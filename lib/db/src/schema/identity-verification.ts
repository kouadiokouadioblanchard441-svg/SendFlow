import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
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

export type IdentityVerification = typeof identityVerificationsTable.$inferSelect;
export type IdentityWebhookEvent = typeof identityWebhookEventsTable.$inferSelect;