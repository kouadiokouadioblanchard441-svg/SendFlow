import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  and,
  db,
  desc,
  eq,
  gt,
  isNull,
  superAdminRefreshTokensTable,
  superAdminSessionsTable,
} from "@workspace/db";
import { adminSessionContext, clearAdminSessionCookies } from "../lib/admin-session";
import { recordAdminAudit } from "../lib/admin-audit";

const router: IRouter = Router();

router.get("/sessions", async (req, res): Promise<void> => {
  const current = adminSessionContext(req);
  if (!current) {
    res.status(401).json({ error: "Connexion administrateur requise." });
    return;
  }
  try {
    const now = new Date();
    const sessions = await db.select({
      id: superAdminSessionsTable.id,
      createdAt: superAdminSessionsTable.createdAt,
      lastActivityAt: superAdminSessionsTable.lastActivityAt,
      idleExpiresAt: superAdminSessionsTable.idleExpiresAt,
      absoluteExpiresAt: superAdminSessionsTable.absoluteExpiresAt,
      revokedAt: superAdminSessionsTable.revokedAt,
    }).from(superAdminSessionsTable)
      .where(and(
        isNull(superAdminSessionsTable.revokedAt),
        gt(superAdminSessionsTable.idleExpiresAt, now),
        gt(superAdminSessionsTable.absoluteExpiresAt, now),
      ))
      .orderBy(desc(superAdminSessionsTable.lastActivityAt))
      .limit(50);
    res.setHeader("Cache-Control", "no-store, private");
    res.json(sessions.map((session) => ({
      ...session,
      isCurrent: session.id === current.sessionId,
    })));
  } catch {
    req.log.error("Administrator session list unavailable");
    res.status(503).json({ error: "La liste des sessions est indisponible." });
  }
});

router.post("/sessions/:sessionId/revoke", async (req, res): Promise<void> => {
  const current = adminSessionContext(req);
  const parsedId = z.string().uuid().safeParse(req.params.sessionId);
  if (!current) {
    res.status(401).json({ error: "Connexion administrateur requise." });
    return;
  }
  if (!parsedId.success) {
    res.status(400).json({ error: "Identifiant de session invalide." });
    return;
  }
  const now = new Date();
  try {
    const revoked = await db.transaction(async (tx) => {
      const [session] = await tx.update(superAdminSessionsTable)
        .set({ revokedAt: now, revocationReason: "manual_revoke" })
        .where(and(
          eq(superAdminSessionsTable.id, parsedId.data),
          isNull(superAdminSessionsTable.revokedAt),
        ))
        .returning({
          id: superAdminSessionsTable.id,
          refreshFamilyId: superAdminSessionsTable.refreshFamilyId,
        });
      if (!session) return null;
      await tx.update(superAdminRefreshTokensTable)
        .set({ revokedAt: now })
        .where(and(
          eq(superAdminRefreshTokensTable.familyId, session.refreshFamilyId),
          isNull(superAdminRefreshTokensTable.revokedAt),
        ));
      await recordAdminAudit({
        adminUserId: "super-admin",
        action: "admin_session_revoked",
        resourceType: "admin_access",
        resourceId: session.id,
        sessionId: current.sessionId,
        outcome: "revoked",
      }, tx);
      return session.id;
    });
    if (!revoked) {
      res.status(404).json({ error: "Session active introuvable." });
      return;
    }
    if (revoked === current.sessionId) clearAdminSessionCookies(res);
    res.status(204).end();
  } catch {
    req.log.error("Administrator session revocation failed");
    res.status(503).json({ error: "La révocation de session est indisponible." });
  }
});

router.post("/sessions/revoke-all", async (req, res): Promise<void> => {
  const current = adminSessionContext(req);
  if (!current) {
    res.status(401).json({ error: "Connexion administrateur requise." });
    return;
  }
  const now = new Date();
  try {
    await db.transaction(async (tx) => {
      await tx.update(superAdminSessionsTable)
        .set({ revokedAt: now, revocationReason: "revoke_all" })
        .where(isNull(superAdminSessionsTable.revokedAt));
      await tx.update(superAdminRefreshTokensTable)
        .set({ revokedAt: now })
        .where(isNull(superAdminRefreshTokensTable.revokedAt));
      await recordAdminAudit({
        adminUserId: "super-admin",
        action: "admin_session_revoked",
        resourceType: "admin_access",
        resourceId: "all",
        sessionId: current.sessionId,
        outcome: "revoked",
      }, tx);
    });
    clearAdminSessionCookies(res);
    res.status(204).end();
  } catch {
    req.log.error("Administrator global session revocation failed");
    res.status(503).json({ error: "La révocation des sessions est indisponible." });
  }
});

export default router;
