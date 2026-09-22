import { getAuth } from "@clerk/express";
import { Router, type IRouter } from "express";
import { GetCurrentAccountResponse } from "@workspace/api-zod";
import { db, eq, usersTable, walletsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/me", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const account = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(usersTable)
        .values({ id: userId })
        .onConflictDoUpdate({
          target: usersTable.id,
          set: { lastSeenAt: new Date() },
        })
        .returning();

      let [wallet] = await tx
        .insert(walletsTable)
        .values({ userId })
        .onConflictDoNothing()
        .returning();

      if (!wallet) {
        [wallet] = await tx
          .select()
          .from(walletsTable)
            .where(eq(walletsTable.userId, userId));
      }

      if (!user || !wallet) {
        throw new Error("Account could not be initialized");
      }

      return {
        userId: user.id,
        phone: user.phone,
        displayName: user.displayName,
        countryCode: user.countryCode,
        wallet: {
          id: wallet.id,
          currency: wallet.currency,
          balanceMinor: wallet.balanceMinor,
          status: wallet.status,
        },
      };
    });

    res.json(GetCurrentAccountResponse.parse(account));
  } catch (error) {
    req.log.error({ err: error, userId }, "Account initialization failed");
    res.status(503).json({ error: "Account storage unavailable" });
  }
});

export default router;