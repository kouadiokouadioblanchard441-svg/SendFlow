import { Router, type IRouter } from "express";
import {
  GetCustomerProfileResponse,
  GetCurrentAccountResponse,
  GetCustomerTransactionResponse,
  GetCustomerTransactionsResponse,
  UpdateCustomerProfileBody,
  UpdateCustomerProfileResponse,
} from "@workspace/api-zod";
import {
  and,
  db,
  desc,
  eq,
  ilike,
  isNull,
  lt,
  or,
  sql,
  transactionsTable,
  usersTable,
  walletsTable,
} from "@workspace/db";
import {
  encodeCustomerTransactionCursor,
  isValidCustomerTransactionId,
  parseCustomerTransactionCursor,
} from "../lib/customer-transaction-cursor";
import { requireCustomerSession } from "../lib/customer-session";
import {
  createSensitiveDataLookupIndex,
  decryptSensitiveDataIfEncrypted,
  encryptSensitiveData,
  normalizeSensitiveNameForLookup,
} from "../lib/sensitive-data-crypto";
import {
  normalizeCustomerProfile,
  serializeCustomerProfileName,
  splitCustomerDisplayName,
} from "../lib/customer-profile-policy";

const router: IRouter = Router();
const DEFAULT_CUSTOMER_TRANSACTION_PAGE_SIZE = 50;
const MAX_CUSTOMER_TRANSACTION_PAGE_SIZE = 50;

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
    senderPhone: decryptSensitiveDataIfEncrypted(transaction.senderPhone, "transaction-sender-phone"),
    recipientPhone: decryptSensitiveDataIfEncrypted(transaction.recipientPhone, "transaction-recipient-phone"),
    currency: transaction.currency,
    amountMinor: transaction.amountMinor,
    feeMinor: transaction.feeMinor,
    reference: transaction.reference,
    providerReference: decryptSensitiveDataIfEncrypted(transaction.providerReference, "provider-reference"),
    createdAt: transaction.createdAt.toISOString(),
  };
}

router.get("/me", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;

  try {
    /**
     * 🛡️ SÉCURITÉ SQLi :
     * `eq` lie `session.userId` comme une valeur PostgreSQL; cette valeur
     * n'est pas analysée comme du texte SQL. L'identité vient de la session
     * serveur, pas d'un identifiant choisi par le navigateur.
     */
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

router.get("/me/profile", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;
  res.setHeader("Cache-Control", "no-store, private");

  try {
    const [user] = await db
      .select({
        displayName: usersTable.displayName,
        birthDate: usersTable.birthDate,
        birthDateEncrypted: usersTable.birthDateEncrypted,
      })
      .from(usersTable)
      .where(eq(usersTable.id, session.userId))
      .limit(1);
    if (!user) {
      res.status(503).json({ error: "Profile storage unavailable" });
      return;
    }

    const displayName = decryptSensitiveDataIfEncrypted(user.displayName, "user-name");
    const birthDate = user.birthDateEncrypted
      ? decryptSensitiveDataIfEncrypted(user.birthDateEncrypted, "user-birth-date")
      : user.birthDate;
    const profile = GetCustomerProfileResponse.parse({
      ...splitCustomerDisplayName(displayName),
      birthDate,
    });
    res.json(profile);
  } catch {
    // Never attach request or decrypted profile values to this log entry.
    req.log.error("Customer profile lookup failed");
    res.status(503).json({ error: "Profile storage unavailable" });
  }
});

router.patch("/me/profile", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;

  const parsed = UpdateCustomerProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile data" });
    return;
  }
  const profile = normalizeCustomerProfile(parsed.data);
  if (!profile) {
    res.status(400).json({ error: "Invalid profile data" });
    return;
  }

  try {
    const fullName = `${profile.firstName} ${profile.lastName}`;
    const [updatedUser] = await db
      .update(usersTable)
      .set({
        displayName: encryptSensitiveData(serializeCustomerProfileName(profile), "user-name"),
        displayNameLookupHash: createSensitiveDataLookupIndex(
          normalizeSensitiveNameForLookup(fullName),
          "user-name",
        ),
        birthDate: null,
        birthDateEncrypted: encryptSensitiveData(profile.birthDate, "user-birth-date"),
      })
      .where(eq(usersTable.id, session.userId))
      .returning({ id: usersTable.id });
    if (!updatedUser) {
      res.status(503).json({ error: "Profile storage unavailable" });
      return;
    }

    res.setHeader("Cache-Control", "no-store, private");
    res.json(UpdateCustomerProfileResponse.parse(profile));
  } catch {
    // Never attach request or decrypted profile values to this log entry.
    req.log.error("Customer profile update failed");
    res.status(503).json({ error: "Profile storage unavailable" });
  }
});

router.get("/me/transactions", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;
  res.setHeader("Cache-Control", "no-store, private");

  const cursorResult = parseCustomerTransactionCursor(req.query.cursor);
  if (!cursorResult.valid) {
    res.status(400).json({ error: "Invalid transaction cursor" });
    return;
  }

  const rawSearch = req.query.search;
  if (rawSearch !== undefined && (typeof rawSearch !== "string" || rawSearch.length > 80)) {
    res.status(400).json({ error: "Invalid transaction search" });
    return;
  }
  const rawLimit = req.query.limit;
  let pageSize = DEFAULT_CUSTOMER_TRANSACTION_PAGE_SIZE;
  if (rawLimit !== undefined) {
    if (typeof rawLimit !== "string" || !/^[1-9][0-9]*$/.test(rawLimit)) {
      res.status(400).json({ error: "Invalid transaction page size" });
      return;
    }
    pageSize = Number(rawLimit);
    if (
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_CUSTOMER_TRANSACTION_PAGE_SIZE
    ) {
      res.status(400).json({ error: "Invalid transaction page size" });
      return;
    }
  }
  const search = typeof rawSearch === "string" ? rawSearch.trim() : "";
  // SÉCURITÉ SQLi : `ilike()` lie le motif via Drizzle. Cet échappement
  // supplémentaire donne à %, _ et \ un sens littéral dans la recherche.
  const escapedSearch = search.replace(/[\\%_]/g, "\\$&");
  const searchPattern = search ? `%${escapedSearch}%` : undefined;
  const searchCondition = searchPattern
    ? or(
        ilike(transactionsTable.senderPhone, searchPattern),
        ilike(transactionsTable.recipientPhone, searchPattern),
        ilike(transactionsTable.reference, searchPattern),
        eq(transactionsTable.senderPhoneLookupHash, createSensitiveDataLookupIndex(search, "transaction-sender-phone")),
        eq(transactionsTable.recipientPhoneLookupHash, createSensitiveDataLookupIndex(search, "transaction-recipient-phone")),
      )
    : undefined;
  const cursor = cursorResult.cursor;

  try {
    if (cursor) {
      const [cursorRecord] = await db
        .select({ id: transactionsTable.id })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.id, cursor),
            eq(transactionsTable.userId, session.userId),
          ),
        )
        .limit(1);
      if (!cursorRecord) {
        res.status(400).json({ error: "Invalid transaction cursor" });
        return;
      }
    }

    // SÉCURITÉ SQLi : le template `sql` Drizzle lie `cursor` et `session.userId`;
    // la validation UUID et le filtre de propriété apportent des contrôles distincts.
    const cursorCreatedAt = cursor
      ? sql<Date>`(
          select ${transactionsTable.createdAt}
          from ${transactionsTable}
          where ${transactionsTable.id} = ${cursor}
            and ${transactionsTable.userId} = ${session.userId}
          limit 1
        )`
      : undefined;
    const cursorCondition = cursor && cursorCreatedAt
      ? or(
          lt(transactionsTable.createdAt, cursorCreatedAt),
          and(
            eq(transactionsTable.createdAt, cursorCreatedAt),
            lt(transactionsTable.id, cursor),
          ),
        )
      : undefined;
    const transactions = await db
      .select(customerTransactionColumns)
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, session.userId),
          isNull(transactionsTable.deletedAt),
          searchCondition,
          cursorCondition,
        ),
      )
      .orderBy(desc(transactionsTable.createdAt), desc(transactionsTable.id))
      .limit(pageSize + 1);

    const hasMore = transactions.length > pageSize;
    const page = transactions.slice(0, pageSize);
    const lastTransaction = page.at(-1);
    const response = GetCustomerTransactionsResponse.parse({
      items: page.map((transaction) => ({
        ...transaction,
        senderPhone: decryptSensitiveDataIfEncrypted(transaction.senderPhone, "transaction-sender-phone"),
        recipientPhone: decryptSensitiveDataIfEncrypted(transaction.recipientPhone, "transaction-recipient-phone"),
        providerReference: decryptSensitiveDataIfEncrypted(transaction.providerReference, "provider-reference"),
        createdAt: transaction.createdAt.toISOString(),
      })),
      nextCursor: hasMore && lastTransaction
        ? encodeCustomerTransactionCursor(lastTransaction.id)
        : null,
    });
    res.json(response);
  } catch (error) {
    req.log.error({ err: error, userId: session.userId }, "Customer transaction list lookup failed");
    res.status(503).json({ error: "Transaction history unavailable" });
  }
});

router.get("/me/transactions/:transactionId", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;
  res.setHeader("Cache-Control", "no-store, private");

  const transactionId =
    typeof req.params.transactionId === "string" ? req.params.transactionId : "";
  if (!isValidCustomerTransactionId(transactionId)) {
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

    const response = GetCustomerTransactionResponse.parse(
      serializeCustomerTransaction(transaction),
    );
    if (!Number.isSafeInteger(response.amountMinor + response.feeMinor)) {
      throw new Error("Customer transaction total exceeds the supported safe integer range");
    }
    res.json(response);
  } catch (error) {
    req.log.error({ err: error, userId: session.userId }, "Customer transaction lookup failed");
    res.status(503).json({ error: "Transaction details unavailable" });
  }
});

export default router;