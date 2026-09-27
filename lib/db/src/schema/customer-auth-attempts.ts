import { createInsertSchema } from "drizzle-zod";
import { check, pgTable, timestamp, varchar, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

export const customerAuthAttemptsTable = pgTable(
  "sf_customer_auth_attempts",
  {
    bucketHash: varchar("bucket_hash", { length: 64 }).primaryKey(),
    failureCount: integer("failure_count").notNull().default(0),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
    blockedUntil: timestamp("blocked_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    failureCountConstraint: check(
      "sf_customer_auth_attempts_count_check",
      sql`${table.failureCount} between 0 and 20`,
    ),
  }),
);

export const insertCustomerAuthAttemptSchema = createInsertSchema(customerAuthAttemptsTable).omit({
  updatedAt: true,
});

export type InsertCustomerAuthAttempt = z.infer<typeof insertCustomerAuthAttemptSchema>;
export type CustomerAuthAttempt = typeof customerAuthAttemptsTable.$inferSelect;