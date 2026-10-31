import { and, eq, gte, isNull, phoneOtpChallengesTable } from "@workspace/db";
import { fingerprint } from "./request-security";
import { createSensitiveDataLookupIndex, normalizeSensitiveEmailForLookup } from "./sensitive-data-crypto";

export type CustomerOtpPurpose = "signup" | "password_reset" | "pin_reset";

export function verifiedCustomerOtpCondition(
  challengeId: string,
  phone: string,
  purpose: CustomerOtpPurpose,
  now: Date,
  email?: string,
) {
  return and(
    eq(phoneOtpChallengesTable.id, challengeId),
    eq(phoneOtpChallengesTable.phoneHash, fingerprint(`phone:${phone}`)),
    eq(phoneOtpChallengesTable.purpose, purpose),
    eq(phoneOtpChallengesTable.deliveryChannel, "email"),
    eq(phoneOtpChallengesTable.status, "verified"),
    eq(phoneOtpChallengesTable.emailVerified, true),
    email
      ? eq(
        phoneOtpChallengesTable.emailHash,
        createSensitiveDataLookupIndex(normalizeSensitiveEmailForLookup(email), "user-email"),
      )
      : undefined,
    isNull(phoneOtpChallengesTable.consumedAt),
    gte(phoneOtpChallengesTable.expiresAt, now),
  );
}