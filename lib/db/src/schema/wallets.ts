import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { bigint, check, pgEnum, pgTable, timestamp, uuid, text } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const walletStatusEnum = pgEnum("sf_wallet_status", ["active", "locked", "closed"]);

export const walletsTable = pgTable(
  "sf_wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    currency: text("currency").notNull().default("XOF"),
    balanceMinor: bigint("balance_minor", { mode: "number" }).notNull().default(0),
    status: walletStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    balanceNonNegativeCheck: check(
      "sf_wallets_balance_minor_nonnegative_check",
      sql`${table.balanceMinor} >= 0`,
    ),
  }),
);

export const insertWalletSchema = createInsertSchema(walletsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;