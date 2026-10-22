import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
  lastProviderEventAt: timestamp("last_provider_event_at", { withTimezone: true }),
  reconciliationRequired: boolean("reconciliation_required").notNull().default(false),
  reconciliationVersion: integer("reconciliation_version").notNull().default(0),
  reconciliationRequestedAt: timestamp("reconciliation_requested_at", { withTimezone: true }),
  reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const identityWebhookEventsTable = pgTable("sf_identity_webhook_events", {
  eventId: text("event_id").primaryKey(),
  providerSessionId: text("provider_session_id").notNull(),
  eventType: text("event_type").notNull(),
  matchedVerification: boolean("matched_verification").notNull().default(false),
  payloadDigest: text("payload_digest"),
  encryptedPayload: text("encrypted_payload"),
  status: text("status"),
  statusApplied: boolean("status_applied"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IdentityVerificationAttemptStatus =
  | "creating"
  | "completed"
  | "failed"
  | "abandoned";

export const identityVerificationAttemptsTable = pgTable(
  "sf_identity_verification_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: text("status")
      .$type<IdentityVerificationAttemptStatus>()
      .notNull()
      .default("creating"),
    providerSessionId: text("provider_session_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusConstraint: check(
      "sf_identity_verification_attempts_status_check",
      sql`${table.status} in ('creating', 'completed', 'failed', 'abandoned')`,
    ),
    userCreatedIndex: index("sf_identity_verification_attempts_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export type IdentityVerification = typeof identityVerificationsTable.$inferSelect;
export type IdentityWebhookEvent = typeof identityWebhookEventsTable.$inferSelect;
export type IdentityVerificationAttempt = typeof identityVerificationAttemptsTable.$inferSelect;