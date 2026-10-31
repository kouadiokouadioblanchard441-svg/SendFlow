import { index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
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
