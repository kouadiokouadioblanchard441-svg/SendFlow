import { randomInt, timingSafeEqual } from "node:crypto";
import { fingerprint } from "./request-security.ts";

export type EmailOtpPurpose = "signup" | "password_reset" | "pin_reset";

export const EMAIL_OTP_LIFETIME_SECONDS = 5 * 60;

export function createEmailOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashEmailOtpCode(challengeId: string, purpose: EmailOtpPurpose, code: string) {
  return fingerprint(`sendflow-email-otp:${purpose}:${challengeId}:${code}`);
}

export function matchesEmailOtpCode(
  challengeId: string,
  purpose: EmailOtpPurpose,
  code: string,
  expectedHash: string,
) {
  if (!/^[0-9]{6}$/.test(code) || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const submittedHash = hashEmailOtpCode(challengeId, purpose, code);
  const submittedBytes = Buffer.from(submittedHash, "hex");
  const expectedBytes = Buffer.from(expectedHash, "hex");
  return submittedBytes.length === expectedBytes.length
    && timingSafeEqual(submittedBytes, expectedBytes);
}
