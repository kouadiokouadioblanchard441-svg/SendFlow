import { Router, type IRouter } from "express";
import {
  and,
  count,
  db,
  desc,
  eq,
  gte,
  lte,
  phoneOtpChallengesTable,
  phoneOtpEventsTable,
} from "@workspace/db";
import {
  ListAdminOtpActivityQueryParams,
  ListAdminOtpActivityResponse,
} from "@workspace/api-zod";
import { recordAdminAudit } from "../lib/admin-audit";
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

router.get("/admin/otp-activity", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;

  const range = parseDateRange(req.query as Record<string, unknown>);
  const parsed = ListAdminOtpActivityQueryParams.safeParse({
    eventType: req.query.eventType,
    outcome: req.query.outcome,
    from: range.from,
    to: range.to,
    page: req.query.page,
    pageSize: req.query.pageSize,
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid OTP activity filters" });
    return;
  }

  const { eventType, outcome, page, pageSize } = parsed.data;
  const filters = [
    range.from ? gte(phoneOtpEventsTable.createdAt, range.from) : undefined,
    range.to ? lte(phoneOtpEventsTable.createdAt, range.to) : undefined,
    eventType ? eq(phoneOtpEventsTable.eventType, eventType) : undefined,
    outcome ? eq(phoneOtpEventsTable.outcome, outcome) : undefined,
  ].filter(Boolean);
  const where = filters.length ? and(...filters) : undefined;
  const offset = (page - 1) * pageSize;

  try {
    const [rows, total] = await Promise.all([
      db
        .select({
          id: phoneOtpEventsTable.id,
          challengeId: phoneOtpEventsTable.challengeId,
          eventType: phoneOtpEventsTable.eventType,
          outcome: phoneOtpEventsTable.outcome,
          challengeStatus: phoneOtpChallengesTable.status,
          providerHttpStatus: phoneOtpEventsTable.providerHttpStatus,
          diagnosticMessage: phoneOtpEventsTable.diagnosticMessage,
          attemptNumber: phoneOtpEventsTable.attemptNumber,
          createdAt: phoneOtpEventsTable.createdAt,
          completedAt: phoneOtpEventsTable.completedAt,
        })
        .from(phoneOtpEventsTable)
        .leftJoin(
          phoneOtpChallengesTable,
          eq(phoneOtpChallengesTable.id, phoneOtpEventsTable.challengeId),
        )
        .where(where)
        .orderBy(desc(phoneOtpEventsTable.createdAt), desc(phoneOtpEventsTable.id))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ value: count() })
        .from(phoneOtpEventsTable)
        .where(where),
    ]);

    const response = ListAdminOtpActivityResponse.parse({
      items: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
      })),
      page,
      pageSize,
      total: Number(total[0]?.value ?? 0),
    });

    await recordAdminAudit({
      adminUserId,
      action: "view_otp_activity",
      resourceType: "otp_activity",
      resourceId: "list",
      reason: "view_otp_activity",
    });

    res.json(response);
  } catch (error) {
    req.log.error({ err: error }, "Admin OTP activity lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

export default router;