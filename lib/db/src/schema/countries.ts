import {
  boolean,
  check,
  integer,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

export const countriesTable = pgTable(
  "sf_countries",
  {
    countryCode: varchar("country_code", { length: 2 }).primaryKey(),
    countryName: varchar("country_name", { length: 120 }).notNull(),
    phonePrefix: varchar("phone_prefix", { length: 8 }).notNull(),
    minPhoneDigits: integer("min_phone_digits").notNull(),
    maxPhoneDigits: integer("max_phone_digits").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    depositEnabled: boolean("deposit_enabled").notNull().default(false),
    interNetworkEnabled: boolean("inter_network_enabled").notNull().default(false),
    internationalEnabled: boolean("international_enabled").notNull().default(false),
    version: integer("version").notNull().default(1),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    updatedBy: varchar("updated_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    countryCodeFormat: check(
      "sf_countries_code_format_check",
      sql`${table.countryCode} ~ '^[a-z]{2}$'`,
    ),
    phonePrefixFormat: check(
      "sf_countries_phone_prefix_format_check",
      sql`${table.phonePrefix} ~ '^\\+[1-9][0-9]{0,3}$'`,
    ),
    phoneDigitsRange: check(
      "sf_countries_phone_digits_range_check",
      sql`${table.minPhoneDigits} BETWEEN 4 AND 15 AND ${table.maxPhoneDigits} BETWEEN ${table.minPhoneDigits} AND 15`,
    ),
  }),
);

export const insertCountrySchema = z.object({
  countryCode: z.string().regex(/^[a-z]{2}$/),
  countryName: z.string().trim().min(2).max(120),
  phonePrefix: z.string().regex(/^\+[1-9][0-9]{0,3}$/),
  minPhoneDigits: z.number().int().min(4).max(15),
  maxPhoneDigits: z.number().int().min(4).max(15),
  enabled: z.boolean().default(true),
  depositEnabled: z.boolean().default(false),
  interNetworkEnabled: z.boolean().default(false),
  internationalEnabled: z.boolean().default(false),
  createdBy: z.string().min(1).max(255),
  updatedBy: z.string().min(1).max(255),
}).refine((country) => country.minPhoneDigits <= country.maxPhoneDigits, {
  path: ["maxPhoneDigits"],
  message: "Maximum phone length must be at least the minimum phone length.",
});

export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type CountryRecord = typeof countriesTable.$inferSelect;
