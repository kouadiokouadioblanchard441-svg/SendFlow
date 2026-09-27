import { Router, type IRouter } from "express";
import { GetCurrentAccountResponse } from "@workspace/api-zod";
import { db, eq, walletsTable } from "@workspace/db";
import { requireCustomerSession } from "../lib/customer-session";

const router: IRouter = Router();

router.get("/me", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;

  try {
    const [wallet] = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, session.userId))
      .limit(1);

    if (!wallet) {
      req.log.error({ userId: session.userId }, "Customer wallet is missing");
      res.status(503).json({ error: "Account storage unavailable" });
      return;
    }

    res.json(
      GetCurrentAccountResponse.parse({
        userId: session.userId,
        phone: session.phone,
        displayName: session.displayName,
        countryCode: session.countryCode,
        wallet: {
          id: wallet.id,
          currency: wallet.currency,
          balanceMinor: wallet.balanceMinor,
          status: wallet.status,
        },
      }),
    );
  } catch (error) {
    req.log.error({ err: error, userId: session.userId }, "Account lookup failed");
    res.status(503).json({ error: "Account storage unavailable" });
  }
});

export default router;