import type { NextFunction, Request, Response } from "express";
import {
  and,
  db,
  eq,
  gt,
  isNull,
  superAdminCredentialsTable,
  superAdminRefreshTokensTable,
  superAdminSessionsTable,
} from "@workspace/db";
import { isSharedDatabasePreview } from "./shared-database-preview-guard";
import { hashOpaqueToken, verifyAdminAccessToken } from "./admin-auth-crypto";

export const ADMIN_ACCESS_COOKIE = "__Host-sendflow_admin_access";
export const ADMIN_REFRESH_COOKIE = "__Host-sendflow_admin_refresh";
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const ADMIN_IDLE_TTL_MS = 15 * 60 * 1000;
export const ADMIN_ACCESS_TTL_MS = 5 * 60 * 1000;
export const ADMIN_STEP_UP_TTL_MS = 60 * 1000;

export type AdminSession = {
  sessionId: string;
  userId: string;
  canMutate: boolean;
  expiresAt: Date;
  mfaAuthenticatedUntil: Date | null;
  lastActivityAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  refreshFamilyId: string;
};

const contexts = new WeakMap<Request, AdminSession>();
const accessTokenPattern = /^[A-Za-z0-9_.-]{80,4096}$/u;
const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/u;

function readCookie(req: Request, name: string) {
  const values = req.headers.cookie?.split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`)) ?? [];
  if (values.length !== 1) return null;
  const raw = values[0]!.slice(name.length + 1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export function readAdminAccessToken(req: Request) {
  const value = readCookie(req, ADMIN_ACCESS_COOKIE);
  return value && accessTokenPattern.test(value) ? value : null;
}

export function readAdminRefreshToken(req: Request) {
  const value = readCookie(req, ADMIN_REFRESH_COOKIE);
  return value && opaqueTokenPattern.test(value) ? value : null;
}

export function adminSessionContext(req: Request) {
  return contexts.get(req);
}

// The access JWT is valid for at most five minutes. Sensitive writes are
// additionally protected by the one-use action-bound TOTP step-up middleware.
export function adminSessionAuthenticated(session: AdminSession, now = new Date()) {
  return session.mfaAuthenticatedUntil !== null
    && session.mfaAuthenticatedUntil > now
    && session.expiresAt > now;
}

export function setAdminSessionCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  absoluteExpiresAt: Date,
) {
  const now = Date.now();
  const maxAge = Math.max(0, absoluteExpiresAt.getTime() - now);
  res.cookie(ADMIN_ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: Math.min(ADMIN_ACCESS_TTL_MS, maxAge),
  });
  res.cookie(ADMIN_REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}

export function clearAdminSessionCookies(res: Response) {
  const options = { httpOnly: true, secure: true, sameSite: "strict" as const, path: "/" };
  res.clearCookie(ADMIN_ACCESS_COOKIE, options);
  res.clearCookie(ADMIN_REFRESH_COOKIE, options);
  // Expire the previous access artifacts without accepting them.
  res.clearCookie("__Host-sendflow_admin", options);
  res.clearCookie("__Host-sendflow-admin-pin", options);
}

export async function loadAdminSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.setHeader("Cache-Control", "no-store, private");
  if (isSharedDatabasePreview()) {
    res.status(503).json({ error: "L’administration est désactivée dans cet environnement." });
    return;
  }
  const isRefreshRequest = req.method === "POST" && req.path === "/refresh";
  if (isRefreshRequest) {
    const refreshToken = readAdminRefreshToken(req);
    if (!refreshToken) {
      next();
      return;
    }
    const now = new Date();
    try {
      const [session] = await db.select({
        sessionId: superAdminSessionsTable.id,
        refreshFamilyId: superAdminSessionsTable.refreshFamilyId,
        lastActivityAt: superAdminSessionsTable.lastActivityAt,
        idleExpiresAt: superAdminSessionsTable.idleExpiresAt,
        absoluteExpiresAt: superAdminSessionsTable.absoluteExpiresAt,
      })
        .from(superAdminRefreshTokensTable)
        .innerJoin(
          superAdminSessionsTable,
          eq(superAdminSessionsTable.id, superAdminRefreshTokensTable.sessionId),
        )
        .innerJoin(superAdminCredentialsTable, and(
          eq(superAdminCredentialsTable.id, 1),
          eq(superAdminCredentialsTable.active, true),
        ))
        .where(and(
          eq(superAdminRefreshTokensTable.tokenHash, hashOpaqueToken(refreshToken)),
          isNull(superAdminRefreshTokensTable.revokedAt),
          isNull(superAdminSessionsTable.revokedAt),
          gt(superAdminSessionsTable.idleExpiresAt, now),
          gt(superAdminSessionsTable.absoluteExpiresAt, now),
        ))
        .limit(1);
      if (session) {
        const shortExpiry = new Date(Math.min(
          session.absoluteExpiresAt.getTime(),
          now.getTime() + ADMIN_ACCESS_TTL_MS,
        ));
        contexts.set(req, {
          sessionId: session.sessionId,
          userId: "super-admin",
          canMutate: true,
          expiresAt: shortExpiry,
          mfaAuthenticatedUntil: shortExpiry,
          lastActivityAt: session.lastActivityAt,
          idleExpiresAt: session.idleExpiresAt,
          absoluteExpiresAt: session.absoluteExpiresAt,
          refreshFamilyId: session.refreshFamilyId,
        });
      }
      next();
    } catch {
      req.log.error("Administrator refresh session storage unavailable");
      res.status(503).json({ error: "Le renouvellement administrateur est indisponible." });
    }
    return;
  }

  const token = readAdminAccessToken(req);
  const claims = token ? verifyAdminAccessToken(token) : null;
  if (!claims) {
    next();
    return;
  }
  const now = new Date();
  try {
    const [session] = await db.select({
      sessionId: superAdminSessionsTable.id,
      refreshFamilyId: superAdminSessionsTable.refreshFamilyId,
      lastActivityAt: superAdminSessionsTable.lastActivityAt,
      idleExpiresAt: superAdminSessionsTable.idleExpiresAt,
      absoluteExpiresAt: superAdminSessionsTable.absoluteExpiresAt,
    })
      .from(superAdminSessionsTable)
      .innerJoin(superAdminCredentialsTable, and(
        eq(superAdminCredentialsTable.id, 1),
        eq(superAdminCredentialsTable.active, true),
      ))
      .where(and(
        eq(superAdminSessionsTable.id, claims.sid),
        isNull(superAdminSessionsTable.revokedAt),
        gt(superAdminSessionsTable.idleExpiresAt, now),
        gt(superAdminSessionsTable.absoluteExpiresAt, now),
      ))
      .limit(1);
    if (session) {
      const jwtExpiry = new Date(claims.exp * 1000);
      contexts.set(req, {
        sessionId: session.sessionId,
        userId: "super-admin",
        canMutate: true,
        expiresAt: jwtExpiry,
        mfaAuthenticatedUntil: jwtExpiry,
        lastActivityAt: session.lastActivityAt,
        idleExpiresAt: session.idleExpiresAt,
        absoluteExpiresAt: session.absoluteExpiresAt,
        refreshFamilyId: session.refreshFamilyId,
      });
    }
    next();
  } catch {
    req.log.error("Administrator session storage unavailable");
    res.status(503).json({ error: "La vérification administrateur est indisponible." });
  }
}
