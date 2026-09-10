import type { NextFunction, Request, Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";

function configuredAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const configuredIds = new Set(
    (process.env.ADMIN_USER_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  if (configuredIds.has(userId)) {
    next();
    return;
  }

  const emails = configuredAdminEmails();
  if (emails.size === 0) {
    res.status(503).json({
      error: "Admin access is not configured",
      hint: "Set ADMIN_EMAILS or ADMIN_USER_IDS in the server environment.",
    });
    return;
  }

  const user = await clerkClient.users.getUser(userId);
  const isAdmin = user.emailAddresses.some((address) => emails.has(address.emailAddress.toLowerCase()));
  if (!isAdmin) {
    res.status(403).json({ error: "Admin access denied" });
    return;
  }

  next();
}