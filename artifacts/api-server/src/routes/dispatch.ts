import { Router } from "express";
import { db, ridesTable, usersTable, driverProfilesTable, offersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  getDriverScheduleBlocks,
  getScheduleGaps,
  scheduleFitScore,
  scheduledRideFitScore,
  scoreDriverForRide,
  haversineKm,
} from "../lib/dispatch";

export const dispatchRouter = Router();

/**
 * GET /api/dispatch/active-fits
 * For the logged-in driver: returns all open real-time rides
 * scored and sorted by smart dispatch score.
 * Also includes schedule gap analysis and distance to pickup.
 */
dispatchRouter.get("/active-fits", requireAuth, async (req, res) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== "driver") {
    res.status(403).json({ error: "Apenas motoristas" }); return;
  }

  // Open real-time rides
  const openRides = await db.select().from(ridesTable).where(
    and(
      inArray(ridesTable.status, ["open", "negotiating"]),
      eq(ridesTable.isScheduled, false),
    ),
  );

  // Driver's schedule blocks
  const blocks = await getDriverScheduleBlocks(currentUser.id);

  // Driver's last known position (from most recently updated active ride or their profile)
  const driverUser = await db.select().from(usersTable).where(eq(usersTable.id, currentUser.id)).then(r => r[0]);

  // Get driver's last GPS position from most recent active ride
  const activeRides = await db.select().from(ridesTable).where(
    and(eq(ridesTable.driverId, currentUser.id), inArray(ridesTable.status, ["accepted", "in_progress"])),
  );
  const lastKnownLat = activeRides[0]?.driverLat ?? null;
  const lastKnownLng = activeRides[0]?.driverLng ?? null;

  // Get completed rides count
  const allDriverRides = await db.select({ status: ridesTable.status })
    .from(ridesTable).where(eq(ridesTable.driverId, currentUser.id));
  const completedCount = allDriverRides.filter(r => r.status === "completed").length;

  const scoredRides = await Promise.all(openRides.map(async (ride) => {
    // Build ride passenger info
    const [passenger] = await db.select({ name: usersTable.name, rating: usersTable.rating })
      .from(usersTable).where(eq(usersTable.id, ride.passengerId));

    const offers = await db.select().from(offersTable).where(eq(offersTable.rideId, ride.id));

    // Distance from driver to pickup
    let distanceKm: number | null = null;
    if (lastKnownLat != null && lastKnownLng != null) {
      distanceKm = Math.round(haversineKm(lastKnownLat, lastKnownLng, ride.originLat, ride.originLng) * 10) / 10;
    }

    // Estimated ride duration in minutes
    const rideDurMin = ride.estimatedDuration ? Math.ceil(ride.estimatedDuration / 60) : 30;

    // Schedule fit
    const fit = scheduleFitScore(blocks, rideDurMin);

    // Distance score: 0-100
    const dScore = distanceKm != null ? Math.max(0, Math.round(100 - (distanceKm / 30) * 100)) : 50;
    // Rating score
    const rScore = Math.round((((driverUser?.rating ?? 4.6) - 1) / 4) * 100);
    // Completion rate
    const cScore = driverUser?.totalRides
      ? Math.round((completedCount / driverUser.totalRides) * 100)
      : 70;

    const total = Math.round(
      dScore * 0.35 + rScore * 0.30 + fit.score * 0.25 + cScore * 0.10,
    );

    return {
      ride: {
        ...ride,
        passenger: passenger ?? null,
        offers,
      },
      score: {
        total,
        distance: dScore,
        scheduleFit: fit.score,
        completionRate: cScore,
      },
      distanceKm,
      scheduleFitLabel: fit.label,
      gapMinutes: fit.gapMinutes,
      scheduleFitColor:
        fit.score >= 90 ? "green" :
        fit.score >= 60 ? "yellow" :
        fit.score >= 30 ? "orange" : "red",
    };
  }));

  // Sort by total score desc
  scoredRides.sort((a, b) => b.score.total - a.score.total);

  res.json(scoredRides);
});

/**
 * GET /api/dispatch/schedule-analysis
 * Returns the driver's schedule blocks + free gaps for the next 48h.
 * Used to render the timeline view.
 */
dispatchRouter.get("/schedule-analysis", requireAuth, async (req, res) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== "driver") {
    res.status(403).json({ error: "Apenas motoristas" }); return;
  }

  const blocks = await getDriverScheduleBlocks(currentUser.id);
  const gaps = getScheduleGaps(blocks);

  // Enrich blocks with ride info
  const enrichedBlocks = await Promise.all(blocks.map(async (b) => {
    const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, b.rideId));
    const [passenger] = ride?.passengerId
      ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, ride.passengerId))
      : [null];
    return {
      ...b,
      isScheduled: ride?.isScheduled ?? false,
      passengerName: passenger?.name ?? "Passageiro",
      originAddress: ride?.originAddress ?? "",
      destinationAddress: ride?.destinationAddress ?? "",
      agreedPrice: ride?.agreedPrice ?? ride?.offeredPrice ?? null,
    };
  }));

  res.json({ blocks: enrichedBlocks, gaps });
});

/**
 * GET /api/dispatch/scheduled-fits
 * Returns available scheduled rides (pending_acceptance) scored by
 * how well they fit into the logged-in driver's existing schedule.
 */
dispatchRouter.get("/scheduled-fits", requireAuth, async (req, res) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== "driver") {
    res.status(403).json({ error: "Apenas motoristas" }); return;
  }

  // Fetch pending public + directed-to-me scheduled rides
  const allScheduled = await db.select().from(ridesTable).where(
    and(
      eq(ridesTable.isScheduled, true),
      eq(ridesTable.scheduledStatus, "pending_acceptance"),
    ),
  );

  const visible = allScheduled.filter(r =>
    r.schedulingType === "public" ||
    (r.schedulingType === "directed" && r.directedToDriverId === currentUser.id),
  );

  const blocks = await getDriverScheduleBlocks(currentUser.id);
  const driverUser = await db.select().from(usersTable).where(eq(usersTable.id, currentUser.id)).then(r => r[0]);

  const scored = await Promise.all(visible.map(async (ride) => {
    const [passenger] = await db.select({ name: usersTable.name })
      .from(usersTable).where(eq(usersTable.id, ride.passengerId));

    const durMin = ride.estimatedDuration ? Math.ceil(ride.estimatedDuration / 60) : 60;
    const proposedStart = ride.scheduledFor ? new Date(ride.scheduledFor) : new Date();
    const fit = scheduledRideFitScore(blocks, proposedStart, durMin);

    // Directed rides get a bonus
    const directedBonus = ride.schedulingType === "directed" ? 15 : 0;
    const ratingFactor = Math.round((((driverUser?.rating ?? 4.6) - 1) / 4) * 20);

    const total = Math.min(100, fit.score + directedBonus + ratingFactor);

    return {
      ride: { ...ride, passenger: passenger ?? null },
      score: { total, scheduleFit: fit.score },
      scheduleFitLabel: fit.label,
      scheduleFitColor:
        fit.score >= 80 ? "green" :
        fit.score >= 50 ? "yellow" :
        fit.score > 0 ? "orange" : "red",
      hasConflict: fit.score === 0,
    };
  }));

  // Sort: no conflict first, then by total score
  scored.sort((a, b) => {
    if (a.hasConflict !== b.hasConflict) return a.hasConflict ? 1 : -1;
    return b.score.total - a.score.total;
  });

  res.json(scored);
});
