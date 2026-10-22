import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

// This is an explicit, single-account exception for live-payment tests against
// shared Neon. It never grants access to the viewer account or other customers.
export const replitPaymentTestAccessTable = pgTable("sf_replit_payment_test_access", {
  userId: text("user_id").primaryKey().references(() => usersTable.id, { onDelete: "restrict" }),
  state: varchar("state", { length: 12 }).notNull().default("active"),
  grantedBy: varchar("granted_by", { length: 120 }).notNull(),
  reason: varchar("reason", { length: 500 }).notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedBy: varchar("revoked_by", { length: 120 }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => ({
  singleActiveAccount: uniqueIndex("sf_replit_payment_test_access_one_active_uq")
    .on(t.state).where(sql`${t.state}='active'`),
  stateCheck: check("sf_replit_payment_test_access_state_check", sql`
    (${t.state}='active' AND ${t.revokedAt} IS NULL AND ${t.revokedBy} IS NULL)
    OR (${t.state}='revoked' AND ${t.revokedAt} IS NOT NULL AND ${t.revokedBy} IS NOT NULL)
  `),
  reasonCheck: check("sf_replit_payment_test_access_reason_check", sql`length(${t.reason}) BETWEEN 10 AND 500`),
}));
export const insertReplitPaymentTestAccessSchema = createInsertSchema(replitPaymentTestAccessTable)
  .omit({ grantedAt: true });
export type ReplitPaymentTestAccess = typeof replitPaymentTestAccessTable.$inferSelect;
export type InsertReplitPaymentTestAccess = typeof replitPaymentTestAccessTable.$inferInsert;
