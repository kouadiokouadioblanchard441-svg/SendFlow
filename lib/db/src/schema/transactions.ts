import { createInsertSchema } from "drizzle-zod";
import {
  bigint,
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
    senderPhone: varchar("sender_phone", { length: 32 }).notNull(),
    recipientPhone: varchar("recipient_phone", { length: 32 }).notNull(),
    currency: text("currency").notNull().default("XOF"),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    feeMinor: bigint("fee_minor", { mode: "number" }).notNull().default(0),
    reference: varchar("reference", { length: 64 }).notNull().unique(),
    providerReference: varchar("provider_reference", { length: 128 }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull().unique(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: varchar("deleted_by", { length: 255 }),
    deletionReason: varchar("deletion_reason", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userTransactionsIndex: index("sf_transactions_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;