import { boolean, check, index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

export const paymentAggregatorsTable = pgTable(
  "sf_payment_aggregators",
  {
    code: varchar("code", { length: 60 }).primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    version: integer("version").notNull().default(1),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    updatedBy: varchar("updated_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    enabledIndex: index("sf_payment_aggregators_enabled_idx").on(table.enabled),
  }),
);

export const paymentAggregatorRoutesTable = pgTable(
  "sf_payment_aggregator_routes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scopeType: varchar("scope_type", { length: 16 }).notNull(),
    scopeKey: varchar("scope_key", { length: 100 }).notNull(),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    operatorId: varchar("operator_id", { length: 60 }),
    operation: varchar("operation", { length: 24 }).notNull(),
    aggregatorCode: varchar("aggregator_code", { length: 60 }),
    version: integer("version").notNull().default(1),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    updatedBy: varchar("updated_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    scopeUnique: uniqueIndex("sf_payment_aggregator_routes_scope_operation_uq").on(
      table.scopeType,
      table.scopeKey,
      table.operation,
    ),
    countryIndex: index("sf_payment_aggregator_routes_country_idx").on(table.countryCode),
    operationCheck: check(
      "sf_payment_aggregator_routes_operation_check",
      sql`${table.operation} IN ('deposit', 'inter-network', 'international')`,
    ),
  }),
);

export const insertPaymentAggregatorSchema = z.object({
  code: z.string().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(120),
  enabled: z.boolean().default(false),
  createdBy: z.string().min(1).max(255),
  updatedBy: z.string().min(1).max(255),
});

export type InsertPaymentAggregator = z.infer<typeof insertPaymentAggregatorSchema>;
export type PaymentAggregator = typeof paymentAggregatorsTable.$inferSelect;
export type PaymentAggregatorRoute = typeof paymentAggregatorRoutesTable.$inferSelect;