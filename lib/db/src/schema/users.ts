import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const usersTable = pgTable("sf_users", {
  id: text("id").primaryKey(),
  phone: varchar("phone", { length: 32 }).unique(),
  displayName: varchar("display_name", { length: 120 }),
  countryCode: varchar("country_code", { length: 2 }),
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