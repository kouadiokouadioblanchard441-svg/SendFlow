import { check, index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const emailMarketingPreferenceEventsTable = pgTable(
  "sf_email_marketing_preference_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 16 }).notNull(),
    source: varchar("source", { length: 24 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIndex: index("sf_email_marketing_preference_user_created_idx")
      .on(table.userId, table.createdAt),
  }),
);

/**
 * Stores only the keyed email lookup hash, never the address itself. A provider
 * bounce or complaint blocks that address from future marketing sends.
 */
export const emailMarketingSuppressionsTable = pgTable(
  "sf_email_marketing_suppressions",
  {
    emailLookupHash: varchar("email_lookup_hash", { length: 64 }).primaryKey(),
    reason: varchar("reason", { length: 16 }).notNull(),
    providerEventId: varchar("provider_event_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    reasonCheck: check("sf_email_marketing_suppression_reason_check", sql`${table.reason} in ('bounced', 'complained')`),
    reasonIndex: index("sf_email_marketing_suppression_reason_idx").on(table.reason, table.updatedAt),
  }),
);
