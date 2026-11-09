import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";
import { fingerprint, requesterAddress } from "./request-security";
import { adminSessionContext } from "./admin-session";

export type AdminAuditContext = {
  sessionId?: string;
  ipHash?: string;
  userAgentHash?: string;
};

const contextStorage = new AsyncLocalStorage<AdminAuditContext>();

export function currentAdminAuditContext() {
  return contextStorage.getStore();
}

export function adminAuditContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const session = adminSessionContext(req);
  const context: AdminAuditContext = {
    ...(session ? { sessionId: session.sessionId } : {}),
  };
  try {
    context.ipHash = fingerprint(`admin-ip:${requesterAddress(req)}`);
    context.userAgentHash = fingerprint(`admin-ua:${(req.get("user-agent") ?? "").slice(0, 512)}`);
  } catch {
    req.log.warn("Administrator audit request context is incomplete");
  }
  contextStorage.run(context, next);
}
