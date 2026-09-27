import { boolean, check, index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const phoneOtpChallengesTable = pgTable(
  "sf_phone_otp_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phoneHash: varchar("phone_hash", { length: 64 }).notNull(),
    requesterHash: varchar("requester_hash", { length: 64 }).notNull(),
    providerVerificationId: varchar("provider_verification_id", { length: 255 }),
    status: varchar("status", { length: 16 }).notNull().default("starting"),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    checkAttempts: integer("check_attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    resendAfter: timestamp("resend_after", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (table) => ({
    phoneCreatedIndex: index("sf_phone_otp_phone_created_idx").on(table.phoneHash, table.createdAt),
    requesterCreatedIndex: index("sf_phone_otp_requester_created_idx").on(table.requesterHash, table.createdAt),
    providerVerificationUniqueIndex: uniqueIndex("sf_phone_otp_provider_verification_uq").on(
      table.providerVerificationId,
    ),
    statusConstraint: check(
      "sf_phone_otp_status_check",
      sql`${table.status} in ('starting', 'pending', 'verified', 'failed', 'expired', 'superseded', 'locked')`,
    ),
    attemptsConstraint: check(
      "sf_phone_otp_attempts_check",
      sql`${table.checkAttempts} between 0 and 5`,
    ),
    verifiedConstraint: check(
      "sf_phone_otp_verified_check",
      sql`${table.phoneVerified} = (${table.status} = 'verified' and ${table.verifiedAt} is not null)`,
    ),
  }),
);

export type PhoneOtpChallenge = typeof phoneOtpChallengesTable.$inferSelect;