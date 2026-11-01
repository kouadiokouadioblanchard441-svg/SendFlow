import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { check, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const customerServiceSettingsTable = pgTable(
  "sf_customer_service_settings",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    phoneNumber: varchar("phone_number", { length: 16 }),
    whatsappNumber: varchar("whatsapp_number", { length: 16 }),
    facebookLabel: varchar("facebook_label", { length: 100 }),
    facebookUrl: varchar("facebook_url", { length: 500 }),
    version: integer("version").notNull().default(1),
    updatedBy: varchar("updated_by", { length: 255 }).notNull().default("system"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    singletonCheck: check("sf_customer_service_settings_singleton_check", sql`${table.id} = 'global'`),
    versionCheck: check("sf_customer_service_settings_version_check", sql`${table.version} > 0`),
    phoneNumberCheck: check(
      "sf_customer_service_settings_phone_check",
      sql`${table.phoneNumber} is null or ${table.phoneNumber} ~ '^\\+[1-9][0-9]{7,14}$'`,
    ),
    whatsappNumberCheck: check(
      "sf_customer_service_settings_whatsapp_check",
      sql`${table.whatsappNumber} is null or ${table.whatsappNumber} ~ '^\\+[1-9][0-9]{7,14}$'`,
    ),
    facebookPairCheck: check(
      "sf_customer_service_settings_facebook_pair_check",
      sql`(${table.facebookLabel} is null and ${table.facebookUrl} is null) or (${table.facebookLabel} is not null and ${table.facebookUrl} is not null)`,
    ),
  }),
);

export const insertCustomerServiceSettingsSchema = createInsertSchema(customerServiceSettingsTable);
export type InsertCustomerServiceSettings = z.infer<typeof insertCustomerServiceSettingsSchema>;
export type CustomerServiceSettings = typeof customerServiceSettingsTable.$inferSelect;
