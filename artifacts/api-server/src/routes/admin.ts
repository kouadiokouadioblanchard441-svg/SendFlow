import { Router, type IRouter, type Request, type Response } from "express";
import { recordAdminAudit } from "../lib/admin-audit";
import {
  createSensitiveDataLookupIndex,
  decryptSensitiveDataIfEncrypted,
  normalizeSensitiveNameForLookup,
} from "../lib/sensitive-data-crypto";
import {
  GetAdminTransactionParams,
  GetAdminTransactionResponse,
  GetAdminUserParams,
  GetAdminUserResponse,
  GetAdminOverviewQueryParams,
  GetAdminOverviewResponse,
  ListAdminTransactionsQueryParams,
  ListAdminTransactionsResponse,
  ListAdminUsersQueryParams,
  ListAdminUsersResponse,
} from "@workspace/api-zod";
import {
  and,
  count,
  db,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
  sum,
  transactionsTable,
  usersTable,
  walletsTable,
} from "@workspace/db";

const router: IRouter = Router();

type DateRange = {
  from?: Date;
  to?: Date;
};

export type AdminPermission = "read" | "mutate";

export function getAdminUserId(req: Request, permission: AdminPermission = "read") {
  void req;
  void permission;
  return { userId: null, error: "Administrator access is not configured" as const };
}

export function respondAdminIdentityError(
  req: Request,
  res: Response,
  permission: AdminPermission = "read",
) {
  const auth = getAdminUserId(req, permission);
  if (auth.userId) return auth.userId;

  req.log.error("Administrator access is not configured");
  res.status(503).json({ error: auth.error });
  return null;
}

export function respondAdminAuthError(
  req: Request,
  res: Response,
  permission: AdminPermission = "read",
) {
  respondAdminIdentityError(req, res, permission);
  return null;
}

function parseDateRange(query: Record<string, unknown>): DateRange {
  const fromValue = typeof query.from === "string" ? query.from : undefined;
  const toValue = typeof query.to === "string" ? query.to : undefined;

  return {
    from: fromValue ? new Date(`${fromValue}T00:00:00.000Z`) : undefined,
    to: toValue ? new Date(`${toValue}T23:59:59.999Z`) : undefined,
  };
}

function dateFilters(column: any, range: DateRange) {
  return [
    range.from ? gte(column, range.from) : undefined,
    range.to ? lte(column, range.to) : undefined,
  ].filter(Boolean);
}

function transactionDateFilters(range: DateRange) {
  return dateFilters(transactionsTable.createdAt, range);
}

function toMinor(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isSafeInteger(amount)) {
    throw new Error("Financial amount is outside the safe integer range");
  }
  return amount;
}

async function getTransactionSummary(
  range: DateRange,
  filters: ReturnType<typeof transactionDateFilters> = transactionDateFilters(range),
) {
  const [summary] = await db
    .select({
      total: count(),
      succeeded: sql<number>`count(*) filter (where ${transactionsTable.status} = 'succeeded')`,
      pending: sql<number>`count(*) filter (where ${transactionsTable.status} = 'pending')`,
      failed: sql<number>`count(*) filter (where ${transactionsTable.status} = 'failed')`,
      volumeMinor: sum(transactionsTable.amountMinor),
      feesMinor: sum(transactionsTable.feeMinor),
    })
    .from(transactionsTable)
    .where(filters.length ? and(...filters) : undefined);

  return {
    total: Number(summary?.total ?? 0),
    succeeded: Number(summary?.succeeded ?? 0),
    pending: Number(summary?.pending ?? 0),
    failed: Number(summary?.failed ?? 0),
    volumeMinor: toMinor(summary?.volumeMinor),
    feesMinor: toMinor(summary?.feesMinor),
  };
}

async function getKindSummary(
  range: DateRange,
  kinds: Array<"inter-network" | "deposit" | "international">,
) {
  const filters = [
    ...transactionDateFilters(range),
    inArray(transactionsTable.kind, kinds),
  ];
  const [summary] = await db
    .select({
      succeeded: sql<number>`count(*) filter (where ${transactionsTable.status} = 'succeeded')`,
      pending: sql<number>`count(*) filter (where ${transactionsTable.status} = 'pending')`,
      volumeMinor: sum(transactionsTable.amountMinor),
    })
    .from(transactionsTable)
    .where(and(...filters));

  return {
    succeeded: Number(summary?.succeeded ?? 0),
    pending: Number(summary?.pending ?? 0),
    volumeMinor: toMinor(summary?.volumeMinor),
  };
}

router.get("/overview", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;

  const rawQuery = {
    from: typeof req.query.from === "string" ? new Date(`${req.query.from}T00:00:00.000Z`) : undefined,
    to: typeof req.query.to === "string" ? new Date(`${req.query.to}T00:00:00.000Z`) : undefined,
  };
  const parsed = GetAdminOverviewQueryParams.safeParse(rawQuery);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid date range" });
    return;
  }

  const range = parseDateRange(req.query as Record<string, unknown>);

  try {
    const [usersCount, newUsersCount, activeWallets, walletBalance, transactions, deposits, transfers] =
      await Promise.all([
        db.select({ value: count() }).from(usersTable),
        (() => {
          const filters = dateFilters(usersTable.createdAt, range);
          return db
            .select({ value: count() })
            .from(usersTable)
            .where(filters.length ? and(...filters) : undefined);
        })(),
        db
          .select({ value: count() })
          .from(walletsTable)
          .where(eq(walletsTable.status, "active")),
        db
          .select({ value: sum(walletsTable.balanceMinor) })
          .from(walletsTable)
          .where(eq(walletsTable.status, "active")),
        getTransactionSummary(range),
        getKindSummary(range, ["deposit"]),
        getKindSummary(range, ["inter-network", "international"]),
      ]);

    const response = GetAdminOverviewResponse.parse({
        period: {
          from: req.query.from ? new Date(`${String(req.query.from)}T00:00:00.000Z`) : null,
          to: req.query.to ? new Date(`${String(req.query.to)}T00:00:00.000Z`) : null,
        },
        users: {
          total: Number(usersCount[0]?.value ?? 0),
          newInPeriod: Number(newUsersCount[0]?.value ?? 0),
        },
        wallets: {
          active: Number(activeWallets[0]?.value ?? 0),
          balanceMinor: toMinor(walletBalance[0]?.value),
        },
        transactions,
        deposits,
        transfers,
      });
    await recordAdminAudit({
      adminUserId,
      action: "view_admin_overview",
      resourceType: "dashboard",
      resourceId: "overview",
    });
    res.json(response);
  } catch (error) {
    req.log.error({ err: error }, "Admin overview lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.get("/users", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;

  const parsed = ListAdminUsersQueryParams.safeParse({
    search: req.query.search,
    page: req.query.page,
    pageSize: req.query.pageSize,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid user list filters" });
    return;
  }

  const { search, page, pageSize } = parsed.data;
  const offset = (page - 1) * pageSize;
  // SÉCURITÉ SQLi : `ilike()` passe le motif comme paramètre Drizzle.
  // `%` et `_` restent des jokers de recherche ici; ils ne deviennent pas du SQL.
  const searchFilter = search
    ? or(
        ilike(usersTable.displayName, `%${search}%`),
        ilike(usersTable.phone, `%${search}%`),
        ilike(usersTable.id, `%${search}%`),
        eq(
          usersTable.displayNameLookupHash,
          createSensitiveDataLookupIndex(normalizeSensitiveNameForLookup(search), "user-name"),
        ),
        eq(
          usersTable.phoneLookupHash,
          createSensitiveDataLookupIndex(search, "user-phone"),
        ),
      )
    : undefined;

  try {
    const [items, total] = await Promise.all([
      db
        .select({
          id: usersTable.id,
          displayName: usersTable.displayName,
          phone: usersTable.phone,
          countryCode: usersTable.countryCode,
          status: usersTable.status,
          suspendedAt: usersTable.suspendedAt,
          deletedAt: usersTable.deletedAt,
          createdAt: usersTable.createdAt,
          lastSeenAt: usersTable.lastSeenAt,
          wallet: {
            currency: walletsTable.currency,
            balanceMinor: walletsTable.balanceMinor,
            status: walletsTable.status,
          },
        })
        .from(usersTable)
        .leftJoin(walletsTable, eq(walletsTable.userId, usersTable.id))
        .where(searchFilter)
        .orderBy(desc(usersTable.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ value: count() }).from(usersTable).where(searchFilter),
    ]);

    const response = ListAdminUsersResponse.parse({
        items: items.map((item) => ({
          ...item,
          displayName: decryptSensitiveDataIfEncrypted(item.displayName, "user-name"),
          phone: decryptSensitiveDataIfEncrypted(item.phone, "user-phone"),
          wallet: item.wallet?.currency
            ? item.wallet
            : {
                currency: "XOF",
                balanceMinor: 0,
                status: "closed" as const,
              },
        })),
        page,
        pageSize,
        total: Number(total[0]?.value ?? 0),
      });
    await recordAdminAudit({
      adminUserId,
      action: "view_user_list",
      resourceType: "user",
      resourceId: "list",
    });
    res.json(response);
  } catch (error) {
    req.log.error({ err: error }, "Admin user list lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.get("/users/:userId", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;

  const parsedParams = GetAdminUserParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid user identifier" });
    return;
  }

  const { userId } = parsedParams.data;

  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        displayName: usersTable.displayName,
        phone: usersTable.phone,
        countryCode: usersTable.countryCode,
        status: usersTable.status,
        suspendedAt: usersTable.suspendedAt,
        deletedAt: usersTable.deletedAt,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
        lastSeenAt: usersTable.lastSeenAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [wallet, transactionSummary] = await Promise.all([
      db
        .select({
          id: walletsTable.id,
          currency: walletsTable.currency,
          balanceMinor: walletsTable.balanceMinor,
          status: walletsTable.status,
          createdAt: walletsTable.createdAt,
          updatedAt: walletsTable.updatedAt,
        })
        .from(walletsTable)
        .where(eq(walletsTable.userId, userId))
        .then((items) => items[0]),
      getTransactionSummary({}, [eq(transactionsTable.userId, userId)]),
    ]);

    await recordAdminAudit({
      adminUserId,
      action: "view_user_detail",
      resourceType: "user",
      resourceId: userId,
    });

    res.json(
      GetAdminUserResponse.parse({
        user: {
          ...user,
          displayName: decryptSensitiveDataIfEncrypted(user.displayName, "user-name"),
          phone: decryptSensitiveDataIfEncrypted(user.phone, "user-phone"),
        },
        wallet: wallet ?? null,
        transactionSummary,
      }),
    );
  } catch (error) {
    req.log.error({ err: error, userId }, "Admin user detail lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.get("/transactions", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;

  const rawQuery = {
    search: req.query.search,
    userId: req.query.userId,
    kind: req.query.kind,
    status: req.query.status,
    from: typeof req.query.from === "string" ? new Date(`${req.query.from}T00:00:00.000Z`) : undefined,
    to: typeof req.query.to === "string" ? new Date(`${req.query.to}T00:00:00.000Z`) : undefined,
    page: req.query.page,
    pageSize: req.query.pageSize,
  };
  const parsed = ListAdminTransactionsQueryParams.safeParse(rawQuery);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid transaction filters" });
    return;
  }

  const { search, userId, kind, status, page, pageSize } = parsed.data;
  const range = parseDateRange(req.query as Record<string, unknown>);
  const filters = [
    ...transactionDateFilters(range),
    userId ? eq(transactionsTable.userId, userId) : undefined,
    kind ? eq(transactionsTable.kind, kind) : undefined,
    status ? eq(transactionsTable.status, status) : undefined,
    search
      ? or(
          ilike(transactionsTable.reference, `%${search}%`),
          ilike(transactionsTable.providerReference, `%${search}%`),
          ilike(transactionsTable.senderPhone, `%${search}%`),
          ilike(transactionsTable.recipientPhone, `%${search}%`),
          ilike(usersTable.displayName, `%${search}%`),
          eq(
            transactionsTable.senderPhoneLookupHash,
            createSensitiveDataLookupIndex(search, "transaction-sender-phone"),
          ),
          eq(
            transactionsTable.recipientPhoneLookupHash,
            createSensitiveDataLookupIndex(search, "transaction-recipient-phone"),
          ),
          eq(
            transactionsTable.providerReferenceLookupHash,
            createSensitiveDataLookupIndex(search, "provider-reference"),
          ),
          eq(
            usersTable.displayNameLookupHash,
            createSensitiveDataLookupIndex(normalizeSensitiveNameForLookup(search), "user-name"),
          ),
        )
      : undefined,
  ].filter(Boolean);
  const offset = (page - 1) * pageSize;

  try {
    const [items, total] = await Promise.all([
      db
        .select({
          id: transactionsTable.id,
          userId: transactionsTable.userId,
          displayName: usersTable.displayName,
          kind: transactionsTable.kind,
          status: transactionsTable.status,
          fromOperator: transactionsTable.fromOperator,
          toOperator: transactionsTable.toOperator,
          senderPhone: transactionsTable.senderPhone,
          recipientPhone: transactionsTable.recipientPhone,
          amountMinor: transactionsTable.amountMinor,
          feeMinor: transactionsTable.feeMinor,
          currency: transactionsTable.currency,
          reference: transactionsTable.reference,
          providerReference: transactionsTable.providerReference,
          archivedAt: transactionsTable.deletedAt,
          createdAt: transactionsTable.createdAt,
        })
        .from(transactionsTable)
        .innerJoin(usersTable, eq(usersTable.id, transactionsTable.userId))
        .where(and(isNull(transactionsTable.deletedAt), ...filters))
        .orderBy(desc(transactionsTable.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ value: count() })
        .from(transactionsTable)
        .innerJoin(usersTable, eq(usersTable.id, transactionsTable.userId))
        .where(and(isNull(transactionsTable.deletedAt), ...filters)),
    ]);

    const response = ListAdminTransactionsResponse.parse({
        items: items.map((item) => ({
          ...item,
          displayName: decryptSensitiveDataIfEncrypted(item.displayName, "user-name"),
          senderPhone: decryptSensitiveDataIfEncrypted(item.senderPhone, "transaction-sender-phone"),
          recipientPhone: decryptSensitiveDataIfEncrypted(item.recipientPhone, "transaction-recipient-phone"),
          providerReference: decryptSensitiveDataIfEncrypted(item.providerReference, "provider-reference"),
        })),
        page,
        pageSize,
        total: Number(total[0]?.value ?? 0),
      });
    await recordAdminAudit({
      adminUserId,
      action: "view_transaction_list",
      resourceType: "transaction",
      resourceId: "list",
    });
    res.json(response);
  } catch (error) {
    req.log.error({ err: error }, "Admin transaction list lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.get("/transactions/:transactionId", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;

  const parsedParams = GetAdminTransactionParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid transaction identifier" });
    return;
  }

  const { transactionId } = parsedParams.data;

  try {
    const [transaction] = await db
      .select({
        id: transactionsTable.id,
        userId: transactionsTable.userId,
        displayName: usersTable.displayName,
        userPhone: usersTable.phone,
        kind: transactionsTable.kind,
        status: transactionsTable.status,
        fromOperator: transactionsTable.fromOperator,
        toOperator: transactionsTable.toOperator,
        senderPhone: transactionsTable.senderPhone,
        recipientPhone: transactionsTable.recipientPhone,
        amountMinor: transactionsTable.amountMinor,
        feeMinor: transactionsTable.feeMinor,
        currency: transactionsTable.currency,
        reference: transactionsTable.reference,
        providerReference: transactionsTable.providerReference,
        archivedAt: transactionsTable.deletedAt,
        createdAt: transactionsTable.createdAt,
        updatedAt: transactionsTable.updatedAt,
      })
      .from(transactionsTable)
      .innerJoin(usersTable, eq(usersTable.id, transactionsTable.userId))
      .where(eq(transactionsTable.id, transactionId));

    if (!transaction) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    await recordAdminAudit({
      adminUserId,
      action: "view_transaction_detail",
      resourceType: "transaction",
      resourceId: transactionId,
    });

    res.json(GetAdminTransactionResponse.parse({
      ...transaction,
      displayName: decryptSensitiveDataIfEncrypted(transaction.displayName, "user-name"),
      userPhone: decryptSensitiveDataIfEncrypted(transaction.userPhone, "user-phone"),
      senderPhone: decryptSensitiveDataIfEncrypted(transaction.senderPhone, "transaction-sender-phone"),
      recipientPhone: decryptSensitiveDataIfEncrypted(transaction.recipientPhone, "transaction-recipient-phone"),
      providerReference: decryptSensitiveDataIfEncrypted(transaction.providerReference, "provider-reference"),
    }));
  } catch (error) {
    req.log.error({ err: error, transactionId }, "Admin transaction detail lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

export default router;