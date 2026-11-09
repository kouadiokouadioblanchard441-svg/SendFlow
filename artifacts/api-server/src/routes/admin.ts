import { Router, type IRouter, type Request, type Response } from "express";
import { recordAdminAudit } from "../lib/admin-audit";
import { adminPinUnlocked, adminSessionContext } from "../lib/admin-session";
import {
  createSensitiveDataLookupIndex,
  decryptSensitiveData,
  decryptSensitiveDataIfEncrypted,
  normalizeSensitiveNameForLookup,
} from "../lib/sensitive-data-crypto";
import { formatCustomerDisplayName } from "../lib/customer-profile-policy";
import { getMonthlyIncomingPolicy } from "../data/unverified-incoming-policy";
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
  ListAdminUserDeveloperWebhooksQueryParams,
  ListAdminUserDeveloperWebhooksResponse,
} from "@workspace/api-zod";
import {
  asc,
  and,
  count,
  countriesTable,
  customerPaymentLinkAttemptsTable,
  customerPaymentLinksTable,
  db,
  desc,
  developerPaymentSessionsTable,
  developerWebhookEndpointsTable,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  paymentAttemptsTable,
  paymentConfirmationsTable,
  paymentIntentsTable,
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
  const session = adminSessionContext(req);
  if (!session) return { userId: null, status: 401, error: "Administrator authentication required" };
  // Keep mutation access narrow: catalogue/campaign operations plus explicit
  // account block/unblock actions. Financial operations and account deletion
  // remain outside this authorization scope.
  if (!/^\/(?:operator-pricing|operator-pricing-rates|operators(?:\/[^/]+(?:\/logo\/[^/]+)?)?|payment-limits|email-campaigns(?:\/.*)?|identity-verifications(?:\/.*)?|users\/[^/]+\/(?:suspend|restore|monthly-incoming-limit))\/?$/.test(req.path)) {
    return { userId: null, status: 403, error: "Administrator permission does not authorize this operation" };
  }
  if (permission === "mutate" && !session.canMutate) {
    return { userId: null, status: 403, error: "Administrator mutation permission required" };
  }
  return { userId: session.userId, status: 200, error: null };
}

export function respondAdminIdentityError(
  req: Request,
  res: Response,
  permission: AdminPermission = "read",
) {
  const auth = getAdminUserId(req, permission);
  if (auth.userId) return auth.userId;

  res.status(auth.status).json({ error: auth.error });
  return null;
}

export function respondAdminAuthError(
  req: Request,
  res: Response,
  permission: AdminPermission = "read",
) {
  const userId = respondAdminIdentityError(req, res, permission);
  if (!userId) return null;
  const session = adminSessionContext(req);
  if (!session || !adminPinUnlocked(session)) {
    res.status(403).json({ error: "Administrator PIN verification required" });
    return null;
  }
  return userId;
}

const adminUserReadPath = /^\/(?:users(?:\/[^/]+)?|developer-webhooks)\/?$/;
const adminTransactionReadPath = /^\/transactions(?:\/[^/]+)?\/?$/;

export function respondAdminUserReadAuthError(req: Request, res: Response) {
  const session = adminSessionContext(req);
  if (!session) {
    res.status(401).json({ error: "Administrator authentication required" });
    return null;
  }
  if (req.method !== "GET" || !adminUserReadPath.test(req.path)) {
    res.status(403).json({ error: "Administrator user profile read access required" });
    return null;
  }
  if (!adminPinUnlocked(session)) {
    res.status(403).json({ error: "Administrator PIN verification required" });
    return null;
  }
  return session.userId;
}

export function respondAdminTransactionReadAuthError(req: Request, res: Response) {
  const session = adminSessionContext(req);
  if (!session) {
    res.status(401).json({ error: "Administrator authentication required" });
    return null;
  }
  if (req.method !== "GET" || !adminTransactionReadPath.test(req.path)) {
    res.status(403).json({ error: "Administrator transaction read access required" });
    return null;
  }
  if (!adminPinUnlocked(session)) {
    res.status(403).json({ error: "Administrator PIN verification required" });
    return null;
  }
  return session.userId;
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
  const adminUserId = respondAdminUserReadAuthError(req, res);
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
          displayName: formatCustomerDisplayName(
            decryptSensitiveDataIfEncrypted(item.displayName, "user-name"),
          ),
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
  const adminUserId = respondAdminUserReadAuthError(req, res);
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
        emailEncrypted: usersTable.emailEncrypted,
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

    const [wallet, transactionSummary, financialTotals] = await Promise.all([
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
      db.select({
        depositsMinor: sql<number>`coalesce(sum(${transactionsTable.amountMinor}) filter (where ${transactionsTable.kind} = 'deposit'), 0)`,
        internationalPayoutsMinor: sql<number>`coalesce(sum(${transactionsTable.amountMinor}) filter (where ${transactionsTable.kind} = 'international'), 0)`,
        depositFeesMinor: sql<number>`coalesce(sum(${transactionsTable.feeMinor}) filter (where ${transactionsTable.kind} = 'deposit'), 0)`,
        interNetworkFeesMinor: sql<number>`coalesce(sum(${transactionsTable.feeMinor}) filter (where ${transactionsTable.kind} = 'inter-network'), 0)`,
        internationalFeesMinor: sql<number>`coalesce(sum(${transactionsTable.feeMinor}) filter (where ${transactionsTable.kind} = 'international'), 0)`,
      }).from(transactionsTable).where(and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.status, "succeeded"),
        eq(transactionsTable.currency, "XOF"),
      )).then((items) => ({
        currency: "XOF" as const,
        depositsMinor: toMinor(items[0]?.depositsMinor),
        internationalPayoutsMinor: toMinor(items[0]?.internationalPayoutsMinor),
        feesByKind: {
          depositMinor: toMinor(items[0]?.depositFeesMinor),
          interNetworkMinor: toMinor(items[0]?.interNetworkFeesMinor),
          internationalMinor: toMinor(items[0]?.internationalFeesMinor),
        },
      })),
    ]);

    const monthlyIncomingPolicy = await getMonthlyIncomingPolicy(userId);

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
        displayName: formatCustomerDisplayName(
          decryptSensitiveDataIfEncrypted(user.displayName, "user-name"),
        ),
          phone: decryptSensitiveDataIfEncrypted(user.phone, "user-phone"),
          email: decryptSensitiveDataIfEncrypted(user.emailEncrypted, "user-email"),
        },
        wallet: wallet ?? null,
        transactionSummary,
        financialTotals,
        monthlyIncomingPolicy: {
          identityVerified: monthlyIncomingPolicy.identityVerified,
          receivedMinor: monthlyIncomingPolicy.receivedMinor,
          unverifiedLimitMinor: monthlyIncomingPolicy.unverifiedLimitMinor,
          verifiedLimitMinor: monthlyIncomingPolicy.verifiedLimitMinor,
          overrideMinor: monthlyIncomingPolicy.overrideMinor,
          effectiveLimitMinor: monthlyIncomingPolicy.effectiveLimitMinor,
          periodStart: monthlyIncomingPolicy.periodStart.toISOString(),
          periodEnd: monthlyIncomingPolicy.periodEnd.toISOString(),
        },
      }),
    );
  } catch (error) {
    req.log.error({ err: error, userId }, "Admin user detail lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.get("/developer-webhooks", async (req, res): Promise<void> => {
  const adminUserId = respondAdminUserReadAuthError(req, res);
  if (!adminUserId) return;

  const parsedQuery = ListAdminUserDeveloperWebhooksQueryParams.safeParse({
    userId: req.query.userId,
    page: req.query.page,
    pageSize: req.query.pageSize,
  });
  if (!parsedQuery.success) {
    res.status(400).json({ error: "Invalid user identifier or pagination filters" });
    return;
  }

  const { userId, page, pageSize } = parsedQuery.data;
  const offset = (page - 1) * pageSize;

  try {
    const [user] = await db.select({ id: usersTable.id })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const endpointFilter = eq(developerWebhookEndpointsTable.userId, userId);
    const [items, total] = await Promise.all([
      db.select({
        id: developerWebhookEndpointsTable.id,
        label: developerWebhookEndpointsTable.label,
        urlEncrypted: developerWebhookEndpointsTable.urlEncrypted,
        events: developerWebhookEndpointsTable.events,
        status: developerWebhookEndpointsTable.status,
        createdAt: developerWebhookEndpointsTable.createdAt,
        revokedAt: developerWebhookEndpointsTable.revokedAt,
      }).from(developerWebhookEndpointsTable)
        .where(endpointFilter)
        .orderBy(desc(developerWebhookEndpointsTable.createdAt), desc(developerWebhookEndpointsTable.id))
        .limit(pageSize)
        .offset(offset),
      db.select({ value: count() }).from(developerWebhookEndpointsTable).where(endpointFilter),
    ]);

    const response = ListAdminUserDeveloperWebhooksResponse.parse({
      items: items.map((item) => ({
        id: item.id,
        label: item.label,
        url: decryptSensitiveData(item.urlEncrypted, "developer-webhook-url"),
        events: item.events,
        status: item.status,
        createdAt: item.createdAt,
        revokedAt: item.revokedAt,
      })),
      page,
      pageSize,
      total: Number(total[0]?.value ?? 0),
    });
    await recordAdminAudit({
      adminUserId,
      action: "view_developer_webhooks",
      resourceType: "developer_webhook",
      resourceId: userId,
    });
    res.json(response);
  } catch (error) {
    req.log.error({ err: error, userId }, "Admin developer webhook lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.get("/transactions", async (req, res): Promise<void> => {
  const adminUserId = respondAdminTransactionReadAuthError(req, res);
  if (!adminUserId) return;

  const rawQuery = {
    search: req.query.search,
    userId: req.query.userId,
    kind: req.query.kind,
    status: req.query.status,
    countryCode: req.query.countryCode,
    channelId: req.query.channelId,
    paymentSource: req.query.paymentSource,
    integrationMode: req.query.integrationMode,
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

  const { search, userId, kind, status, countryCode, channelId, paymentSource, integrationMode, page, pageSize } = parsed.data;
  const range = parseDateRange(req.query as Record<string, unknown>);
  const filters = [
    ...transactionDateFilters(range),
    userId ? eq(transactionsTable.userId, userId) : undefined,
    kind ? eq(transactionsTable.kind, kind) : undefined,
    status ? eq(transactionsTable.status, status) : undefined,
    countryCode
      ? inArray(
          transactionsTable.id,
          db.select({ transactionId: paymentIntentsTable.transactionId })
            .from(paymentIntentsTable)
            .innerJoin(paymentAttemptsTable, eq(paymentAttemptsTable.intentId, paymentIntentsTable.id))
            .where(eq(paymentAttemptsTable.countryCode, countryCode)),
        )
      : undefined,
    channelId
      ? inArray(
          transactionsTable.id,
          db.select({ transactionId: paymentIntentsTable.transactionId })
            .from(paymentIntentsTable)
            .innerJoin(paymentAttemptsTable, eq(paymentAttemptsTable.intentId, paymentIntentsTable.id))
            .where(eq(paymentAttemptsTable.channelId, channelId)),
        )
      : undefined,
    paymentSource
      ? inArray(
          transactionsTable.id,
          db.select({ transactionId: paymentIntentsTable.transactionId })
            .from(paymentIntentsTable)
            .innerJoin(
              customerPaymentLinkAttemptsTable,
              eq(customerPaymentLinkAttemptsTable.intentId, paymentIntentsTable.id),
            )
            .innerJoin(
              customerPaymentLinksTable,
              and(
                eq(customerPaymentLinksTable.id, customerPaymentLinkAttemptsTable.paymentLinkId),
                eq(customerPaymentLinksTable.userId, transactionsTable.userId),
              ),
            )
            .where(eq(customerPaymentLinksTable.source, paymentSource)),
        )
      : undefined,
    integrationMode
      ? inArray(
          transactionsTable.id,
          db.select({ transactionId: paymentIntentsTable.transactionId })
            .from(paymentIntentsTable)
            .innerJoin(
              customerPaymentLinkAttemptsTable,
              eq(customerPaymentLinkAttemptsTable.intentId, paymentIntentsTable.id),
            )
            .innerJoin(
              customerPaymentLinksTable,
              and(
                eq(customerPaymentLinksTable.id, customerPaymentLinkAttemptsTable.paymentLinkId),
                eq(customerPaymentLinksTable.userId, transactionsTable.userId),
              ),
            )
            .innerJoin(
              developerPaymentSessionsTable,
              and(
                eq(developerPaymentSessionsTable.paymentLinkId, customerPaymentLinksTable.id),
                eq(developerPaymentSessionsTable.userId, customerPaymentLinksTable.userId),
              ),
            )
            .where(eq(developerPaymentSessionsTable.mode, integrationMode)),
        )
      : undefined,
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
          displayName: formatCustomerDisplayName(
            decryptSensitiveDataIfEncrypted(item.displayName, "user-name"),
          ),
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
  const adminUserId = respondAdminTransactionReadAuthError(req, res);
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

    const [intent] = await db
      .select({
        id: paymentIntentsTable.id,
        kind: paymentIntentsTable.kind,
        state: paymentIntentsTable.state,
        currency: paymentIntentsTable.currency,
        amountMinor: paymentIntentsTable.amountMinor,
        feeMinor: paymentIntentsTable.feeMinor,
        feePayer: paymentIntentsTable.feePayer,
        senderTotalMinor: paymentIntentsTable.senderTotalMinor,
        recipientTotalMinor: paymentIntentsTable.recipientTotalMinor,
        ledgerEntryId: paymentIntentsTable.ledgerEntryId,
        createdAt: paymentIntentsTable.createdAt,
        updatedAt: paymentIntentsTable.updatedAt,
      })
      .from(paymentIntentsTable)
      .where(eq(paymentIntentsTable.transactionId, transactionId))
      .limit(1);

    const [paymentContext, attempts] = intent
      ? await Promise.all([
          db
            .select({
              linkId: customerPaymentLinksTable.id,
              linkName: customerPaymentLinksTable.linkName,
              linkSource: customerPaymentLinksTable.source,
              paymentMethod: customerPaymentLinksTable.paymentMethod,
              linkCurrency: customerPaymentLinksTable.currency,
              linkStatus: customerPaymentLinksTable.status,
              sessionId: developerPaymentSessionsTable.id,
              sessionMode: developerPaymentSessionsTable.mode,
              merchantReference: developerPaymentSessionsTable.merchantReference,
              sessionCreatedAt: developerPaymentSessionsTable.createdAt,
              sessionExpiresAt: developerPaymentSessionsTable.expiresAt,
            })
            .from(customerPaymentLinkAttemptsTable)
            .innerJoin(
              customerPaymentLinksTable,
              eq(customerPaymentLinksTable.id, customerPaymentLinkAttemptsTable.paymentLinkId),
            )
            .leftJoin(
              developerPaymentSessionsTable,
              and(
                eq(developerPaymentSessionsTable.paymentLinkId, customerPaymentLinksTable.id),
                eq(developerPaymentSessionsTable.userId, transaction.userId),
              ),
            )
            .where(and(
              eq(customerPaymentLinkAttemptsTable.intentId, intent.id),
              eq(customerPaymentLinksTable.userId, transaction.userId),
            ))
            .limit(1)
            .then((items) => items[0]),
          db
            .select({
              id: paymentAttemptsTable.id,
              direction: paymentAttemptsTable.direction,
              countryCode: paymentAttemptsTable.countryCode,
              countryName: countriesTable.countryName,
              channelId: paymentAttemptsTable.channelId,
              operationReference: paymentAttemptsTable.operationReference,
              amountMinor: paymentAttemptsTable.amountMinor,
              currency: paymentAttemptsTable.currency,
              status: paymentAttemptsTable.status,
              dispatchedAt: paymentAttemptsTable.dispatchedAt,
              finalConfirmationId: paymentAttemptsTable.finalConfirmationId,
              createdAt: paymentAttemptsTable.createdAt,
              updatedAt: paymentAttemptsTable.updatedAt,
            })
            .from(paymentAttemptsTable)
            .leftJoin(countriesTable, eq(countriesTable.countryCode, paymentAttemptsTable.countryCode))
            .where(eq(paymentAttemptsTable.intentId, intent.id))
            .orderBy(asc(paymentAttemptsTable.createdAt), asc(paymentAttemptsTable.direction)),
        ])
      : [undefined, []];
    const confirmations = attempts.length
      ? await db
          .select({
            id: paymentConfirmationsTable.id,
            attemptId: paymentConfirmationsTable.attemptId,
            source: paymentConfirmationsTable.source,
            providerStatus: paymentConfirmationsTable.providerStatus,
            amountMinor: paymentConfirmationsTable.amountMinor,
            currency: paymentConfirmationsTable.currency,
            verifiedAt: paymentConfirmationsTable.verifiedAt,
            createdAt: paymentConfirmationsTable.createdAt,
          })
          .from(paymentConfirmationsTable)
          .where(inArray(
            paymentConfirmationsTable.attemptId,
            attempts.map((attempt) => attempt.id),
          ))
          .orderBy(asc(paymentConfirmationsTable.verifiedAt), asc(paymentConfirmationsTable.createdAt))
      : [];
    const confirmationsByAttempt = new Map<string, typeof confirmations>();
    for (const confirmation of confirmations) {
      const existing = confirmationsByAttempt.get(confirmation.attemptId) ?? [];
      existing.push(confirmation);
      confirmationsByAttempt.set(confirmation.attemptId, existing);
    }
    const tracedAttempts = attempts.map((attempt) => ({
      ...attempt,
      confirmations: confirmationsByAttempt.get(attempt.id) ?? [],
    }));

    await recordAdminAudit({
      adminUserId,
      action: "view_transaction_detail",
      resourceType: "transaction",
      resourceId: transactionId,
    });

    res.json(GetAdminTransactionResponse.parse({
      ...transaction,
      displayName: formatCustomerDisplayName(
        decryptSensitiveDataIfEncrypted(transaction.displayName, "user-name"),
      ),
      userPhone: decryptSensitiveDataIfEncrypted(transaction.userPhone, "user-phone"),
      senderPhone: decryptSensitiveDataIfEncrypted(transaction.senderPhone, "transaction-sender-phone"),
      recipientPhone: decryptSensitiveDataIfEncrypted(transaction.recipientPhone, "transaction-recipient-phone"),
      providerReference: decryptSensitiveDataIfEncrypted(transaction.providerReference, "provider-reference"),
      paymentTrace: {
        intent: intent ?? null,
        paymentLink: paymentContext
          ? {
              id: paymentContext.linkId,
              name: paymentContext.linkName,
              source: paymentContext.linkSource,
              paymentMethod: paymentContext.paymentMethod,
              currency: paymentContext.linkCurrency,
              status: paymentContext.linkStatus,
            }
          : null,
        integrationSession: paymentContext?.sessionId
          ? {
              id: paymentContext.sessionId,
              mode: paymentContext.sessionMode,
              merchantReference: paymentContext.merchantReference,
              createdAt: paymentContext.sessionCreatedAt,
              expiresAt: paymentContext.sessionExpiresAt,
            }
          : null,
        attempts: tracedAttempts,
      },
    }));
  } catch (error) {
    req.log.error({ err: error, transactionId }, "Admin transaction detail lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

export default router;