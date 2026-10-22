import { sql } from "drizzle-orm";
import { bigint, check, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { transactionsTable } from "./transactions";
import { paymentAggregatorsTable } from "./payment-aggregator-routing";
import { walletLedgerTable } from "./wallet-ledger";

export const paymentIntentsTable = pgTable("sf_payment_intents", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").notNull().unique().references(() => transactionsTable.id, { onDelete: "restrict" }),
  providerCode: varchar("provider_code", { length: 60 }).notNull().references(() => paymentAggregatorsTable.code, { onDelete: "restrict" }),
  requestHash: varchar("request_hash", { length: 64 }).notNull(),
  kind: varchar("kind", { length: 24 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  feeMinor: bigint("fee_minor", { mode: "number" }).notNull(),
  feePayer: varchar("fee_payer", { length: 12 }).notNull(),
  senderTotalMinor: bigint("sender_total_minor", { mode: "number" }).notNull(),
  recipientTotalMinor: bigint("recipient_total_minor", { mode: "number" }).notNull(),
  state: varchar("state", { length: 32 }).notNull().default("created"),
  ledgerEntryId: uuid("ledger_entry_id").unique().references(() => walletLedgerTable.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  stateIndex: index("sf_payment_intents_state_idx").on(t.state, t.createdAt),
  hashCheck: check("sf_payment_intents_request_hash_check", sql`${t.requestHash} ~ '^[a-f0-9]{64}$'`),
  kindCheck: check("sf_payment_intents_kind_check", sql`${t.kind} in ('deposit','inter-network','international')`),
  currencyCheck: check("sf_payment_intents_currency_check", sql`${t.currency} in ('XOF','XAF')`),
  amountCheck: check("sf_payment_intents_amount_minor_check", sql`${t.amountMinor} between 1 and 9007199254740991`),
  feeCheck: check("sf_payment_intents_fee_minor_check", sql`${t.feeMinor} between 0 and 9007199254740991`),
  senderCheck: check("sf_payment_intents_sender_total_minor_check", sql`${t.senderTotalMinor} between 1 and 9007199254740991`),
  recipientCheck: check("sf_payment_intents_recipient_total_minor_check", sql`${t.recipientTotalMinor} between 1 and 9007199254740991`),
  payerCheck: check("sf_payment_intents_fee_payer_check", sql`${t.feePayer} in ('sender','recipient')`),
  stateCheck: check("sf_payment_intents_state_check", sql`${t.state} in ('created','collecting','funded','paying','succeeded','failed','uncertain','refund_due')`),
  mathCheck: check("sf_payment_intent_fee_math", sql`(${t.feePayer}='sender' and ${t.senderTotalMinor}=${t.amountMinor}+${t.feeMinor} and ${t.recipientTotalMinor}=${t.amountMinor}) or (${t.feePayer}='recipient' and ${t.senderTotalMinor}=${t.amountMinor} and ${t.recipientTotalMinor}=${t.amountMinor}-${t.feeMinor})`),
}));
export const insertPaymentIntentSchema = createInsertSchema(paymentIntentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type PaymentIntent = typeof paymentIntentsTable.$inferSelect;
export type InsertPaymentIntent = typeof paymentIntentsTable.$inferInsert;
