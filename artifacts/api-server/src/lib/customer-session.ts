import type { Request, Response } from "express";
import { and, db, eq, gte, isNull, customerCredentialsTable, customerSessionsTable, usersTable } from "@workspace/db";
import { createCustomerSessionToken, hashCustomerSessionToken, isCustomerSessionToken } from "./customer-auth-crypto";

export const CUSTOMER_SESSION_COOKIE = "__Host-sendflow_session";
export const CUSTOMER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CUSTOMER_PIN_UNLOCK_TTL_MS = 15 * 60 * 1000;

type InsertDatabase = Pick<typeof db, "insert">;

export type CustomerSessionContext = {
  sessionId: string;
  userId: string;
  phone: string;
  displayName: string | null;
  countryCode: string | null;
  pinConfigured: boolean;
  pinUnlocked: boolean;
};

function readSessionCookie(req: Request) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    if (segment.slice(0, separator).trim() !== CUSTOMER_SESSION_COOKIE) continue;
    const value = segment.slice(separator + 1).trim();
    return isCustomerSessionToken(value) ? value : null;
  }
  return null;
}

export async function insertCustomerSession(database: InsertDatabase, userId: string, now = new Date()) {
  const token = createCustomerSessionToken();
  const expiresAt = new Date(now.getTime() + CUSTOMER_SESSION_TTL_MS);
  const [session] = await database
    .insert(customerSessionsTable)
    .values({
      userId,
      tokenHash: hashCustomerSessionToken(token),
      expiresAt,
    })
    .returning({ id: customerSessionsTable.id });

  if (!session) throw new Error("Customer session could not be created");
  return { sessionId: session.id, token, expiresAt };
}

export function setCustomerSessionCookie(res: Response, token: string) {
  res.cookie(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_SESSION_TTL_MS,
  });
}

export function clearCustomerSessionCookie(res: Response) {
  res.clearCookie(CUSTOMER_SESSION_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getCustomerSession(
  req: Request,
  { touchLastSeen = true }: { touchLastSeen?: boolean } = {},
): Promise<CustomerSessionContext | null> {
  const token = readSessionCookie(req);
  if (!token) return null;

  const now = new Date();
  const tokenHash = hashCustomerSessionToken(token);
  const [row] = await db
    .select({
      sessionId: customerSessionsTable.id,
      userId: usersTable.id,
      phone: usersTable.phone,
      displayName: usersTable.displayName,
      countryCode: usersTable.countryCode,
      accountStatus: usersTable.status,
      pinVerifiedUntil: customerSessionsTable.pinVerifiedUntil,
      credentialPinHash: customerCredentialsTable.pinHash,
    })
    .from(customerSessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, customerSessionsTable.userId))
    .leftJoin(customerCredentialsTable, eq(customerCredentialsTable.userId, usersTable.id))
    .where(
      and(
        eq(customerSessionsTable.tokenHash, tokenHash),
        isNull(customerSessionsTable.revokedAt),
        gte(customerSessionsTable.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) return null;
  if (row.accountStatus !== "active") {
    await db
      .update(customerSessionsTable)
      .set({ revokedAt: now, pinVerifiedUntil: null })
      .where(eq(customerSessionsTable.id, row.sessionId));
    return null;
  }

  if (touchLastSeen) {
    await db
      .update(customerSessionsTable)
      .set({ lastSeenAt: now })
      .where(eq(customerSessionsTable.id, row.sessionId));
  }

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    phone: row.phone ?? "",
    displayName: row.displayName,
    countryCode: row.countryCode,
    pinConfigured: row.credentialPinHash !== null,
    pinUnlocked: row.credentialPinHash !== null
      && row.pinVerifiedUntil !== null
      && row.pinVerifiedUntil !== undefined
      && row.pinVerifiedUntil >= now,
  };
}

export async function requireCustomerSession(
  req: Request,
  res: Response,
  requirePinUnlock = false,
): Promise<CustomerSessionContext | null> {
  let session: CustomerSessionContext | null;
  try {
    session = await getCustomerSession(req);
  } catch (error) {
    req.log.error({ err: error }, "Customer session validation failed");
    res.status(503).json({ error: "Session storage unavailable" });
    return null;
  }

  if (!session) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  if (requirePinUnlock && (!session.pinConfigured || !session.pinUnlocked)) {
    res.status(403).json({ error: "PIN verification required" });
    return null;
  }
  return session;
}

export function getCustomerSessionTokenFromRequest(req: Request) {
  return readSessionCookie(req);
}