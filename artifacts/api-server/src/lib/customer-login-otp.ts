import { randomUUID } from "node:crypto";
import {
  and,
  db,
  desc,
  eq,
  gte,
  phoneOtpChallengesTable,
  phoneOtpEventsTable,
  sql,
} from "@workspace/db";
import type { Request } from "express";
import {
  EMAIL_OTP_LIFETIME_SECONDS,
  createEmailOtpCode,
  hashEmailOtpCode,
} from "./email-otp-code.ts";
import { renderEmailOtpContent } from "./email-otp-template.ts";
import {
  ResendConfigurationError,
  ResendDeliveryError,
  isResendEmailConfigured,
  sendResendEmail,
} from "./resend-email.ts";
import {
  assertExternalProviderCallsAllowed,
  ExternalProviderCallUnavailableError,
} from "./provider-call-policy.ts";
import { fingerprint, requesterAddress } from "./request-security.ts";

const OTP_PURPOSE = "customer_login" as const;
const OTP_RESEND_COOLDOWN_MS = 60_000;
const OTP_SENDS_PER_ACCOUNT_PER_HOUR = 5;
const OTP_SENDS_PER_EMAIL_PER_HOUR = 5;
const OTP_SENDS_PER_REQUESTER_PER_HOUR = 60;
const HOUR_MS = 60 * 60 * 1000;

export type CustomerLoginOtpResult =
  | {
      kind: "sent";
      challengeId: string;
      expiresAt: Date;
      resendAfterSeconds: number;
    }
  | { kind: "rate_limited"; retryAfterSeconds: number }
  | { kind: "unavailable" };

function retryAfterSeconds(until: Date, now: Date) {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000));
}

function providerFailureOutcome(error: unknown) {
  if (error instanceof ResendConfigurationError) return "configuration_error" as const;
  if (error instanceof ResendDeliveryError) {
    if (error.statusCode === 429) return "provider_rate_limited" as const;
    if (error.statusCode !== null) return "provider_rejected" as const;
  }
  return "provider_error" as const;
}

export async function sendCustomerLoginOtp(input: {
  userId: string;
  email: string;
  emailHash: string;
  req: Request;
  now?: Date;
}): Promise<CustomerLoginOtpResult> {
  const { userId, email, emailHash, req } = input;
  const now = input.now ?? new Date();
  if (!isResendEmailConfigured()) return { kind: "unavailable" };

  try {
    assertExternalProviderCallsAllowed("Resend");
  } catch (error) {
    if (error instanceof ExternalProviderCallUnavailableError) {
      return { kind: "unavailable" };
    }
    throw error;
  }

  const accountHash = fingerprint(`customer-login-account:${userId}`);
  const requesterHash = fingerprint(`requester:${requesterAddress(req)}`);
  const challengeId = randomUUID();
  const code = createEmailOtpCode();
  const codeHash = hashEmailOtpCode(challengeId, OTP_PURPOSE, code);
  const expiresAt = new Date(now.getTime() + EMAIL_OTP_LIFETIME_SECONDS * 1000);
  const resendAt = new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS);
  const hourAgo = new Date(now.getTime() - HOUR_MS);

  let reservation:
    | { kind: "reserved"; eventId: string }
    | { kind: "rate_limited"; retryAfterSeconds: number };
  try {
    reservation = await db.transaction(async (tx) => {
      const lockKeys = [
        `customer-login-otp-account:${userId}`,
        `customer-login-otp-email:${emailHash}`,
        `customer-login-otp-requester:${requesterHash}`,
      ].sort();
      for (const lockKey of lockKeys) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
      }

      const recentAccountChallenges = await tx
        .select({
          createdAt: phoneOtpChallengesTable.createdAt,
          resendAfter: phoneOtpChallengesTable.resendAfter,
        })
        .from(phoneOtpChallengesTable)
        .where(and(
          eq(phoneOtpChallengesTable.userId, userId),
          eq(phoneOtpChallengesTable.purpose, OTP_PURPOSE),
          eq(phoneOtpChallengesTable.deliveryChannel, "email"),
          gte(phoneOtpChallengesTable.createdAt, hourAgo),
        ))
        .orderBy(desc(phoneOtpChallengesTable.createdAt))
        .limit(OTP_SENDS_PER_ACCOUNT_PER_HOUR);

      const latestAccountChallenge = recentAccountChallenges[0];
      if (latestAccountChallenge && latestAccountChallenge.resendAfter > now) {
        return {
          kind: "rate_limited",
          retryAfterSeconds: retryAfterSeconds(latestAccountChallenge.resendAfter, now),
        } as const;
      }
      if (recentAccountChallenges.length >= OTP_SENDS_PER_ACCOUNT_PER_HOUR) {
        return {
          kind: "rate_limited",
          retryAfterSeconds: retryAfterSeconds(
            new Date(recentAccountChallenges.at(-1)!.createdAt.getTime() + HOUR_MS),
            now,
          ),
        } as const;
      }

      const recentEmailChallenges = await tx
        .select({ createdAt: phoneOtpChallengesTable.createdAt })
        .from(phoneOtpChallengesTable)
        .where(and(
          eq(phoneOtpChallengesTable.emailHash, emailHash),
          eq(phoneOtpChallengesTable.deliveryChannel, "email"),
          gte(phoneOtpChallengesTable.createdAt, hourAgo),
        ))
        .orderBy(desc(phoneOtpChallengesTable.createdAt))
        .limit(OTP_SENDS_PER_EMAIL_PER_HOUR);
      if (recentEmailChallenges.length >= OTP_SENDS_PER_EMAIL_PER_HOUR) {
        return {
          kind: "rate_limited",
          retryAfterSeconds: retryAfterSeconds(
            new Date(recentEmailChallenges.at(-1)!.createdAt.getTime() + HOUR_MS),
            now,
          ),
        } as const;
      }

      const recentRequesterChallenges = await tx
        .select({ createdAt: phoneOtpChallengesTable.createdAt })
        .from(phoneOtpChallengesTable)
        .where(and(
          eq(phoneOtpChallengesTable.requesterHash, requesterHash),
          eq(phoneOtpChallengesTable.deliveryChannel, "email"),
          gte(phoneOtpChallengesTable.createdAt, hourAgo),
        ))
        .orderBy(desc(phoneOtpChallengesTable.createdAt))
        .limit(OTP_SENDS_PER_REQUESTER_PER_HOUR);
      if (recentRequesterChallenges.length >= OTP_SENDS_PER_REQUESTER_PER_HOUR) {
        return {
          kind: "rate_limited",
          retryAfterSeconds: retryAfterSeconds(
            new Date(recentRequesterChallenges.at(-1)!.createdAt.getTime() + HOUR_MS),
            now,
          ),
        } as const;
      }

      await tx
        .update(phoneOtpChallengesTable)
        .set({ status: "superseded", codeHash: null })
        .where(and(
          eq(phoneOtpChallengesTable.userId, userId),
          eq(phoneOtpChallengesTable.purpose, OTP_PURPOSE),
          eq(phoneOtpChallengesTable.status, "pending"),
        ));

      const [challenge] = await tx
        .insert(phoneOtpChallengesTable)
        .values({
          id: challengeId,
          userId,
          phoneHash: accountHash,
          emailHash,
          codeHash,
          requesterHash,
          purpose: OTP_PURPOSE,
          deliveryChannel: "email",
          status: "starting",
          phoneVerified: false,
          emailVerified: false,
          checkAttempts: 0,
          createdAt: now,
          expiresAt,
          resendAfter: resendAt,
        })
        .returning({ id: phoneOtpChallengesTable.id });
      if (!challenge) throw new Error("Customer login OTP challenge could not be reserved");

      const [event] = await tx
        .insert(phoneOtpEventsTable)
        .values({
          challengeId: challenge.id,
          eventType: "send",
          outcome: "requested",
        })
        .returning({ id: phoneOtpEventsTable.id });
      if (!event) throw new Error("Customer login OTP event could not be reserved");
      return { kind: "reserved", eventId: event.id } as const;
    });
  } catch {
    return { kind: "unavailable" };
  }

  if (reservation.kind === "rate_limited") return reservation;

  try {
    const content = renderEmailOtpContent(OTP_PURPOSE, code, {
      publicSiteUrl: process.env.SENDFLOW_PUBLIC_SITE_URL,
      now,
    });
    const providerResult = await sendResendEmail(
      {
        to: email,
        subject: content.subject,
        text: content.text,
        html: content.html,
        tags: [{ name: "flow", value: "customer-login" }],
      },
      { idempotencyKey: `customer-login-${challengeId}` },
    );
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(phoneOtpChallengesTable)
        .set({
          status: "pending",
          providerMessageId: providerResult.messageId,
        })
        .where(and(
          eq(phoneOtpChallengesTable.id, challengeId),
          eq(phoneOtpChallengesTable.status, "starting"),
        ))
        .returning({ id: phoneOtpChallengesTable.id });
      if (!updated) throw new Error("Customer login OTP challenge state changed");
      await tx
        .update(phoneOtpEventsTable)
        .set({
          outcome: "provider_accepted",
          providerHttpStatus: providerResult.statusCode,
          diagnosticMessage: null,
          completedAt: new Date(),
        })
        .where(eq(phoneOtpEventsTable.id, reservation.eventId));
    });
    return {
      kind: "sent",
      challengeId,
      expiresAt,
      resendAfterSeconds: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000),
    };
  } catch (error) {
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(phoneOtpChallengesTable)
          .set({ status: "failed", codeHash: null })
          .where(and(
            eq(phoneOtpChallengesTable.id, challengeId),
            eq(phoneOtpChallengesTable.status, "starting"),
          ));
        await tx
          .update(phoneOtpEventsTable)
          .set({
            outcome: providerFailureOutcome(error),
            providerHttpStatus: error instanceof ResendDeliveryError ? error.statusCode : null,
            diagnosticMessage: "Customer login OTP delivery was not confirmed.",
            completedAt: new Date(),
          })
          .where(eq(phoneOtpEventsTable.id, reservation.eventId));
      });
    } catch {
      // Keep provider and database diagnostics free of code, email, and secret values.
    }
    return { kind: "unavailable" };
  }
}
