import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  and,
  countriesTable,
  customerBiometricChallengesTable,
  customerBiometricCredentialsTable,
  customerCredentialsTable,
  customerSessionsTable,
  db,
  developerApiKeysTable,
  eq,
  gte,
  isNull,
  lt,
  or,
  sql,
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
  GetCustomerBiometricStatusResponse,
  StartCustomerBiometricRegistrationResponse,
  StartCustomerBiometricAuthenticationResponse,
  VerifyCustomerBiometricRegistrationBody,
  VerifyCustomerBiometricAuthenticationBody,
  VerifyCustomerBiometricRegistrationResponse,
  VerifyCustomerBiometricAuthenticationResponse,
  RemoveCustomerBiometricCredentialsResponse,
  UnlockCustomerSessionBody,
  UnlockCustomerSessionResponse,
} from "@workspace/api-zod";
import {
  CUSTOMER_ACCESS_RATE_LIMIT_POLICY,
  clearAuthFailures,
  getCustomerAccessAttemptBucketsForRequest,
  getCustomerLoginEmailAttemptBucket,
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
  normalizeSensitiveEmailForLookup,
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
import { createDeveloperApiKeyMaterial } from "../services/developer-api-security";
import {
  activeReplitPaymentTestAccountCondition,
  sharedDatabaseCustomerCondition,
} from "../lib/replit-payment-test-access";
import { isSharedDatabasePreview } from "../lib/shared-database-preview-guard";
import { previewPasswordForVerification } from "../lib/preview-credential-policy";
import { formatCustomerDisplayName } from "../lib/customer-profile-policy";
import { getCustomerBiometricOrigin } from "../lib/customer-biometric-origin";

const router: IRouter = Router();
const PRIVACY_POLICY_VERSION = "sendflow-privacy-v1";
const DUMMY_PASSWORD_HASH = hashCustomerSecret("sendflow-invalid-account-password");
const BIOMETRIC_CHALLENGE_TTL_MS = 5 * 60 * 1000;

function getWebAuthnOrigin(req: Parameters<typeof requesterAddress>[0]) {
  return getCustomerBiometricOrigin(req.method, req.get("origin"), req.get("host"));
}

async function saveBiometricChallenge(
  userId: string,
  sessionId: string,
  purpose: "registration" | "authentication",
  origin: string,
  rpId: string,
  challenge: string,
) {
  const now = new Date();
  await db.delete(customerBiometricChallengesTable)
    .where(lt(customerBiometricChallengesTable.expiresAt, now));
  await db.delete(customerBiometricChallengesTable)
    .where(and(
      eq(customerBiometricChallengesTable.sessionId, sessionId),
      eq(customerBiometricChallengesTable.purpose, purpose),
      isNull(customerBiometricChallengesTable.usedAt),
    ));
  const [row] = await db.insert(customerBiometricChallengesTable).values({
    userId,
    sessionId,
    purpose,
    expectedOrigin: origin,
    rpId,
    challenge,
    expiresAt: new Date(now.getTime() + BIOMETRIC_CHALLENGE_TTL_MS),
  }).returning({ id: customerBiometricChallengesTable.id });
  if (!row) throw new Error("Biometric challenge could not be stored");
  return row.id;
}

async function getBiometricCredentialCount(userId: string, rpId: string) {
  const rows = await db.select({ id: customerBiometricCredentialsTable.id })
    .from(customerBiometricCredentialsTable)
    .where(and(
      eq(customerBiometricCredentialsTable.userId, userId),
      eq(customerBiometricCredentialsTable.rpId, rpId),
    ));
  return rows.length;
}

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

function getLoginAttemptBuckets(emailLookupHash: string | null, req: Parameters<typeof requesterAddress>[0]) {
  const address = requesterAddress(req);
  return [
    ...(emailLookupHash ? [getCustomerLoginEmailAttemptBucket(emailLookupHash)] : []),
    fingerprint(`customer-login-requester:${address}`),
  ];
}

function getSignupPhoneFromBody(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const phone = RegisterCustomerBody.shape.phone.safeParse((body as { phone?: unknown }).phone);
  return phone.success ? phone.data : null;
}

function normalizeSignupBody(body: unknown): unknown {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return body;
  const record = body as Record<string, unknown>;
  if (typeof record.email !== "string") return body;
  return { ...record, email: normalizeSensitiveEmailForLookup(record.email) };
}

function normalizeSignInBody(body: unknown): unknown {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (typeof record.email !== "string") return body;
  return { ...record, email: normalizeSensitiveEmailForLookup(record.email) };
}

function getLoginEmailHashFromBody(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const rawEmail = (body as { email?: unknown }).email;
  if (typeof rawEmail !== "string") return null;
  const email = SignInCustomerBody.shape.email.safeParse(normalizeSensitiveEmailForLookup(rawEmail));
  return email.success
    ? createSensitiveDataLookupIndex(email.data, "user-email")
    : null;
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

  const parsed = RegisterCustomerBody.safeParse(normalizeSignupBody(req.body));
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

      // Lock configuration through account creation: a simultaneous country
      // suspension cannot race a new registration. Legacy clients may omit a
      // country only when the longest matching phone prefix is unambiguous.
      const requestedCountry = parsed.data.countryCode?.toLowerCase();
      const countries = await tx.select().from(countriesTable).where(and(
        eq(countriesTable.enabled, true),
        requestedCountry ? eq(countriesTable.countryCode, requestedCountry) : undefined,
      )).for("share");
      const candidates = countries.filter((country) => {
        const nationalDigits = parsed.data.phone.length - country.phonePrefix.length;
        return parsed.data.phone.startsWith(country.phonePrefix)
          && nationalDigits >= country.minPhoneDigits && nationalDigits <= country.maxPhoneDigits;
      }).sort((left, right) => right.phonePrefix.length - left.phonePrefix.length);
      const registrationCountry = candidates[0];
      if (!registrationCountry || candidates[1]?.phonePrefix.length === registrationCountry.phonePrefix.length) {
        return registerFailure("invalid-body");
      }

      // A shared row lock serializes signup with an administrator switching the policy.
      const [setting] = await tx.select()
        .from(registrationSettingsTable)
        .where(eq(registrationSettingsTable.id, "signup"))
        .for("share");
      if (!setting) throw new Error("Signup setting is missing");
      const requiresOtp = setting.emailVerificationEnabled;
      let challenge: { id: string } | undefined;
      if (requiresOtp) {
        if (!parsed.data.challengeId) return registerFailure("invalid-challenge");
        [challenge] = await tx
          .select({ id: phoneOtpChallengesTable.id })
          .from(phoneOtpChallengesTable)
          .where(verifiedCustomerOtpCondition(
            parsed.data.challengeId,
            parsed.data.phone,
            "signup",
            now,
            parsed.data.email,
          ))
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
      const emailLookupHash = createSensitiveDataLookupIndex(parsed.data.email, "user-email");
      const [existingEmail] = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.emailLookupHash, emailLookupHash))
        .limit(1);

      if (challenge) {
        await tx
          .update(phoneOtpChallengesTable)
          .set({ consumedAt: now })
          .where(eq(phoneOtpChallengesTable.id, challenge.id));
      }

      if (existingUser || existingEmail) return registerFailure("exists");

      const passwordHash = await hashCustomerSecret(parsed.data.password);
      const userId = randomUUID();
      const [user] = await tx
        .insert(usersTable)
        .values({
          id: userId,
          phone: encryptSensitiveData(parsed.data.phone, "user-phone"),
          phoneLookupHash: createSensitiveDataLookupIndex(parsed.data.phone, "user-phone"),
          emailVerifiedAt: requiresOtp ? now : null,
          emailEncrypted: encryptSensitiveData(parsed.data.email, "user-email"),
          emailLookupHash,
          phoneVerifiedAt: null,
          displayName: encryptSensitiveData(normalizedName, "user-name"),
          displayNameLookupHash: createSensitiveDataLookupIndex(
            normalizeSensitiveNameForLookup(normalizedName),
            "user-name",
          ),
          countryCode: registrationCountry.countryCode,
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

      const apiKeyPair = createDeveloperApiKeyMaterial();
      const { secretKey, ...storedApiKeyPair } = apiKeyPair;
      await tx.insert(developerApiKeysTable).values({
        userId,
        label: "Clé principale",
        ...storedApiKeyPair,
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
          displayName: formatCustomerDisplayName(
            decryptSensitiveDataIfEncrypted(user.displayName, "user-name"),
          ),
          countryCode: user.countryCode,
          pinConfigured: false,
          developerApiKeyPair: {
            label: "Clé principale",
            publicKey: apiKeyPair.publicKey,
            secretKey,
          },
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
      res.status(409).json({ error: "Ces informations sont déjà associées à un compte. Connectez-vous ou réinitialisez votre code secret." });
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
      res.status(409).json({ error: "Ces informations sont déjà associées à un compte. Connectez-vous ou réinitialisez votre code secret." });
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

  const parsed = SignInCustomerBody.safeParse(normalizeSignInBody(req.body));
  if (!parsed.success) {
    try {
      const emailLookupHash = getLoginEmailHashFromBody(req.body);
      const buckets = getLoginAttemptBuckets(emailLookupHash, req);
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
    res.status(400).json({ error: "Adresse e-mail ou code secret invalide." });
    return;
  }

  try {
    const emailLookupHash = createSensitiveDataLookupIndex(parsed.data.email, "user-email");
    const buckets = getLoginAttemptBuckets(emailLookupHash, req);
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
          paymentTestAccount: sql<boolean>`exists (
            select 1 from public.sf_replit_payment_test_access a
            where a.user_id=${usersTable.id} and a.state='active'
          )`,
        })
        .from(usersTable)
        .innerJoin(customerCredentialsTable, eq(customerCredentialsTable.userId, usersTable.id))
        .where(and(
          eq(usersTable.emailLookupHash, emailLookupHash),
          sharedDatabaseCustomerCondition(),
        ))
        .for("update");

      const scopedHash = isSharedDatabasePreview() && !record?.paymentTestAccount
        ? previewPasswordForVerification(record?.passwordHash ?? "")
        : record?.passwordHash;
      const encodedHash = scopedHash || await DUMMY_PASSWORD_HASH;
      const validPassword = await verifyCustomerSecret(parsed.data.password, encodedHash);
      if (
        !record
        || !scopedHash
        || !validPassword
        || (record.accountStatus !== "active" && record.accountStatus !== "suspended")
      ) {
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

      if (record.accountStatus === "suspended") {
        return { kind: "blocked" } as const;
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
          displayName: formatCustomerDisplayName(
            decryptSensitiveDataIfEncrypted(record.displayName, "user-name"),
          ),
          countryCode: record.countryCode,
          pinConfigured: record.pinHash !== null,
        },
      } as const;
    });

    if (result.kind === "rate") {
      sendRateLimit(res, result.retry);
      return;
    }
    if (result.kind === "blocked") {
      res.status(423).json({
        error: "Votre compte est bloqué. Veuillez contacter le support SendFlow pour obtenir de l’aide.",
      });
      return;
    }
    if (result.kind !== "signed-in") {
      res.status(401).json({ error: "Adresse e-mail ou code secret incorrect." });
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

router.get("/auth/biometric", async (req, res): Promise<void> => {
  try {
    const session = await requireCustomerSession(req, res);
    if (!session) return;
    const origin = getWebAuthnOrigin(req);
    if (!origin) {
      res.status(403).json({ error: "Cette origine ne peut pas vérifier une clé biométrique." });
      return;
    }
    const credentialCount = session.pinConfigured
      ? await getBiometricCredentialCount(session.userId, origin.rpId)
      : 0;
    res.json(GetCustomerBiometricStatusResponse.parse({
      enabled: credentialCount > 0,
      credentialCount,
    }));
  } catch (error) {
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer biometric status could not be loaded");
    res.status(503).json({ error: "La biométrie est momentanément indisponible." });
  }
});

router.post("/auth/biometric/registration/options", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }
  try {
    const session = await requireCustomerSession(req, res);
    if (!session) return;
    if (!session.pinConfigured || !session.pinUnlocked) {
      res.status(403).json({ error: "Déverrouillez votre code PIN avant d’activer la biométrie." });
      return;
    }
    const origin = getWebAuthnOrigin(req);
    if (!origin) {
      res.status(403).json({ error: "Cette origine ne peut pas enregistrer une clé biométrique." });
      return;
    }
    const existing = await db.select({
      credentialId: customerBiometricCredentialsTable.credentialId,
      transports: customerBiometricCredentialsTable.transports,
    }).from(customerBiometricCredentialsTable)
      .where(and(
        eq(customerBiometricCredentialsTable.userId, session.userId),
        eq(customerBiometricCredentialsTable.rpId, origin.rpId),
      ));
    const options = await generateRegistrationOptions({
      rpName: "SendFlow",
      rpID: origin.rpId,
      userID: new TextEncoder().encode(session.userId),
      userName: session.userId,
      userDisplayName: session.displayName || "Compte SendFlow",
      attestationType: "none",
      timeout: 60_000,
      excludeCredentials: existing.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports,
      })),
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        userVerification: "required",
      },
    });
    const challengeId = await saveBiometricChallenge(
      session.userId,
      session.sessionId,
      "registration",
      origin.origin,
      origin.rpId,
      options.challenge,
    );
    res.json(StartCustomerBiometricRegistrationResponse.parse({ challengeId, options }));
  } catch (error) {
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer biometric registration options failed");
    res.status(503).json({ error: "L’activation biométrique est momentanément indisponible." });
  }
});

router.post("/auth/biometric/registration/verify", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }
  const parsed = VerifyCustomerBiometricRegistrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "La réponse biométrique est invalide." });
    return;
  }
  try {
    const session = await requireCustomerSession(req, res);
    if (!session) return;
    if (!session.pinConfigured || !session.pinUnlocked) {
      res.status(403).json({ error: "Déverrouillez votre code PIN avant d’activer la biométrie." });
      return;
    }
    const origin = getWebAuthnOrigin(req);
    if (!origin) {
      res.status(403).json({ error: "Cette origine ne peut pas enregistrer une clé biométrique." });
      return;
    }
    const now = new Date();
    const [challenge] = await db.update(customerBiometricChallengesTable)
      .set({ usedAt: now })
      .where(and(
        eq(customerBiometricChallengesTable.id, parsed.data.challengeId),
        eq(customerBiometricChallengesTable.userId, session.userId),
        eq(customerBiometricChallengesTable.sessionId, session.sessionId),
        eq(customerBiometricChallengesTable.purpose, "registration"),
        eq(customerBiometricChallengesTable.expectedOrigin, origin.origin),
        eq(customerBiometricChallengesTable.rpId, origin.rpId),
        gte(customerBiometricChallengesTable.expiresAt, now),
        isNull(customerBiometricChallengesTable.usedAt),
      ))
      .returning();
    if (!challenge) {
      res.status(400).json({ error: "La demande biométrique a expiré. Réessayez." });
      return;
    }
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: parsed.data.credential as unknown as RegistrationResponseJSON,
        expectedChallenge: challenge.challenge,
        expectedOrigin: challenge.expectedOrigin,
        expectedRPID: challenge.rpId,
        requireUserVerification: true,
      });
    } catch {
      verification = null;
    }
    if (!verification?.verified || !verification.registrationInfo.userVerified) {
      res.status(400).json({ error: "L’authentification biométrique n’a pas été confirmée." });
      return;
    }
    const info = verification.registrationInfo.credential;
    const transports = info.transports ?? [];
    const result = await db.transaction(async (tx) => {
      const [currentSession] = await tx.select({ id: customerSessionsTable.id })
        .from(customerSessionsTable)
        .where(and(
          eq(customerSessionsTable.id, session.sessionId),
          eq(customerSessionsTable.userId, session.userId),
          isNull(customerSessionsTable.revokedAt),
          gte(customerSessionsTable.expiresAt, now),
          gte(customerSessionsTable.pinVerifiedUntil, now),
        ))
        .for("update")
        .limit(1);
      if (!currentSession) return false;
      await tx.insert(customerBiometricCredentialsTable).values({
        userId: session.userId,
        rpId: challenge.rpId,
        credentialId: info.id,
        publicKey: Buffer.from(info.publicKey).toString("base64url"),
        counter: info.counter,
        transports,
      });
      return true;
    });
    if (!result) {
      res.status(400).json({ error: "La demande biométrique a déjà été utilisée. Réessayez." });
      return;
    }
    const credentialCount = await getBiometricCredentialCount(session.userId, origin.rpId);
    res.json(VerifyCustomerBiometricRegistrationResponse.parse({
      enabled: credentialCount > 0,
      credentialCount,
    }));
  } catch (error) {
    if (safeErrorCode(error) === "23505") {
      res.status(409).json({ error: "Cette empreinte est déjà associée à votre compte." });
      return;
    }
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer biometric registration failed");
    res.status(503).json({ error: "L’activation biométrique est momentanément indisponible." });
  }
});

router.post("/auth/biometric/authentication/options", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }
  try {
    const session = await requireCustomerSession(req, res);
    if (!session) return;
    if (!session.pinConfigured) {
      res.status(401).json({ error: "Aucun code PIN n’est configuré." });
      return;
    }
    const origin = getWebAuthnOrigin(req);
    if (!origin) {
      res.status(403).json({ error: "Cette origine ne peut pas vérifier une clé biométrique." });
      return;
    }
    const credentials = await db.select({
      credentialId: customerBiometricCredentialsTable.credentialId,
      transports: customerBiometricCredentialsTable.transports,
    }).from(customerBiometricCredentialsTable)
      .where(and(
        eq(customerBiometricCredentialsTable.userId, session.userId),
        eq(customerBiometricCredentialsTable.rpId, origin.rpId),
      ));
    if (credentials.length === 0) {
      res.status(404).json({ error: "Aucune empreinte n’est activée sur ce compte." });
      return;
    }
    const options = await generateAuthenticationOptions({
      rpID: origin.rpId,
      allowCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports,
      })),
      userVerification: "required",
      timeout: 60_000,
    });
    const challengeId = await saveBiometricChallenge(
      session.userId,
      session.sessionId,
      "authentication",
      origin.origin,
      origin.rpId,
      options.challenge,
    );
    res.json(StartCustomerBiometricAuthenticationResponse.parse({ challengeId, options }));
  } catch (error) {
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer biometric authentication options failed");
    res.status(503).json({ error: "Le déverrouillage biométrique est momentanément indisponible." });
  }
});

router.post("/auth/biometric/authentication/verify", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }
  const parsed = VerifyCustomerBiometricAuthenticationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "La réponse biométrique est invalide." });
    return;
  }
  try {
    const session = await requireCustomerSession(req, res);
    if (!session) return;
    if (!session.pinConfigured) {
      res.status(401).json({ error: "Aucun code PIN n’est configuré." });
      return;
    }
    const origin = getWebAuthnOrigin(req);
    if (!origin) {
      res.status(403).json({ error: "Cette origine ne peut pas vérifier une clé biométrique." });
      return;
    }
    const buckets = getPinAttemptBuckets(session.userId, req);
    const result = await withPinAttemptLock(buckets, async (tx) => {
      const now = new Date();
      const retry = await getAuthRateLimit(buckets, now, tx);
      if (retry !== null) return { kind: "rate", retry } as const;
      const [challenge] = await tx.select().from(customerBiometricChallengesTable)
        .where(and(
          eq(customerBiometricChallengesTable.id, parsed.data.challengeId),
          eq(customerBiometricChallengesTable.userId, session.userId),
          eq(customerBiometricChallengesTable.sessionId, session.sessionId),
          eq(customerBiometricChallengesTable.purpose, "authentication"),
          eq(customerBiometricChallengesTable.expectedOrigin, origin.origin),
          eq(customerBiometricChallengesTable.rpId, origin.rpId),
          gte(customerBiometricChallengesTable.expiresAt, now),
          isNull(customerBiometricChallengesTable.usedAt),
        )).for("update").limit(1);
      if (!challenge) return { kind: "invalid" } as const;
      const response = parsed.data.credential as unknown as AuthenticationResponseJSON;
      const responseId = typeof response.id === "string" ? response.id : "";
      const [credential] = await tx.select().from(customerBiometricCredentialsTable)
        .where(and(
          eq(customerBiometricCredentialsTable.userId, session.userId),
          eq(customerBiometricCredentialsTable.credentialId, responseId),
          eq(customerBiometricCredentialsTable.rpId, challenge.rpId),
        )).for("update").limit(1);
      let verified = false;
      let newCounter = credential?.counter ?? 0;
      if (credential) {
        try {
          const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: challenge.challenge,
            expectedOrigin: challenge.expectedOrigin,
            expectedRPID: challenge.rpId,
            credential: {
              id: credential.credentialId,
              publicKey: new Uint8Array(Buffer.from(credential.publicKey, "base64url")),
              counter: credential.counter,
              transports: credential.transports as never,
            },
            requireUserVerification: true,
          });
          verified = verification.verified && verification.authenticationInfo.userVerified;
          newCounter = verification.authenticationInfo.newCounter;
        } catch {
          verified = false;
        }
      }
      await tx.update(customerBiometricChallengesTable)
        .set({ usedAt: now })
        .where(and(
          eq(customerBiometricChallengesTable.id, challenge.id),
          isNull(customerBiometricChallengesTable.usedAt),
        ));
      if (!verified || !credential) {
        await recordAuthFailure(buckets, now, tx);
        const retryAfterFailure = await getAuthRateLimit(buckets, now, tx);
        return retryAfterFailure !== null
          ? { kind: "rate", retry: retryAfterFailure } as const
          : { kind: "invalid" } as const;
      }
      const [updatedCredential] = await tx.update(customerBiometricCredentialsTable)
        .set({ counter: newCounter, lastUsedAt: now })
        .where(and(
          eq(customerBiometricCredentialsTable.id, credential.id),
          eq(customerBiometricCredentialsTable.userId, session.userId),
          eq(customerBiometricCredentialsTable.counter, credential.counter),
        )).returning({ id: customerBiometricCredentialsTable.id });
      const [updatedSession] = await tx.update(customerSessionsTable)
        .set({
          pinVerifiedUntil: new Date(now.getTime() + CUSTOMER_PIN_UNLOCK_TTL_MS),
          lastSeenAt: now,
        })
        .where(and(
          eq(customerSessionsTable.id, session.sessionId),
          eq(customerSessionsTable.userId, session.userId),
          isNull(customerSessionsTable.revokedAt),
          gte(customerSessionsTable.expiresAt, now),
        )).returning({ id: customerSessionsTable.id });
      if (!updatedCredential || !updatedSession) return { kind: "expired" } as const;
      await clearAuthFailures(buckets, tx);
      return { kind: "success" } as const;
    });
    if (result.kind === "rate") {
      sendRateLimit(res, result.retry);
      return;
    }
    if (result.kind === "invalid") {
      res.status(401).json({ error: "L’empreinte n’a pas pu être vérifiée. Utilisez votre code PIN." });
      return;
    }
    if (result.kind === "expired") {
      res.status(401).json({ error: "Session expirée. Connectez-vous à nouveau." });
      return;
    }
    res.json(VerifyCustomerBiometricAuthenticationResponse.parse({
      pinConfigured: true,
      pinUnlocked: true,
    }));
  } catch (error) {
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer biometric authentication failed");
    res.status(503).json({ error: "Le déverrouillage biométrique est momentanément indisponible." });
  }
});

router.delete("/auth/biometric", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }
  try {
    const session = await requireCustomerSession(req, res);
    if (!session) return;
    if (!session.pinConfigured || !session.pinUnlocked) {
      res.status(403).json({ error: "Déverrouillez votre code PIN avant de désactiver la biométrie." });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.delete(customerBiometricCredentialsTable)
        .where(eq(customerBiometricCredentialsTable.userId, session.userId));
      await tx.delete(customerBiometricChallengesTable)
        .where(and(
          eq(customerBiometricChallengesTable.userId, session.userId),
          isNull(customerBiometricChallengesTable.usedAt),
        ));
    });
    res.json(RemoveCustomerBiometricCredentialsResponse.parse({ enabled: false, credentialCount: 0 }));
  } catch (error) {
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer biometric credentials could not be removed");
    res.status(503).json({ error: "La désactivation biométrique est momentanément indisponible." });
  }
});

router.put("/me/pin", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }

  try {
    const session = await requireCustomerSession(req, res);
    if (!session) return;
    const parsed = SetCustomerPinBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Le code PIN doit contenir quatre chiffres." });
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