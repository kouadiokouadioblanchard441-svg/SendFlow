import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import {
  and,
  customerCredentialsTable,
  customerSessionsTable,
  db,
  eq,
  gte,
  isNull,
  or,
  phoneOtpChallengesTable,
  registrationSettingsTable,
  usersTable,
  walletsTable,
} from "@workspace/db";
import {
  GetCustomerSessionResponse,
  RegisterCustomerBody,
  RegisterCustomerResponse,
  SetCustomerPinBody,
  SetCustomerPinResponse,
  SignInCustomerBody,
  SignInCustomerResponse,
  SignOutCustomerResponse,
  UnlockCustomerSessionBody,
  UnlockCustomerSessionResponse,
} from "@workspace/api-zod";
import {
  CUSTOMER_ACCESS_RATE_LIMIT_POLICY,
  clearAuthFailures,
  getCustomerAccessAttemptBucketsForRequest,
  getCustomerLoginPhoneAttemptBucket,
  getCustomerPinAttemptBucket,
  getAuthRateLimit,
  formatAuthRateLimitMessage,
  recordAuthFailure,
  recordAuthFailureAndGetRetryAfter,
  withAuthAttemptLock,
  withPinAttemptLock,
} from "../lib/customer-auth-rate-limit";
import { hashCustomerSecret, hashCustomerSessionToken, verifyCustomerSecret } from "../lib/customer-auth-crypto";
import {
  createSensitiveDataLookupIndex,
  decryptSensitiveDataIfEncrypted,
  encryptSensitiveData,
  normalizeSensitiveNameForLookup,
} from "../lib/sensitive-data-crypto";
import {
  CUSTOMER_PIN_UNLOCK_TTL_MS,
  getCustomerSession,
  getCustomerSessionTokenFromRequest,
  insertCustomerSession,
  requireCustomerSession,
  setCustomerSessionCookie,
  clearCustomerSessionCookie,
} from "../lib/customer-session";
import { verifiedCustomerOtpCondition } from "../lib/customer-auth-otp";
import { fingerprint, isTrustedOrigin, requesterAddress } from "../lib/request-security";
import { recordLoginActivity } from "../lib/login-activity";
import { createCustomerPinRotationSessionPolicy } from "../lib/customer-pin-session-policy";
import { activePreviewAccountCondition } from "../lib/preview-account-condition";
import { isSharedNeonPreview } from "../lib/shared-neon-preview-guard";
import { previewPasswordForVerification } from "../lib/preview-credential-policy";

const router: IRouter = Router();
const PRIVACY_POLICY_VERSION = "sendflow-privacy-v1";
const DUMMY_PASSWORD_HASH = hashCustomerSecret("sendflow-invalid-account-password");

function safeErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
}

function sendRateLimit(res: Response, seconds: number) {
  res.status(429).json({
    error: formatAuthRateLimitMessage(seconds),
    retryAfterSeconds: Math.max(1, seconds),
  });
}

function formatName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isAdultBirthDate(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return false;

  const cutoff = new Date(Date.UTC(
    now.getUTCFullYear() - 18,
    now.getUTCMonth(),
    now.getUTCDate(),
  ));
  return parsed.getTime() <= cutoff.getTime();
}

function getLoginAttemptBuckets(phone: string | null, req: Parameters<typeof requesterAddress>[0]) {
  const address = requesterAddress(req);
  return [
    ...getCustomerAccessAttemptBucketsForRequest(phone, address),
    ...(phone ? [getCustomerLoginPhoneAttemptBucket(phone)] : []),
    fingerprint(`customer-login-requester:${address}`),
  ];
}

function getSignupPhoneFromBody(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const phone = RegisterCustomerBody.shape.phone.safeParse((body as { phone?: unknown }).phone);
  return phone.success ? phone.data : null;
}

function getLoginPhoneFromBody(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const phone = SignInCustomerBody.shape.phone.safeParse((body as { phone?: unknown }).phone);
  return phone.success ? phone.data : null;
}

function getPinAttemptBuckets(userId: string, req: Parameters<typeof requesterAddress>[0]) {
  return [
    getCustomerPinAttemptBucket(userId),
    fingerprint(`customer-pin-requester:${requesterAddress(req)}`),
  ];
}

router.post("/auth/register", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }

  const parsed = RegisterCustomerBody.safeParse(req.body);
  const phone = parsed.success ? parsed.data.phone : getSignupPhoneFromBody(req.body);
  let buckets: string[] = [];
  try {
    buckets = getCustomerAccessAttemptBucketsForRequest(phone, requesterAddress(req));
    const preliminaryRetry = await getAuthRateLimit(buckets);
    if (preliminaryRetry !== null) {
      sendRateLimit(res, preliminaryRetry);
      return;
    }

    const normalizedName = parsed.success ? formatName(parsed.data.fullName) : "";
    const birthDate = parsed.success ? parsed.data.birthDate.toISOString().slice(0, 10) : "";
    const profileIsValid = parsed.success
      && normalizedName.length >= 2
      && normalizedName.length <= 120
      && normalizedName.split(" ").filter(Boolean).length >= 2
      && /\p{L}/u.test(normalizedName)
      && isAdultBirthDate(birthDate)
      && parsed.data.acceptedPrivacy === true;

    const signupResult = await withAuthAttemptLock(buckets, async (tx) => {
      const now = new Date();
      const retry = await getAuthRateLimit(buckets, now, tx);
      if (retry !== null) return { kind: "rate", retry } as const;

      const registerFailure = async (kind: "invalid-body" | "invalid-profile" | "invalid-challenge" | "exists") => {
        const retryAfter = await recordAuthFailureAndGetRetryAfter(
          buckets,
          now,
          CUSTOMER_ACCESS_RATE_LIMIT_POLICY,
          tx,
        );
        return retryAfter !== null
          ? { kind: "rate", retry: retryAfter } as const
          : { kind } as const;
      };

      if (!parsed.success) return registerFailure("invalid-body");
      if (!profileIsValid) return registerFailure("invalid-profile");

      // A shared row lock serializes signup with an administrator switching the policy.
      const [setting] = await tx.select()
        .from(registrationSettingsTable)
        .where(eq(registrationSettingsTable.id, "signup"))
        .for("share");
      if (!setting) throw new Error("Signup setting is missing");
      const requiresOtp = setting.smsVerificationEnabled;
      let challenge: { id: string } | undefined;
      if (requiresOtp) {
        if (!parsed.data.challengeId) return registerFailure("invalid-challenge");
        [challenge] = await tx
          .select({ id: phoneOtpChallengesTable.id })
          .from(phoneOtpChallengesTable)
          .where(verifiedCustomerOtpCondition(parsed.data.challengeId, parsed.data.phone, "signup", now))
          .for("update");
        if (!challenge) return registerFailure("invalid-challenge");
      }

      const [existingUser] = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(or(
          eq(usersTable.phoneLookupHash, createSensitiveDataLookupIndex(parsed.data.phone, "user-phone")),
          eq(usersTable.phone, parsed.data.phone),
        ))
        .limit(1);

      if (challenge) {
        await tx
          .update(phoneOtpChallengesTable)
          .set({ consumedAt: now })
          .where(eq(phoneOtpChallengesTable.id, challenge.id));
      }

      if (existingUser) return registerFailure("exists");

      const passwordHash = await hashCustomerSecret(parsed.data.password);
      const userId = randomUUID();
      const [user] = await tx
        .insert(usersTable)
        .values({
          id: userId,
          phone: encryptSensitiveData(parsed.data.phone, "user-phone"),
          phoneLookupHash: createSensitiveDataLookupIndex(parsed.data.phone, "user-phone"),
          phoneVerifiedAt: requiresOtp ? now : null,
          displayName: encryptSensitiveData(normalizedName, "user-name"),
          displayNameLookupHash: createSensitiveDataLookupIndex(
            normalizeSensitiveNameForLookup(normalizedName),
            "user-name",
          ),
          countryCode: parsed.data.countryCode ?? null,
          birthDate: null,
          birthDateEncrypted: encryptSensitiveData(birthDate, "user-birth-date"),
          lastSeenAt: now,
        })
        .returning({
          id: usersTable.id,
          phone: usersTable.phone,
          displayName: usersTable.displayName,
          countryCode: usersTable.countryCode,
        });

      if (!user?.phone) throw new Error("Customer user insert returned no phone");

      await tx.insert(customerCredentialsTable).values({
        userId,
        passwordHash,
        privacyAcceptedAt: now,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      });

      const [wallet] = await tx
        .insert(walletsTable)
        .values({ userId })
        .returning({ id: walletsTable.id });
      if (!wallet) throw new Error("Customer wallet could not be created");

      const session = await insertCustomerSession(tx, userId, now);
      await recordLoginActivity(req, userId, session.sessionId, tx);
      await clearAuthFailures(buckets, tx);

      return {
        kind: "created",
        session,
        account: {
          userId: user.id,
          phone: decryptSensitiveDataIfEncrypted(user.phone, "user-phone"),
          displayName: decryptSensitiveDataIfEncrypted(user.displayName, "user-name"),
          countryCode: user.countryCode,
          pinConfigured: false,
        },
      } as const;
    });

    if (signupResult.kind === "rate") {
      sendRateLimit(res, signupResult.retry);
      return;
    }
    if (signupResult.kind === "invalid-body") {
      res.status(400).json({ error: "Vérifiez les informations du compte." });
      return;
    }
    if (signupResult.kind === "invalid-profile") {
      res.status(400).json({ error: "Vérifiez le nom, la date de naissance et l’acceptation de la politique." });
      return;
    }
    if (signupResult.kind === "invalid-challenge") {
      res.status(409).json({ error: "La vérification du téléphone a expiré ou a déjà été utilisée." });
      return;
    }
    if (signupResult.kind === "exists") {
      res.status(409).json({ error: "Ce numéro est déjà associé à un compte. Connectez-vous ou réinitialisez votre code secret." });
      return;
    }
    if (signupResult.kind !== "created") return;

    setCustomerSessionCookie(res, signupResult.session.token);
    res.status(201).json(RegisterCustomerResponse.parse(signupResult.account));
  } catch (error) {
    if (safeErrorCode(error) === "23505") {
      const retry = await recordAuthFailureAndGetRetryAfter(
        buckets,
        new Date(),
        CUSTOMER_ACCESS_RATE_LIMIT_POLICY,
      );
      if (retry !== null) {
        sendRateLimit(res, retry);
        return;
      }
      res.status(409).json({ error: "Ce numéro est déjà associé à un compte. Connectez-vous ou réinitialisez votre code secret." });
      return;
    }
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer registration failed");
    res.status(503).json({ error: "La création du compte est momentanément indisponible." });
  }
});

router.post("/auth/sign-in", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }

  const parsed = SignInCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    try {
      const phone = getLoginPhoneFromBody(req.body);
      const buckets = getLoginAttemptBuckets(phone, req);
      const retry = await recordAuthFailureAndGetRetryAfter(
        buckets,
        new Date(),
        CUSTOMER_ACCESS_RATE_LIMIT_POLICY,
      );
      if (retry !== null) {
        sendRateLimit(res, retry);
        return;
      }
    } catch (error) {
      req.log.error({ errorCode: safeErrorCode(error) }, "Customer sign-in rate-limit storage failed");
      res.status(503).json({ error: "La connexion est momentanément indisponible." });
      return;
    }
    res.status(400).json({ error: "Numéro ou code secret invalide." });
    return;
  }

  try {
    const buckets = getLoginAttemptBuckets(parsed.data.phone, req);
    const result = await withAuthAttemptLock(buckets, async (tx) => {
      const now = new Date();
      const retry = await getAuthRateLimit(buckets, now, tx);
      if (retry !== null) return { kind: "rate", retry } as const;

      const [record] = await tx
        .select({
          userId: usersTable.id,
          phone: usersTable.phone,
          displayName: usersTable.displayName,
          countryCode: usersTable.countryCode,
          accountStatus: usersTable.status,
          passwordHash: customerCredentialsTable.passwordHash,
          pinHash: customerCredentialsTable.pinHash,
        })
        .from(usersTable)
        .innerJoin(customerCredentialsTable, eq(customerCredentialsTable.userId, usersTable.id))
        .where(and(
          or(
            eq(usersTable.phoneLookupHash, createSensitiveDataLookupIndex(parsed.data.phone, "user-phone")),
            eq(usersTable.phone, parsed.data.phone),
          ),
          isSharedNeonPreview() ? activePreviewAccountCondition() : undefined,
        ))
        .for("update");

      const scopedHash = isSharedNeonPreview()
        ? previewPasswordForVerification(record?.passwordHash ?? "")
        : record?.passwordHash;
      const encodedHash = scopedHash || await DUMMY_PASSWORD_HASH;
      const validPassword = await verifyCustomerSecret(parsed.data.password, encodedHash);
      if (!record || !scopedHash || record.accountStatus !== "active" || !validPassword) {
        const retryAfterFailure = await recordAuthFailureAndGetRetryAfter(
          buckets,
          now,
          CUSTOMER_ACCESS_RATE_LIMIT_POLICY,
          tx,
        );
        return retryAfterFailure !== null
          ? { kind: "rate", retry: retryAfterFailure } as const
          : { kind: "invalid" } as const;
      }

      await tx
        .update(usersTable)
        .set({ lastSeenAt: now })
        .where(eq(usersTable.id, record.userId));
      const session = await insertCustomerSession(tx, record.userId, now);
      await recordLoginActivity(req, record.userId, session.sessionId, tx);
      await clearAuthFailures(buckets, tx);

      return {
        kind: "signed-in",
        session,
        account: {
          userId: record.userId,
          phone: decryptSensitiveDataIfEncrypted(record.phone, "user-phone") ?? "",
          displayName: decryptSensitiveDataIfEncrypted(record.displayName, "user-name"),
          countryCode: record.countryCode,
          pinConfigured: record.pinHash !== null,
        },
      } as const;
    });

    if (result.kind === "rate") {
      sendRateLimit(res, result.retry);
      return;
    }
    if (result.kind !== "signed-in") {
      res.status(401).json({ error: "Numéro ou code secret incorrect." });
      return;
    }

    setCustomerSessionCookie(res, result.session.token);
    res.json(SignInCustomerResponse.parse(result.account));
  } catch (error) {
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer sign-in failed");
    res.status(503).json({ error: "La connexion est momentanément indisponible." });
  }
});

router.get("/auth/session", async (req, res): Promise<void> => {
  try {
    const session = await getCustomerSession(req, { touchLastSeen: false });
    if (!session) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    res.json(
      GetCustomerSessionResponse.parse({
        userId: session.userId,
        phone: session.phone,
        displayName: session.displayName,
        countryCode: session.countryCode,
        pinConfigured: session.pinConfigured,
        pinUnlocked: session.pinUnlocked,
      }),
    );
  } catch (error) {
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer session lookup failed");
    res.status(503).json({ error: "Session storage unavailable" });
  }
});

router.post("/auth/sign-out", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }

  try {
    const token = getCustomerSessionTokenFromRequest(req);
    if (token) {
      await db
        .update(customerSessionsTable)
        .set({ revokedAt: new Date(), pinVerifiedUntil: null })
        .where(
          and(
            eq(customerSessionsTable.tokenHash, hashCustomerSessionToken(token)),
            isNull(customerSessionsTable.revokedAt),
          ),
        );
    }
    clearCustomerSessionCookie(res);
    res.json(SignOutCustomerResponse.parse({ success: true }));
  } catch (error) {
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer sign-out failed");
    res.status(503).json({ error: "La déconnexion est momentanément indisponible." });
  }
});

router.post("/auth/unlock", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }

  const parsed = UnlockCustomerSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Code PIN invalide." });
    return;
  }

  try {
    const session = await requireCustomerSession(req, res);
    if (!session) return;
    if (!session.pinConfigured) {
      res.status(401).json({ error: "Aucun code PIN n’est configuré." });
      return;
    }

    const buckets = getPinAttemptBuckets(session.userId, req);
    const result = await withPinAttemptLock(buckets, async (tx) => {
      const retry = await getAuthRateLimit(buckets, new Date(), tx);
      if (retry !== null) return { kind: "rate", retry } as const;

      const [credential] = await tx
        .select({ pinHash: customerCredentialsTable.pinHash })
        .from(customerCredentialsTable)
        .where(eq(customerCredentialsTable.userId, session.userId))
        .limit(1);
      if (!credential?.pinHash || !await verifyCustomerSecret(parsed.data.pin, credential.pinHash)) {
        await recordAuthFailure(buckets, new Date(), tx);
        const retryAfterFailure = await getAuthRateLimit(buckets, new Date(), tx);
        return retryAfterFailure !== null
          ? { kind: "rate", retry: retryAfterFailure } as const
          : { kind: "invalid" } as const;
      }

      const now = new Date();
      const [updatedSession] = await tx
        .update(customerSessionsTable)
        .set({
          pinVerifiedUntil: new Date(now.getTime() + CUSTOMER_PIN_UNLOCK_TTL_MS),
          lastSeenAt: now,
        })
        .where(
          and(
            eq(customerSessionsTable.id, session.sessionId),
            eq(customerSessionsTable.userId, session.userId),
            isNull(customerSessionsTable.revokedAt),
            gte(customerSessionsTable.expiresAt, now),
          ),
        )
        .returning({ id: customerSessionsTable.id });
      if (!updatedSession) return { kind: "expired" } as const;

      await clearAuthFailures(buckets, tx);
      return { kind: "success" } as const;
    });
    if (result.kind === "rate") {
      sendRateLimit(res, result.retry);
      return;
    }
    if (result.kind === "invalid") {
      res.status(401).json({ error: "Code PIN incorrect." });
      return;
    }
    if (result.kind === "expired") {
      res.status(401).json({ error: "Session expirée. Connectez-vous à nouveau." });
      return;
    }
    res.json(UnlockCustomerSessionResponse.parse({ pinConfigured: true, pinUnlocked: true }));
  } catch (error) {
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer PIN unlock failed");
    res.status(503).json({ error: "La vérification du PIN est momentanément indisponible." });
  }
});

router.put("/me/pin", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }

  const parsed = SetCustomerPinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Le code PIN doit contenir quatre chiffres." });
    return;
  }

  try {
    const session = await requireCustomerSession(req, res);
    if (!session) return;
    const buckets = getPinAttemptBuckets(session.userId, req);
    const result = await withPinAttemptLock(buckets, async (tx) => {
      const retry = await getAuthRateLimit(buckets, new Date(), tx);
      if (retry !== null) return { kind: "rate", retry } as const;

      const [credential] = await tx
        .select({ pinHash: customerCredentialsTable.pinHash })
        .from(customerCredentialsTable)
        .where(eq(customerCredentialsTable.userId, session.userId))
        .limit(1);
      if (!credential) return { kind: "unavailable" } as const;

      if (credential.pinHash) {
        if (!parsed.data.currentPin) return { kind: "missing" } as const;
        if (!await verifyCustomerSecret(parsed.data.currentPin, credential.pinHash)) {
          await recordAuthFailure(buckets, new Date(), tx);
          const retryAfterFailure = await getAuthRateLimit(buckets, new Date(), tx);
          return retryAfterFailure !== null
            ? { kind: "rate", retry: retryAfterFailure } as const
            : { kind: "invalid" } as const;
        }
        if (parsed.data.currentPin === parsed.data.newPin) return { kind: "unchanged" } as const;
      }

      const newPinHash = await hashCustomerSecret(parsed.data.newPin);
      const now = new Date();
      const pinCondition = credential.pinHash
        ? eq(customerCredentialsTable.pinHash, credential.pinHash)
        : isNull(customerCredentialsTable.pinHash);
      const [updatedCredential] = await tx
        .update(customerCredentialsTable)
        .set({
          pinHash: newPinHash,
          pinUpdatedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(customerCredentialsTable.userId, session.userId),
            pinCondition,
          ),
        )
        .returning({ userId: customerCredentialsTable.userId });

      if (!updatedCredential) return { kind: "changed" } as const;
      const pinRotationPolicy = createCustomerPinRotationSessionPolicy(
        session.userId,
        session.sessionId,
        now,
        CUSTOMER_PIN_UNLOCK_TTL_MS,
      );
      await tx
        .update(customerSessionsTable)
        .set({ pinVerifiedUntil: null })
        .where(
          and(
            eq(customerSessionsTable.userId, pinRotationPolicy.relockActiveSessionsForUserId),
            isNull(customerSessionsTable.revokedAt),
          ),
        );
      const [updatedSession] = await tx
        .update(customerSessionsTable)
        .set({
          pinVerifiedUntil: pinRotationPolicy.unlockCurrentSessionUntil,
          lastSeenAt: now,
        })
        .where(
          and(
            eq(customerSessionsTable.id, pinRotationPolicy.currentSessionId),
            eq(customerSessionsTable.userId, pinRotationPolicy.relockActiveSessionsForUserId),
            isNull(customerSessionsTable.revokedAt),
            gte(customerSessionsTable.expiresAt, now),
          ),
        )
        .returning({ id: customerSessionsTable.id });
      if (!updatedSession) throw new Error("Customer session expired during PIN update");
      await clearAuthFailures(buckets, tx);
      return { kind: "success" } as const;
    });

    if (result.kind === "rate") {
      sendRateLimit(res, result.retry);
      return;
    }
    if (result.kind === "unavailable") {
      res.status(503).json({ error: "Données du compte indisponibles." });
      return;
    }
    if (result.kind === "missing") {
      res.status(400).json({ error: "Saisissez votre code PIN actuel." });
      return;
    }
    if (result.kind === "invalid") {
      res.status(401).json({ error: "Code PIN actuel incorrect." });
      return;
    }
    if (result.kind === "unchanged") {
      res.status(400).json({ error: "Choisissez un code PIN différent de l’actuel." });
      return;
    }
    if (result.kind === "changed") {
      res.status(401).json({ error: "Le code PIN a changé. Connectez-vous à nouveau." });
      return;
    }

    res.json(SetCustomerPinResponse.parse({ pinConfigured: true, pinUnlocked: true }));
  } catch (error) {
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer PIN update failed");
    res.status(503).json({ error: "La mise à jour du PIN est momentanément indisponible." });
  }
});

export default router;