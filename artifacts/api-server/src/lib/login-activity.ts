import type { Request } from "express";
import { db, loginEventsTable, type AdminAuditAction } from "@workspace/db";

type LoginActivityDatabase = Pick<typeof db, "insert">;

function firstHeader(req: Request, names: string[]) {
  for (const name of names) {
    const value = req.get(name)?.trim();
    if (value) return value.slice(0, 500);
  }
  return undefined;
}

function classifyDevice(userAgent: string) {
  if (/ipad|tablet|kindle|silk/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

function classifyBrowser(userAgent: string) {
  if (/edg\//i.test(userAgent)) return "Edge";
  if (/opr\//i.test(userAgent)) return "Opera";
  if (/chrome\//i.test(userAgent) && !/edg\//i.test(userAgent)) return "Chrome";
  if (/firefox\//i.test(userAgent)) return "Firefox";
  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent) && !/android/i.test(userAgent)) return "Safari";
  if (/msie|trident\//i.test(userAgent)) return "Internet Explorer";
  return "Autre";
}

function classifyOperatingSystem(userAgent: string) {
  if (/windows nt/i.test(userAgent)) return "Windows";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "iOS";
  if (/android/i.test(userAgent)) return "Android";
  if (/mac os x|macintosh/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";
  return "Autre";
}

function normalizeIpAddress(req: Request) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return ip.replace(/^::ffff:/, "").slice(0, 45);
}

function locationFromRequest() {
  // Do not persist client-supplied geolocation headers until a trusted proxy contract is configured.
  return {
    city: undefined,
    region: undefined,
    countryCode: undefined,
    countryName: undefined,
    locationSource: undefined,
  };
}

export function getLoginActivitySnapshot(req: Request) {
  const userAgent = firstHeader(req, ["user-agent"]) ?? "";
  return {
    ipAddress: normalizeIpAddress(req),
    ...locationFromRequest(),
    deviceType: classifyDevice(userAgent),
    browser: classifyBrowser(userAgent),
    operatingSystem: classifyOperatingSystem(userAgent),
    userAgent: userAgent || undefined,
  };
}

export async function recordLoginActivity(
  req: Request,
  userId: string,
  sessionId: string,
  database: LoginActivityDatabase = db,
) {
  const snapshot = getLoginActivitySnapshot(req);
  await database
    .insert(loginEventsTable)
    .values({
      userId,
      sessionId,
      ...snapshot,
    })
    .onConflictDoNothing();
}

export const loginActivityAuditAction: AdminAuditAction = "view_login_activity";