import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { adminGrantsTable, adminSessionsTable, and, db, eq, gt, isNull, usersTable } from "@workspace/db";
import { isCustomerSessionToken } from "./customer-auth-crypto";
import { isSharedNeonPreview } from "./shared-neon-preview-guard";

export const ADMIN_SESSION_COOKIE = "__Host-sendflow_admin";
export const ADMIN_SESSION_TTL_MS = 60 * 60 * 1000;
export const ADMIN_PIN_TTL_MS = 15 * 60 * 1000;
export type AdminSession = {
  sessionId: string;
  userId: string;
  canMutate: boolean;
  pinHash: string;
  expiresAt: Date;
  pinVerifiedUntil: Date | null;
};
const contexts = new WeakMap<Request, AdminSession>();

// Separate hash namespace and table: a customer/viewer token can never be an administrator token.
export function hashAdminSessionToken(token: string) {
  return createHash("sha256").update(`sendflow-admin:v1:${token}`).digest("hex");
}
export function adminSessionContext(req: Request) {
  return contexts.get(req);
}
export function adminPinUnlocked(session: AdminSession, now = new Date()) {
  return session.pinVerifiedUntil !== null && session.pinVerifiedUntil > now && session.expiresAt > now;
}
export function setAdminSessionCookie(res: Response, token: string) {
  res.cookie(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: ADMIN_SESSION_TTL_MS,
  });
}
export function clearAdminSessionCookie(res: Response) {
  res.clearCookie(ADMIN_SESSION_COOKIE, { httpOnly: true, secure: true, sameSite: "strict", path: "/" });
}
export async function loadAdminSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.setHeader("Cache-Control", "no-store, private");
  if (isSharedNeonPreview()) {
    res.status(503).json({ error: "L’administration est désactivée dans cet environnement." });
    return;
  }
  const cookie = req.headers.cookie?.split(";")
    .map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  const token = cookie?.slice(ADMIN_SESSION_COOKIE.length + 1);
  if (!token || !isCustomerSessionToken(token)) { next(); return; }
  try {
    const [session] = await db.select({
      sessionId: adminSessionsTable.id, userId: adminGrantsTable.userId,
      canMutate: adminGrantsTable.canMutate, pinHash: adminGrantsTable.pinHash,
      expiresAt: adminSessionsTable.expiresAt, pinVerifiedUntil: adminSessionsTable.pinVerifiedUntil,
    }).from(adminSessionsTable)
      .innerJoin(adminGrantsTable, and(
        eq(adminGrantsTable.userId, adminSessionsTable.userId),
        eq(adminGrantsTable.authorizationVersion, adminSessionsTable.authorizationVersion),
      ))
      .innerJoin(usersTable, eq(usersTable.id, adminGrantsTable.userId))
      .where(and(
        eq(adminSessionsTable.tokenHash, hashAdminSessionToken(token)),
        isNull(adminSessionsTable.revokedAt), isNull(adminGrantsTable.revokedAt),
        gt(adminSessionsTable.expiresAt, new Date()), eq(usersTable.status, "active"),
      )).limit(1);
    if (session) contexts.set(req, session);
    next();
  } catch {
    req.log.error("Administrator session storage unavailable");
    res.status(503).json({ error: "La vérification administrateur est indisponible." });
  }
}
