import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const operatorCatalogTable = pgTable(
  "sf_operator_catalog",
  {
    operatorId: varchar("operator_id", { length: 60 }).primaryKey(),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    shortName: varchar("short_name", { length: 30 }).notNull(),
    initials: varchar("initials", { length: 8 }).notNull(),
    brand: varchar("brand", { length: 16 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    version: integer("version").notNull().default(1),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    updatedBy: varchar("updated_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    countryIndex: index("sf_operator_catalog_country_idx").on(table.countryCode),
    enabledIndex: index("sf_operator_catalog_enabled_idx").on(table.enabled),
  }),
);

export const operatorPricingRatesTable = pgTable(
  "sf_operator_pricing_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    operatorId: varchar("operator_id", { length: 60 })
      .notNull()
      .references(() => operatorCatalogTable.operatorId, { onDelete: "restrict" }),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    categoryId: varchar("category_id", { length: 30 }).notNull(),
    feePercent: numeric("fee_percent", { precision: 7, scale: 4, mode: "number" }),
    version: integer("version").notNull().default(1),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    updatedBy: varchar("updated_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    operatorCategoryUnique: uniqueIndex("sf_operator_pricing_rates_operator_category_uq").on(
      table.operatorId,
      table.categoryId,
    ),
    countryCategoryIndex: index("sf_operator_pricing_rates_country_category_idx").on(
      table.countryCode,
      table.categoryId,
    ),
  }),
);

export const insertOperatorCatalogSchema = z.object({
  operatorId: z.string().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  countryCode: z.string().length(2),
  name: z.string().trim().min(2).max(120),
  shortName: z.string().trim().min(1).max(30),
  initials: z.string().trim().min(1).max(8),
  brand: z.enum(["orange", "wave", "mtn", "moov", "generic"]),
  enabled: z.boolean().default(false),
  createdBy: z.string().min(1).max(255),
  updatedBy: z.string().min(1).max(255),
});

export const insertOperatorPricingRateSchema = z.object({
  operatorId: z.string().min(2).max(60),
  countryCode: z.string().length(2),
  categoryId: z.enum(["deposit", "inter-network", "international"]),
  feePercent: z.number().min(0).max(100).nullable(),
  createdBy: z.string().min(1).max(255),
  updatedBy: z.string().min(1).max(255),
});

export type InsertOperatorCatalog = z.infer<typeof insertOperatorCatalogSchema>;
export type InsertOperatorPricingRate = z.infer<typeof insertOperatorPricingRateSchema>;
export type OperatorCatalogRecord = typeof operatorCatalogTable.$inferSelect;
export type OperatorPricingRate = typeof operatorPricingRatesTable.$inferSelect;