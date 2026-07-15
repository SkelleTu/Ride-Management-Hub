import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { ridesTable } from "./rides";

export const offersTable = pgTable("offers", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").notNull().references(() => ridesTable.id, { onDelete: "cascade" }),
  driverId: integer("driver_id").notNull().references(() => usersTable.id),
  price: real("price").notNull(),
  message: text("message"),
  status: text("status").notNull().default("pending"), // pending | accepted | rejected
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOfferSchema = createInsertSchema(offersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type Offer = typeof offersTable.$inferSelect;
