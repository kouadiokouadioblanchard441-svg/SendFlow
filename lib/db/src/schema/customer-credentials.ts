import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const customerCredentialsTable = pgTable("sf_customer_credentials", {
  userId: text("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  pinHash: text("pin_hash"),
  privacyAcceptedAt: timestamp("privacy_accepted_at", { withTimezone: true }).notNull(),
  privacyPolicyVersion: varchar("privacy_policy_version", { length: 100 }).notNull(),
  passwordUpdatedAt: timestamp("password_updated_at", { withTimezone: true }).notNull().defaultNow(),
  pinUpdatedAt: timestamp("pin_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCustomerCredentialSchema = createInsertSchema(customerCredentialsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomerCredential = z.infer<typeof insertCustomerCredentialSchema>;
export type CustomerCredential = typeof customerCredentialsTable.$inferSelect;