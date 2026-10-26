import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { customerPaymentLinksTable } from "./payment-links";
import { paymentIntentsTable } from "./payment-intents";

/**
 * Public, payer-facing handle for a wallet-backed LinkFlow deposit.
 * Financial status remains authoritative in sf_payment_intents / attempts.
 */
export const customerPaymentLinkAttemptsTable = pgTable("sf_customer_payment_link_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentLinkId: uuid("payment_link_id").notNull()
    .references(() => customerPaymentLinksTable.id, { onDelete: "restrict" }),
  intentId: uuid("intent_id").notNull()
    .references(() => paymentIntentsTable.id, { onDelete: "restrict" }),
  idempotencyKey: uuid("idempotency_key").notNull(),
  requestHash: varchar("request_hash", { length: 64 }).notNull(),
  pollTokenHash: varchar("poll_token_hash", { length: 64 }).notNull().unique(),
  merchantName: varchar("merchant_name", { length: 120 }).notNull(),
  payerFirstNameEncrypted: varchar("payer_first_name_encrypted", { length: 512 }).notNull(),
  payerLastNameEncrypted: varchar("payer_last_name_encrypted", { length: 512 }).notNull(),
  ussdCode: varchar("ussd_code", { length: 32 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  linkIdempotencyUnique: unique("sf_customer_link_payment_idempotency_uq")
    .on(table.paymentLinkId, table.idempotencyKey),
  intentUnique: unique("sf_customer_link_payment_intent_uq").on(table.intentId),
  linkCreatedIndex: index("sf_customer_link_payment_link_created_idx")
    .on(table.paymentLinkId, table.createdAt, table.id),
  requestHashCheck: check(
    "sf_customer_link_payment_request_hash_check",
    sql`${table.requestHash} ~ '^[a-f0-9]{64}$'`,
  ),
  pollTokenHashCheck: check(
    "sf_customer_link_payment_poll_token_hash_check",
    sql`${table.pollTokenHash} ~ '^[a-f0-9]{64}$'`,
  ),
  merchantNameCheck: check(
    "sf_customer_link_payment_merchant_name_check",
    sql`length(btrim(${table.merchantName})) between 1 and 120`,
  ),
  payerFirstNameCipherCheck: check(
    "sf_customer_link_payment_first_name_cipher_check",
    sql`${table.payerFirstNameEncrypted} like 'sfenc-v1.%'`,
  ),
  payerLastNameCipherCheck: check(
    "sf_customer_link_payment_last_name_cipher_check",
    sql`${table.payerLastNameEncrypted} like 'sfenc-v1.%'`,
  ),
  ussdCodeCheck: check(
    "sf_customer_link_payment_ussd_code_check",
    sql`${table.ussdCode} is null or (${table.ussdCode} ~ '^[*][0-9]+([*][0-9]+)*#$' and length(${table.ussdCode}) <= 32)`,
  ),
}));

export const insertCustomerPaymentLinkAttemptSchema = createInsertSchema(customerPaymentLinkAttemptsTable).omit({
  id: true,
  createdAt: true,
});

export type CustomerPaymentLinkAttempt = typeof customerPaymentLinkAttemptsTable.$inferSelect;
export type InsertCustomerPaymentLinkAttempt = typeof customerPaymentLinkAttemptsTable.$inferInsert;
