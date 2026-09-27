import { and, eq, gte, isNull, phoneOtpChallengesTable } from "@workspace/db";
import { fingerprint } from "./request-security";

export type CustomerOtpPurpose = "signup" | "password_reset" | "pin_reset";

export function verifiedCustomerOtpCondition(
  challengeId: string,
  phone: string,
  purpose: CustomerOtpPurpose,
  now: Date,
) {
  return and(
    eq(phoneOtpChallengesTable.id, challengeId),
    eq(phoneOtpChallengesTable.phoneHash, fingerprint(`phone:${phone}`)),
    eq(phoneOtpChallengesTable.purpose, purpose),
    eq(phoneOtpChallengesTable.status, "verified"),
    eq(phoneOtpChallengesTable.phoneVerified, true),
    isNull(phoneOtpChallengesTable.consumedAt),
    gte(phoneOtpChallengesTable.expiresAt, now),
  );
}