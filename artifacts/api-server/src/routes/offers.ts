import { Router } from "express";
import { db, usersTable, offersTable, ridesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateOfferBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

export const offersRouter = Router({ mergeParams: true });

offersRouter.get("/", requireAuth, async (req, res) => {
  const rideId = parseInt(String(req.params.rideId));
  if (isNaN(rideId)) { res.status(400).json({ error: "Invalid ride id" }); return; }

  const offers = await db.select().from(offersTable).where(eq(offersTable.rideId, rideId));
  const result = await Promise.all(offers.map(async (offer) => {
    const [d] = await db.select().from(usersTable).where(eq(usersTable.id, offer.driverId));
    const { passwordHash: _, ...s } = d!;
    return { ...offer, driver: { ...s, driverProfile: null } };
  }));
  res.json(result);
});

offersRouter.post("/", requireAuth, async (req, res) => {
  const rideId = parseInt(String(req.params.rideId));
  const currentUser = (req as any).user;

  if (currentUser.role !== "driver") {
    res.status(403).json({ error: "Only drivers can make offers" }); return;
  }

  const parsed = CreateOfferBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }

  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, rideId));
  if (!ride) { res.status(404).json({ error: "Ride not found" }); return; }
  if (ride.status !== "open" && ride.status !== "negotiating") {
    res.status(400).json({ error: "Ride is not accepting offers" }); return;
  }

  const [offer] = await db.insert(offersTable).values({
    rideId,
    driverId: currentUser.id,
    ...parsed.data,
    status: "pending",
  }).returning();

  if (ride.status === "open") {
    await db.update(ridesTable).set({ status: "negotiating" }).where(eq(ridesTable.id, rideId));
  }

  const { passwordHash: _, ...safeUser } = currentUser;
  res.status(201).json({ ...offer, driver: { ...safeUser, driverProfile: null } });
});

offersRouter.patch("/:offerId/accept", requireAuth, async (req, res) => {
  const rideId = parseInt(String(req.params.rideId));
  const offerId = parseInt(String(req.params.offerId));

  const [offer] = await db.select().from(offersTable).where(
    and(eq(offersTable.id, offerId), eq(offersTable.rideId, rideId))
  );
  if (!offer) { res.status(404).json({ error: "Offer not found" }); return; }

  const [accepted] = await db.update(offersTable)
    .set({ status: "accepted" })
    .where(eq(offersTable.id, offerId))
    .returning();

  // Reject other offers for this ride
  await db.update(offersTable)
    .set({ status: "rejected" })
    .where(and(eq(offersTable.rideId, rideId), eq(offersTable.status, "pending")));

  await db.update(ridesTable).set({
    driverId: offer.driverId,
    agreedPrice: offer.price,
    status: "accepted",
  }).where(eq(ridesTable.id, rideId));

  const [driver] = await db.select().from(usersTable).where(eq(usersTable.id, offer.driverId));
  const { passwordHash: _, ...safeDriver } = driver!;
  res.json({ ...accepted, driver: { ...safeDriver, driverProfile: null } });
});

offersRouter.patch("/:offerId/reject", requireAuth, async (req, res) => {
  const rideId = parseInt(String(req.params.rideId));
  const offerId = parseInt(String(req.params.offerId));

  const [rejected] = await db.update(offersTable)
    .set({ status: "rejected" })
    .where(and(eq(offersTable.id, offerId), eq(offersTable.rideId, rideId)))
    .returning();

  if (!rejected) { res.status(404).json({ error: "Offer not found" }); return; }

  const [driver] = await db.select().from(usersTable).where(eq(usersTable.id, rejected.driverId));
  const { passwordHash: _, ...safeDriver } = driver!;
  res.json({ ...rejected, driver: { ...safeDriver, driverProfile: null } });
});
