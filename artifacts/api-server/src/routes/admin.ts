import { Router } from "express";
import { db, usersTable, ridesTable, driverProfilesTable, activityLogTable, offersTable, rideFeedbacksTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

export const adminRouter = Router();

adminRouter.get("/stats", requireAdmin, async (req, res) => {
  const users = await db.select().from(usersTable);
  const rides = await db.select().from(ridesTable);
  const drivers = await db.select().from(driverProfilesTable);

  const totalPassengers = users.filter(u => u.role === "passenger").length;
  const totalDrivers = users.filter(u => u.role === "driver").length;
  const pendingDrivers = drivers.filter(d => d.status === "pending").length;
  const pendingAccounts = users.filter(u => u.accountStatus === "pending" && u.role !== "admin").length;
  const approvedDrivers = drivers.filter(d => d.status === "approved").length;
  const deniedDrivers = drivers.filter(d => d.status === "denied").length;
  const totalRides = rides.length;
  const activeRides = rides.filter(r => ["open", "negotiating", "accepted", "in_progress"].includes(r.status)).length;
  const completedRides = rides.filter(r => r.status === "completed").length;
  const cancelledRides = rides.filter(r => r.status === "cancelled").length;
  const totalRevenue = rides
    .filter(r => r.status === "completed" && r.agreedPrice)
    .reduce((sum, r) => sum + (r.agreedPrice ?? 0), 0);

  res.json({
    totalPassengers,
    totalDrivers,
    pendingDrivers,
    pendingAccounts,
    approvedDrivers,
    deniedDrivers,
    totalRides,
    activeRides,
    completedRides,
    cancelledRides,
    totalRevenue,
  });
});

adminRouter.get("/recent-activity", requireAdmin, async (req, res) => {
  const activities = await db.select().from(activityLogTable)
    .orderBy(activityLogTable.createdAt)
    .limit(50);
  res.json(activities.reverse());
});

adminRouter.get("/scheduled-rides", requireAdmin, async (req, res) => {
  const { scheduledStatus, schedulingType } = req.query as Record<string, string | undefined>;

  let rides = await db.select().from(ridesTable).where(eq(ridesTable.isScheduled, true));
  if (scheduledStatus) rides = rides.filter(r => r.scheduledStatus === scheduledStatus);
  if (schedulingType) rides = rides.filter(r => r.schedulingType === schedulingType);

  rides.sort((a, b) => {
    const ta = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
    const tb = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
    return ta - tb;
  });

  const result = await Promise.all(rides.map(async (ride) => {
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
    const { passwordHash: _, ...safePassenger } = passenger!;
    return { ...ride, passenger: { ...safePassenger, driverProfile: null }, driver, offers };
  }));

  res.json(result);
});

adminRouter.patch("/scheduled-rides/:id/cancel", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const { reason } = req.body ?? {};
  const [updated] = await db.update(ridesTable)
    .set({
      status: "cancelled",
      scheduledStatus: "cancelled",
      cancelReason: reason ?? "Cancelado pelo administrador",
    })
    .where(and(eq(ridesTable.id, id), eq(ridesTable.isScheduled, true)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Scheduled ride not found" }); return; }
  res.json(updated);
});

adminRouter.patch("/scheduled-rides/:id/reassign", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const { driverId } = req.body ?? {};
  if (!driverId || typeof driverId !== "number") {
    res.status(400).json({ error: "driverId required" }); return;
  }
  const [updated] = await db.update(ridesTable)
    .set({ driverId, directedToDriverId: driverId, schedulingType: "directed", scheduledStatus: "pending_acceptance", status: "open" })
    .where(and(eq(ridesTable.id, id), eq(ridesTable.isScheduled, true)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Scheduled ride not found" }); return; }
  res.json(updated);
});

// GET /admin/feedbacks — all ride feedbacks with reviewer/reviewee info
adminRouter.get("/feedbacks", requireAdmin, async (req, res) => {
  const feedbacks = await db.select().from(rideFeedbacksTable).orderBy(desc(rideFeedbacksTable.createdAt));

  const result = await Promise.all(feedbacks.map(async (fb) => {
    const [reviewer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, fb.reviewerId));
    const [reviewee] = await db.select({ name: usersTable.name, isSuspended: usersTable.isSuspended }).from(usersTable).where(eq(usersTable.id, fb.revieweeId));
    return {
      ...fb,
      reviewerName: reviewer?.name ?? "Desconhecido",
      revieweeName: reviewee?.name ?? "Desconhecido",
      revieweeSuspended: reviewee?.isSuspended ?? false,
    };
  }));

  res.json(result);
});

// PATCH /admin/users/:id/suspend — suspend or unsuspend a user
adminRouter.patch("/users/:id/suspend", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const { suspended, reason } = req.body ?? {};

  if (typeof suspended !== "boolean") {
    res.status(400).json({ error: "suspended (boolean) required" }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [updated] = await db.update(usersTable).set({
    isSuspended: suspended,
    suspendedReason: suspended ? (reason ?? "Suspenso pelo administrador") : null,
  }).where(eq(usersTable.id, id)).returning();

  await db.insert(activityLogTable).values({
    type: suspended ? "driver_denied" : "driver_approved",
    description: `Usuário ${user.name} ${suspended ? "suspenso" : "reativado"} pelo administrador${reason ? `: ${reason}` : ""}`,
    userId: id,
    userName: user.name,
  });

  res.json({ ok: true, user: updated });
});
