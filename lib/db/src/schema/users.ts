import { createInsertSchema } from "drizzle-zod";
import { date, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const userAccountStatusEnum = pgEnum("sf_user_account_status", ["active", "suspended", "deleted"]);

export const usersTable = pgTable("sf_users", {
  id: text("id").primaryKey(),
  phone: varchar("phone", { length: 32 }).unique(),
  displayName: varchar("display_name", { length: 120 }),
  countryCode: varchar("country_code", { length: 2 }),
  birthDate: date("birth_date", { mode: "string" }),
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
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
  updatedAt: true,
  lastSeenAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;