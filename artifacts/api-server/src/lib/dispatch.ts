import { db, ridesTable, usersTable, driverProfilesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

const SCHEDULE_BUFFER_MS = 15 * 60 * 1000;
const SCORE_WEIGHTS = { distance: 0.35, rating: 0.30, scheduleFit: 0.25, completionRate: 0.10 };

/** Haversine distance in km between two lat/lng pairs */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 0-100 distance score: 100 = ≤1 km, 0 = ≥30 km */
function distanceScore(km: number): number {
  return Math.max(0, Math.round(100 - (km / 30) * 100));
}

/** 0-100 rating score from a 1-5 star average */
function ratingScore(stars: number): number {
  return Math.round(((stars - 1) / 4) * 100);
}

/** 0-100 completion rate score */
function completionRateScore(completed: number, total: number): number {
  if (total === 0) return 70; // unknown — neutral
  return Math.round((completed / total) * 100);
}

export interface ScheduledBlock {
  rideId: number;
  startsAt: Date;
  endsAt: Date;         // scheduledFor + estimatedDuration + buffer
  endsAtNoBuffer: Date; // scheduledFor + estimatedDuration (raw end)
  durationMin: number;
}

export interface ScheduleGap {
  startsAt: Date;
  endsAt: Date;
  durationMin: number;
  label: "large" | "medium" | "small" | "tiny";
}

/** Build the list of time blocks a driver is committed to (next 48h) */
export async function getDriverScheduleBlocks(driverId: number): Promise<ScheduledBlock[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const rides = await db.select().from(ridesTable).where(
    and(
      eq(ridesTable.driverId, driverId),
      inArray(ridesTable.status, ["accepted", "in_progress"]),
    ),
  );

  const blocks: ScheduledBlock[] = [];

  for (const r of rides) {
    if (r.isScheduled && r.scheduledFor) {
      const start = new Date(r.scheduledFor);
      if (start > horizon) continue;
      const durMs = r.estimatedDuration ? r.estimatedDuration * 1000 : 60 * 60 * 1000;
      const rawEnd = new Date(start.getTime() + durMs);
      const bufferedEnd = new Date(rawEnd.getTime() + SCHEDULE_BUFFER_MS);
      blocks.push({ rideId: r.id, startsAt: start, endsAt: bufferedEnd, endsAtNoBuffer: rawEnd, durationMin: Math.round(durMs / 60000) });
    } else if (!r.isScheduled && (r.status === "accepted" || r.status === "in_progress")) {
      // Active real-time ride: treat it as ending now + estimated remaining duration
      const start = r.startedAt ?? now;
      const durMs = r.estimatedDuration ? r.estimatedDuration * 1000 : 60 * 60 * 1000;
      const rawEnd = new Date(start.getTime() + durMs);
      const end = rawEnd < now ? new Date(now.getTime() + 5 * 60 * 1000) : rawEnd;
      const bufferedEnd = new Date(end.getTime() + SCHEDULE_BUFFER_MS);
      blocks.push({ rideId: r.id, startsAt: start, endsAt: bufferedEnd, endsAtNoBuffer: end, durationMin: Math.round(durMs / 60000) });
    }
  }

  // Sort ascending
  blocks.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return blocks;
}

/** Gaps between schedule blocks (and from now until first block) */
export function getScheduleGaps(blocks: ScheduledBlock[], fromNow = new Date()): ScheduleGap[] {
  const gaps: ScheduleGap[] = [];
  let cursor = fromNow;

  for (const block of blocks) {
    const gapStart = cursor;
    const gapEnd = block.startsAt;
    const gapMin = Math.round((gapEnd.getTime() - gapStart.getTime()) / 60000);
    if (gapMin > 0) {
      gaps.push({ startsAt: gapStart, endsAt: gapEnd, durationMin: gapMin, label: gapLabel(gapMin) });
    }
    cursor = block.endsAt;
  }

  // Gap after last block (2h window)
  const afterMin = 120;
  gaps.push({
    startsAt: cursor,
    endsAt: new Date(cursor.getTime() + afterMin * 60 * 1000),
    durationMin: afterMin,
    label: "large",
  });

  return gaps;
}

function gapLabel(min: number): ScheduleGap["label"] {
  if (min >= 120) return "large";
  if (min >= 60) return "medium";
  if (min >= 20) return "small";
  return "tiny";
}

/**
 * Evaluate how well a real-time ride fits into a driver's current schedule.
 * Returns 0-100 and a human-readable reason.
 */
export function scheduleFitScore(
  blocks: ScheduledBlock[],
  rideDurationMin: number,
  fromNow = new Date(),
): { score: number; label: string; gapMinutes: number | null } {
  const rideNeeds = rideDurationMin + 15; // +15 min buffer

  if (blocks.length === 0) {
    return { score: 80, label: "Livre", gapMinutes: null };
  }

  // Find first future block
  const nextBlock = blocks.find(b => b.startsAt > fromNow);
  if (!nextBlock) {
    return { score: 80, label: "Livre", gapMinutes: null };
  }

  const gapMin = Math.round((nextBlock.startsAt.getTime() - fromNow.getTime()) / 60000);

  if (gapMin >= rideNeeds + 30) {
    return { score: 100, label: "Encaixe perfeito", gapMinutes: gapMin };
  }
  if (gapMin >= rideNeeds) {
    return { score: 65, label: "Encaixe justo", gapMinutes: gapMin };
  }
  if (gapMin >= rideNeeds / 2) {
    return { score: 30, label: "Pode atrasar agendamento", gapMinutes: gapMin };
  }
  return { score: 0, label: "Conflito de agenda", gapMinutes: gapMin };
}

/**
 * Evaluate how well a SCHEDULED ride fits into a driver's existing schedule.
 */
export function scheduledRideFitScore(
  blocks: ScheduledBlock[],
  proposedStart: Date,
  durationMin: number,
): { score: number; label: string } {
  const proposedEnd = new Date(proposedStart.getTime() + durationMin * 60 * 1000);
  const bufferedStart = new Date(proposedStart.getTime() - SCHEDULE_BUFFER_MS);
  const bufferedEnd = new Date(proposedEnd.getTime() + SCHEDULE_BUFFER_MS);

  // Check for conflicts
  for (const block of blocks) {
    const overlaps = bufferedStart < block.endsAt && bufferedEnd > block.startsAt;
    if (overlaps) return { score: 0, label: "Conflito" };
  }

  // No conflict — measure how much free space surrounds it
  const before = blocks.find(b => b.endsAt <= proposedStart);
  const after = blocks.find(b => b.startsAt >= proposedEnd);

  const gapBefore = before
    ? Math.round((proposedStart.getTime() - before.endsAt.getTime()) / 60000)
    : 999;
  const gapAfter = after
    ? Math.round((after.startsAt.getTime() - proposedEnd.getTime()) / 60000)
    : 999;

  const minGap = Math.min(gapBefore, gapAfter);

  if (minGap >= 60) return { score: 100, label: "Encaixe ideal" };
  if (minGap >= 30) return { score: 80, label: "Bom encaixe" };
  if (minGap >= 15) return { score: 55, label: "Encaixe justo" };
  return { score: 35, label: "Encaixe apertado" };
}

export interface DriverRideScore {
  driverId: number;
  distanceKm: number;
  rating: number;
  scores: {
    distance: number;
    rating: number;
    scheduleFit: number;
    completionRate: number;
    total: number;
  };
  scheduleFitLabel: string;
  gapMinutes: number | null;
}

/**
 * Score a single driver against a real-time ride.
 */
export async function scoreDriverForRide(
  driver: { id: number; rating: number | null; totalRides: number; driverLat?: number | null; driverLng?: number | null },
  rideOriginLat: number,
  rideOriginLng: number,
  estimatedDurationMin: number,
): Promise<DriverRideScore> {
  const blocks = await getDriverScheduleBlocks(driver.id);

  // Distance — use last known location if available, otherwise no distance known
  let distKm = 999;
  if (driver.driverLat != null && driver.driverLng != null) {
    distKm = haversineKm(driver.driverLat, driver.driverLng, rideOriginLat, rideOriginLng);
  }

  const fit = scheduleFitScore(blocks, estimatedDurationMin);

  // Completed rides — query
  const allRides = await db.select({ status: ridesTable.status })
    .from(ridesTable)
    .where(eq(ridesTable.driverId, driver.id));
  const completed = allRides.filter(r => r.status === "completed").length;

  const ds = distanceScore(distKm);
  const rs = ratingScore(driver.rating ?? 4.6);
  const fs = fit.score;
  const cs = completionRateScore(completed, driver.totalRides);

  const total = Math.round(
    ds * SCORE_WEIGHTS.distance +
    rs * SCORE_WEIGHTS.rating +
    fs * SCORE_WEIGHTS.scheduleFit +
    cs * SCORE_WEIGHTS.completionRate,
  );

  return {
    driverId: driver.id,
    distanceKm: Math.round(distKm * 10) / 10,
    rating: driver.rating ?? 4.6,
    scores: { distance: ds, rating: rs, scheduleFit: fs, completionRate: cs, total },
    scheduleFitLabel: fit.label,
    gapMinutes: fit.gapMinutes,
  };
}
