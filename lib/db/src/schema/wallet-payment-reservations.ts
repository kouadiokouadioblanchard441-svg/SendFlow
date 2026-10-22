import { sql } from "drizzle-orm";
import { bigint, check, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { paymentIntentsTable } from "./payment-intents";
import { paymentConfirmationsTable } from "./payment-confirmations";
import { walletsTable } from "./wallets";
import { walletLedgerTable } from "./wallet-ledger";

export const walletPaymentReservationsTable = pgTable("sf_wallet_payment_reservations", {
  id: uuid("id").defaultRandom().primaryKey(),
  intentId: uuid("intent_id").notNull().unique().references(() => paymentIntentsTable.id, { onDelete: "restrict" }),
  walletId: uuid("wallet_id").notNull().references(() => walletsTable.id, { onDelete: "restrict" }),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  state: varchar("state", { length: 12 }).notNull().default("active"),
  confirmationId: uuid("confirmation_id").references(() => paymentConfirmationsTable.id, { onDelete: "restrict" }),
  ledgerEntryId: uuid("ledger_entry_id").unique().references(() => walletLedgerTable.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  activeIndex: index("sf_wallet_payment_reservations_active_idx").on(t.walletId).where(sql`${t.state}='active'`),
  amountCheck: check("sf_wallet_payment_reservations_amount_minor_check", sql`${t.amountMinor} between 1 and 9007199254740991`),
  currencyCheck: check("sf_wallet_payment_reservations_currency_check", sql`${t.currency} in ('XOF','XAF')`),
  stateCheck: check("sf_wallet_payment_reservations_state_check", sql`${t.state} in ('active','consumed','released')`),
}));
export const insertWalletPaymentReservationSchema = createInsertSchema(walletPaymentReservationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type WalletPaymentReservation = typeof walletPaymentReservationsTable.$inferSelect;
export type InsertWalletPaymentReservation = typeof walletPaymentReservationsTable.$inferInsert;
