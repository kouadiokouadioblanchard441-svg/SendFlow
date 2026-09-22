import { getAuth } from "@clerk/express";
import { Router, type IRouter, type Request } from "express";
import {
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

function getAdminUserId(req: Request) {
  const { userId } = getAuth(req);
  if (!userId) return { userId: null, error: "Authentication required" as const };

  const configuredAdmins = (process.env.SENDFLOW_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configuredAdmins.length === 0) {
    return { userId: null, error: "Administrator access is not configured" as const };
  }

  if (!configuredAdmins.includes(userId)) {
    return { userId: null, error: "Administrator access denied" as const };
  }

  return { userId, error: null };
}

function respondAdminAuthError(req: Request, res: Parameters<Parameters<IRouter["get"]>[1]>[1]) {
  const auth = getAdminUserId(req);
  if (auth.userId) return auth.userId;

  if (auth.error === "Authentication required") {
    res.status(401).json({ error: auth.error });
  } else if (auth.error === "Administrator access denied") {
    res.status(403).json({ error: auth.error });
  } else {
    req.log.error("Administrator access is not configured");
    res.status(503).json({ error: auth.error });
  }
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
  return Number(value ?? 0);
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

router.get("/admin/overview", async (req, res): Promise<void> => {
  if (!respondAdminAuthError(req, res)) return;

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

    res.json(
      GetAdminOverviewResponse.parse({
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
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Admin overview lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.get("/admin/users", async (req, res): Promise<void> => {
  if (!respondAdminAuthError(req, res)) return;

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
  const searchFilter = search
    ? or(
        ilike(usersTable.displayName, `%${search}%`),
        ilike(usersTable.phone, `%${search}%`),
        ilike(usersTable.id, `%${search}%`),
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

    res.json(
      ListAdminUsersResponse.parse({
        items: items.map((item) => ({
          ...item,
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
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Admin user list lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.get("/admin/users/:userId", async (req, res): Promise<void> => {
  if (!respondAdminAuthError(req, res)) return;

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

    res.json(
      GetAdminUserResponse.parse({
        user,
        wallet: wallet ?? null,
        transactionSummary,
      }),
    );
  } catch (error) {
    req.log.error({ err: error, userId }, "Admin user detail lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.get("/admin/transactions", async (req, res): Promise<void> => {
  if (!respondAdminAuthError(req, res)) return;

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
          amountMinor: transactionsTable.amountMinor,
          feeMinor: transactionsTable.feeMinor,
          currency: transactionsTable.currency,
          reference: transactionsTable.reference,
          providerReference: transactionsTable.providerReference,
          createdAt: transactionsTable.createdAt,
        })
        .from(transactionsTable)
        .innerJoin(usersTable, eq(usersTable.id, transactionsTable.userId))
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(desc(transactionsTable.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ value: count() })
        .from(transactionsTable)
        .innerJoin(usersTable, eq(usersTable.id, transactionsTable.userId))
        .where(filters.length ? and(...filters) : undefined),
    ]);

    res.json(
      ListAdminTransactionsResponse.parse({
        items,
        page,
        pageSize,
        total: Number(total[0]?.value ?? 0),
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Admin transaction list lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

export default router;