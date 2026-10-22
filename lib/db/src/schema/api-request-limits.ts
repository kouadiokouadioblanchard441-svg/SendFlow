import { check, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const apiRequestLimitsTable = pgTable("sf_api_request_limits", {
  bucketHash: varchar("bucket_hash", { length: 64 }).primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  requestCount: integer("request_count").notNull(),
}, (table) => ({
  countCheck: check("sf_api_request_limits_count_check", sql`${table.requestCount} between 1 and 60`),
}));
