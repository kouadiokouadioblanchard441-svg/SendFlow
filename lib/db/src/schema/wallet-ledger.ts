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
import { usersTable } from "./users";
import { walletsTable } from "./wallets";

export const walletLedgerDirectionEnum = pgEnum("sf_wallet_ledger_direction", ["credit", "debit"]);

export const walletLedgerTable = pgTable(
  "sf_wallet_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => walletsTable.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    direction: walletLedgerDirectionEnum("direction").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    balanceBeforeMinor: bigint("balance_before_minor", { mode: "number" }).notNull(),
    balanceAfterMinor: bigint("balance_after_minor", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    reason: varchar("reason", { length: 500 }).notNull(),
    adminUserId: varchar("admin_user_id", { length: 255 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    amountPositiveCheck: check(
      "sf_wallet_ledger_amount_minor_positive_check",
      sql`${table.amountMinor} > 0`,
    ),
    walletCreatedIndex: index("sf_wallet_ledger_wallet_created_idx").on(table.walletId, table.createdAt),
    userCreatedIndex: index("sf_wallet_ledger_user_created_idx").on(table.userId, table.createdAt),
  }),
);

export type WalletLedgerEntry = typeof walletLedgerTable.$inferSelect;