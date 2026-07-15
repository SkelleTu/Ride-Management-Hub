import { pgTable, text, serial, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ridesTable = pgTable("rides", {
  id: serial("id").primaryKey(),
  passengerId: integer("passenger_id").notNull().references(() => usersTable.id),
  driverId: integer("driver_id").references(() => usersTable.id),
  originAddress: text("origin_address").notNull(),
  originLat: real("origin_lat").notNull(),
  originLng: real("origin_lng").notNull(),
  destinationAddress: text("destination_address").notNull(),
  destinationLat: real("destination_lat").notNull(),
  destinationLng: real("destination_lng").notNull(),
  offeredPrice: real("offered_price").notNull(),
  agreedPrice: real("agreed_price"),
  status: text("status").notNull().default("open"), // open | negotiating | accepted | in_progress | completed | cancelled
  estimatedDistance: real("estimated_distance"),
  estimatedDuration: integer("estimated_duration"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  cancelReason: text("cancel_reason"),
  driverLat: real("driver_lat"),
  driverLng: real("driver_lng"),
  passengerLat: real("passenger_lat"),
  passengerLng: real("passenger_lng"),
  // ── Scheduling fields ──────────────────────────────────────────────────────
  isScheduled: boolean("is_scheduled").notNull().default(false),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  schedulingType: text("scheduling_type"), // 'public' | 'directed'
  directedToDriverId: integer("directed_to_driver_id").references(() => usersTable.id),
  scheduledStatus: text("scheduled_status"), // 'pending_acceptance' | 'confirmed' | 'driver_declined' | 'cancelled'
  scheduledNote: text("scheduled_note"), // optional note from passenger
  // ──────────────────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRideSchema = createInsertSchema(ridesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRide = z.infer<typeof insertRideSchema>;
export type Ride = typeof ridesTable.$inferSelect;
