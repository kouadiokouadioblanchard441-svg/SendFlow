import { createHash } from "node:crypto";
import type { Request, RequestHandler } from "express";
import {
  and,
  db,
  eq,
  gt,
  isNull,
  superAdminStepUpTokensTable,
} from "@workspace/db";
import { adminSessionContext } from "./admin-session";
import { recordAdminAudit } from "./admin-audit";
import { fingerprint, requesterAddress } from "./request-security";
import { adminActionKey, hashAdminActionPayload } from "./admin-step-up-policy";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const STEP_UP_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

async function recordDeniedStepUp(
  sessionId: string,
  actionKey: string,
  req: Request,
) {
  try {
    await recordAdminAudit({
      adminUserId: "super-admin",
      action: "admin_step_up",
      resourceType: "admin_access",
      resourceId: sessionId,
      reason: actionKey.slice(0, 500),
      sessionId,
      ipHash: fingerprint(`admin-ip:${requesterAddress(req)}`),
      userAgentHash: fingerprint(`admin-ua:${(req.get("user-agent") ?? "").slice(0, 512)}`),
      outcome: "denied",
    });
  } catch {
    req.log.error("Administrator step-up denial audit unavailable");
  }
}

export const requireAdminStepUp: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const session = adminSessionContext(req);
  if (!session) {
    res.status(401).json({ error: "Connexion administrateur requise." });
    return;
  }
  const actionKey = adminActionKey(req.method, req.path);
  const rawToken = req.get("x-admin-step-up");
  if (!actionKey || !rawToken || !STEP_UP_TOKEN_PATTERN.test(rawToken)) {
    void recordDeniedStepUp(session.sessionId, actionKey ?? "invalid-action", req);
    res.status(403).json({
      error: "Confirmez cette action avec un nouveau code d’authentification.",
      code: "admin_step_up_required",
    });
    return;
  }

  let payloadHash: string;
  try {
    payloadHash = hashAdminActionPayload(req.query, req.body);
  } catch {
    res.status(400).json({ error: "Paramètres d’action invalides." });
    return;
  }
  const now = new Date();
  void db.update(superAdminStepUpTokensTable)
    .set({ consumedAt: now })
    .where(and(
      eq(superAdminStepUpTokensTable.sessionId, session.sessionId),
      eq(superAdminStepUpTokensTable.tokenHash, createHash("sha256").update(rawToken).digest("hex")),
      eq(superAdminStepUpTokensTable.actionKey, actionKey),
      eq(superAdminStepUpTokensTable.payloadHash, payloadHash),
      isNull(superAdminStepUpTokensTable.consumedAt),
      gt(superAdminStepUpTokensTable.expiresAt, now),
    ))
    .returning({ id: superAdminStepUpTokensTable.id })
    .then(async ([consumed]) => {
      if (!consumed) {
        await recordDeniedStepUp(session.sessionId, actionKey, req);
        res.status(403).json({
          error: "Confirmez cette action avec un nouveau code d’authentification.",
          code: "admin_step_up_required",
        });
        return;
      }
      next();
    })
    .catch((error: unknown) => {
      req.log.error({ err: error }, "Administrator step-up token storage unavailable");
      if (!res.headersSent) res.status(503).json({ error: "La confirmation de sécurité est indisponible." });
    });
};
