import { Router } from "express";
import { db, usersTable, ridesTable, driverProfilesTable, activityLogTable, offersTable } from "@workspace/db";
import { eq, count, sum } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

export const adminRouter = Router();

adminRouter.get("/stats", requireAdmin, async (req, res) => {
  const users = await db.select().from(usersTable);
  const rides = await db.select().from(ridesTable);
  const drivers = await db.select().from(driverProfilesTable);

  const totalPassengers = users.filter(u => u.role === "passenger").length;
  const totalDrivers = users.filter(u => u.role === "driver").length;
  const pendingDrivers = drivers.filter(d => d.status === "pending").length;
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
  // Return most recent first
  res.json(activities.reverse());
});
