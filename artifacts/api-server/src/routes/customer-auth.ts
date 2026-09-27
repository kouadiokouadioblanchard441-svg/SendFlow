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
  phoneOtpChallengesTable,
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
  clearAuthFailures,
  getAuthRateLimit,
  recordAuthFailure,
} from "../lib/customer-auth-rate-limit";
import { hashCustomerSecret, hashCustomerSessionToken, verifyCustomerSecret } from "../lib/customer-auth-crypto";
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
    error: "Trop de tentatives. Réessayez plus tard.",
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

function getLoginAttemptBuckets(phone: string, req: Parameters<typeof requesterAddress>[0]) {
  return [
    fingerprint(`customer-login-phone:${phone}`),
    fingerprint(`customer-login-requester:${requesterAddress(req)}`),
  ];
}

function getPinAttemptBuckets(userId: string, req: Parameters<typeof requesterAddress>[0]) {
  return [
    fingerprint(`customer-pin-user:${userId}`),
    fingerprint(`customer-pin-requester:${requesterAddress(req)}`),
  ];
}

router.post("/auth/register", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }

  const parsed = RegisterCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Vérifiez les informations du compte." });
    return;
  }

  const fullName = formatName(parsed.data.fullName);
  const birthDate = parsed.data.birthDate.toISOString().slice(0, 10);
  if (
    fullName.length < 2
    || fullName.length > 120
    || fullName.split(" ").filter(Boolean).length < 2
    || !/\p{L}/u.test(fullName)
    || !isAdultBirthDate(birthDate)
    || parsed.data.acceptedPrivacy !== true
  ) {
    res.status(400).json({ error: "Vérifiez le nom, la date de naissance et l’acceptation de la politique." });
    return;
  }

  const now = new Date();
  try {
    const [availableChallenge] = await db
      .select({ id: phoneOtpChallengesTable.id })
      .from(phoneOtpChallengesTable)
      .where(verifiedCustomerOtpCondition(parsed.data.challengeId, parsed.data.phone, "signup", now))
      .limit(1);
    if (!availableChallenge) {
      res.status(409).json({ error: "La vérification du téléphone a expiré ou a déjà été utilisée." });
      return;
    }

    const passwordHash = await hashCustomerSecret(parsed.data.password);
    const sessionTokenAndAccount = await db.transaction(async (tx) => {
      const [challenge] = await tx
        .select({ id: phoneOtpChallengesTable.id })
        .from(phoneOtpChallengesTable)
        .where(verifiedCustomerOtpCondition(parsed.data.challengeId, parsed.data.phone, "signup", now))
        .for("update");

      if (!challenge) return { kind: "invalid" } as const;

      const [existingUser] = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.phone, parsed.data.phone))
        .limit(1);

      await tx
        .update(phoneOtpChallengesTable)
        .set({ consumedAt: now })
        .where(eq(phoneOtpChallengesTable.id, challenge.id));

      if (existingUser) return { kind: "exists" } as const;

      const userId = randomUUID();
      const [user] = await tx
        .insert(usersTable)
        .values({
          id: userId,
          phone: parsed.data.phone,
          displayName: fullName,
          countryCode: parsed.data.countryCode ?? null,
          birthDate,
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

      return {
        kind: "created",
        session,
        account: {
          userId: user.id,
          phone: user.phone,
          displayName: user.displayName,
          countryCode: user.countryCode,
          pinConfigured: false,
        },
      } as const;
    });

    if (sessionTokenAndAccount.kind === "invalid") {
      res.status(409).json({ error: "La vérification du téléphone a expiré ou a déjà été utilisée." });
      return;
    }
    if (sessionTokenAndAccount.kind === "exists") {
      res.status(409).json({ error: "Ce numéro est déjà associé à un compte. Connectez-vous ou réinitialisez votre code secret." });
      return;
    }

    setCustomerSessionCookie(res, sessionTokenAndAccount.session.token);
    res.status(201).json(RegisterCustomerResponse.parse(sessionTokenAndAccount.account));
  } catch (error) {
    if (safeErrorCode(error) === "23505") {
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
    res.status(400).json({ error: "Numéro ou code secret invalide." });
    return;
  }

  try {
    const buckets = getLoginAttemptBuckets(parsed.data.phone, req);
    const retry = await getAuthRateLimit(buckets);
    if (retry !== null) {
      sendRateLimit(res, retry);
      return;
    }

    const [record] = await db
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
      .where(eq(usersTable.phone, parsed.data.phone))
      .limit(1);

    const encodedHash = record?.passwordHash ?? await DUMMY_PASSWORD_HASH;
    const validPassword = await verifyCustomerSecret(parsed.data.password, encodedHash);
    if (!record || record.accountStatus !== "active" || !validPassword) {
      await recordAuthFailure(buckets);
      const retryAfterFailure = await getAuthRateLimit(buckets);
      if (retryAfterFailure !== null) {
        sendRateLimit(res, retryAfterFailure);
        return;
      }
      res.status(401).json({ error: "Numéro ou code secret incorrect." });
      return;
    }

    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const [freshRecord] = await tx
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
        .where(eq(usersTable.id, record.userId))
        .for("update");

      if (
        !freshRecord
        || freshRecord.accountStatus !== "active"
        || freshRecord.passwordHash !== record.passwordHash
        || freshRecord.phone !== parsed.data.phone
      ) {
        return { kind: "invalid" } as const;
      }

      await tx
        .update(usersTable)
        .set({ lastSeenAt: now })
        .where(eq(usersTable.id, freshRecord.userId));
      const session = await insertCustomerSession(tx, freshRecord.userId, now);
      await recordLoginActivity(req, freshRecord.userId, session.sessionId, tx);

      return {
        kind: "signed-in",
        session,
        account: {
          userId: freshRecord.userId,
          phone: freshRecord.phone,
          displayName: freshRecord.displayName,
          countryCode: freshRecord.countryCode,
          pinConfigured: freshRecord.pinHash !== null,
        },
      } as const;
    });

    if (result.kind !== "signed-in") {
      await recordAuthFailure(buckets);
      res.status(401).json({ error: "Numéro ou code secret incorrect." });
      return;
    }

    await clearAuthFailures(buckets);
    setCustomerSessionCookie(res, result.session.token);
    res.json(SignInCustomerResponse.parse(result.account));
  } catch (error) {
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer sign-in failed");
    res.status(503).json({ error: "La connexion est momentanément indisponible." });
  }
});

router.get("/auth/session", async (req, res): Promise<void> => {
  try {
    const session = await getCustomerSession(req);
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
    const retry = await getAuthRateLimit(buckets);
    if (retry !== null) {
      sendRateLimit(res, retry);
      return;
    }

    const [credential] = await db
      .select({ pinHash: customerCredentialsTable.pinHash })
      .from(customerCredentialsTable)
      .where(eq(customerCredentialsTable.userId, session.userId))
      .limit(1);
    if (!credential?.pinHash || !await verifyCustomerSecret(parsed.data.pin, credential.pinHash)) {
      await recordAuthFailure(buckets);
      const retryAfterFailure = await getAuthRateLimit(buckets);
      if (retryAfterFailure !== null) {
        sendRateLimit(res, retryAfterFailure);
        return;
      }
      res.status(401).json({ error: "Code PIN incorrect." });
      return;
    }

    const now = new Date();
    const [updatedSession] = await db
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
    if (!updatedSession) {
      res.status(401).json({ error: "Session expirée. Connectez-vous à nouveau." });
      return;
    }

    await clearAuthFailures(buckets);
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
    const retry = await getAuthRateLimit(buckets);
    if (retry !== null) {
      sendRateLimit(res, retry);
      return;
    }

    const [credential] = await db
      .select({ pinHash: customerCredentialsTable.pinHash })
      .from(customerCredentialsTable)
      .where(eq(customerCredentialsTable.userId, session.userId))
      .limit(1);
    if (!credential) {
      res.status(503).json({ error: "Données du compte indisponibles." });
      return;
    }

    if (credential.pinHash) {
      if (!parsed.data.currentPin) {
        res.status(400).json({ error: "Saisissez votre code PIN actuel." });
        return;
      }
      if (!await verifyCustomerSecret(parsed.data.currentPin, credential.pinHash)) {
        await recordAuthFailure(buckets);
        const retryAfterFailure = await getAuthRateLimit(buckets);
        if (retryAfterFailure !== null) {
          sendRateLimit(res, retryAfterFailure);
          return;
        }
        res.status(401).json({ error: "Code PIN actuel incorrect." });
        return;
      }
      if (parsed.data.currentPin === parsed.data.newPin) {
        res.status(400).json({ error: "Choisissez un code PIN différent de l’actuel." });
        return;
      }
    }

    const newPinHash = await hashCustomerSecret(parsed.data.newPin);
    const now = new Date();
    const updated = await db.transaction(async (tx) => {
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

      if (!updatedCredential) return false;
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
      if (!updatedSession) throw new Error("Customer session expired during PIN update");
      return true;
    });

    if (!updated) {
      res.status(401).json({ error: "Le code PIN a changé. Connectez-vous à nouveau." });
      return;
    }

    await clearAuthFailures(buckets);
    res.json(SetCustomerPinResponse.parse({ pinConfigured: true, pinUnlocked: true }));
  } catch (error) {
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer PIN update failed");
    res.status(503).json({ error: "La mise à jour du PIN est momentanément indisponible." });
  }
});

export default router;