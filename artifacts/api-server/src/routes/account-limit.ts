import { Router, type IRouter } from "express";
import { db, eq, usersTable } from "@workspace/db";
import { GetCurrentAccountLimitResponse } from "@workspace/api-zod";
import { getAccountLimitSnapshot } from "../lib/account-limit";
import { requireCustomerSession } from "../lib/customer-session";
import { isTrustedOrigin } from "../lib/request-security";

const router: IRouter = Router();

function inactiveAccountMessage(status: "active" | "suspended" | "deleted" | undefined) {
  if (status === "suspended") return "Account suspended";
  if (status === "deleted") return "Account deleted";
  return null;
}

router.get("/me/account-limit", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;
  const { userId } = session;
  res.setHeader("Cache-Control", "no-store, private");

  try {
    const [user] = await db
      .select({ status: usersTable.status })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    const inactiveAccount = inactiveAccountMessage(user?.status);
    if (inactiveAccount) {
      res.status(403).json({ error: inactiveAccount });
      return;
    }

    res.json(GetCurrentAccountLimitResponse.parse(await getAccountLimitSnapshot(userId)));
  } catch (error) {
    req.log.error({ err: error, userId }, "Account limit lookup failed");
    res.status(503).json({ error: "Account limit data unavailable" });
  }
});

export default router;
