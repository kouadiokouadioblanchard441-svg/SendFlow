import { createInsertSchema } from "drizzle-zod";
import { date, index, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const userAccountStatusEnum = pgEnum("sf_user_account_status", ["active", "suspended", "deleted"]);

export const usersTable = pgTable("sf_users", {
  id: text("id").primaryKey(),
  phone: varchar("phone", { length: 512 }).unique(),
  phoneLookupHash: varchar("phone_lookup_hash", { length: 64 }).unique("sf_users_phone_lookup_hash_uq"),
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
  displayName: varchar("display_name", { length: 512 }),
  displayNameLookupHash: varchar("display_name_lookup_hash", { length: 64 }),
  countryCode: varchar("country_code", { length: 2 }),
  birthDate: date("birth_date", { mode: "string" }),
  birthDateEncrypted: text("birth_date_encrypted"),
  status: userAccountStatusEnum("status").notNull().default("active"),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspendedBy: varchar("suspended_by", { length: 255 }),
  suspensionReason: varchar("suspension_reason", { length: 500 }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: varchar("deleted_by", { length: 255 }),
  deletionReason: varchar("deletion_reason", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
}, (table) => ({
  displayNameLookupHashIndex: index("sf_users_display_name_lookup_hash_idx").on(table.displayNameLookupHash),
}));

export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
  updatedAt: true,
  lastSeenAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;