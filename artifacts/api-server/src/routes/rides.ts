import { Router } from "express";
import { db, usersTable, ridesTable, offersTable, activityLogTable, messagesTable, driverProfilesTable } from "@workspace/db";
import { eq, or, and, not, inArray } from "drizzle-orm";
import { CreateRideBody, ListRidesQueryParams, UpdateRideStatusBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { hasSchedulingConflict, computeAvailability } from "../lib/scheduling";
import { sendRideScheduledConfirmation, sendRideConfirmedByDriver, sendAsync } from "../lib/whatsapp";

export const ridesRouter = Router();

export async function buildRide(ride: typeof ridesTable.$inferSelect) {
  const [passenger] = await db.select().from(usersTable).where(eq(usersTable.id, ride.passengerId));
  let driver = null;
  if (ride.driverId) {
    const [d] = await db.select().from(usersTable).where(eq(usersTable.id, ride.driverId));
    if (d) {
      const { passwordHash: _, ...s } = d;
      const [dp] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, d.id));
      driver = { ...s, driverProfile: dp ?? null };
    }
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

  // Non-admins only see non-scheduled or their own scheduled rides
  if (currentUser.role !== "admin") {
    if (currentUser.role === "passenger") {
      rides = rides.filter(r => r.passengerId === currentUser.id);
    } else if (currentUser.role === "driver") {
      rides = rides.filter(r => r.driverId === currentUser.id || r.status === "open");
    }
  }

  // Exclude scheduled rides from the normal list (they have their own endpoint)
  rides = rides.filter(r => !r.isScheduled || r.driverId === currentUser.id);

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

  const data = parsed.data;

  // Handle scheduled rides
  if (data.isScheduled) {
    if (!data.scheduledFor) {
      res.status(400).json({ error: "scheduledFor is required for scheduled rides" }); return;
    }
    const scheduledDate = new Date(data.scheduledFor as any);
    if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      res.status(400).json({ error: "scheduledFor must be a future date" }); return;
    }
    if (!data.schedulingType) {
      res.status(400).json({ error: "schedulingType is required for scheduled rides" }); return;
    }
    if (data.schedulingType === "directed" && !data.directedToDriverId) {
      res.status(400).json({ error: "directedToDriverId is required for directed scheduled rides" }); return;
    }

    const [ride] = await db.insert(ridesTable).values({
      passengerId: currentUser.id,
      ...data,
      scheduledFor: scheduledDate,
      status: "open",
      scheduledStatus: "pending_acceptance",
      isScheduled: true,
    }).returning();

    await db.insert(activityLogTable).values({
      type: "ride_scheduled",
      description: `Corrida agendada #${ride.id} criada por ${currentUser.name} para ${scheduledDate.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      userId: currentUser.id,
      userName: currentUser.name,
    });

    // Notifica o passageiro (best-effort)
    sendAsync(
      () => sendRideScheduledConfirmation({
        passenger: { name: currentUser.name, phone: currentUser.phone },
        scheduledFor: scheduledDate,
        originAddress: data.originAddress,
        destinationAddress: data.destinationAddress,
        offeredPrice: data.offeredPrice,
        rideId: ride.id,
        note: (data as any).scheduledNote ?? null,
      }),
      { event: "ride_scheduled", rideId: ride.id },
    );

    res.status(201).json(await buildRide(ride));
    return;
  }

  const [ride] = await db.insert(ridesTable).values({
    passengerId: currentUser.id,
    ...data,
    status: "open",
    isScheduled: false,
  }).returning();

  res.status(201).json(await buildRide(ride));
});

// Get scheduled rides visible to current driver
ridesRouter.get("/scheduled", requireAuth, async (req, res) => {
  const currentUser = (req as any).user;

  let rides: (typeof ridesTable.$inferSelect)[] = [];

  if (currentUser.role === "admin") {
    // Admin sees all scheduled rides
    rides = await db.select().from(ridesTable).where(eq(ridesTable.isScheduled, true));
  } else if (currentUser.role === "driver") {
    // Driver sees: public pending rides + rides directed to them
    const all = await db.select().from(ridesTable).where(eq(ridesTable.isScheduled, true));
    rides = all.filter(r =>
      (r.schedulingType === "public" && r.scheduledStatus === "pending_acceptance") ||
      (r.schedulingType === "directed" && r.directedToDriverId === currentUser.id &&
        r.scheduledStatus === "pending_acceptance") ||
      (r.driverId === currentUser.id) // rides they've already accepted
    );
  } else if (currentUser.role === "passenger") {
    // Passenger sees their own scheduled rides
    rides = await db.select().from(ridesTable).where(
      and(eq(ridesTable.isScheduled, true), eq(ridesTable.passengerId, currentUser.id))
    );
  }

  // Sort by scheduledFor ascending
  rides.sort((a, b) => {
    const ta = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
    const tb = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
    return ta - tb;
  });

  const result = await Promise.all(rides.map(buildRide));
  res.json(result);
});

// GET /rides/availability?date=YYYY-MM-DD&duration=N (minutes)
// Returns 30-min time slots for the day with available driver counts.
ridesRouter.get("/availability", requireAuth, async (req, res) => {
  const { date, duration } = req.query as { date?: string; duration?: string };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date required in YYYY-MM-DD format" }); return;
  }
  const durationMin = parseInt(duration ?? "60");
  if (isNaN(durationMin) || durationMin < 5) {
    res.status(400).json({ error: "duration must be >= 5 minutes" }); return;
  }

  res.json(await computeAvailability(date, durationMin));
});

ridesRouter.get("/active", requireAuth, async (req, res) => {
  const rides = await db.select().from(ridesTable)
    .where(
      and(
        or(eq(ridesTable.status, "open"), eq(ridesTable.status, "negotiating")),
        eq(ridesTable.isScheduled, false)
      )
    );
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
    const [reopened] = await db.update(ridesTable)
      .set({
        status: "open",
        driverId: null,
        agreedPrice: null,
        driverLat: null,
        driverLng: null,
        cancelReason: null,
        startedAt: null,
        ...(ride.isScheduled ? { scheduledStatus: "pending_acceptance" } : {}),
      })
      .where(eq(ridesTable.id, id))
      .returning();
    updated = reopened;

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

  const [cancelled] = await db.update(ridesTable)
    .set({
      status: "cancelled",
      cancelReason: reason ?? "Cancelado pelo usuário",
      ...(ride.isScheduled ? { scheduledStatus: "cancelled" } : {}),
    })
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

// Driver accepts a scheduled ride
ridesRouter.patch("/:id/accept-scheduled", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const currentUser = (req as any).user;

  if (currentUser.role !== "driver") {
    res.status(403).json({ error: "Only drivers can accept scheduled rides" }); return;
  }

  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, id));
  if (!ride) { res.status(404).json({ error: "Ride not found" }); return; }
  if (!ride.isScheduled) { res.status(400).json({ error: "This is not a scheduled ride" }); return; }
  if (ride.scheduledStatus !== "pending_acceptance") {
    res.status(409).json({ error: "This scheduled ride is no longer available" }); return;
  }
  if (ride.schedulingType === "directed" && ride.directedToDriverId !== currentUser.id) {
    res.status(403).json({ error: "This ride is directed to a different driver" }); return;
  }

  // Check for scheduling conflicts
  if (ride.scheduledFor) {
    const durMin = ride.estimatedDuration ? Math.ceil(ride.estimatedDuration / 60) : 60;
    const { conflict, conflictingRide } = await hasSchedulingConflict(currentUser.id, new Date(ride.scheduledFor), durMin);
    if (conflict) {
      res.status(409).json({
        error: "Você já tem uma corrida agendada nesse horário. Verifique sua agenda.",
        conflictingRideId: conflictingRide?.id,
      }); return;
    }
  }

  // Atomic update: only succeeds if scheduledStatus is still 'pending_acceptance'.
  // This prevents two drivers from simultaneously accepting the same public ride.
  const [updated] = await db.update(ridesTable)
    .set({
      driverId: currentUser.id,
      scheduledStatus: "confirmed",
      status: "accepted",
    })
    .where(and(
      eq(ridesTable.id, id),
      eq(ridesTable.scheduledStatus, "pending_acceptance")
    ))
    .returning();

  if (!updated) {
    res.status(409).json({ error: "Esta corrida já foi aceita por outro motorista" }); return;
  }

  await db.insert(activityLogTable).values({
    type: "ride_scheduled",
    description: `Agendamento #${id} aceito pelo motorista ${currentUser.name} para ${ride.scheduledFor ? new Date(ride.scheduledFor).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "?"}`,
    userId: currentUser.id,
    userName: currentUser.name,
  });

  // Notifica o passageiro que o motorista confirmou (best-effort)
  const [passengerUser] = await db.select().from(usersTable).where(eq(usersTable.id, ride.passengerId));
  if (passengerUser && ride.scheduledFor) {
    sendAsync(
      () => sendRideConfirmedByDriver({
        passenger: { name: passengerUser.name, phone: passengerUser.phone },
        driver: { name: currentUser.name, phone: currentUser.phone },
        scheduledFor: new Date(ride.scheduledFor!),
        originAddress: ride.originAddress,
        destinationAddress: ride.destinationAddress,
        rideId: ride.id,
      }),
      { event: "ride_confirmed_by_driver", rideId: ride.id },
    );
  }

  res.json(await buildRide(updated));
});

// Driver declines a scheduled ride
ridesRouter.patch("/:id/decline-scheduled", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const currentUser = (req as any).user;
  const { reason } = req.body ?? {};

  if (currentUser.role !== "driver") {
    res.status(403).json({ error: "Only drivers can decline scheduled rides" }); return;
  }

  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, id));
  if (!ride) { res.status(404).json({ error: "Ride not found" }); return; }
  if (!ride.isScheduled) { res.status(400).json({ error: "This is not a scheduled ride" }); return; }

  // Authorization: directed rides can only be declined by the intended/assigned driver
  if (ride.schedulingType === "directed") {
    const isIntendedDriver = ride.directedToDriverId === currentUser.id || ride.driverId === currentUser.id;
    if (!isIntendedDriver) {
      res.status(403).json({ error: "You can only decline rides directed to you" }); return;
    }
  }

  // For directed rides: mark as declined so it can be re-broadcast or admin handles it
  // For public rides: just ignore (driver declines but ride stays available for others)
  if (ride.schedulingType === "directed") {
    const [updated] = await db.update(ridesTable)
      .set({
        scheduledStatus: "driver_declined",
        cancelReason: reason ?? "Motorista recusou o agendamento",
      })
      .where(eq(ridesTable.id, id))
      .returning();
    res.json(await buildRide(updated));
  } else {
    // Public ride: driver just skips it, ride stays open for others
    res.json(await buildRide(ride));
  }
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
