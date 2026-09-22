import { index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const loginEventsTable = pgTable(
  "sf_login_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    sessionId: varchar("session_id", { length: 255 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }).notNull(),
    city: varchar("city", { length: 120 }),
    region: varchar("region", { length: 120 }),
    countryCode: varchar("country_code", { length: 2 }),
    countryName: varchar("country_name", { length: 120 }),
    locationSource: varchar("location_source", { length: 32 }),
    deviceType: varchar("device_type", { length: 24 }).notNull(),
    browser: varchar("browser", { length: 80 }).notNull(),
    operatingSystem: varchar("operating_system", { length: 80 }).notNull(),
    userAgent: varchar("user_agent", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIndex: index("sf_login_events_user_created_idx").on(table.userId, table.createdAt),
    createdIndex: index("sf_login_events_created_idx").on(table.createdAt),
    userSessionUniqueIndex: uniqueIndex("sf_login_events_user_session_unique").on(
      table.userId,
      table.sessionId,
    ),
  }),
);

export type LoginEvent = typeof loginEventsTable.$inferSelect;