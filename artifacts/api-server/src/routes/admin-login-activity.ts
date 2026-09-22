import { Router, type IRouter } from "express";
import {
  adminAuditLogsTable,
  and,
  count,
  db,
  desc,
  eq,
  gte,
  ilike,
  lte,
  loginEventsTable,
  or,
  usersTable,
} from "@workspace/db";
import { ListAdminLoginActivityQueryParams, ListAdminLoginActivityResponse } from "@workspace/api-zod";
import { recordAdminAudit } from "../lib/admin-audit";
import { loginActivityAuditAction } from "../lib/login-activity";
import { respondAdminAuthError } from "./admin";

const router: IRouter = Router();

function parseDateRange(query: Record<string, unknown>) {
  const fromValue = typeof query.from === "string" ? query.from : undefined;
  const toValue = typeof query.to === "string" ? query.to : undefined;

  return {
    from: fromValue ? new Date(`${fromValue}T00:00:00.000Z`) : undefined,
    to: toValue ? new Date(`${toValue}T23:59:59.999Z`) : undefined,
  };
}

router.get("/admin/login-activity", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;

  const range = parseDateRange(req.query as Record<string, unknown>);
  const parsed = ListAdminLoginActivityQueryParams.safeParse({
    search: req.query.search,
    userId: req.query.userId,
    from: range.from,
    to: range.to,
    page: req.query.page,
    pageSize: req.query.pageSize,
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid login activity filters" });
    return;
  }

  const { search, userId, page, pageSize } = parsed.data;
  const filters = [
    range.from ? gte(loginEventsTable.createdAt, range.from) : undefined,
    range.to ? lte(loginEventsTable.createdAt, range.to) : undefined,
    userId ? eq(loginEventsTable.userId, userId) : undefined,
    search
      ? or(
          ilike(loginEventsTable.ipAddress, `%${search}%`),
          ilike(loginEventsTable.city, `%${search}%`),
          ilike(loginEventsTable.region, `%${search}%`),
          ilike(loginEventsTable.countryCode, `%${search}%`),
          ilike(loginEventsTable.countryName, `%${search}%`),
          ilike(loginEventsTable.sessionId, `%${search}%`),
          ilike(usersTable.displayName, `%${search}%`),
          ilike(usersTable.phone, `%${search}%`),
          ilike(usersTable.id, `%${search}%`),
        )
      : undefined,
  ].filter(Boolean);
  const where = filters.length ? and(...filters) : undefined;
  const offset = (page - 1) * pageSize;

  try {
    const [items, total] = await Promise.all([
      db
        .select({
          id: loginEventsTable.id,
          userId: loginEventsTable.userId,
          displayName: usersTable.displayName,
          phone: usersTable.phone,
          sessionId: loginEventsTable.sessionId,
          ipAddress: loginEventsTable.ipAddress,
          city: loginEventsTable.city,
          region: loginEventsTable.region,
          countryCode: loginEventsTable.countryCode,
          countryName: loginEventsTable.countryName,
          locationSource: loginEventsTable.locationSource,
          deviceType: loginEventsTable.deviceType,
          browser: loginEventsTable.browser,
          operatingSystem: loginEventsTable.operatingSystem,
          userAgent: loginEventsTable.userAgent,
          createdAt: loginEventsTable.createdAt,
        })
        .from(loginEventsTable)
        .innerJoin(usersTable, eq(usersTable.id, loginEventsTable.userId))
        .where(where)
        .orderBy(desc(loginEventsTable.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ value: count() })
        .from(loginEventsTable)
        .innerJoin(usersTable, eq(usersTable.id, loginEventsTable.userId))
        .where(where),
    ]);

    await recordAdminAudit({
      adminUserId,
      action: loginActivityAuditAction,
      resourceType: "login_activity",
      resourceId: "list",
      reason: "view_login_activity",
    });

    res.json(
      ListAdminLoginActivityResponse.parse({
        items,
        page,
        pageSize,
        total: Number(total[0]?.value ?? 0),
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Admin login activity lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

export default router;