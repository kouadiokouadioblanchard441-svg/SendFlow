import { boolean, check, index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

// No seed or public enrollment: only a database owner can provision these grants.
export const adminGrantsTable = pgTable("sf_admin_grants", {
  userId: text("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  canMutate: boolean("can_mutate").notNull().default(false),
  pinHash: text("pin_hash").notNull(),
  authorizationVersion: uuid("authorization_version").notNull().defaultRandom(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminSessionsTable = pgTable("sf_admin_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => adminGrantsTable.userId, { onDelete: "cascade" }),
  authorizationVersion: uuid("authorization_version").notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  pinVerifiedUntil: timestamp("pin_verified_until", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => ({
  tokenIndex: uniqueIndex("sf_admin_sessions_token_uq").on(table.tokenHash),
  expiryIndex: index("sf_admin_sessions_user_expiry_idx").on(table.userId, table.expiresAt),
  expiryCheck: check("sf_admin_sessions_expiry_check", sql`${table.expiresAt} > ${table.createdAt}`),
}));
