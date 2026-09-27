import { Router, type IRouter, type Response } from "express";
import {
  and,
  db,
  desc,
  eq,
  gte,
  lt,
  phoneOtpChallengesTable,
  phoneOtpEventsTable,
  sql,
  type PhoneOtpEventOutcome,
} from "@workspace/db";
import {
  SendPhoneOtpBody,
  SendPhoneOtpResponse,
  VerifyPhoneOtpBody,
  VerifyPhoneOtpResponse,
} from "@workspace/api-zod";
import {
  EsmsConfigurationError,
  EsmsProviderError,
  EsmsRateLimitError,
  getEsmsVerifyClient,
} from "../lib/esms-verify";
import { fingerprint, isTrustedOrigin, requesterAddress } from "../lib/request-security";

const router: IRouter = Router();
const OTP_LIFETIME_SECONDS = 5 * 60;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_PHONE_PER_HOUR = 5;
const MAX_SENDS_PER_REQUESTER_PER_HOUR = 60;
const MAX_CODE_CHECKS = 5;
const HOUR_MS = 60 * 60 * 1000;

function retryAfterSeconds(until: Date, now = new Date()) {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000));
}

function sendRateLimitResponse(
  res: Response,
  error: string,
  seconds: number,
) {
  res.status(429).json({
    error,
    retryAfterSeconds: Math.max(1, seconds),
  });
}

function safeProviderErrorResponse(
  res: Response,
  error: unknown,
) {
  if (error instanceof EsmsRateLimitError) {
    sendRateLimitResponse(
      res,
      "Le service SMS limite temporairement les vérifications.",
      error.retryAfterSeconds,
    );
    return;
  }

  res.status(502).json({ error: "Le service SMS est momentanément indisponible." });
}

function providerFailureDetails(error: unknown): {
  outcome: PhoneOtpEventOutcome;
  providerHttpStatus: number | null;
  diagnosticMessage: string;
} {
  if (error instanceof EsmsRateLimitError) {
    return {
      outcome: "provider_rate_limited",
      providerHttpStatus: 429,
      diagnosticMessage: error.message,
    };
  }

  if (error instanceof EsmsConfigurationError) {
    return {
      outcome: "configuration_error",
      providerHttpStatus: null,
      diagnosticMessage: error.message,
    };
  }

  if (error instanceof EsmsProviderError) {
    const statusCode = error.statusCode ?? null;
    return {
      outcome: statusCode !== null && statusCode >= 400 && statusCode < 500
        ? "provider_rejected"
        : "provider_error",
      providerHttpStatus: statusCode,
      diagnosticMessage: error.providerMessage ?? error.message,
    };
  }

  return {
    outcome: "provider_error",
    providerHttpStatus: null,
    diagnosticMessage: "eSMS Verify request failed.",
  };
}

async function completePhoneOtpEvent(
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

  const parsed = SendPhoneOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Numéro de téléphone invalide." });
    return;
  }

  let esms;
  try {
    esms = getEsmsVerifyClient();
  } catch (error) {
    if (error instanceof EsmsConfigurationError) {
      res.status(503).json({ error: "Le service de vérification SMS n'est pas configuré." });
      return;
    }
    throw error;
  }

  let phoneHash: string;
  let requesterHash: string;
  try {
    phoneHash = fingerprint(`phone:${parsed.data.phone}`);
    requesterHash = fingerprint(`requester:${requesterAddress(req)}`);
  } catch (error) {
    req.log.error({ err: error }, "Phone OTP fingerprinting is unavailable");
    res.status(503).json({ error: "Le service de vérification SMS est indisponible." });
    return;
  }

  const now = new Date();
  const hourAgo = new Date(now.getTime() - HOUR_MS);
  const expiresAt = new Date(now.getTime() + OTP_LIFETIME_SECONDS * 1000);
  const resendAt = new Date(now.getTime() + RESEND_COOLDOWN_SECONDS * 1000);

  let reservation:
    | { rateLimited: true; retryAfterSeconds: number; reason: "cooldown" | "phone" | "requester" }
    | { rateLimited: false; id: string; eventId: string };

  try {
    reservation = await db.transaction(async (tx) => {
      const lockKeys = [
        `sendflow-otp-phone:${phoneHash}`,
        `sendflow-otp-requester:${requesterHash}`,
      ].sort();
      for (const lockKey of lockKeys) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
      }

      await tx
        .update(phoneOtpChallengesTable)
        .set({ status: "expired" })
        .where(
          and(
            eq(phoneOtpChallengesTable.phoneHash, phoneHash),
            eq(phoneOtpChallengesTable.status, "pending"),
            lt(phoneOtpChallengesTable.expiresAt, now),
          ),
        );

      const recentPhoneChallenges = await tx
        .select({
          createdAt: phoneOtpChallengesTable.createdAt,
          resendAfter: phoneOtpChallengesTable.resendAfter,
        })
        .from(phoneOtpChallengesTable)
        .where(
          and(
            eq(phoneOtpChallengesTable.phoneHash, phoneHash),
            gte(phoneOtpChallengesTable.createdAt, hourAgo),
          ),
        )
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

      const recentRequesterChallenges = await tx
        .select({ createdAt: phoneOtpChallengesTable.createdAt })
        .from(phoneOtpChallengesTable)
        .where(
          and(
            eq(phoneOtpChallengesTable.requesterHash, requesterHash),
            gte(phoneOtpChallengesTable.createdAt, hourAgo),
          ),
        )
        .orderBy(desc(phoneOtpChallengesTable.createdAt))
        .limit(MAX_SENDS_PER_REQUESTER_PER_HOUR);

      if (recentRequesterChallenges.length >= MAX_SENDS_PER_REQUESTER_PER_HOUR) {
        const oldestAllowedChallenge =
          recentRequesterChallenges[recentRequesterChallenges.length - 1]!;
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
        .set({ status: "superseded" })
        .where(
          and(
            eq(phoneOtpChallengesTable.phoneHash, phoneHash),
            eq(phoneOtpChallengesTable.status, "pending"),
          ),
        );

      const [challenge] = await tx
        .insert(phoneOtpChallengesTable)
        .values({
          phoneHash,
          requesterHash,
          purpose: parsed.data.purpose,
          status: "starting",
          phoneVerified: false,
          checkAttempts: 0,
          createdAt: now,
          expiresAt,
          resendAfter: resendAt,
        })
        .returning({ id: phoneOtpChallengesTable.id });

      if (!challenge) throw new Error("OTP challenge could not be reserved");
      const [event] = await tx
        .insert(phoneOtpEventsTable)
        .values({
          challengeId: challenge.id,
          eventType: "send",
          outcome: "requested",
        })
        .returning({ id: phoneOtpEventsTable.id });
      if (!event) throw new Error("OTP activity event could not be created");
      return { rateLimited: false, id: challenge.id, eventId: event.id } as const;
    });
  } catch (error) {
    req.log.error({ err: error }, "Phone OTP send reservation failed");
    res.status(503).json({ error: "Le service de vérification SMS est indisponible." });
    return;
  }

  if (reservation.rateLimited) {
    const message = reservation.reason === "cooldown"
      ? "Attendez avant de demander un nouveau code."
      : "Trop de demandes de code. Réessayez plus tard.";
    sendRateLimitResponse(res, message, reservation.retryAfterSeconds);
    return;
  }

  let providerResult: { verificationId: string; statusCode: number };
  try {
    providerResult = await esms.start(parsed.data.phone);
  } catch (error) {
    try {
      const failure = providerFailureDetails(error);
      await db.transaction(async (tx) => {
        await tx
          .update(phoneOtpChallengesTable)
          .set({ status: "failed" })
          .where(
            and(
              eq(phoneOtpChallengesTable.id, reservation.id),
              eq(phoneOtpChallengesTable.status, "starting"),
            ),
          );
        await tx
          .update(phoneOtpEventsTable)
          .set({ ...failure, completedAt: new Date() })
          .where(eq(phoneOtpEventsTable.id, reservation.eventId));
      });
    } catch (storageError) {
      req.log.error(
        { err: storageError, challengeId: reservation.id },
        "Failed OTP provider request could not be marked",
      );
    }

    if (error instanceof EsmsRateLimitError) {
      safeProviderErrorResponse(res, error);
      return;
    }
    if (error instanceof EsmsConfigurationError) {
      res.status(503).json({ error: "Le service de vérification SMS n'est pas configuré." });
      return;
    }

    req.log.warn(
      {
        err: error,
        challengeId: reservation.id,
        providerMessage: error instanceof EsmsProviderError ? error.providerMessage : undefined,
      },
      "eSMS Verify send failed",
    );
    res.status(502).json({ error: "Le service SMS est momentanément indisponible." });
    return;
  }

  try {
    const challenge = await db.transaction(async (tx) => {
      const [updatedChallenge] = await tx
        .update(phoneOtpChallengesTable)
        .set({
          providerVerificationId: providerResult.verificationId,
          status: "pending",
        })
        .where(
          and(
            eq(phoneOtpChallengesTable.id, reservation.id),
            eq(phoneOtpChallengesTable.status, "starting"),
          ),
        )
        .returning({
          id: phoneOtpChallengesTable.id,
          expiresAt: phoneOtpChallengesTable.expiresAt,
        });

      if (!updatedChallenge) throw new Error("OTP challenge state could not be updated");

      const [updatedEvent] = await tx
        .update(phoneOtpEventsTable)
        .set({
          outcome: "provider_accepted",
          providerHttpStatus: providerResult.statusCode,
          diagnosticMessage: null,
          completedAt: new Date(),
        })
        .where(eq(phoneOtpEventsTable.id, reservation.eventId))
        .returning({ id: phoneOtpEventsTable.id });

      if (!updatedEvent) throw new Error("OTP activity event could not be updated");
      return updatedChallenge;
      });

    res.status(202).json(
      SendPhoneOtpResponse.parse({
        challengeId: challenge.id,
        expiresAt: challenge.expiresAt,
        resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
      }),
    );
  } catch (error) {
    req.log.error({ err: error, challengeId: reservation.id }, "OTP provider result could not be stored");
    res.status(503).json({ error: "Le code a peut-être été envoyé, mais son suivi est indisponible." });
  }
});

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }

  const parsed = VerifyPhoneOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Code de vérification invalide." });
    return;
  }

  let esms;
  try {
    esms = getEsmsVerifyClient();
  } catch (error) {
    if (error instanceof EsmsConfigurationError) {
      res.status(503).json({ error: "Le service de vérification SMS n'est pas configuré." });
      return;
    }
    throw error;
  }

  const now = new Date();
  let reservation:
    | { kind: "missing" }
    | { kind: "expired" | "locked" | "inactive"; eventId: string }
    | { kind: "verified"; verifiedAt: Date; eventId: string }
    | { kind: "check"; verificationId: string; attemptNumber: number; eventId: string };

  try {
    reservation = await db.transaction(async (tx) => {
      const [challenge] = await tx
        .select()
        .from(phoneOtpChallengesTable)
        .where(eq(phoneOtpChallengesTable.id, parsed.data.challengeId))
        .for("update");

      if (!challenge) return { kind: "missing" } as const;
      const createEvent = async (
        outcome: PhoneOtpEventOutcome,
        attemptNumber?: number,
      ) => {
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

      if (challenge.purpose !== parsed.data.purpose) {
        const eventId = await createEvent("challenge_inactive");
        return { kind: "inactive", eventId } as const;
      }

      if (challenge.consumedAt) {
        const eventId = await createEvent("challenge_inactive");
        return { kind: "inactive", eventId } as const;
      }

      if (
        challenge.status === "expired"
        || (["pending", "verified"].includes(challenge.status) && challenge.expiresAt <= now)
      ) {
        await tx
          .update(phoneOtpChallengesTable)
          .set({ status: "expired" })
          .where(eq(phoneOtpChallengesTable.id, challenge.id));
        const eventId = await createEvent("challenge_expired");
        return { kind: "expired", eventId } as const;
      }

      if (challenge.phoneVerified && challenge.verifiedAt) {
        const eventId = await createEvent("already_verified");
        return { kind: "verified", verifiedAt: challenge.verifiedAt, eventId } as const;
      }

      if (
        challenge.status === "locked"
        || (challenge.status === "pending" && challenge.checkAttempts >= MAX_CODE_CHECKS)
      ) {
        await tx
          .update(phoneOtpChallengesTable)
          .set({ status: "locked" })
          .where(eq(phoneOtpChallengesTable.id, challenge.id));
        const eventId = await createEvent("challenge_locked");
        return { kind: "locked", eventId } as const;
      }

      if (challenge.status !== "pending" || !challenge.providerVerificationId) {
        const eventId = await createEvent("challenge_inactive");
        return { kind: "inactive", eventId } as const;
      }

      const attemptNumber = challenge.checkAttempts + 1;
      await tx
        .update(phoneOtpChallengesTable)
        .set({ checkAttempts: attemptNumber })
        .where(eq(phoneOtpChallengesTable.id, challenge.id));
      const eventId = await createEvent("requested", attemptNumber);

      return {
        kind: "check",
        verificationId: challenge.providerVerificationId,
        attemptNumber,
        eventId,
      } as const;
    });
  } catch (error) {
    req.log.error({ err: error }, "Phone OTP verification reservation failed");
    res.status(503).json({ error: "Le service de vérification SMS est indisponible." });
    return;
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
    res.json(
      VerifyPhoneOtpResponse.parse({
        phoneVerified: true,
        verifiedAt: reservation.verifiedAt,
      }),
    );
    return;
  }
  if (reservation.kind !== "check") {
    res.status(409).json({ error: "Cette vérification n'est plus active. Demandez un nouveau code." });
    return;
  }

  let providerResult: { approved: boolean; statusCode: number; providerMessage?: string };
  try {
    providerResult = await esms.check(reservation.verificationId, parsed.data.code);
  } catch (error) {
    try {
      const failure = providerFailureDetails(error);
      await db.transaction(async (tx) => {
        await tx
          .update(phoneOtpChallengesTable)
          .set({ checkAttempts: sql`${phoneOtpChallengesTable.checkAttempts} - 1` })
          .where(
            and(
              eq(phoneOtpChallengesTable.id, parsed.data.challengeId),
              eq(phoneOtpChallengesTable.status, "pending"),
              eq(phoneOtpChallengesTable.checkAttempts, reservation.attemptNumber),
            ),
          );
        await tx
          .update(phoneOtpEventsTable)
          .set({ ...failure, completedAt: new Date() })
          .where(eq(phoneOtpEventsTable.id, reservation.eventId));
      });
    } catch (storageError) {
      req.log.error(
        { err: storageError, challengeId: parsed.data.challengeId },
        "Failed OTP check attempt could not be released",
      );
    }

    if (error instanceof EsmsRateLimitError) {
      safeProviderErrorResponse(res, error);
      return;
    }
    req.log.warn(
      {
        err: error,
        challengeId: parsed.data.challengeId,
        providerMessage: error instanceof EsmsProviderError ? error.providerMessage : undefined,
      },
      "eSMS Verify check failed",
    );
    res.status(502).json({ error: "Le service SMS est momentanément indisponible." });
    return;
  }

  if (!providerResult.approved) {
    try {
      await db.transaction(async (tx) => {
        if (reservation.attemptNumber >= MAX_CODE_CHECKS) {
          await tx
            .update(phoneOtpChallengesTable)
            .set({ status: "locked" })
            .where(
              and(
                eq(phoneOtpChallengesTable.id, parsed.data.challengeId),
                eq(phoneOtpChallengesTable.status, "pending"),
                gte(phoneOtpChallengesTable.checkAttempts, MAX_CODE_CHECKS),
              ),
            );
        }

        const [updatedEvent] = await tx
          .update(phoneOtpEventsTable)
          .set({
            outcome: "not_approved",
            providerHttpStatus: providerResult.statusCode,
            diagnosticMessage: providerResult.providerMessage
              ?? "eSMS Verify did not approve the code.",
            completedAt: new Date(),
          })
          .where(eq(phoneOtpEventsTable.id, reservation.eventId))
          .returning({ id: phoneOtpEventsTable.id });

        if (!updatedEvent) throw new Error("OTP activity event could not be updated");
      });
    } catch (error) {
      req.log.error({ err: error, challengeId: parsed.data.challengeId }, "OTP rejection could not be recorded");
      try {
        await completePhoneOtpEvent(reservation.eventId, "storage_error", {
          providerHttpStatus: providerResult.statusCode,
          diagnosticMessage: "eSMS Verify rejection could not be recorded.",
        });
      } catch (storageError) {
        req.log.error({ err: storageError }, "OTP rejection storage error could not be recorded");
      }
      res.status(503).json({ error: "Le service de vérification SMS est indisponible." });
      return;
    }

    if (reservation.attemptNumber >= MAX_CODE_CHECKS) {
      res.status(409).json({ error: "Trop de codes incorrects. Demandez un nouveau code." });
      return;
    }
    res.status(400).json({ error: "Code incorrect. Vérifiez le code reçu par SMS." });
    return;
  }

  try {
    const verifiedAt = new Date();
    const outcome = await db.transaction(async (tx) => {
      const [challenge] = await tx
        .select()
        .from(phoneOtpChallengesTable)
        .where(eq(phoneOtpChallengesTable.id, parsed.data.challengeId))
        .for("update");

      if (!challenge) {
        await tx
          .update(phoneOtpEventsTable)
          .set({
            outcome: "state_conflict",
            providerHttpStatus: providerResult.statusCode,
            diagnosticMessage: "eSMS Verify approved the code, but the challenge was unavailable.",
            completedAt: new Date(),
          })
          .where(eq(phoneOtpEventsTable.id, reservation.eventId));
        return { kind: "inactive" } as const;
      }
      if (challenge.consumedAt) {
        await tx
          .update(phoneOtpEventsTable)
          .set({
            outcome: "state_conflict",
            providerHttpStatus: providerResult.statusCode,
            diagnosticMessage: "The OTP challenge was consumed while verification was in progress.",
            completedAt: new Date(),
          })
          .where(eq(phoneOtpEventsTable.id, reservation.eventId));
        return { kind: "inactive" } as const;
      }
      if (challenge.expiresAt <= verifiedAt) {
        await tx
          .update(phoneOtpChallengesTable)
          .set({ status: "expired" })
          .where(eq(phoneOtpChallengesTable.id, challenge.id));
        await tx
          .update(phoneOtpEventsTable)
          .set({
            outcome: "challenge_expired",
            providerHttpStatus: providerResult.statusCode,
            diagnosticMessage: "The OTP challenge expired before the provider check completed.",
            completedAt: new Date(),
          })
          .where(eq(phoneOtpEventsTable.id, reservation.eventId));
        return { kind: "inactive" } as const;
      }
      if (challenge.phoneVerified && challenge.verifiedAt) {
        await tx
          .update(phoneOtpEventsTable)
          .set({
            outcome: "verified",
            providerHttpStatus: providerResult.statusCode,
            diagnosticMessage: null,
            completedAt: new Date(),
          })
          .where(eq(phoneOtpEventsTable.id, reservation.eventId));
        return { kind: "verified", verifiedAt: challenge.verifiedAt } as const;
      }
      if (!["pending", "locked"].includes(challenge.status)) {
        await tx
          .update(phoneOtpEventsTable)
          .set({
            outcome: "state_conflict",
            providerHttpStatus: providerResult.statusCode,
            diagnosticMessage: "eSMS Verify approved the code, but the challenge was no longer active.",
            completedAt: new Date(),
          })
          .where(eq(phoneOtpEventsTable.id, reservation.eventId));
        return { kind: "inactive" } as const;
      }

      const [updated] = await tx
        .update(phoneOtpChallengesTable)
        .set({
          status: "verified",
          phoneVerified: true,
          verifiedAt,
        })
        .where(eq(phoneOtpChallengesTable.id, challenge.id))
        .returning({ verifiedAt: phoneOtpChallengesTable.verifiedAt });

      if (!updated?.verifiedAt) throw new Error("Verified OTP state was not stored");
      const [updatedEvent] = await tx
        .update(phoneOtpEventsTable)
        .set({
          outcome: "verified",
          providerHttpStatus: providerResult.statusCode,
          diagnosticMessage: null,
          completedAt: new Date(),
        })
        .where(eq(phoneOtpEventsTable.id, reservation.eventId))
        .returning({ id: phoneOtpEventsTable.id });

      if (!updatedEvent) throw new Error("OTP activity event could not be updated");
      return { kind: "verified", verifiedAt: updated.verifiedAt } as const;
    });

    if (outcome.kind !== "verified") {
      res.status(409).json({ error: "Cette vérification n'est plus active. Demandez un nouveau code." });
      return;
    }

    res.json(
      VerifyPhoneOtpResponse.parse({
        phoneVerified: true,
        verifiedAt: outcome.verifiedAt,
      }),
    );
  } catch (error) {
    req.log.error({ err: error, challengeId: parsed.data.challengeId }, "Verified OTP state could not be stored");
    try {
      await completePhoneOtpEvent(reservation.eventId, "storage_error", {
        providerHttpStatus: providerResult.statusCode,
        diagnosticMessage: "Verified OTP result could not be persisted.",
      });
    } catch (storageError) {
      req.log.error({ err: storageError }, "Verified OTP storage error could not be recorded");
    }
    res.status(503).json({ error: "La vérification SMS n'a pas pu être enregistrée." });
  }
});

export default router;