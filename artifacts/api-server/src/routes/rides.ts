import { Router } from "express";
import { db, usersTable, ridesTable, offersTable, activityLogTable, messagesTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { CreateRideBody, ListRidesQueryParams, UpdateRideStatusBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

export const ridesRouter = Router();

async function buildRide(ride: typeof ridesTable.$inferSelect) {
  const [passenger] = await db.select().from(usersTable).where(eq(usersTable.id, ride.passengerId));
  let driver = null;
  if (ride.driverId) {
    const [d] = await db.select().from(usersTable).where(eq(usersTable.id, ride.driverId));
    if (d) { const { passwordHash: _, ...s } = d; driver = { ...s, driverProfile: null }; }
  }
  const offers = await db.select().from(offersTable).where(eq(offersTable.rideId, ride.id));
  const offersWithDrivers = await Promise.all(offers.map(async (offer) => {
    const [d] = await db.select().from(usersTable).where(eq(usersTable.id, offer.driverId));
    const { passwordHash: _, ...s } = d!;
    return { ...offer, driver: { ...s, driverProfile: null } };
  }));
  const { passwordHash: _, ...safePassenger } = passenger!;
  return { ...ride, passenger: { ...safePassenger, driverProfile: null }, driver, offers: offersWithDrivers };
}

ridesRouter.get("/", requireAuth, async (req, res) => {
  const currentUser = (req as any).user;
  const parsed = ListRidesQueryParams.safeParse(req.query);
  const { status, passengerId, driverId } = parsed.success ? parsed.data : {};

  let rides = await db.select().from(ridesTable);

  if (currentUser.role !== "admin") {
    if (currentUser.role === "passenger") {
      rides = rides.filter(r => r.passengerId === currentUser.id);
    } else if (currentUser.role === "driver") {
      rides = rides.filter(r => r.driverId === currentUser.id || r.status === "open");
    }
  }

  if (status) rides = rides.filter(r => r.status === status);
  if (passengerId) rides = rides.filter(r => r.passengerId === passengerId);
  if (driverId) rides = rides.filter(r => r.driverId === driverId);

  const result = await Promise.all(rides.map(buildRide));
  res.json(result);
});

ridesRouter.post("/", requireAuth, async (req, res) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== "passenger" && currentUser.role !== "admin") {
    res.status(403).json({ error: "Only passengers can create ride requests" }); return;
  }

  const parsed = CreateRideBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error", details: parsed.error.issues }); return; }

  const [ride] = await db.insert(ridesTable).values({
    passengerId: currentUser.id,
    ...parsed.data,
    status: "open",
  }).returning();

  res.status(201).json(await buildRide(ride));
});

ridesRouter.get("/active", requireAuth, async (req, res) => {
  const rides = await db.select().from(ridesTable)
    .where(or(eq(ridesTable.status, "open"), eq(ridesTable.status, "negotiating")));
  const result = await Promise.all(rides.map(buildRide));
  res.json(result);
});

ridesRouter.get("/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, id));
  if (!ride) { res.status(404).json({ error: "Ride not found" }); return; }

  res.json(await buildRide(ride));
});

ridesRouter.patch("/:id/status", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const currentUser = (req as any).user;
  const parsed = UpdateRideStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }

  const { status, cancelReason } = parsed.data;
  const updateData: Record<string, any> = { status };
  if (status === "in_progress") updateData.startedAt = new Date();
  if (status === "completed") {
    updateData.completedAt = new Date();
    await db.insert(activityLogTable).values({
      type: "ride_completed",
      description: `Corrida #${id} finalizada`,
      userId: currentUser.id,
      userName: currentUser.name,
    });
  }
  if (status === "cancelled") {
    updateData.cancelReason = cancelReason ?? null;
    await db.insert(activityLogTable).values({
      type: "ride_cancelled",
      description: `Corrida #${id} cancelada`,
      userId: currentUser.id,
      userName: currentUser.name,
    });
  }

  const [updated] = await db.update(ridesTable).set(updateData).where(eq(ridesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Ride not found" }); return; }

  res.json(await buildRide(updated));
});

ridesRouter.patch("/:id/cancel", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const currentUser = (req as any).user;
  const { reason } = req.body ?? {};

  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, id));
  if (!ride) { res.status(404).json({ error: "Ride not found" }); return; }

  const isDriver = currentUser.role === "driver" || (currentUser.role === "admin" && ride.driverId === currentUser.id);
  const driverCancellingAccepted = isDriver && (ride.status === "accepted" || ride.status === "in_progress");

  let updated: typeof ridesTable.$inferSelect;

  if (driverCancellingAccepted) {
    // Driver cancelled an active ride — reopen it for new drivers
    const [reopened] = await db.update(ridesTable)
      .set({
        status: "open",
        driverId: null,
        agreedPrice: null,
        driverLat: null,
        driverLng: null,
        cancelReason: null,
        startedAt: null,
      })
      .where(eq(ridesTable.id, id))
      .returning();
    updated = reopened;

    // Reject all existing offers so drivers bid fresh
    await db.update(offersTable)
      .set({ status: "rejected" })
      .where(eq(offersTable.rideId, id));

    await db.insert(activityLogTable).values({
      type: "ride_cancelled",
      description: `Corrida #${id} reaberta — motorista ${currentUser.name} cancelou${reason ? `: ${reason}` : ""}`,
      userId: currentUser.id,
      userName: currentUser.name,
    });

    res.json({ ...(await buildRide(updated)), driverCancelled: true });
    return;
  }

  // Passenger (or non-driver) cancelling — mark as cancelled normally
  const [cancelled] = await db.update(ridesTable)
    .set({ status: "cancelled", cancelReason: reason ?? "Cancelado pelo usuário" })
    .where(eq(ridesTable.id, id))
    .returning();

  if (!cancelled) { res.status(404).json({ error: "Ride not found" }); return; }

  await db.insert(activityLogTable).values({
    type: "ride_cancelled",
    description: `Corrida #${id} cancelada por ${currentUser.name}${reason ? `: ${reason}` : ""}`,
    userId: currentUser.id,
    userName: currentUser.name,
  });

  res.json(await buildRide(cancelled));
});

// Driver broadcasts their GPS position
ridesRouter.patch("/:id/location", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const { lat, lng } = req.body ?? {};
  if (typeof lat !== "number" || typeof lng !== "number") {
    res.status(400).json({ error: "lat and lng required" }); return;
  }
  const [updated] = await db.update(ridesTable)
    .set({ driverLat: lat, driverLng: lng })
    .where(eq(ridesTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Ride not found" }); return; }
  res.json({ ok: true });
});

// Passenger broadcasts their GPS position
ridesRouter.patch("/:id/passenger-location", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const { lat, lng } = req.body ?? {};
  if (typeof lat !== "number" || typeof lng !== "number") {
    res.status(400).json({ error: "lat and lng required" }); return;
  }
  const [updated] = await db.update(ridesTable)
    .set({ passengerLat: lat, passengerLng: lng })
    .where(eq(ridesTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Ride not found" }); return; }
  res.json({ ok: true });
});

// Get messages for a ride
ridesRouter.get("/:id/messages", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.rideId, id));
  res.json(msgs);
});

// Send a message
ridesRouter.post("/:id/messages", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const currentUser = (req as any).user;
  const { content } = req.body ?? {};
  if (!content || typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "content required" }); return;
  }
  const [msg] = await db.insert(messagesTable).values({
    rideId: id,
    senderId: currentUser.id,
    senderName: currentUser.name,
    content: content.trim(),
  }).returning();
  res.status(201).json(msg);
});
