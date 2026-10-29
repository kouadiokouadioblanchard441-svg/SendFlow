import { check, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const paymentLimitsTable = pgTable("sf_payment_limits", {
  id: varchar("id", { length: 16 }).primaryKey(),
  minimumDepositMinor: integer("minimum_deposit_minor").notNull().default(200),
  minimumPayoutMinor: integer("minimum_payout_minor").notNull().default(200),
  minimumInterNetworkMinor: integer("minimum_inter_network_minor").notNull().default(1),
  maximumTransferMinor: integer("maximum_transfer_minor").notNull().default(10_000_000),
  maximumPayinMinor: integer("maximum_payin_minor").notNull().default(2_000_000),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  singletonCheck: check("sf_payment_limits_singleton_check", sql`${table.id} = 'global'`),
  depositCheck: check("sf_payment_limits_deposit_check", sql`${table.minimumDepositMinor} BETWEEN 200 AND 2000000`),
  payoutCheck: check("sf_payment_limits_payout_check", sql`${table.minimumPayoutMinor} BETWEEN 200 AND 2000000`),
  interNetworkCheck: check("sf_payment_limits_inter_network_check", sql`${table.minimumInterNetworkMinor} BETWEEN 1 AND 10000000`),
  transferMaximumCheck: check("sf_payment_limits_transfer_max_check", sql`${table.maximumTransferMinor} BETWEEN 1 AND 10000000`),
  payinMaximumCheck: check("sf_payment_limits_payin_max_check", sql`${table.maximumPayinMinor} BETWEEN 200 AND 2000000`),
  depositTransferOrderCheck: check(
    "sf_payment_limits_deposit_transfer_order_check",
    sql`${table.minimumDepositMinor} <= ${table.maximumTransferMinor}`,
  ),
  payoutTransferOrderCheck: check(
    "sf_payment_limits_payout_transfer_order_check",
    sql`${table.minimumPayoutMinor} <= ${table.maximumTransferMinor}`,
  ),
  interNetworkTransferOrderCheck: check(
    "sf_payment_limits_inter_network_transfer_order_check",
    sql`${table.minimumInterNetworkMinor} <= ${table.maximumTransferMinor}`,
  ),
  depositPayinOrderCheck: check(
    "sf_payment_limits_deposit_payin_order_check",
    sql`${table.minimumDepositMinor} <= ${table.maximumPayinMinor}`,
  ),
  versionCheck: check("sf_payment_limits_version_check", sql`${table.version} >= 1`),
}));

export type PaymentLimitsRecord = typeof paymentLimitsTable.$inferSelect;
