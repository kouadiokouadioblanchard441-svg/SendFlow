import { createHmac } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  and,
  db,
  desc,
  eq,
  gte,
  lt,
  phoneOtpChallengesTable,
  sql,
} from "@workspace/db";
import {
  SendPhoneOtpBody,
  SendPhoneOtpResponse,
  VerifyPhoneOtpBody,
  VerifyPhoneOtpResponse,
} from "@workspace/api-zod";
import {
  EsmsConfigurationError,
  EsmsRateLimitError,
  getEsmsVerifyClient,
} from "../lib/esms-verify";

const router: IRouter = Router();
const OTP_LIFETIME_SECONDS = 5 * 60;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_PHONE_PER_HOUR = 5;
const MAX_SENDS_PER_REQUESTER_PER_HOUR = 60;
const MAX_CODE_CHECKS = 5;
const HOUR_MS = 60 * 60 * 1000;

function isTrustedOrigin(req: Request) {
  const origin = req.get("origin");
  if (!origin) return false;

  const configuredOrigins = [
    process.env.CORS_ALLOWED_ORIGINS,
    process.env.REPLIT_DOMAINS,
    process.env.REPLIT_DEV_DOMAIN,
  ]
    .filter(Boolean)
    .flatMap((value) => value!.split(","))
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean)
    .map((value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`));

  return configuredOrigins.includes(origin.replace(/\/+$/, ""));
}

function getFingerprintKey() {
  const key = process.env.SESSION_SECRET?.trim();
  if (!key) throw new Error("OTP fingerprinting is not configured");
  return key;
}

function fingerprint(value: string) {
  return createHmac("sha256", getFingerprintKey()).update(value).digest("hex");
}

function requesterAddress(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

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
    | { rateLimited: false; id: string };

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
          status: "starting",
          phoneVerified: false,
          checkAttempts: 0,
          createdAt: now,
          expiresAt,
          resendAfter: resendAt,
        })
        .returning({ id: phoneOtpChallengesTable.id });

      if (!challenge) throw new Error("OTP challenge could not be reserved");
      return { rateLimited: false, id: challenge.id } as const;
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

  let providerResult: { verificationId: string };
  try {
    providerResult = await esms.start(parsed.data.phone);
  } catch (error) {
    try {
      await db
        .update(phoneOtpChallengesTable)
        .set({ status: "failed" })
        .where(
          and(
            eq(phoneOtpChallengesTable.id, reservation.id),
            eq(phoneOtpChallengesTable.status, "starting"),
          ),
        );
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

    req.log.warn({ err: error, challengeId: reservation.id }, "eSMS Verify send failed");
    res.status(502).json({ error: "Le service SMS est momentanément indisponible." });
    return;
  }

  try {
    const [challenge] = await db
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

    if (!challenge) throw new Error("OTP challenge state could not be updated");
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
    | { kind: "missing" | "expired" | "locked" | "inactive" }
    | { kind: "verified"; verifiedAt: Date }
    | { kind: "check"; verificationId: string; attemptNumber: number };

  try {
    reservation = await db.transaction(async (tx) => {
      const [challenge] = await tx
        .select()
        .from(phoneOtpChallengesTable)
        .where(eq(phoneOtpChallengesTable.id, parsed.data.challengeId))
        .for("update");

      if (!challenge) return { kind: "missing" } as const;
      if (challenge.phoneVerified && challenge.verifiedAt) {
        return { kind: "verified", verifiedAt: challenge.verifiedAt } as const;
      }

      if (challenge.status !== "pending" || !challenge.providerVerificationId) {
        return { kind: "inactive" } as const;
      }

      if (challenge.expiresAt <= now) {
        await tx
          .update(phoneOtpChallengesTable)
          .set({ status: "expired" })
          .where(eq(phoneOtpChallengesTable.id, challenge.id));
        return { kind: "expired" } as const;
      }

      if (challenge.checkAttempts >= MAX_CODE_CHECKS) {
        await tx
          .update(phoneOtpChallengesTable)
          .set({ status: "locked" })
          .where(eq(phoneOtpChallengesTable.id, challenge.id));
        return { kind: "locked" } as const;
      }

      const attemptNumber = challenge.checkAttempts + 1;
      await tx
        .update(phoneOtpChallengesTable)
        .set({ checkAttempts: attemptNumber })
        .where(eq(phoneOtpChallengesTable.id, challenge.id));

      return {
        kind: "check",
        verificationId: challenge.providerVerificationId,
        attemptNumber,
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

  let providerResult: { approved: boolean };
  try {
    providerResult = await esms.check(reservation.verificationId, parsed.data.code);
  } catch (error) {
    try {
      await db
        .update(phoneOtpChallengesTable)
        .set({ checkAttempts: sql`${phoneOtpChallengesTable.checkAttempts} - 1` })
        .where(
          and(
            eq(phoneOtpChallengesTable.id, parsed.data.challengeId),
            eq(phoneOtpChallengesTable.status, "pending"),
            eq(phoneOtpChallengesTable.checkAttempts, reservation.attemptNumber),
          ),
        );
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
    req.log.warn({ err: error, challengeId: parsed.data.challengeId }, "eSMS Verify check failed");
    res.status(502).json({ error: "Le service SMS est momentanément indisponible." });
    return;
  }

  if (!providerResult.approved) {
    if (reservation.attemptNumber >= MAX_CODE_CHECKS) {
      try {
        await db
          .update(phoneOtpChallengesTable)
          .set({ status: "locked" })
          .where(
            and(
              eq(phoneOtpChallengesTable.id, parsed.data.challengeId),
              eq(phoneOtpChallengesTable.status, "pending"),
              gte(phoneOtpChallengesTable.checkAttempts, MAX_CODE_CHECKS),
            ),
          );
      } catch (error) {
        req.log.error({ err: error, challengeId: parsed.data.challengeId }, "OTP challenge lock failed");
        res.status(503).json({ error: "Le service de vérification SMS est indisponible." });
        return;
      }

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

      if (!challenge) return { kind: "inactive" } as const;
      if (challenge.phoneVerified && challenge.verifiedAt) {
        return { kind: "verified", verifiedAt: challenge.verifiedAt } as const;
      }
      if (!["pending", "locked"].includes(challenge.status)) {
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
    res.status(503).json({ error: "La vérification SMS n'a pas pu être enregistrée." });
  }
});

export default router;