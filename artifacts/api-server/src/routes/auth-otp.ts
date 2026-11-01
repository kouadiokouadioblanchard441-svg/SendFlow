import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import {
  and,
  adminGrantsTable,
  db,
  desc,
  eq,
  gte,
  isNull,
  lt,
  or,
  phoneOtpChallengesTable,
  phoneOtpEventsTable,
  sql,
  usersTable,
  type PhoneOtpEventOutcome,
} from "@workspace/db";
import {
  SendEmailOtpBody,
  SendEmailOtpResponse,
  VerifyEmailOtpBody,
  VerifyEmailOtpResponse,
} from "@workspace/api-zod";
import {
  ResendConfigurationError,
  ResendDeliveryError,
  sendResendEmail,
} from "../lib/resend-email";
import { renderEmailOtpContent } from "../lib/email-otp-template";
import {
  assertExternalProviderCallsAllowed,
  ExternalProviderCallUnavailableError,
} from "../lib/provider-call-policy";
import {
  EMAIL_OTP_LIFETIME_SECONDS,
  createEmailOtpCode,
  hashEmailOtpCode,
  matchesEmailOtpCode,
  type EmailOtpPurpose,
} from "../lib/email-otp-code";
import {
  createSensitiveDataLookupIndex,
  decryptSensitiveDataIfEncrypted,
  normalizeSensitiveEmailForLookup,
} from "../lib/sensitive-data-crypto";
import { fingerprint, isTrustedOrigin, requesterAddress } from "../lib/request-security";
import {
  rejectTurnstileRequest,
  verifyTurnstileRequest,
} from "../lib/turnstile";
import {
  CUSTOMER_ACCESS_RATE_LIMIT_POLICY,
  formatAuthRateLimitMessage,
  getCustomerAccessAttemptBuckets,
  getCustomerAccessAttemptBucketsForRequest,
  getAuthRateLimit,
  recordAuthFailureAndGetRetryAfter,
  withAuthAttemptLock,
  type AuthRateLimitDatabase,
} from "../lib/customer-auth-rate-limit";

const router: IRouter = Router();
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_PHONE_PER_HOUR = 5;
const MAX_SENDS_PER_EMAIL_PER_HOUR = 5;
const MAX_SENDS_PER_REQUESTER_PER_HOUR = 60;
const MAX_CODE_CHECKS = 5;
const MAX_SIGNUP_CODE_CHECKS = CUSTOMER_ACCESS_RATE_LIMIT_POLICY.maxFailures;
const HOUR_MS = 60 * 60 * 1000;

type OtpPurpose = EmailOtpPurpose;
type OtpRecipient = { email: string; emailHash: string };

function retryAfterSeconds(until: Date, now = new Date()) {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000));
}

function sendRateLimitResponse(res: Response, error: string, seconds: number) {
  res.status(429).json({
    error,
    retryAfterSeconds: Math.max(1, seconds),
  });
}

function hasSignupPurpose(body: unknown) {
  return typeof body === "object"
    && body !== null
    && "purpose" in body
    && body.purpose === "signup";
}

function emailOtpConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
}

function normalizeEmail(value: string) {
  return normalizeSensitiveEmailForLookup(value);
}

async function resolveOtpRecipient(
  phone: string,
  purpose: OtpPurpose,
  signupEmail?: string,
): Promise<OtpRecipient | null> {
  if (purpose === "signup") {
    if (!signupEmail) return null;
    const email = normalizeEmail(signupEmail);
    return { email, emailHash: createSensitiveDataLookupIndex(email, "user-email") };
  }

  const phoneLookupHash = createSensitiveDataLookupIndex(phone, "user-phone");
  const [user] = await db
    .select({
      id: usersTable.id,
      status: usersTable.status,
      emailEncrypted: usersTable.emailEncrypted,
      emailLookupHash: usersTable.emailLookupHash,
    })
    .from(usersTable)
    .where(or(
      eq(usersTable.phoneLookupHash, phoneLookupHash),
      eq(usersTable.phone, phone),
    ))
    .limit(1);

  if (!user || user.status !== "active" || !user.emailEncrypted) return null;
  if (purpose === "admin_login") {
    const [grant] = await db
      .select({ userId: adminGrantsTable.userId })
      .from(adminGrantsTable)
      .where(and(eq(adminGrantsTable.userId, user.id), isNull(adminGrantsTable.revokedAt)))
      .limit(1);
    if (!grant) return null;
  }

  const storedEmail = decryptSensitiveDataIfEncrypted(user.emailEncrypted, "user-email");
  if (!storedEmail) return null;
  const email = normalizeEmail(storedEmail);
  return {
    email,
    emailHash: user.emailLookupHash ?? createSensitiveDataLookupIndex(email, "user-email"),
  };
}

async function resolvePasswordResetOtpRecipient(
  email: string,
  emailLookupHash: string,
): Promise<OtpRecipient | null> {
  const [user] = await db
    .select({
      status: usersTable.status,
      emailEncrypted: usersTable.emailEncrypted,
      emailLookupHash: usersTable.emailLookupHash,
      emailVerifiedAt: usersTable.emailVerifiedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.emailLookupHash, emailLookupHash))
    .limit(1);

  if (
    !user
    || user.status !== "active"
    || !user.emailEncrypted
    || !user.emailVerifiedAt
    || user.emailLookupHash !== emailLookupHash
  ) return null;

  const storedEmail = decryptSensitiveDataIfEncrypted(user.emailEncrypted, "user-email");
  if (!storedEmail) return null;
  const normalizedEmail = normalizeEmail(storedEmail);
  if (normalizedEmail !== email || createSensitiveDataLookupIndex(normalizedEmail, "user-email") !== emailLookupHash) {
    return null;
  }

  return { email: normalizedEmail, emailHash: emailLookupHash };
}

async function getSignupAttemptBucketsForVerifyRequest(
  req: Parameters<typeof requesterAddress>[0],
) {
  let challengeId: string | null = null;
  if (typeof req.body === "object" && req.body !== null && !Array.isArray(req.body)) {
    const parsedId = VerifyEmailOtpBody.shape.challengeId.safeParse(
      (req.body as { challengeId?: unknown }).challengeId,
    );
    if (parsedId.success) challengeId = parsedId.data;
  }

  if (challengeId) {
    const [identity] = await db
      .select({
        phoneHash: phoneOtpChallengesTable.phoneHash,
        emailHash: phoneOtpChallengesTable.emailHash,
        requesterHash: phoneOtpChallengesTable.requesterHash,
      })
      .from(phoneOtpChallengesTable)
      .where(eq(phoneOtpChallengesTable.id, challengeId))
      .limit(1);
    if (identity) {
      return [
        ...getCustomerAccessAttemptBuckets(identity.phoneHash, identity.requesterHash),
        ...(identity.emailHash ? [fingerprint(`signup-email:${identity.emailHash}`)] : []),
      ];
    }
  }

  return getCustomerAccessAttemptBucketsForRequest(null, requesterAddress(req));
}

async function isSignupRateLimited(
  req: Parameters<typeof requesterAddress>[0],
  res: Response,
  buckets: string[],
) {
  try {
    const retry = await withAuthAttemptLock(buckets, (tx) => getAuthRateLimit(buckets, new Date(), tx));
    if (retry === null) return false;
    sendRateLimitResponse(res, formatAuthRateLimitMessage(retry), retry);
    return true;
  } catch (error) {
    req.log.error({ err: error }, "Signup rate-limit lookup failed");
    res.status(503).json({ error: "La vérification du compte est momentanément indisponible." });
    return true;
  }
}

async function recordSignupFailure(
  req: Parameters<typeof requesterAddress>[0],
  res: Response,
  buckets: string[],
) {
  try {
    const retry = await recordAuthFailureAndGetRetryAfter(
      buckets,
      new Date(),
      CUSTOMER_ACCESS_RATE_LIMIT_POLICY,
    );
    if (retry === null) return false;
    sendRateLimitResponse(res, formatAuthRateLimitMessage(retry), retry);
    return true;
  } catch (error) {
    req.log.error({ err: error }, "Signup rate-limit storage failed");
    res.status(503).json({ error: "La vérification du compte est momentanément indisponible." });
    return true;
  }
}

function providerFailureDetails(error: unknown): {
  outcome: PhoneOtpEventOutcome;
  providerHttpStatus: number | null;
  diagnosticMessage: string;
} {
  if (error instanceof ResendConfigurationError) {
    return {
      outcome: "configuration_error",
      providerHttpStatus: null,
      diagnosticMessage: "Transactional email delivery is not configured.",
    };
  }
  if (error instanceof ResendDeliveryError) {
    return {
      outcome: error.statusCode !== null && error.statusCode >= 400 && error.statusCode < 500
        ? "provider_rejected"
        : "provider_error",
      providerHttpStatus: error.statusCode,
      diagnosticMessage: "Transactional email delivery failed.",
    };
  }
  return {
    outcome: "provider_error",
    providerHttpStatus: null,
    diagnosticMessage: "Transactional email delivery failed.",
  };
}

async function completeOtpEvent(
  eventId: string,
  outcome: PhoneOtpEventOutcome,
  details: {
    providerHttpStatus?: number | null;
    diagnosticMessage?: string | null;
  } = {},
) {
  const [event] = await db
    .update(phoneOtpEventsTable)
    .set({
      outcome,
      providerHttpStatus: details.providerHttpStatus ?? null,
      diagnosticMessage: details.diagnosticMessage ?? null,
      completedAt: new Date(),
    })
    .where(eq(phoneOtpEventsTable.id, eventId))
    .returning({ id: phoneOtpEventsTable.id });
  if (!event) throw new Error("OTP activity event was not found");
}

router.post("/auth/send-otp", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }

  const rawBody = typeof req.body === "object" && req.body !== null
    ? req.body as Record<string, unknown>
    : {};
  const requiresTurnstile = rawBody.purpose === "signup"
    || rawBody.purpose === "password_reset";
  if (
    requiresTurnstile
    && (typeof rawBody.turnstileToken !== "string" || rawBody.turnstileToken.length === 0)
  ) {
    rejectTurnstileRequest(req, res, {
      success: false,
      category: "missing_token",
      unavailable: false,
    });
    return;
  }

  const parsed = SendEmailOtpBody.safeParse(req.body);
  const invalidIdentifier = parsed.success && (
    parsed.data.purpose === "password_reset"
      ? !parsed.data.email || Object.hasOwn(req.body ?? {}, "phone")
      : !parsed.data.phone || (parsed.data.purpose === "signup" && !parsed.data.email)
  );
  if (!parsed.success || invalidIdentifier) {
    if (hasSignupPurpose(req.body)) {
      try {
        const buckets = getCustomerAccessAttemptBucketsForRequest(null, requesterAddress(req));
        if (await recordSignupFailure(req, res, buckets)) return;
      } catch (error) {
        req.log.error({ err: error }, "Invalid signup OTP request could not be rate-limited");
        res.status(503).json({ error: "La vérification du compte est momentanément indisponible." });
        return;
      }
    }
    res.status(400).json({ error: "Adresse e-mail ou numéro de compte invalide." });
    return;
  }

  if (parsed.data.purpose === "signup" || parsed.data.purpose === "password_reset") {
    const turnstile = await verifyTurnstileRequest(
      req,
      parsed.data.turnstileToken,
      parsed.data.purpose === "signup" ? "signup" : "password_reset",
    );
    if (!turnstile.success) {
      rejectTurnstileRequest(req, res, turnstile);
      return;
    }
  }

  if (!emailOtpConfigured()) {
    res.status(503).json({ error: "La vérification par e-mail n'est pas configurée." });
    return;
  }
  try {
    assertExternalProviderCallsAllowed("Resend");
  } catch (error) {
    if (error instanceof ExternalProviderCallUnavailableError) {
      res.status(503).json({ error: "La vérification par e-mail n'est pas disponible dans cet environnement." });
      return;
    }
    throw error;
  }

  const purpose = parsed.data.purpose as OtpPurpose;
  const phone = "phone" in parsed.data ? parsed.data.phone : null;
  const providedEmail = "email" in parsed.data ? parsed.data.email : undefined;
  const recoveryEmail = purpose === "password_reset" && providedEmail
    ? normalizeEmail(providedEmail)
    : null;
  let phoneHash: string;
  let emailLookupHash: string | null = null;
  let requesterHash: string;
  try {
    if (recoveryEmail) {
      emailLookupHash = createSensitiveDataLookupIndex(recoveryEmail, "user-email");
      // Keep the existing challenge column opaque and account-specific without
      // requiring the customer to disclose a phone number during recovery.
      phoneHash = fingerprint(`password-reset-email:${emailLookupHash}`);
    } else if (phone) {
      phoneHash = fingerprint(`phone:${phone}`);
    } else {
      throw new Error("OTP identity is missing");
    }
    requesterHash = fingerprint(`requester:${requesterAddress(req)}`);
  } catch (error) {
    req.log.error({ err: error }, "Email OTP fingerprinting is unavailable");
    res.status(503).json({ error: "La vérification par e-mail est indisponible." });
    return;
  }

  let recipient: OtpRecipient | null;
  try {
    recipient = recoveryEmail && emailLookupHash
      ? await resolvePasswordResetOtpRecipient(recoveryEmail, emailLookupHash)
      : await resolveOtpRecipient(phone!, purpose, providedEmail);
  } catch (error) {
    req.log.error({ err: error }, "Email OTP recipient lookup failed");
    res.status(503).json({ error: "La vérification par e-mail est indisponible." });
    return;
  }

  let signupBuckets: string[] | null = null;
  if (purpose === "signup") {
    try {
      signupBuckets = getCustomerAccessAttemptBuckets(phoneHash, requesterHash);
      if (recipient) signupBuckets.push(fingerprint(`signup-email:${recipient.emailHash}`));
      if (await isSignupRateLimited(req, res, signupBuckets)) return;
    } catch (error) {
      req.log.error({ err: error }, "Signup OTP rate-limit identity could not be computed");
      res.status(503).json({ error: "La vérification du compte est momentanément indisponible." });
      return;
    }
  }

  const now = new Date();
  const hourAgo = new Date(now.getTime() - HOUR_MS);
  const expiresAt = new Date(now.getTime() + EMAIL_OTP_LIFETIME_SECONDS * 1000);
  const resendAt = new Date(now.getTime() + RESEND_COOLDOWN_SECONDS * 1000);
  const challengeId = randomUUID();
  const code = recipient ? createEmailOtpCode() : null;
  const codeHash = recipient && code ? hashEmailOtpCode(challengeId, purpose, code) : null;
  const rateEmailHash = recipient?.emailHash ?? emailLookupHash ?? fingerprint(`unknown-email:${phoneHash}`);

  let reservation:
    | { rateLimited: true; retryAfterSeconds: number; reason: "cooldown" | "phone" | "email" | "requester" | "account" }
    | { rateLimited: false; id: string; eventId: string | null; shouldSend: boolean };

  try {
    reservation = await db.transaction(async (tx) => {
      const lockKeys = [
        ...(signupBuckets ?? []),
        `sendflow-otp-identity:${phoneHash}`,
        `sendflow-otp-email:${rateEmailHash}`,
        `sendflow-otp-requester:${requesterHash}`,
      ].sort();
      for (const lockKey of lockKeys) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
      }

      if (signupBuckets) {
        const accountRetry = await getAuthRateLimit(signupBuckets, now, tx);
        if (accountRetry !== null) {
          return { rateLimited: true, retryAfterSeconds: accountRetry, reason: "account" } as const;
        }
      }

      await tx
        .update(phoneOtpChallengesTable)
        .set({ status: "expired", codeHash: null })
        .where(and(
          eq(phoneOtpChallengesTable.phoneHash, phoneHash),
          eq(phoneOtpChallengesTable.status, "pending"),
          lt(phoneOtpChallengesTable.expiresAt, now),
        ));

      const recentPhoneChallenges = await tx
        .select({
          createdAt: phoneOtpChallengesTable.createdAt,
          resendAfter: phoneOtpChallengesTable.resendAfter,
        })
        .from(phoneOtpChallengesTable)
        .where(and(
          eq(phoneOtpChallengesTable.phoneHash, phoneHash),
          gte(phoneOtpChallengesTable.createdAt, hourAgo),
        ))
        .orderBy(desc(phoneOtpChallengesTable.createdAt))
        .limit(MAX_SENDS_PER_PHONE_PER_HOUR);

      const latestPhoneChallenge = recentPhoneChallenges[0];
      if (latestPhoneChallenge && latestPhoneChallenge.resendAfter > now) {
        return {
          rateLimited: true,
          retryAfterSeconds: retryAfterSeconds(latestPhoneChallenge.resendAfter, now),
          reason: "cooldown",
        } as const;
      }
      if (recentPhoneChallenges.length >= MAX_SENDS_PER_PHONE_PER_HOUR) {
        const oldestAllowedChallenge = recentPhoneChallenges[recentPhoneChallenges.length - 1]!;
        return {
          rateLimited: true,
          retryAfterSeconds: retryAfterSeconds(
            new Date(oldestAllowedChallenge.createdAt.getTime() + HOUR_MS),
            now,
          ),
          reason: "phone",
        } as const;
      }

      const recentEmailChallenges = await tx
        .select({ createdAt: phoneOtpChallengesTable.createdAt })
        .from(phoneOtpChallengesTable)
        .where(and(
          eq(phoneOtpChallengesTable.emailHash, rateEmailHash),
          gte(phoneOtpChallengesTable.createdAt, hourAgo),
        ))
        .orderBy(desc(phoneOtpChallengesTable.createdAt))
        .limit(MAX_SENDS_PER_EMAIL_PER_HOUR);
      if (recentEmailChallenges.length >= MAX_SENDS_PER_EMAIL_PER_HOUR) {
        const oldestAllowedChallenge = recentEmailChallenges[recentEmailChallenges.length - 1]!;
        return {
          rateLimited: true,
          retryAfterSeconds: retryAfterSeconds(
            new Date(oldestAllowedChallenge.createdAt.getTime() + HOUR_MS),
            now,
          ),
          reason: "email",
        } as const;
      }

      const recentRequesterChallenges = await tx
        .select({ createdAt: phoneOtpChallengesTable.createdAt })
        .from(phoneOtpChallengesTable)
        .where(and(
          eq(phoneOtpChallengesTable.requesterHash, requesterHash),
          gte(phoneOtpChallengesTable.createdAt, hourAgo),
        ))
        .orderBy(desc(phoneOtpChallengesTable.createdAt))
        .limit(MAX_SENDS_PER_REQUESTER_PER_HOUR);
      if (recentRequesterChallenges.length >= MAX_SENDS_PER_REQUESTER_PER_HOUR) {
        const oldestAllowedChallenge = recentRequesterChallenges[recentRequesterChallenges.length - 1]!;
        return {
          rateLimited: true,
          retryAfterSeconds: retryAfterSeconds(
            new Date(oldestAllowedChallenge.createdAt.getTime() + HOUR_MS),
            now,
          ),
          reason: "requester",
        } as const;
      }

      await tx
        .update(phoneOtpChallengesTable)
        .set({ status: "superseded", codeHash: null })
        .where(and(
          eq(phoneOtpChallengesTable.phoneHash, phoneHash),
          eq(phoneOtpChallengesTable.status, "pending"),
        ));

      const shouldSend = recipient !== null;
      const [challenge] = await tx
        .insert(phoneOtpChallengesTable)
        .values({
          id: challengeId,
          phoneHash,
          emailHash: rateEmailHash,
          codeHash,
          requesterHash,
          purpose,
          deliveryChannel: "email",
          status: shouldSend ? "starting" : "failed",
          phoneVerified: false,
          emailVerified: false,
          checkAttempts: 0,
          createdAt: now,
          expiresAt,
          resendAfter: resendAt,
        })
        .returning({ id: phoneOtpChallengesTable.id });
      if (!challenge) throw new Error("OTP challenge could not be reserved");

      let eventId: string | null = null;
      if (shouldSend) {
        const [event] = await tx
          .insert(phoneOtpEventsTable)
          .values({
            challengeId: challenge.id,
            eventType: "send",
            outcome: "requested",
          })
          .returning({ id: phoneOtpEventsTable.id });
        if (!event) throw new Error("OTP activity event could not be created");
        eventId = event.id;
      }
      return { rateLimited: false, id: challenge.id, eventId, shouldSend } as const;
    });
  } catch (error) {
    req.log.error({ err: error }, "Email OTP send reservation failed");
    res.status(503).json({ error: "La vérification par e-mail est indisponible." });
    return;
  }

  if (reservation.rateLimited) {
    const message = reservation.reason === "account"
      ? formatAuthRateLimitMessage(reservation.retryAfterSeconds)
      : reservation.reason === "cooldown"
        ? "Attendez avant de demander un nouveau code."
        : "Trop de demandes de code. Réessayez plus tard.";
    sendRateLimitResponse(res, message, reservation.retryAfterSeconds);
    return;
  }

  if (reservation.shouldSend && recipient && code && reservation.eventId) {
    try {
      const email = renderEmailOtpContent(purpose, code, {
        publicSiteUrl: process.env.SENDFLOW_PUBLIC_SITE_URL,
      });
      const providerResult = await sendResendEmail({
        to: recipient.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      await db.transaction(async (tx) => {
        const [updatedChallenge] = await tx
          .update(phoneOtpChallengesTable)
          .set({ providerMessageId: providerResult.messageId, status: "pending" })
          .where(and(
            eq(phoneOtpChallengesTable.id, reservation.id),
            eq(phoneOtpChallengesTable.status, "starting"),
          ))
          .returning({ id: phoneOtpChallengesTable.id });
        if (!updatedChallenge) throw new Error("OTP challenge state could not be updated");
        await tx
          .update(phoneOtpEventsTable)
          .set({
            outcome: "provider_accepted",
            providerHttpStatus: providerResult.statusCode,
            diagnosticMessage: null,
            completedAt: new Date(),
          })
          .where(eq(phoneOtpEventsTable.id, reservation.eventId!));
      });
    } catch (error) {
      const failure = providerFailureDetails(error);
      try {
        await db.transaction(async (tx) => {
          await tx
            .update(phoneOtpChallengesTable)
            .set({ status: "failed", codeHash: null })
            .where(and(
              eq(phoneOtpChallengesTable.id, reservation.id),
              eq(phoneOtpChallengesTable.status, "starting"),
            ));
          await tx
            .update(phoneOtpEventsTable)
            .set({ ...failure, completedAt: new Date() })
            .where(eq(phoneOtpEventsTable.id, reservation.eventId!));
        });
      } catch (storageError) {
        req.log.error({ err: storageError, challengeId: reservation.id }, "Failed OTP email request could not be marked");
      }

      if (purpose === "password_reset") {
        req.log.warn(
          { challengeId: reservation.id, providerHttpStatus: failure.providerHttpStatus },
          "Password reset email delivery could not be confirmed",
        );
        res.status(202).json(
          SendEmailOtpResponse.parse({
            challengeId: reservation.id,
            expiresAt,
            resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
          }),
        );
        return;
      }

      if (error instanceof ExternalProviderCallUnavailableError || error instanceof ResendConfigurationError) {
        res.status(503).json({ error: "La vérification par e-mail n'est pas disponible dans cet environnement." });
        return;
      }
      req.log.warn(
        { challengeId: reservation.id, providerHttpStatus: failure.providerHttpStatus },
        "OTP email delivery failed",
      );
      res.status(502).json({ error: "L'envoi du code par e-mail est momentanément indisponible." });
      return;
    }
  }

  res.status(202).json(
    SendEmailOtpResponse.parse({
      challengeId: reservation.id,
      expiresAt,
      resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
    }),
  );
});

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }

  const parsed = VerifyEmailOtpBody.safeParse(req.body);
  if (!parsed.success) {
    if (hasSignupPurpose(req.body)) {
      try {
        const buckets = await getSignupAttemptBucketsForVerifyRequest(req);
        if (await recordSignupFailure(req, res, buckets)) return;
      } catch (error) {
        req.log.error({ err: error }, "Invalid signup OTP check could not be rate-limited");
        res.status(503).json({ error: "La vérification du compte est momentanément indisponible." });
        return;
      }
    }
    res.status(400).json({ error: "Code de vérification invalide." });
    return;
  }

  const purpose = parsed.data.purpose as OtpPurpose;
  let signupBuckets: string[] | null = null;
  if (purpose === "signup") {
    try {
      signupBuckets = await getSignupAttemptBucketsForVerifyRequest(req);
    } catch (error) {
      req.log.error({ err: error }, "Signup OTP rate-limit identity lookup failed");
      res.status(503).json({ error: "La vérification du compte est momentanément indisponible." });
      return;
    }
    if (await isSignupRateLimited(req, res, signupBuckets)) return;
  }

  const now = new Date();
  const maxCodeChecks = purpose === "signup" ? MAX_SIGNUP_CODE_CHECKS : MAX_CODE_CHECKS;
  type VerificationReservation =
    | { kind: "missing" }
    | { kind: "rate"; retry: number }
    | { kind: "expired" | "locked" | "inactive"; eventId: string }
    | { kind: "verified"; verifiedAt: Date; eventId: string }
    | { kind: "check"; emailHash: string; codeHash: string; attemptNumber: number; eventId: string };

  const reserveVerification = async (tx: AuthRateLimitDatabase): Promise<VerificationReservation> => {
    const [challenge] = await tx
      .select()
      .from(phoneOtpChallengesTable)
      .where(eq(phoneOtpChallengesTable.id, parsed.data.challengeId))
      .for("update");
    if (!challenge) return { kind: "missing" };

    const createEvent = async (outcome: PhoneOtpEventOutcome, attemptNumber?: number) => {
      const [event] = await tx
        .insert(phoneOtpEventsTable)
        .values({
          challengeId: challenge.id,
          eventType: "verify",
          outcome,
          attemptNumber,
          completedAt: outcome === "requested" ? null : now,
        })
        .returning({ id: phoneOtpEventsTable.id });
      if (!event) throw new Error("OTP activity event could not be created");
      return event.id;
    };

    if (challenge.purpose !== purpose
      || challenge.deliveryChannel !== "email"
      || !challenge.emailHash
      || challenge.consumedAt) {
      return { kind: "inactive", eventId: await createEvent("challenge_inactive") };
    }
    if (
      challenge.status === "expired"
      || (["pending", "verified"].includes(challenge.status) && challenge.expiresAt <= now)
    ) {
      await tx.update(phoneOtpChallengesTable)
        .set({ status: "expired", codeHash: null })
        .where(eq(phoneOtpChallengesTable.id, challenge.id));
      return { kind: "expired", eventId: await createEvent("challenge_expired") };
    }
    if (challenge.emailVerified && challenge.verifiedAt) {
      return {
        kind: "verified",
        verifiedAt: challenge.verifiedAt,
        eventId: await createEvent("already_verified"),
      };
    }
    if (challenge.status === "locked"
      || (challenge.status === "pending" && challenge.checkAttempts >= maxCodeChecks)) {
      await tx.update(phoneOtpChallengesTable)
        .set({ status: "locked", codeHash: null })
        .where(eq(phoneOtpChallengesTable.id, challenge.id));
      return { kind: "locked", eventId: await createEvent("challenge_locked") };
    }
    if (challenge.status !== "pending" || !challenge.codeHash) {
      return { kind: "inactive", eventId: await createEvent("challenge_inactive") };
    }

    const attemptNumber = challenge.checkAttempts + 1;
    await tx.update(phoneOtpChallengesTable)
      .set({ checkAttempts: attemptNumber })
      .where(eq(phoneOtpChallengesTable.id, challenge.id));
    return {
      kind: "check",
      emailHash: challenge.emailHash,
      codeHash: challenge.codeHash,
      attemptNumber,
      eventId: await createEvent("requested", attemptNumber),
    };
  };

  let reservation: VerificationReservation;
  try {
    if (signupBuckets) {
      const buckets = signupBuckets;
      reservation = await withAuthAttemptLock(buckets, async (tx) => {
        const retry = await getAuthRateLimit(buckets, new Date(), tx);
        if (retry !== null) return { kind: "rate", retry };
        return reserveVerification(tx);
      });
    } else {
      reservation = await db.transaction(reserveVerification);
    }
  } catch (error) {
    req.log.error({ err: error }, "Email OTP verification reservation failed");
    res.status(503).json({ error: "La vérification par e-mail est indisponible." });
    return;
  }

  if (reservation.kind === "rate") {
    sendRateLimitResponse(res, formatAuthRateLimitMessage(reservation.retry), reservation.retry);
    return;
  }
  if (["missing", "inactive", "expired", "locked"].includes(reservation.kind)) {
    if (signupBuckets && await recordSignupFailure(req, res, signupBuckets)) return;
  }
  if (reservation.kind === "missing" || reservation.kind === "inactive") {
    res.status(409).json({ error: "Cette vérification n'est plus active. Demandez un nouveau code." });
    return;
  }
  if (reservation.kind === "expired") {
    res.status(409).json({ error: "Ce code a expiré. Demandez un nouveau code." });
    return;
  }
  if (reservation.kind === "locked") {
    res.status(409).json({ error: "Trop de codes incorrects. Demandez un nouveau code." });
    return;
  }
  if (reservation.kind === "verified") {
    res.json(VerifyEmailOtpResponse.parse({
      emailVerified: true,
      verifiedAt: reservation.verifiedAt,
    }));
    return;
  }
  if (reservation.kind !== "check") {
    res.status(409).json({ error: "Cette vérification n'est plus active. Demandez un nouveau code." });
    return;
  }

  if (!matchesEmailOtpCode(parsed.data.challengeId, purpose, parsed.data.code, reservation.codeHash)) {
    try {
      await db.transaction(async (tx) => {
        if (reservation.attemptNumber >= maxCodeChecks) {
          await tx.update(phoneOtpChallengesTable)
            .set({ status: "locked", codeHash: null })
            .where(and(
              eq(phoneOtpChallengesTable.id, parsed.data.challengeId),
              eq(phoneOtpChallengesTable.status, "pending"),
              gte(phoneOtpChallengesTable.checkAttempts, maxCodeChecks),
            ));
        }
        await tx.update(phoneOtpEventsTable)
          .set({
            outcome: reservation.attemptNumber >= maxCodeChecks ? "challenge_locked" : "not_approved",
            diagnosticMessage: null,
            completedAt: new Date(),
          })
          .where(eq(phoneOtpEventsTable.id, reservation.eventId));
      });
    } catch (error) {
      req.log.error({ err: error, challengeId: parsed.data.challengeId }, "OTP rejection could not be recorded");
      res.status(503).json({ error: "La vérification par e-mail est indisponible." });
      return;
    }
    if (signupBuckets && await recordSignupFailure(req, res, signupBuckets)) return;
    if (reservation.attemptNumber >= maxCodeChecks) {
      res.status(409).json({ error: "Trop de codes incorrects. Demandez un nouveau code." });
      return;
    }
    res.status(400).json({ error: "Code incorrect. Vérifiez le code reçu par e-mail." });
    return;
  }

  const verifiedAt = new Date();
  const finalizeVerification = async (tx: AuthRateLimitDatabase) => {
    const [challenge] = await tx
      .select()
      .from(phoneOtpChallengesTable)
      .where(eq(phoneOtpChallengesTable.id, parsed.data.challengeId))
      .for("update");
    if (!challenge
      || challenge.purpose !== purpose
      || challenge.deliveryChannel !== "email"
      || challenge.consumedAt
      || challenge.status !== "pending"
      || challenge.expiresAt <= verifiedAt
      || !challenge.emailHash
      || !challenge.codeHash
      || !matchesEmailOtpCode(parsed.data.challengeId, purpose, parsed.data.code, challenge.codeHash)) {
      if (challenge && challenge.status === "pending" && challenge.expiresAt <= verifiedAt) {
        await tx.update(phoneOtpChallengesTable)
          .set({ status: "expired", codeHash: null })
          .where(eq(phoneOtpChallengesTable.id, challenge.id));
      }
      await tx.update(phoneOtpEventsTable)
        .set({
          outcome: "state_conflict",
          diagnosticMessage: null,
          completedAt: new Date(),
        })
        .where(eq(phoneOtpEventsTable.id, reservation.eventId));
      return { kind: "inactive" } as const;
    }

    const [updated] = await tx.update(phoneOtpChallengesTable)
      .set({
        status: "verified",
        phoneVerified: false,
        emailVerified: true,
        codeHash: null,
        verifiedAt,
      })
      .where(eq(phoneOtpChallengesTable.id, challenge.id))
      .returning({ verifiedAt: phoneOtpChallengesTable.verifiedAt, emailHash: phoneOtpChallengesTable.emailHash });
    if (!updated?.verifiedAt || !updated.emailHash) throw new Error("Verified email OTP state was not stored");

    await tx.update(usersTable)
      .set({ emailVerifiedAt: verifiedAt })
      .where(eq(usersTable.emailLookupHash, updated.emailHash));

    await tx.update(phoneOtpEventsTable)
      .set({
        outcome: "verified",
        diagnosticMessage: null,
        completedAt: new Date(),
      })
      .where(eq(phoneOtpEventsTable.id, reservation.eventId));
    return { kind: "verified", verifiedAt: updated.verifiedAt } as const;
  };

  try {
    let outcome:
      | { kind: "inactive" }
      | { kind: "verified"; verifiedAt: Date }
      | { kind: "rate"; retry: number };
    if (signupBuckets) {
      outcome = await withAuthAttemptLock(signupBuckets, async (tx) => {
        const retry = await getAuthRateLimit(signupBuckets!, new Date(), tx);
        if (retry !== null) {
          await tx.update(phoneOtpChallengesTable)
            .set({ status: "locked", codeHash: null })
            .where(and(
              eq(phoneOtpChallengesTable.id, parsed.data.challengeId),
              eq(phoneOtpChallengesTable.status, "pending"),
            ));
          await tx.update(phoneOtpEventsTable)
            .set({
              outcome: "challenge_locked",
              diagnosticMessage: "Customer access was rate-limited during email OTP verification.",
              completedAt: new Date(),
            })
            .where(eq(phoneOtpEventsTable.id, reservation.eventId));
          return { kind: "rate", retry };
        }
        return finalizeVerification(tx);
      });
    } else {
      outcome = await db.transaction(finalizeVerification);
    }

    if (outcome.kind === "rate") {
      sendRateLimitResponse(res, formatAuthRateLimitMessage(outcome.retry), outcome.retry);
      return;
    }
    if (outcome.kind !== "verified") {
      res.status(409).json({ error: "Cette vérification n'est plus active. Demandez un nouveau code." });
      return;
    }
    res.json(VerifyEmailOtpResponse.parse({
      emailVerified: true,
      verifiedAt: outcome.verifiedAt,
    }));
  } catch (error) {
    req.log.error({ err: error, challengeId: parsed.data.challengeId }, "Verified email OTP state could not be stored");
    try {
      await completeOtpEvent(reservation.eventId, "storage_error", {
        diagnosticMessage: "Verified email OTP result could not be persisted.",
      });
    } catch (storageError) {
      req.log.error({ err: storageError }, "Verified email OTP storage error could not be recorded");
    }
    res.status(503).json({ error: "La vérification par e-mail n'a pas pu être enregistrée." });
  }
});

export default router;
