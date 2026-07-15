import { db, ridesTable, driverProfilesTable } from "@workspace/db";
import { eq, and, or, inArray } from "drizzle-orm";

export const SCHEDULE_BUFFER_MS = 15 * 60 * 1000; // 15 min buffer between rides

/**
 * Check if a driver has a conflicting scheduled/accepted ride at the given time window.
 * Returns true if there is a conflict (driver is unavailable).
 */
export async function hasSchedulingConflict(
  driverId: number,
  proposedStart: Date,
  estimatedDurationMinutes: number
): Promise<{ conflict: boolean; conflictingRide?: any }> {
  const proposedEnd = new Date(proposedStart.getTime() + estimatedDurationMinutes * 60 * 1000);
  const windowStart = new Date(proposedStart.getTime() - SCHEDULE_BUFFER_MS);
  const windowEnd = new Date(proposedEnd.getTime() + SCHEDULE_BUFFER_MS);

  const driverRides = await db.select().from(ridesTable).where(
    and(
      eq(ridesTable.driverId, driverId),
      inArray(ridesTable.status, ["accepted", "in_progress", "open", "negotiating"])
    )
  );

  for (const r of driverRides) {
    if (r.isScheduled && r.scheduledFor) {
      const rideStart = new Date(r.scheduledFor);
      const durMin = r.estimatedDuration ? Math.ceil(r.estimatedDuration / 60) : 60;
      const rideEnd = new Date(rideStart.getTime() + durMin * 60 * 1000);
      if (windowStart < rideEnd && windowEnd > rideStart) {
        return { conflict: true, conflictingRide: r };
      }
    } else if (!r.isScheduled) {
      const durMin = r.estimatedDuration ? Math.ceil(r.estimatedDuration / 60) : 60;
      const rideStart = new Date();
      const rideEnd = new Date(rideStart.getTime() + durMin * 60 * 1000);
      if (windowStart < rideEnd && windowEnd > rideStart) {
        return { conflict: true, conflictingRide: r };
      }
    }
  }

  return { conflict: false };
}

export interface AvailabilitySlot {
  time: string;
  datetime: string;
  available: boolean;
  driverCount: number;
  totalDrivers: number;
}

/**
 * Computes 30-min availability slots for a given date, based on live driver
 * approval status and confirmed/active scheduled rides. Always computed fresh
 * from the database — there is no cached/synced copy anywhere.
 */
export async function computeAvailability(
  date: string,
  durationMin: number
): Promise<{ date: string; duration: number; totalDrivers: number; slots: AvailabilitySlot[] }> {
  const approvedDrivers = await db.select()
    .from(driverProfilesTable)
    .where(eq(driverProfilesTable.status, "approved"));
  const totalDrivers = approvedDrivers.length;
  const approvedDriverIds = new Set(approvedDrivers.map(d => d.userId));

  const confirmedRides = await db.select().from(ridesTable).where(
    and(
      eq(ridesTable.isScheduled, true),
      or(
        eq(ridesTable.scheduledStatus, "confirmed"),
        inArray(ridesTable.status, ["accepted", "in_progress"])
      )
    )
  );

  const [year, month, day] = date.split("-").map(Number);

  const slots: AvailabilitySlot[] = [];

  for (let hour = 5; hour <= 23; hour++) {
    for (let minuteOffset = 0; minuteOffset < 60; minuteOffset += 30) {
      if (hour === 23 && minuteOffset > 30) break;

      const slotStart = new Date(year, month - 1, day, hour, minuteOffset, 0);
      if (slotStart <= new Date()) continue;

      const slotEnd = new Date(slotStart.getTime() + durationMin * 60 * 1000);
      const windowStart = new Date(slotStart.getTime() - SCHEDULE_BUFFER_MS);
      const windowEnd = new Date(slotEnd.getTime() + SCHEDULE_BUFFER_MS);

      const busyDriverIds = new Set<number>();
      for (const ride of confirmedRides) {
        if (!ride.driverId || !ride.scheduledFor) continue;
        if (!approvedDriverIds.has(ride.driverId)) continue;
        const rideStart = new Date(ride.scheduledFor);
        const rideDurMin = ride.estimatedDuration ? Math.ceil(ride.estimatedDuration / 60) : 60;
        const rideEnd = new Date(rideStart.getTime() + rideDurMin * 60 * 1000);
        if (windowStart < rideEnd && windowEnd > rideStart) {
          busyDriverIds.add(ride.driverId);
        }
      }

      const availableCount = totalDrivers - busyDriverIds.size;
      const pad = (n: number) => String(n).padStart(2, "0");

      slots.push({
        time: `${pad(hour)}:${pad(minuteOffset)}`,
        datetime: slotStart.toISOString(),
        available: availableCount > 0,
        driverCount: Math.max(0, availableCount),
        totalDrivers,
      });
    }
  }

  return { date, duration: durationMin, totalDrivers, slots };
}
