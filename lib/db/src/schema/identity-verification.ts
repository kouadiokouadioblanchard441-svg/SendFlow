import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const identityVerificationsTable = pgTable("sf_identity_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  providerSessionId: text("provider_session_id").notNull().unique(),
  vendorData: text("vendor_data").notNull(),
  verificationUrl: text("verification_url").notNull(),
  status: text("status").notNull().default("Not Started"),
  sandboxScenario: text("sandbox_scenario"),
  lastWebhookEventId: text("last_webhook_event_id"),
  lastWebhookType: text("last_webhook_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const identityWebhookEventsTable = pgTable("sf_identity_webhook_events", {
  eventId: text("event_id").primaryKey(),
  providerSessionId: text("provider_session_id").notNull(),
  eventType: text("event_type").notNull(),
  matchedVerification: boolean("matched_verification").notNull().default(false),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export const identityVerificationAttemptsTable = pgTable(
  "sf_identity_verification_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sf_identity_verification_attempts_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export type IdentityVerification = typeof identityVerificationsTable.$inferSelect;
export type IdentityWebhookEvent = typeof identityWebhookEventsTable.$inferSelect;
export type IdentityVerificationAttempt = typeof identityVerificationAttemptsTable.$inferSelect;