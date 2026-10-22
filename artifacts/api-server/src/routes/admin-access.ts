import { Router, type IRouter } from "express";
import {
  GetAdminAccessStatusResponse,
  SignInAdminBody,
  UnlockAdminPinBody,
} from "@workspace/api-zod";
import {
  adminGrantsTable, adminSessionsTable, and, db, eq, gt, isNull,
  or, phoneOtpChallengesTable, usersTable,
} from "@workspace/db";
import {
  ADMIN_PIN_TTL_MS, ADMIN_SESSION_TTL_MS, adminPinUnlocked, adminSessionContext,
  clearAdminSessionCookie, hashAdminSessionToken, setAdminSessionCookie,
} from "../lib/admin-session";
import { createCustomerSessionToken, verifyCustomerSecret } from "../lib/customer-auth-crypto";
import { createSensitiveDataLookupIndex } from "../lib/sensitive-data-crypto";
import { fingerprint, isTrustedOrigin, requesterAddress } from "../lib/request-security";
import {
  clearAuthFailures, getAuthRateLimit, recordAuthFailure, withAuthAttemptLock,
} from "../lib/customer-auth-rate-limit";
import { recordAdminAudit } from "../lib/admin-audit";

const router: IRouter = Router();

router.get("/access", (req, res): void => {
  const session = adminSessionContext(req);
  const response = GetAdminAccessStatusResponse.parse({
    isAdmin: !!session,
    pinUnlocked: session ? adminPinUnlocked(session) : false,
    canMutate: session?.canMutate ?? false,
  });
  res.json(response);
});

router.post("/sign-in", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) { res.status(403).json({ error: "Origine non autorisée." }); return; }
  const parsed = SignInAdminBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Données de connexion invalides." }); return; }
  const { phone, challengeId } = parsed.data;
  const now = new Date();
  const token = createCustomerSessionToken();
  try {
    const buckets = [
      fingerprint(`admin-login-phone:${phone}`),
      fingerprint(`admin-login-requester:${requesterAddress(req)}`),
    ];
    const result = await withAuthAttemptLock(buckets, async (tx) => {
      const retry = await getAuthRateLimit(buckets, now, tx);
      if (retry) return { status: 429, retry };
      const [grant] = await tx.select({
        userId: adminGrantsTable.userId, version: adminGrantsTable.authorizationVersion,
      }).from(adminGrantsTable)
        .innerJoin(usersTable, eq(usersTable.id, adminGrantsTable.userId))
        .where(and(
          isNull(adminGrantsTable.revokedAt), eq(usersTable.status, "active"),
          or(
            eq(usersTable.phoneLookupHash, createSensitiveDataLookupIndex(phone, "user-phone")),
            eq(usersTable.phone, phone),
          ),
        ));
      if (!grant) {
        await recordAuthFailure(buckets, now, tx);
        return { status: 403 };
      }
      // Consume only this purpose, phone and requester, once, in the session-creation transaction.
      const [challenge] = await tx.update(phoneOtpChallengesTable).set({ consumedAt: now })
        .where(and(
          eq(phoneOtpChallengesTable.id, challengeId),
          eq(phoneOtpChallengesTable.purpose, "admin_login"),
          eq(phoneOtpChallengesTable.phoneHash, fingerprint(`phone:${phone}`)),
          eq(phoneOtpChallengesTable.requesterHash, fingerprint(`requester:${requesterAddress(req)}`)),
          eq(phoneOtpChallengesTable.status, "verified"), eq(phoneOtpChallengesTable.phoneVerified, true),
          isNull(phoneOtpChallengesTable.consumedAt), gt(phoneOtpChallengesTable.expiresAt, now),
        )).returning({ id: phoneOtpChallengesTable.id });
      if (!challenge) {
        await recordAuthFailure(buckets, now, tx);
        return { status: 403 };
      }
      const previous = adminSessionContext(req);
      if (previous) await tx.update(adminSessionsTable).set({ revokedAt: now, pinVerifiedUntil: null })
        .where(eq(adminSessionsTable.id, previous.sessionId));
      const [session] = await tx.insert(adminSessionsTable).values({
        userId: grant.userId, authorizationVersion: grant.version,
        tokenHash: hashAdminSessionToken(token), expiresAt: new Date(now.getTime() + ADMIN_SESSION_TTL_MS),
      }).returning({ id: adminSessionsTable.id });
      if (!session) throw new Error("Administrator session creation failed");
      await recordAdminAudit({
        adminUserId: grant.userId, action: "admin_sign_in", resourceType: "admin_access", resourceId: session.id,
      }, tx);
      await clearAuthFailures(buckets.slice(0, 1), tx);
      return { status: 200 };
    });
    if (result.status !== 200) {
      res.status(result.status).json({
        error: result.status === 429 ? "Trop de tentatives. Réessayez plus tard." : "Connexion administrateur refusée.",
        ...(result.retry ? { retryAfterSeconds: result.retry } : {}),
      });
      return;
    }
    setAdminSessionCookie(res, token);
    res.json({ isAdmin: true, pinUnlocked: false });
  } catch {
    req.log.error("Administrator sign-in failed");
    res.status(503).json({ error: "La connexion administrateur est indisponible." });
  }
});

router.post("/pin/unlock", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) { res.status(403).json({ error: "Origine non autorisée." }); return; }
  const context = adminSessionContext(req);
  if (!context) { res.status(401).json({ error: "Connexion administrateur requise." }); return; }
  const parsed = UnlockAdminPinBody.safeParse(req.body);
  try {
    const buckets = [
      fingerprint(`admin-pin-user:${context.userId}`),
      fingerprint(`admin-pin-requester:${requesterAddress(req)}`),
    ];
    const result = await withAuthAttemptLock(buckets, async (tx) => {
      const now = new Date();
      const retry = await getAuthRateLimit(buckets, now, tx);
      if (retry) return { status: 429, retry };
      const [session] = await tx.select({
        pinHash: adminGrantsTable.pinHash, expiresAt: adminSessionsTable.expiresAt,
      }).from(adminSessionsTable).innerJoin(adminGrantsTable, and(
        eq(adminGrantsTable.userId, adminSessionsTable.userId),
        eq(adminGrantsTable.authorizationVersion, adminSessionsTable.authorizationVersion),
      )).innerJoin(usersTable, eq(usersTable.id, adminGrantsTable.userId)).where(and(
        eq(adminSessionsTable.id, context.sessionId), gt(adminSessionsTable.expiresAt, now),
        isNull(adminGrantsTable.revokedAt), isNull(adminSessionsTable.revokedAt),
        eq(usersTable.status, "active"),
      )).for("update", { of: adminSessionsTable });
      if (!session) return { status: 401 };
      if (!parsed.success || !await verifyCustomerSecret(parsed.data.pin, session.pinHash)) {
        await recordAuthFailure(buckets, now, tx);
        await recordAdminAudit({
          adminUserId: context.userId, action: "admin_pin_failure",
          resourceType: "admin_access", resourceId: context.sessionId,
        }, tx);
        return { status: 403 };
      }
      const expiresAt = new Date(Math.min(session.expiresAt.getTime(), Date.now() + ADMIN_PIN_TTL_MS));
      await tx.update(adminSessionsTable).set({ pinVerifiedUntil: expiresAt })
        .where(eq(adminSessionsTable.id, context.sessionId));
      await recordAdminAudit({
        adminUserId: context.userId, action: "admin_pin_unlock",
        resourceType: "admin_access", resourceId: context.sessionId,
      }, tx);
      await clearAuthFailures(buckets.slice(0, 1), tx);
      return { status: 200, expiresAt };
    });
    if (result.status !== 200 || !result.expiresAt) {
      res.status(result.status).json({
        error: result.status === 429 ? "Trop de tentatives. Réessayez plus tard." : "PIN incorrect ou accès révoqué.",
        ...(result.retry ? { retryAfterSeconds: result.retry } : {}),
      });
      return;
    }
    res.json({ pinUnlocked: true, expiresAt: result.expiresAt.toISOString() });
  } catch {
    req.log.error("Administrator PIN verification failed");
    res.status(503).json({ error: "La vérification du PIN est indisponible." });
  }
});

router.post("/sign-out", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) { res.status(403).json({ error: "Origine non autorisée." }); return; }
  const session = adminSessionContext(req);
  if (session) {
    await db.transaction(async (tx) => {
      await tx.update(adminSessionsTable).set({ revokedAt: new Date(), pinVerifiedUntil: null })
        .where(eq(adminSessionsTable.id, session.sessionId));
      await recordAdminAudit({
        adminUserId: session.userId, action: "admin_sign_out",
        resourceType: "admin_access", resourceId: session.sessionId,
      }, tx);
    });
  }
  clearAdminSessionCookie(res);
  res.status(204).end();
});

export default router;
