import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const transactionKindEnum = pgEnum("sf_transaction_kind", [
  "inter-network",
  "deposit",
  "international",
]);

export const transactionStatusEnum = pgEnum("sf_transaction_status", [
  "pending",
  "succeeded",
  "failed",
]);

export const transactionsTable = pgTable(
  "sf_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    kind: transactionKindEnum("kind").notNull(),
    status: transactionStatusEnum("status").notNull().default("pending"),
    fromOperator: varchar("from_operator", { length: 32 }),
    toOperator: varchar("to_operator", { length: 32 }),
    senderPhone: varchar("sender_phone", { length: 512 }).notNull(),
    senderPhoneLookupHash: varchar("sender_phone_lookup_hash", { length: 64 }),
    recipientPhone: varchar("recipient_phone", { length: 512 }).notNull(),
    recipientPhoneLookupHash: varchar("recipient_phone_lookup_hash", { length: 64 }),
    currency: text("currency").notNull().default("XOF"),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    feeMinor: bigint("fee_minor", { mode: "number" }).notNull().default(0),
    reference: varchar("reference", { length: 64 }).notNull().unique(),
    providerReference: varchar("provider_reference", { length: 512 }),
    providerReferenceLookupHash: varchar("provider_reference_lookup_hash", { length: 64 }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull().unique(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: varchar("deleted_by", { length: 255 }),
    deletionReason: varchar("deletion_reason", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    amountPositiveCheck: check(
      "sf_transactions_amount_minor_positive_check",
      sql`${table.amountMinor} > 0`,
    ),
    amountSafeIntegerCheck: check(
      "sf_transactions_amount_minor_safe_integer_check",
      sql`${table.amountMinor} <= 9007199254740991`,
    ),
    feeNonNegativeCheck: check(
      "sf_transactions_fee_minor_nonnegative_check",
      sql`${table.feeMinor} >= 0`,
    ),
    feeSafeIntegerCheck: check(
      "sf_transactions_fee_minor_safe_integer_check",
      sql`${table.feeMinor} <= 9007199254740991`,
    ),
    userTransactionsIndex: index("sf_transactions_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    senderPhoneLookupHashIndex: index("sf_transactions_sender_phone_hash_idx").on(table.senderPhoneLookupHash),
    recipientPhoneLookupHashIndex: index("sf_transactions_recipient_phone_hash_idx").on(table.recipientPhoneLookupHash),
    providerReferenceLookupHashIndex: index("sf_transactions_provider_ref_hash_idx").on(table.providerReferenceLookupHash),
  }),
);

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;