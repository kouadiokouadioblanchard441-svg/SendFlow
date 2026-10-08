import { getAuth } from "@clerk/express";
import { Router, type IRouter } from "express";
import {
  GetAdminAccessStatusResponse,
  UnlockAdminPinBody,
  UnlockAdminPinResponse,
} from "@workspace/api-zod";
import {
  clearAuthFailures,
  getAuthRateLimit,
  recordAuthFailure,
  withPinAttemptLock,
} from "../lib/customer-auth-rate-limit";
import {
  getAdminPinAttemptBucket,
  hasAdminPinSession,
  isAdminPinConfigured,
  setAdminPinSessionCookie,
  verifyAdminPin,
} from "../lib/admin-pin-session";
import { getAdminUserId, respondAdminIdentityError } from "./admin";

const router: IRouter = Router();

router.get("/access", (req, res): void => {
  const auth = getAdminUserId(req);
  const { sessionId } = getAuth(req);
  const isAdmin = auth.userId !== null;
  const response = GetAdminAccessStatusResponse.parse({
    isAdmin,
    pinUnlocked:
      isAdmin &&
      Boolean(sessionId) &&
      hasAdminPinSession(req, auth.userId!, sessionId),
  });
  res.json(response);
});

router.post("/pin/unlock", async (req, res): Promise<void> => {
  const adminUserId = respondAdminIdentityError(req, res);
  if (!adminUserId) return;

  const { sessionId } = getAuth(req);
  if (!sessionId) {
    res.status(401).json({ error: "Session administrateur invalide." });
    return;
  }

  const parsed = UnlockAdminPinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Le PIN doit contenir exactement 8 chiffres." });
    return;
  }

  if (!isAdminPinConfigured()) {
    req.log.error("Administrator PIN access is not configured");
    res.status(503).json({ error: "L’accès PIN administrateur n’est pas configuré." });
    return;
  }

  const buckets = [getAdminPinAttemptBucket(adminUserId)];
  let result: { kind: "unlocked" } | { kind: "invalid" } | { kind: "blocked"; retryAfter: number };
  try {
    result = await withPinAttemptLock(buckets, async (database) => {
      const now = new Date();
      const retryAfter = await getAuthRateLimit(buckets, now, database);
      if (retryAfter !== null) return { kind: "blocked", retryAfter } as const;

      if (!verifyAdminPin(parsed.data.pin)) {
        await recordAuthFailure(buckets, now, database);
        return { kind: "invalid" } as const;
      }

      await clearAuthFailures(buckets, database);
      return { kind: "unlocked" } as const;
    });
  } catch (error) {
    req.log.error({ err: error }, "Administrator PIN rate-limit storage failed");
    res.status(503).json({ error: "La vérification du PIN est temporairement indisponible." });
    return;
  }

  if (result.kind === "blocked") {
    res.setHeader("Retry-After", String(result.retryAfter));
    res.status(429).json({
      error: "Trop de tentatives. Réessayez après le délai indiqué.",
      retryAfterSeconds: result.retryAfter,
    });
    return;
  }

  if (result.kind === "invalid") {
    res.status(403).json({ error: "PIN administrateur incorrect." });
    return;
  }

  const expiresAt = setAdminPinSessionCookie(res, adminUserId, sessionId);
  if (!expiresAt) {
    req.log.error("Administrator PIN session signing is not configured");
    res.status(503).json({ error: "La session PIN administrateur n’est pas configurée." });
    return;
  }

  res.json(UnlockAdminPinResponse.parse({ pinUnlocked: true, expiresAt }));
});

export default router;
