import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const phoneOtpChallengesTable = pgTable(
  "sf_phone_otp_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phoneHash: varchar("phone_hash", { length: 64 }).notNull(),
    emailHash: varchar("email_hash", { length: 64 }),
    codeHash: varchar("code_hash", { length: 64 }),
    requesterHash: varchar("requester_hash", { length: 64 }).notNull(),
    purpose: varchar("purpose", { length: 24 }).notNull().default("signup"),
    providerVerificationId: varchar("provider_verification_id", { length: 255 }),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    deliveryChannel: varchar("delivery_channel", { length: 8 }).notNull().default("sms"),
    status: varchar("status", { length: 16 }).notNull().default("starting"),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    emailVerified: boolean("email_verified").notNull().default(false),
    checkAttempts: integer("check_attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    resendAfter: timestamp("resend_after", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (table) => ({
    phoneCreatedIndex: index("sf_phone_otp_phone_created_idx").on(table.phoneHash, table.createdAt),
    phonePurposeIndex: index("sf_phone_otp_phone_purpose_idx").on(
      table.phoneHash,
      table.purpose,
      table.status,
      table.expiresAt,
    ),
    emailCreatedIndex: index("sf_phone_otp_email_created_idx").on(table.emailHash, table.createdAt),
    emailPurposeIndex: index("sf_phone_otp_email_purpose_idx").on(
      table.emailHash,
      table.purpose,
      table.status,
      table.expiresAt,
    ),
    requesterCreatedIndex: index("sf_phone_otp_requester_created_idx").on(table.requesterHash, table.createdAt),
    providerVerificationUniqueIndex: uniqueIndex("sf_phone_otp_provider_verification_uq").on(
      table.providerVerificationId,
    ),
    statusConstraint: check(
      "sf_phone_otp_status_check",
      sql`${table.status} in ('starting', 'pending', 'verified', 'failed', 'expired', 'superseded', 'locked')`,
    ),
    deliveryChannelConstraint: check(
      "sf_phone_otp_delivery_channel_check",
      sql`${table.deliveryChannel} in ('sms', 'email')`,
    ),
    emailChallengeConstraint: check(
      "sf_phone_otp_email_challenge_check",
      sql`${table.deliveryChannel} <> 'email' or ${table.emailHash} is not null`,
    ),
    emailCodeConstraint: check(
      "sf_phone_otp_email_code_check",
      sql`${table.deliveryChannel} <> 'email' or ${table.status} not in ('starting', 'pending') or ${table.codeHash} is not null`,
    ),
    purposeConstraint: check(
      "sf_phone_otp_purpose_check",
      sql`${table.purpose} in ('signup', 'password_reset', 'pin_reset', 'admin_login')`,
    ),
    attemptsConstraint: check(
      "sf_phone_otp_attempts_check",
      sql`${table.checkAttempts} between 0 and 5`,
    ),
    consumedConstraint: check(
      "sf_phone_otp_consumed_check",
      sql`${table.consumedAt} is null or ${table.status} = 'verified'`,
    ),
    verifiedConstraint: check(
      "sf_phone_otp_verified_check",
      sql`${table.phoneVerified} = (${table.deliveryChannel} = 'sms' and ${table.status} = 'verified' and ${table.verifiedAt} is not null)`,
    ),
    emailVerifiedConstraint: check(
      "sf_phone_otp_email_verified_check",
      sql`${table.emailVerified} = (${table.deliveryChannel} = 'email' and ${table.status} = 'verified' and ${table.verifiedAt} is not null)`,
    ),
  }),
);

export type PhoneOtpChallenge = typeof phoneOtpChallengesTable.$inferSelect;