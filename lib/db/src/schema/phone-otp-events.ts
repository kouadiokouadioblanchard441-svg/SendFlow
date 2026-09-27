import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { phoneOtpChallengesTable } from "./phone-otp-challenges";

export const phoneOtpEventTypes = ["send", "verify"] as const;
export type PhoneOtpEventType = (typeof phoneOtpEventTypes)[number];

export const phoneOtpEventOutcomes = [
  "requested",
  "rate_limited",
  "configuration_error",
  "reservation_error",
  "provider_accepted",
  "provider_rejected",
  "provider_error",
  "provider_rate_limited",
  "challenge_inactive",
  "challenge_expired",
  "challenge_locked",
  "already_verified",
  "not_approved",
  "verified",
  "state_conflict",
  "storage_error",
] as const;
export type PhoneOtpEventOutcome = (typeof phoneOtpEventOutcomes)[number];

export const phoneOtpEventsTable = pgTable(
  "sf_phone_otp_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    challengeId: uuid("challenge_id").references(() => phoneOtpChallengesTable.id, {
      onDelete: "set null",
    }),
    eventType: varchar("event_type", { length: 16 }).notNull(),
    outcome: varchar("outcome", { length: 32 }).notNull(),
    providerHttpStatus: integer("provider_http_status"),
    diagnosticMessage: varchar("diagnostic_message", { length: 300 }),
    attemptNumber: integer("attempt_number"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    eventTypeConstraint: check(
      "sf_phone_otp_event_type_check",
      sql`${table.eventType} in ('send', 'verify')`,
    ),
    outcomeConstraint: check(
      "sf_phone_otp_event_outcome_check",
      sql`${table.outcome} in (
        'requested',
        'rate_limited',
        'configuration_error',
        'reservation_error',
        'provider_accepted',
        'provider_rejected',
        'provider_error',
        'provider_rate_limited',
        'challenge_inactive',
        'challenge_expired',
        'challenge_locked',
        'already_verified',
        'not_approved',
        'verified',
        'state_conflict',
        'storage_error'
      )`,
    ),
    providerStatusConstraint: check(
      "sf_phone_otp_event_provider_status_check",
      sql`${table.providerHttpStatus} is null or ${table.providerHttpStatus} between 100 and 599`,
    ),
    attemptConstraint: check(
      "sf_phone_otp_event_attempt_check",
      sql`${table.attemptNumber} is null or ${table.attemptNumber} between 1 and 5`,
    ),
    createdIndex: index("sf_phone_otp_events_created_idx").on(table.createdAt.desc()),
    challengeCreatedIndex: index("sf_phone_otp_events_challenge_created_idx").on(
      table.challengeId,
      table.createdAt.desc(),
    ),
    outcomeCreatedIndex: index("sf_phone_otp_events_outcome_created_idx").on(
      table.outcome,
      table.createdAt.desc(),
    ),
    eventTypeCreatedIndex: index("sf_phone_otp_events_type_created_idx").on(
      table.eventType,
      table.createdAt.desc(),
    ),
  }),
);

export type PhoneOtpEvent = typeof phoneOtpEventsTable.$inferSelect;