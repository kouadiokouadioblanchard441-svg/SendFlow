import { check, pgTable, timestamp, uuid, bigint } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { walletsTable } from "./wallets";

export const walletReservationTotalsTable = pgTable("sf_wallet_reservation_totals", {
  walletId: uuid("wallet_id")
    .primaryKey()
    .references(() => walletsTable.id, { onDelete: "restrict" }),
  reservedMinor: bigint("reserved_minor", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  reservedAmountCheck: check(
    "sf_wallet_reservation_totals_amount_check",
    sql`${table.reservedMinor} BETWEEN 0 AND 9007199254740991`,
  ),
}));
