import { Router, type IRouter } from "express";
import { GetCurrentAccountResponse } from "@workspace/api-zod";
import {
  and,
  db,
  desc,
  eq,
  isNull,
  transactionsTable,
  walletsTable,
} from "@workspace/db";
import { requireCustomerSession } from "../lib/customer-session";

const router: IRouter = Router();
const MAX_CUSTOMER_TRANSACTIONS = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const customerTransactionColumns = {
  id: transactionsTable.id,
  kind: transactionsTable.kind,
  status: transactionsTable.status,
  fromOperator: transactionsTable.fromOperator,
  toOperator: transactionsTable.toOperator,
  senderPhone: transactionsTable.senderPhone,
  recipientPhone: transactionsTable.recipientPhone,
  currency: transactionsTable.currency,
  amountMinor: transactionsTable.amountMinor,
  feeMinor: transactionsTable.feeMinor,
  reference: transactionsTable.reference,
  providerReference: transactionsTable.providerReference,
  createdAt: transactionsTable.createdAt,
};

function serializeCustomerTransaction(
  transaction: typeof transactionsTable.$inferSelect,
) {
  return {
    id: transaction.id,
    kind: transaction.kind,
    status: transaction.status,
    fromOperator: transaction.fromOperator,
    toOperator: transaction.toOperator,
    senderPhone: transaction.senderPhone,
    recipientPhone: transaction.recipientPhone,
    currency: transaction.currency,
    amountMinor: transaction.amountMinor,
    feeMinor: transaction.feeMinor,
    reference: transaction.reference,
    providerReference: transaction.providerReference,
    createdAt: transaction.createdAt.toISOString(),
  };
}

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

    res.setHeader("Cache-Control", "no-store, private");
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

router.get("/me/transactions", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;

  try {
    const transactions = await db
      .select(customerTransactionColumns)
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, session.userId),
          isNull(transactionsTable.deletedAt),
        ),
      )
      .orderBy(desc(transactionsTable.createdAt))
      .limit(MAX_CUSTOMER_TRANSACTIONS);

    res.setHeader("Cache-Control", "no-store, private");
    res.json({
      items: transactions.map((transaction) => ({
        ...transaction,
        createdAt: transaction.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    req.log.error({ err: error, userId: session.userId }, "Customer transaction list lookup failed");
    res.status(503).json({ error: "Transaction history unavailable" });
  }
});

router.get("/me/transactions/:transactionId", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;

  const transactionId =
    typeof req.params.transactionId === "string" ? req.params.transactionId : "";
  if (!UUID_PATTERN.test(transactionId)) {
    res.status(400).json({ error: "Invalid transaction reference" });
    return;
  }

  try {
    const [transaction] = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.id, transactionId),
          eq(transactionsTable.userId, session.userId),
          isNull(transactionsTable.deletedAt),
        ),
      )
      .limit(1);

    if (!transaction) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    res.setHeader("Cache-Control", "no-store, private");
    res.json(serializeCustomerTransaction(transaction));
  } catch (error) {
    req.log.error({ err: error, userId: session.userId }, "Customer transaction lookup failed");
    res.status(503).json({ error: "Transaction details unavailable" });
  }
});

export default router;