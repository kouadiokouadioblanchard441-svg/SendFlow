import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import {
  and,
  db,
  eq,
  gt,
  isNull,
  superAdminCredentialsTable,
  superAdminRecoveryCodesTable,
  superAdminRefreshTokensTable,
  superAdminSessionsTable,
  superAdminStepUpTokensTable,
} from "@workspace/db";
import {
  createAdminAccessToken,
  createOpaqueToken,
  createRecoveryCodes,
  createTotpSecret,
  decryptTotpSecret,
  encryptTotpSecret,
  hashRecoveryCode,
  hashAdminPassword,
  hashOpaqueToken,
  normalizeAdminEmail,
  verifyAdminAccessToken,
  verifyAdminPassword,
  verifyTotpCode,
} from "../lib/admin-auth-crypto";
import {
  ADMIN_ACCESS_TTL_MS,
  ADMIN_SESSION_TTL_MS,
  ADMIN_STEP_UP_TTL_MS,
  adminSessionContext,
  clearAdminSessionCookies,
  readAdminRefreshToken,
  setAdminSessionCookies,
} from "../lib/admin-session";
import {
  clearAuthFailures,
  getAuthRateLimit,
  recordAuthFailure,
  withAuthAttemptLock,
} from "../lib/customer-auth-rate-limit";
import { fingerprint, isTrustedOrigin, requesterAddress } from "../lib/request-security";
import { recordAdminAudit } from "../lib/admin-audit";
import { issueableAdminAction } from "../lib/admin-step-up-policy";

const router: IRouter = Router();
const loginInput = z.object({
  email: z.string().max(254),
  password: z.string().min(1).max(1024),
  totpCode: z.string().regex(/^[0-9]{6}$/u),
}).strict();
const stepUpInput = z.object({
  totpCode: z.string().regex(/^[0-9]{6}$/u),
  action: z.string().max(255),
  query: z.record(z.string(), z.unknown()).optional().default({}),
  payload: z.unknown().optional().default(null),
}).strict();
const setupStartInput = z.object({}).strict();
const setupCompleteInput = z.object({
  challengeId: z.string().uuid(),
  email: z.string().max(254),
  password: z.string().min(12).max(1024),
  totpCode: z.string().regex(/^[0-9]{6}$/u),
}).strict();
const dummyTotpSecret = createTotpSecret();
let dummyPasswordHash: Promise<string> | null = null;
const setupChallengeTtlMs = 10 * 60 * 1000;
const setupChallengeMaxAttempts = 5;
const setupChallenges = new Map<string, {
  secret: string;
  requester: string;
  expiresAt: number;
  attempts: number;
}>();
const setupStartLimits = new Map<string, { count: number; expiresAt: number }>();

function getDummyPasswordHash() {
  dummyPasswordHash ??= hashAdminPassword(randomUUID() + randomUUID());
  return dummyPasswordHash;
}

function requestAuditContext(req: Request) {
  return {
    ipHash: fingerprint(`admin-ip:${requesterAddress(req)}`),
    userAgentHash: fingerprint(`admin-ua:${(req.get("user-agent") ?? "").slice(0, 512)}`),
  };
}

function genericLoginFailure(res: Response) {
  res.status(401).json({ error: "Identifiants ou code d’authentification invalides." });
}

function isJwtConfigured() {
  return Boolean(createAdminAccessToken(
    "7c6e3792-2fc8-4f9f-8dbf-871cfa5c3a12",
    Math.floor(Date.now() / 1000),
  ));
}

function isTotpEncryptionConfigured() {
  return Boolean(encryptTotpSecret(dummyTotpSecret));
}

function pruneSetupState(now: number) {
  for (const [id, challenge] of setupChallenges) {
    if (challenge.expiresAt <= now || challenge.attempts >= setupChallengeMaxAttempts) {
      setupChallenges.delete(id);
    }
  }
  for (const [requester, limit] of setupStartLimits) {
    if (limit.expiresAt <= now) setupStartLimits.delete(requester);
  }
}

router.get("/setup-status", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, private");
  try {
    const [credentials] = await db.select({ id: superAdminCredentialsTable.id })
      .from(superAdminCredentialsTable)
      .where(eq(superAdminCredentialsTable.id, 1))
      .limit(1);
    res.json({ setupAvailable: !credentials });
  } catch {
    req.log.error("Administrator setup status lookup failed");
    res.status(503).json({ error: "Le service de connexion est momentanément indisponible." });
  }
});

router.post("/setup/start", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, private");
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine non autorisée." });
    return;
  }
  if (!setupStartInput.safeParse(req.body).success) {
    res.status(400).json({ error: "Demande d’initialisation invalide." });
    return;
  }
  if (!isJwtConfigured() || !isTotpEncryptionConfigured()) {
    res.status(503).json({ error: "Le service de connexion est momentanément indisponible." });
    return;
  }

  const now = Date.now();
  pruneSetupState(now);
  const requester = fingerprint(`admin-setup:${requesterAddress(req)}`);
  const currentLimit = setupStartLimits.get(requester);
  if (currentLimit && currentLimit.count >= 3) {
    res.status(429).json({ error: "Trop de demandes. Réessayez plus tard." });
    return;
  }
  try {
    const [credentials] = await db.select({ id: superAdminCredentialsTable.id })
      .from(superAdminCredentialsTable)
      .where(eq(superAdminCredentialsTable.id, 1))
      .limit(1);
    if (credentials) {
      res.status(409).json({ error: "L’initialisation n’est plus disponible." });
      return;
    }

    const existing = [...setupChallenges.entries()]
      .find(([, challenge]) => challenge.requester === requester);
    if (existing) {
      const [challengeId, challenge] = existing;
      res.json({
        challengeId,
        totpSecret: challenge.secret,
        expiresInSeconds: Math.floor((challenge.expiresAt - now) / 1000),
      });
      return;
    }

    const limit = currentLimit ?? { count: 0, expiresAt: now + 15 * 60 * 1000 };
    limit.count += 1;
    setupStartLimits.set(requester, limit);
    const challengeId = randomUUID();
    const challenge = {
      secret: createTotpSecret(),
      requester,
      expiresAt: now + setupChallengeTtlMs,
      attempts: 0,
    };
    setupChallenges.set(challengeId, challenge);
    res.json({
      challengeId,
      totpSecret: challenge.secret,
      expiresInSeconds: setupChallengeTtlMs / 1000,
    });
  } catch {
    req.log.error("Administrator enrollment start failed");
    res.status(503).json({ error: "L’initialisation est momentanément indisponible." });
  }
});

router.post("/setup/complete", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, private");
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine non autorisée." });
    return;
  }
  const parsed = setupCompleteInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Les informations saisies sont invalides." });
    return;
  }
  const email = normalizeAdminEmail(parsed.data.email);
  if (!email) {
    res.status(400).json({ error: "Les informations saisies sont invalides." });
    return;
  }
  const nowMs = Date.now();
  pruneSetupState(nowMs);
  const challenge = setupChallenges.get(parsed.data.challengeId);
  const requester = fingerprint(`admin-setup:${requesterAddress(req)}`);
  if (!challenge || challenge.requester !== requester || challenge.expiresAt <= nowMs) {
    res.status(400).json({ error: "L’enrôlement a expiré. Recommencez l’initialisation." });
    return;
  }
  const acceptedStep = verifyTotpCode(challenge.secret, parsed.data.totpCode, nowMs, null);
  if (acceptedStep === null) {
    challenge.attempts += 1;
    if (challenge.attempts >= setupChallengeMaxAttempts) setupChallenges.delete(parsed.data.challengeId);
    await recordAdminAudit({
      adminUserId: "super-admin",
      action: "admin_totp_failure",
      resourceType: "admin_access",
      resourceId: "super-admin",
      ...requestAuditContext(req),
      outcome: "failure",
    }).catch(() => undefined);
    res.status(400).json({ error: "Code invalide. Vérifiez Google Authenticator puis réessayez." });
    return;
  }

  try {
    const encryptedTotp = encryptTotpSecret(challenge.secret);
    const accessTokenProbe = createAdminAccessToken(randomUUID(), Math.floor(nowMs / 1000));
    if (!encryptedTotp || !decryptTotpSecret(encryptedTotp) || !accessTokenProbe || !verifyAdminAccessToken(accessTokenProbe)) {
      req.log.error("Administrator enrollment cryptographic configuration unavailable");
      res.status(503).json({ error: "L’initialisation est momentanément indisponible." });
      return;
    }

    const passwordHash = await hashAdminPassword(parsed.data.password);
    const recoveryCodes = createRecoveryCodes();
    const recoveryHashes = recoveryCodes.map(({ code }) => hashRecoveryCode(code));
    if (recoveryHashes.some((hash) => !hash)) {
      res.status(503).json({ error: "L’initialisation est momentanément indisponible." });
      return;
    }

    await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: superAdminCredentialsTable.id })
        .from(superAdminCredentialsTable)
        .where(eq(superAdminCredentialsTable.id, 1))
        .for("update")
        .limit(1);
      if (existing) throw new Error("ADMIN_ALREADY_INITIALIZED");

      await tx.insert(superAdminCredentialsTable).values({
        id: 1,
        emailNormalized: email,
        passwordHash,
        totpCiphertext: encryptedTotp.ciphertext,
        totpNonce: encryptedTotp.nonce,
        totpAuthTag: encryptedTotp.authTag,
        lastTotpStep: acceptedStep,
        active: true,
        createdAt: new Date(nowMs),
        updatedAt: new Date(nowMs),
        passwordChangedAt: new Date(nowMs),
      });
      for (const codeHash of recoveryHashes) {
        await tx.insert(superAdminRecoveryCodesTable).values({
          credentialId: 1,
          codeHash: codeHash!,
        });
      }
      await recordAdminAudit({
        adminUserId: "super-admin",
        action: "provision_admin",
        resourceType: "admin_access",
        resourceId: "super-admin",
        ...requestAuditContext(req),
        outcome: "success",
      }, tx);
    });
    setupChallenges.delete(parsed.data.challengeId);
    res.status(201).json({ initialized: true, recoveryCodes: recoveryCodes.map(({ code }) => code) });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_ALREADY_INITIALIZED") {
      setupChallenges.delete(parsed.data.challengeId);
      res.status(409).json({ error: "L’initialisation n’est plus disponible." });
      return;
    }
    req.log.error("Administrator enrollment completion failed");
    res.status(503).json({ error: "L’initialisation est momentanément indisponible." });
  }
});

router.get("/access", (req, res): void => {
  const session = adminSessionContext(req);
  res.setHeader("Cache-Control", "no-store, private");
  res.json({
    isAdmin: Boolean(session),
    sessionAuthenticated: Boolean(session && session.expiresAt.getTime() > Date.now()),
    canMutate: Boolean(session?.canMutate),
  });
});

router.post("/activity", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine non autorisée." });
    return;
  }
  const session = adminSessionContext(req);
  if (!session) {
    res.status(401).json({ error: "Connexion administrateur requise." });
    return;
  }
  const now = new Date();
  const idleExpiresAt = new Date(Math.min(
    session.absoluteExpiresAt.getTime(),
    now.getTime() + 15 * 60 * 1000,
  ));
  try {
    const [updated] = await db.update(superAdminSessionsTable)
      .set({ lastActivityAt: now, idleExpiresAt })
      .where(and(
        eq(superAdminSessionsTable.id, session.sessionId),
        isNull(superAdminSessionsTable.revokedAt),
        gt(superAdminSessionsTable.idleExpiresAt, now),
        gt(superAdminSessionsTable.absoluteExpiresAt, now),
      ))
      .returning({ id: superAdminSessionsTable.id });
    if (!updated) {
      clearAdminSessionCookies(res);
      res.status(401).json({ error: "Session administrateur expirée." });
      return;
    }
    res.status(204).end();
  } catch {
    req.log.error("Administrator activity update failed");
    res.status(503).json({ error: "La session administrateur est indisponible." });
  }
});

router.post("/sign-in", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine non autorisée." });
    return;
  }
  const parsed = loginInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données de connexion invalides." });
    return;
  }
  if (!isJwtConfigured() || !isTotpEncryptionConfigured()) {
    req.log.error("Administrator authentication configuration unavailable");
    res.status(503).json({ error: "La connexion administrateur est indisponible." });
    return;
  }

  const email = normalizeAdminEmail(parsed.data.email);
  const address = requesterAddress(req);
  let buckets: string[];
  try {
    buckets = [
      fingerprint(`admin-login-email:${email ?? "invalid"}`),
      fingerprint(`admin-login-requester:${address}`),
    ];
  } catch {
    res.status(503).json({ error: "La connexion administrateur est indisponible." });
    return;
  }

  try {
    const result = await withAuthAttemptLock(buckets, async (tx) => {
      const now = new Date();
      const retry = await getAuthRateLimit(buckets, now, tx);
      if (retry) return { kind: "limited" as const, retry };

      const [credentials] = await tx.select()
        .from(superAdminCredentialsTable)
        .where(eq(superAdminCredentialsTable.emailNormalized, email ?? "invalid"))
        .for("update")
        .limit(1);
      const passwordHash = credentials?.passwordHash ?? await getDummyPasswordHash();
      const passwordValid = await verifyAdminPassword(parsed.data.password, passwordHash);
      const decryptedSecret = credentials?.active
        ? decryptTotpSecret({
          ciphertext: credentials.totpCiphertext,
          nonce: credentials.totpNonce,
          authTag: credentials.totpAuthTag,
        })
        : null;
      const acceptedStep = verifyTotpCode(
        decryptedSecret ?? dummyTotpSecret,
        parsed.data.totpCode,
        now.getTime(),
        credentials?.lastTotpStep ?? null,
      );

      if (
        !credentials
        || !credentials.active
        || !email
        || !passwordValid
        || acceptedStep === null
        || !decryptedSecret
      ) {
        await recordAuthFailure(buckets, now, tx);
        const audit = requestAuditContext(req);
        await recordAdminAudit({
          adminUserId: "super-admin",
          action: passwordValid && acceptedStep === null ? "admin_totp_failure" : "admin_login_failure",
          resourceType: "admin_access",
          resourceId: "super-admin",
          ...audit,
          outcome: "failure",
        }, tx);
        return { kind: "denied" as const };
      }

      const sessionId = randomUUID();
      const familyId = randomUUID();
      const refreshToken = createOpaqueToken();
      const refreshTokenHash = hashOpaqueToken(refreshToken);
      const absoluteExpiresAt = new Date(now.getTime() + ADMIN_SESSION_TTL_MS);
      const idleExpiresAt = new Date(Math.min(
        absoluteExpiresAt.getTime(),
        now.getTime() + 15 * 60 * 1000,
      ));
      const accessToken = createAdminAccessToken(
        sessionId,
        Math.floor(now.getTime() / 1000),
      );
      if (!accessToken) throw new Error("Administrator signing key unavailable");
      const audit = requestAuditContext(req);

      await tx.update(superAdminCredentialsTable)
        .set({ lastTotpStep: acceptedStep, updatedAt: now })
        .where(eq(superAdminCredentialsTable.id, credentials.id));
      await tx.insert(superAdminSessionsTable).values({
        id: sessionId,
        refreshTokenHash,
        refreshFamilyId: familyId,
        createdAt: now,
        lastActivityAt: now,
        idleExpiresAt,
        absoluteExpiresAt,
        ipHash: audit.ipHash,
        userAgentHash: audit.userAgentHash,
      });
      await tx.insert(superAdminRefreshTokensTable).values({
        tokenHash: refreshTokenHash,
        sessionId,
        familyId,
        createdAt: now,
      });
      await recordAdminAudit({
        adminUserId: "super-admin",
        action: "admin_sign_in",
        resourceType: "admin_access",
        resourceId: sessionId,
        sessionId,
        ...audit,
        outcome: "success",
      }, tx);
      await clearAuthFailures(buckets.slice(0, 1), tx);
      return {
        kind: "created" as const,
        accessToken,
        refreshToken,
        absoluteExpiresAt,
      };
    });

    if (result.kind === "limited") {
      res.status(429).json({
        error: "Trop de tentatives. Réessayez plus tard.",
        retryAfterSeconds: result.retry,
      });
      return;
    }
    if (result.kind !== "created") {
      genericLoginFailure(res);
      return;
    }
    setAdminSessionCookies(res, result.accessToken, result.refreshToken, result.absoluteExpiresAt);
    res.setHeader("X-Admin-Access-Expires-In", String(ADMIN_ACCESS_TTL_MS / 1000));
    res.status(200).json({ isAdmin: true, sessionAuthenticated: true, canMutate: true });
  } catch {
    req.log.error("Administrator sign-in failed");
    res.status(503).json({ error: "La connexion administrateur est indisponible." });
  }
});

router.post("/refresh", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine non autorisée." });
    return;
  }
  const refreshToken = readAdminRefreshToken(req);
  if (!refreshToken) {
    clearAdminSessionCookies(res);
    res.status(401).json({ error: "Session administrateur expirée." });
    return;
  }
  const refreshTokenHash = hashOpaqueToken(refreshToken);
  const address = requesterAddress(req);
  let buckets: string[];
  try {
    buckets = [
      fingerprint(`admin-refresh-token:${refreshTokenHash}`),
      fingerprint(`admin-refresh-requester:${address}`),
    ];
  } catch {
    clearAdminSessionCookies(res);
    res.status(503).json({ error: "Le renouvellement de session est indisponible." });
    return;
  }

  try {
    const result = await withAuthAttemptLock(buckets, async (tx) => {
      const now = new Date();
      const retry = await getAuthRateLimit(buckets, now, tx);
      if (retry) return { kind: "limited" as const, retry };

      const [refreshRecord] = await tx.select()
        .from(superAdminRefreshTokensTable)
        .where(eq(superAdminRefreshTokensTable.tokenHash, refreshTokenHash))
        .for("update")
        .limit(1);
      if (!refreshRecord) {
        await recordAuthFailure(buckets, now, tx);
        return { kind: "invalid" as const };
      }
      if (refreshRecord.consumedAt || refreshRecord.revokedAt) {
        await tx.update(superAdminSessionsTable)
          .set({ revokedAt: now, revocationReason: "refresh_reuse" })
          .where(and(
            eq(superAdminSessionsTable.refreshFamilyId, refreshRecord.familyId),
            isNull(superAdminSessionsTable.revokedAt),
          ));
        await tx.update(superAdminRefreshTokensTable)
          .set({ revokedAt: now })
          .where(and(
            eq(superAdminRefreshTokensTable.familyId, refreshRecord.familyId),
            isNull(superAdminRefreshTokensTable.revokedAt),
          ));
        await recordAdminAudit({
          adminUserId: "super-admin",
          action: "admin_refresh_reuse",
          resourceType: "admin_access",
          resourceId: refreshRecord.sessionId,
          sessionId: refreshRecord.sessionId,
          ...requestAuditContext(req),
          outcome: "revoked",
        }, tx);
        return { kind: "reuse" as const };
      }

      const [session] = await tx.select()
        .from(superAdminSessionsTable)
        .where(and(
          eq(superAdminSessionsTable.id, refreshRecord.sessionId),
          eq(superAdminSessionsTable.refreshFamilyId, refreshRecord.familyId),
          eq(superAdminSessionsTable.refreshTokenHash, refreshTokenHash),
          isNull(superAdminSessionsTable.revokedAt),
          gt(superAdminSessionsTable.idleExpiresAt, now),
          gt(superAdminSessionsTable.absoluteExpiresAt, now),
        ))
        .for("update")
        .limit(1);
      if (!session) {
        await recordAuthFailure(buckets, now, tx);
        return { kind: "invalid" as const };
      }

      const nextRefreshToken = createOpaqueToken();
      const nextRefreshHash = hashOpaqueToken(nextRefreshToken);
      const accessToken = createAdminAccessToken(
        session.id,
        Math.floor(now.getTime() / 1000),
      );
      if (!accessToken) throw new Error("Administrator signing key unavailable");
      await tx.update(superAdminRefreshTokensTable)
        .set({ consumedAt: now, replacedByHash: nextRefreshHash })
        .where(eq(superAdminRefreshTokensTable.tokenHash, refreshTokenHash));
      await tx.update(superAdminSessionsTable)
        .set({ refreshTokenHash: nextRefreshHash })
        .where(eq(superAdminSessionsTable.id, session.id));
      await tx.insert(superAdminRefreshTokensTable).values({
        tokenHash: nextRefreshHash,
        sessionId: session.id,
        familyId: session.refreshFamilyId,
        createdAt: now,
      });
      await recordAdminAudit({
        adminUserId: "super-admin",
        action: "admin_refresh",
        resourceType: "admin_access",
        resourceId: session.id,
        sessionId: session.id,
        ...requestAuditContext(req),
        outcome: "success",
      }, tx);
      return {
        kind: "rotated" as const,
        accessToken,
        refreshToken: nextRefreshToken,
        absoluteExpiresAt: session.absoluteExpiresAt,
      };
    });

    if (result.kind === "limited") {
      clearAdminSessionCookies(res);
      res.status(429).json({
        error: "Trop de tentatives. Réessayez plus tard.",
        retryAfterSeconds: result.retry,
      });
      return;
    }
    if (result.kind !== "rotated") {
      clearAdminSessionCookies(res);
      res.status(401).json({ error: "Session administrateur expirée." });
      return;
    }
    setAdminSessionCookies(res, result.accessToken, result.refreshToken, result.absoluteExpiresAt);
    res.status(200).json({ isAdmin: true });
  } catch {
    req.log.error("Administrator session refresh failed");
    clearAdminSessionCookies(res);
    res.status(503).json({ error: "Le renouvellement de session est indisponible." });
  }
});

router.post("/step-up", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine non autorisée." });
    return;
  }
  const session = adminSessionContext(req);
  if (!session) {
    res.status(401).json({ error: "Connexion administrateur requise." });
    return;
  }
  const parsed = stepUpInput.safeParse(req.body);
  const action = parsed.success
    ? issueableAdminAction(parsed.data.action, parsed.data.query, parsed.data.payload)
    : null;
  if (!parsed.success || !action) {
    res.status(400).json({ error: "Action de sécurité invalide." });
    return;
  }
  const now = new Date();
  const buckets = [
    fingerprint(`admin-step-up-session:${session.sessionId}`),
    fingerprint(`admin-step-up-requester:${requesterAddress(req)}`),
  ];
  try {
    const result = await withAuthAttemptLock(buckets, async (tx) => {
      const retry = await getAuthRateLimit(buckets, now, tx);
      if (retry) return { kind: "limited" as const, retry };
      const [credentials] = await tx.select()
        .from(superAdminCredentialsTable)
        .where(and(
          eq(superAdminCredentialsTable.id, 1),
          eq(superAdminCredentialsTable.active, true),
        ))
        .for("update")
        .limit(1);
      const secret = credentials
        ? decryptTotpSecret({
          ciphertext: credentials.totpCiphertext,
          nonce: credentials.totpNonce,
          authTag: credentials.totpAuthTag,
        })
        : null;
      const acceptedStep = secret
        ? verifyTotpCode(secret, parsed.data.totpCode, now.getTime(), credentials?.lastTotpStep ?? null)
        : null;
      if (!credentials || acceptedStep === null) {
        await recordAuthFailure(buckets, now, tx);
        await recordAdminAudit({
          adminUserId: "super-admin",
          action: "admin_totp_failure",
          resourceType: "admin_access",
          resourceId: session.sessionId,
          sessionId: session.sessionId,
          ...requestAuditContext(req),
          outcome: "failure",
        }, tx);
        return { kind: "denied" as const };
      }

      const token = createOpaqueToken();
      await tx.update(superAdminCredentialsTable)
        .set({ lastTotpStep: acceptedStep, updatedAt: now })
        .where(eq(superAdminCredentialsTable.id, credentials.id));
      await tx.update(superAdminSessionsTable)
        .set({
          lastActivityAt: now,
          idleExpiresAt: new Date(Math.min(
            session.absoluteExpiresAt.getTime(),
            now.getTime() + 15 * 60 * 1000,
          )),
        })
        .where(and(
          eq(superAdminSessionsTable.id, session.sessionId),
          isNull(superAdminSessionsTable.revokedAt),
          gt(superAdminSessionsTable.idleExpiresAt, now),
          gt(superAdminSessionsTable.absoluteExpiresAt, now),
        ));
      await tx.insert(superAdminStepUpTokensTable).values({
        sessionId: session.sessionId,
        tokenHash: hashOpaqueToken(token),
        actionKey: action.actionKey,
        payloadHash: action.payloadHash,
        createdAt: now,
        expiresAt: new Date(now.getTime() + ADMIN_STEP_UP_TTL_MS),
      });
      await recordAdminAudit({
        adminUserId: "super-admin",
        action: "admin_step_up",
        resourceType: "admin_access",
        resourceId: session.sessionId,
        reason: action.actionKey,
        sessionId: session.sessionId,
        ...requestAuditContext(req),
        outcome: "success",
      }, tx);
      await clearAuthFailures(buckets.slice(0, 1), tx);
      return { kind: "created" as const, token };
    });

    if (result.kind === "limited") {
      res.status(429).json({
        error: "Trop de tentatives. Réessayez plus tard.",
        retryAfterSeconds: result.retry,
      });
      return;
    }
    if (result.kind !== "created") {
      genericLoginFailure(res);
      return;
    }
    res.setHeader("Cache-Control", "no-store, private");
    res.json({ stepUpToken: result.token, expiresInSeconds: ADMIN_STEP_UP_TTL_MS / 1000 });
  } catch {
    req.log.error("Administrator step-up verification failed");
    res.status(503).json({ error: "La confirmation de sécurité est indisponible." });
  }
});

router.post("/sign-out", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine non autorisée." });
    return;
  }
  const session = adminSessionContext(req);
  const refreshToken = readAdminRefreshToken(req);
  const now = new Date();
  try {
    await db.transaction(async (tx) => {
      let target = session?.sessionId ?? null;
      if (!target && refreshToken) {
        const [refreshRecord] = await tx.select({
          sessionId: superAdminRefreshTokensTable.sessionId,
        }).from(superAdminRefreshTokensTable)
          .where(eq(superAdminRefreshTokensTable.tokenHash, hashOpaqueToken(refreshToken)))
          .limit(1);
        target = refreshRecord?.sessionId ?? null;
      }
      if (!target) return;
      const [revoked] = await tx.update(superAdminSessionsTable)
        .set({ revokedAt: now, revocationReason: "sign_out" })
        .where(and(
          eq(superAdminSessionsTable.id, target),
          isNull(superAdminSessionsTable.revokedAt),
        ))
        .returning({ id: superAdminSessionsTable.id, refreshFamilyId: superAdminSessionsTable.refreshFamilyId });
      if (!revoked) return;
      await tx.update(superAdminRefreshTokensTable)
        .set({ revokedAt: now })
        .where(and(
          eq(superAdminRefreshTokensTable.familyId, revoked.refreshFamilyId),
          isNull(superAdminRefreshTokensTable.revokedAt),
        ));
      await recordAdminAudit({
        adminUserId: "super-admin",
        action: "admin_sign_out",
        resourceType: "admin_access",
        resourceId: revoked.id,
        sessionId: revoked.id,
        ...requestAuditContext(req),
        outcome: "revoked",
      }, tx);
    });
    clearAdminSessionCookies(res);
    res.status(204).end();
  } catch {
    req.log.error("Administrator sign-out failed");
    clearAdminSessionCookies(res);
    res.status(503).json({ error: "La déconnexion administrateur est indisponible." });
  }
});

export default router;
