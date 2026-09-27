import { createInsertSchema } from "drizzle-zod";
import { index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const customerSessionsTable = pgTable(
  "sf_customer_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    pinVerifiedUntil: timestamp("pin_verified_until", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    tokenHashUniqueIndex: uniqueIndex("sf_customer_sessions_token_hash_uq").on(table.tokenHash),
    userExpiryIndex: index("sf_customer_sessions_user_expiry_idx").on(table.userId, table.expiresAt),
  }),
);

export const insertCustomerSessionSchema = createInsertSchema(customerSessionsTable).omit({
  createdAt: true,
  lastSeenAt: true,
});

export type InsertCustomerSession = z.infer<typeof insertCustomerSessionSchema>;
export type CustomerSession = typeof customerSessionsTable.$inferSelect;