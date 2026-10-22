import { sql } from "drizzle-orm";
import { bigint, check, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { paymentAttemptsTable } from "./payment-attempts";

export const paymentConfirmationsTable = pgTable("sf_payment_confirmations", {
  id: uuid("id").defaultRandom().primaryKey(),
  attemptId: uuid("attempt_id").notNull().references(() => paymentAttemptsTable.id, { onDelete: "restrict" }),
  eventFingerprint: varchar("event_fingerprint", { length: 64 }).notNull().unique(),
  source: varchar("source", { length: 24 }).notNull(),
  providerStatus: varchar("provider_status", { length: 12 }).notNull(),
  providerReferenceHash: varchar("provider_reference_hash", { length: 64 }).notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  encryptedPayload: text("encrypted_payload").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  fingerprintCheck: check("sf_payment_confirmations_event_fingerprint_check", sql`${t.eventFingerprint} ~ '^[a-f0-9]{64}$'`),
  sourceCheck: check("sf_payment_confirmations_source_check", sql`${t.source} in ('provider_status','verified_webhook')`),
  statusCheck: check("sf_payment_confirmations_provider_status_check", sql`${t.providerStatus} in ('pending','succeeded','failed')`),
  referenceCheck: check("sf_payment_confirmations_provider_reference_hash_check", sql`${t.providerReferenceHash} ~ '^[a-f0-9]{64}$'`),
  amountCheck: check("sf_payment_confirmations_amount_minor_check", sql`${t.amountMinor} between 1 and 9007199254740991`),
  currencyCheck: check("sf_payment_confirmations_currency_check", sql`${t.currency} in ('XOF','XAF')`),
  payloadCheck: check("sf_payment_confirmations_encrypted_payload_check", sql`${t.encryptedPayload} ~ '^sfenc-v1\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]+$' and octet_length(${t.encryptedPayload})<=131072`),
}));
export const insertPaymentConfirmationSchema = createInsertSchema(paymentConfirmationsTable).omit({ id: true, createdAt: true });
export type PaymentConfirmation = typeof paymentConfirmationsTable.$inferSelect;
export type InsertPaymentConfirmation = typeof paymentConfirmationsTable.$inferInsert;
