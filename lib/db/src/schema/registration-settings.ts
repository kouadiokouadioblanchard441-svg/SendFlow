import { createInsertSchema } from "drizzle-zod";
import { boolean, foreignKey, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { countriesTable } from "./countries";

export const registrationSettingsTable = pgTable("sf_registration_settings", {
  id: varchar("id", { length: 32 }).primaryKey(),
  emailVerificationEnabled: boolean("email_verification_enabled").notNull().default(true),
  defaultCountryCode: varchar("default_country_code", { length: 2 }).notNull(),
  // Retained for historical database compatibility; signup now uses email verification.
  legacySmsVerificationEnabled: boolean("sms_verification_enabled").notNull().default(true),
  version: integer("version").notNull().default(1),
  updatedBy: varchar("updated_by", { length: 255 }).notNull().default("system"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  defaultCountryForeignKey: foreignKey({
    name: "sf_registration_settings_default_country_code_fk",
    columns: [table.defaultCountryCode],
    foreignColumns: [countriesTable.countryCode],
  }),
}));

export const insertRegistrationSettingsSchema = createInsertSchema(registrationSettingsTable);
export type RegistrationSettings = z.infer<typeof insertRegistrationSettingsSchema>;