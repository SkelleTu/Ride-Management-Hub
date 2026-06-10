import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const driverProfilesTable = pgTable("driver_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  status: text("status").notNull().default("pending"), // pending | approved | denied
  // Personal
  cpf: text("cpf"),
  birthDate: text("birth_date"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  // CNH
  cnhNumber: text("cnh_number"),
  cnhCategory: text("cnh_category"),
  cnhExpiry: text("cnh_expiry"),
  // Vehicle
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  vehicleYear: integer("vehicle_year"),
  vehicleColor: text("vehicle_color"),
  vehiclePlate: text("vehicle_plate"),
  vehicleType: text("vehicle_type"), // sedan | suv | hatch | pickup | moto | van
  // Documents
  photoUrl: text("photo_url"),
  cnhPhotoUrl: text("cnh_photo_url"),
  vehiclePhotoUrl: text("vehicle_photo_url"),
  criminalRecordUrl: text("criminal_record_url"),
  // Admin decision
  adminNote: text("admin_note"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDriverProfileSchema = createInsertSchema(driverProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDriverProfile = z.infer<typeof insertDriverProfileSchema>;
export type DriverProfile = typeof driverProfilesTable.$inferSelect;
