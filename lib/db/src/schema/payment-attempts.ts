import { sql } from "drizzle-orm";
import { bigint, check, index, pgTable, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { paymentIntentsTable } from "./payment-intents";
import { countriesTable } from "./countries";
import { paymentConfirmationsTable } from "./payment-confirmations";

export const paymentAttemptsTable = pgTable("sf_payment_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  intentId: uuid("intent_id").notNull().references(() => paymentIntentsTable.id, { onDelete: "restrict" }),
  direction: varchar("direction", { length: 12 }).notNull(),
  countryCode: varchar("country_code", { length: 2 }).notNull().references(() => countriesTable.countryCode, { onDelete: "restrict" }),
  channelId: varchar("channel_id", { length: 80 }).notNull(),
  operationReference: varchar("operation_reference", { length: 30 }).notNull().unique(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("prepared"),
  providerReference: text("provider_reference"),
  providerReferenceHash: varchar("provider_reference_hash", { length: 64 }).unique(),
  finalConfirmationId: uuid("final_confirmation_id").references((): AnyPgColumn => paymentConfirmationsTable.id, { onDelete: "restrict" }),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  legUnique: unique("sf_payment_attempt_leg_unique").on(t.intentId, t.direction),
  reconcileIndex: index("sf_payment_attempts_reconcile_idx").on(t.status, t.updatedAt),
  directionCheck: check("sf_payment_attempts_direction_check", sql`${t.direction} in ('payin','payout')`),
  channelCheck: check("sf_payment_attempts_channel_id_check", sql`length(${t.channelId})>0`),
  operationCheck: check("sf_payment_attempts_operation_reference_check", sql`${t.operationReference} ~ '^[A-Z0-9]{12,30}$'`),
  amountCheck: check("sf_payment_attempts_amount_minor_check", sql`${t.amountMinor} between 1 and 9007199254740991`),
  currencyCheck: check("sf_payment_attempts_currency_check", sql`${t.currency} in ('XOF','XAF')`),
  statusCheck: check("sf_payment_attempts_status_check", sql`${t.status} in ('prepared','dispatching','pending','uncertain','succeeded','failed')`),
  referencePair: check("sf_payment_attempt_reference_pair", sql`(${t.providerReference} is null and ${t.providerReferenceHash} is null) or (${t.providerReference} is not null and ${t.providerReferenceHash} is not null and ${t.providerReference} ~ '^sfenc-v1\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]+$' and octet_length(${t.providerReference})<=4096 and ${t.providerReferenceHash} ~ '^[a-f0-9]{64}$')`),
  confirmableCheck: check("sf_payment_attempt_confirmable_reference", sql`${t.status} not in ('pending','succeeded') or ${t.providerReferenceHash} is not null`),
}));
export const insertPaymentAttemptSchema = createInsertSchema(paymentAttemptsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type PaymentAttempt = typeof paymentAttemptsTable.$inferSelect;
export type InsertPaymentAttempt = typeof paymentAttemptsTable.$inferInsert;
