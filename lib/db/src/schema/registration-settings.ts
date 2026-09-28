import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const registrationSettingsTable = pgTable("sf_registration_settings", {
  id: varchar("id", { length: 32 }).primaryKey(),
  smsVerificationEnabled: boolean("sms_verification_enabled").notNull().default(true),
  version: integer("version").notNull().default(1),
  updatedBy: varchar("updated_by", { length: 255 }).notNull().default("system"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRegistrationSettingsSchema = createInsertSchema(registrationSettingsTable);
export type RegistrationSettings = z.infer<typeof insertRegistrationSettingsSchema>;