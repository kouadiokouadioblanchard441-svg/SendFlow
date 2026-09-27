import { Router, type IRouter } from "express";
import {
  and,
  desc,
  db,
  eq,
  gte,
  inArray,
  identityVerificationsTable,
  identityWebhookEventsTable,
  lt,
  sql,
  transactionsTable,
  usersTable,
} from "@workspace/db";
import {
  GetCurrentAccountLimitResponse,
  CreateIdentityVerificationSessionBody,
  CreateIdentityVerificationSessionResponse,
  GetIdentityVerificationStatusResponse,
  ReceiveDiditWebhookBody,
  ReceiveDiditWebhookResponse,
} from "@workspace/api-zod";
import {
  createDiditSession,
  DiditConfigurationError,
  getSafeCallbackUrl,
  isFreshDiditTimestamp,
  isDiditStatus,
  isSandboxEnvironment,
  isValidDiditSignature,
} from "../lib/didit";
import { requireCustomerSession } from "../lib/customer-session";
import { isTrustedOrigin } from "../lib/request-security";

const router: IRouter = Router();

function currentStatus(status: string): "unverified" | "pending" | "verified" | "failed" | "review" {
  if (status === "Approved") return "verified";
  if (status === "Declined" || status === "Expired" || status === "Kyc Expired" || status === "Abandoned") return "failed";
  if (status === "In Review") return "review";
  return "pending";
}

function inactiveAccountMessage(status: "active" | "suspended" | "deleted" | undefined) {
  if (status === "suspended") return "Account suspended";
  if (status === "deleted") return "Account deleted";
  return null;
}

function statusRank(status: string) {
  if (status === "Approved") return 100;
  if (status === "In Review") return 70;
  if (["Declined", "Expired", "Kyc Expired", "Abandoned"].includes(status)) return 60;
  if (["In Progress", "Awaiting User", "Resubmitted"].includes(status)) return 20;
  return 0;
}

router.get("/me/account-limit", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;
  const { userId } = session;

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

    const [verification] = await db
      .select({ status: identityVerificationsTable.status })
      .from(identityVerificationsTable)
      .where(eq(identityVerificationsTable.userId, userId))
      .orderBy(desc(identityVerificationsTable.createdAt))
      .limit(1);

    const status = verification ? currentStatus(verification.status) : "unverified";
    const monthlyLimit = status === "verified" ? 10_000_000 : 150_000;
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const [usage] = await db
      .select({
        sentAmount: sql<unknown>`coalesce(sum(${transactionsTable.amountMinor}), 0)`,
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.currency, "XOF"),
          inArray(transactionsTable.kind, ["inter-network", "international"]),
          inArray(transactionsTable.status, ["pending", "succeeded"]),
          gte(transactionsTable.createdAt, periodStart),
          lt(transactionsTable.createdAt, periodEnd),
        ),
      );

    const sentAmount = Number(usage?.sentAmount ?? 0);
    if (!Number.isSafeInteger(sentAmount) || sentAmount < 0) {
      throw new Error("Account limit usage is outside the safe integer range");
    }

    res.json(
      GetCurrentAccountLimitResponse.parse({
        status,
        currency: "XOF",
        monthlyLimit,
        sentAmount,
        remainingAmount: Math.max(0, monthlyLimit - sentAmount),
        periodStart,
        periodEnd,
      }),
    );
  } catch (error) {
    req.log.error({ err: error, userId }, "Account limit lookup failed");
    res.status(503).json({ error: "Account limit data unavailable" });
  }
});

router.get("/me/identity-verification", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;
  const { userId } = session;

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

    const [verification] = await db
      .select()
      .from(identityVerificationsTable)
      .where(eq(identityVerificationsTable.userId, userId))
      .orderBy(desc(identityVerificationsTable.createdAt))
      .limit(1);

    res.json(
      GetIdentityVerificationStatusResponse.parse({
        status: verification ? currentStatus(verification.status) : "unverified",
        diditStatus: verification?.status ?? null,
        sessionId: verification?.providerSessionId ?? null,
        verificationUrl: verification?.verificationUrl ?? null,
        sandboxScenario: verification?.sandboxScenario ?? null,
      }),
    );
  } catch (error) {
    req.log.error({ err: error, userId }, "Identity verification status lookup failed");
    res.status(503).json({ error: "Identity verification storage unavailable" });
  }
});

router.post("/me/identity-verification", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Untrusted request origin" });
    return;
  }

  const session = await requireCustomerSession(req, res, true);
  if (!session) return;
  const { userId } = session;

  const parsed = CreateIdentityVerificationSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid identity verification request" });
    return;
  }

  const scenario = parsed.data.sandboxScenario;
  if (scenario && !isSandboxEnvironment()) {
    res.status(400).json({ error: "Sandbox scenarios are disabled outside development" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select({ id: usersTable.id, status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .for("update");

      if (!lockedUser) throw new Error("Account could not be locked");
      const inactiveAccount = inactiveAccountMessage(lockedUser.status);
      if (inactiveAccount) return { blockedAccount: inactiveAccount } as const;

      const [existing] = await tx
        .select()
        .from(identityVerificationsTable)
        .where(
          and(
            eq(identityVerificationsTable.userId, userId),
            inArray(identityVerificationsTable.status, [
              "Not Started",
              "Awaiting User",
              "In Progress",
              "Resubmitted",
            ]),
          ),
        )
        .orderBy(desc(identityVerificationsTable.createdAt))
        .limit(1);

      if (existing) {
        return { blockedAccount: null, verification: existing, reused: true } as const;
      }

      const vendorData = `sendflow:user:${userId}`;
      const diditSession = await createDiditSession({
        vendorData,
        sandboxScenario: scenario,
        callback: getSafeCallbackUrl(),
      });

      const [verification] = await tx
        .insert(identityVerificationsTable)
        .values({
          userId,
          providerSessionId: diditSession.session_id,
          vendorData,
          verificationUrl: diditSession.url,
          status: diditSession.status,
          sandboxScenario: scenario ?? null,
        })
        .returning();

      if (!verification) throw new Error("Identity verification session was not stored");
      return { blockedAccount: null, verification, reused: false } as const;
    });

    if (result.blockedAccount) {
      res.status(403).json({ error: result.blockedAccount });
      return;
    }

    const { verification, reused } = result;

    res.status(reused ? 200 : 201).json(
      CreateIdentityVerificationSessionResponse.parse({
        sessionId: verification.providerSessionId,
        verificationUrl: verification.verificationUrl,
        status: currentStatus(verification.status),
        diditStatus: verification.status,
        sandboxScenario: verification.sandboxScenario,
        reused,
      }),
    );
  } catch (error) {
    if (error instanceof DiditConfigurationError) {
      res.status(503).json({ error: "Didit development credentials are not configured" });
      return;
    }

    req.log.error({ err: error, userId }, "Didit session creation failed");
    res.status(502).json({ error: "Identity verification provider unavailable" });
  }
});

router.post("/webhooks/didit", async (req, res): Promise<void> => {
  if (
    !isFreshDiditTimestamp(req.header("X-Timestamp") ?? undefined) ||
    !isValidDiditSignature(req.body, req.header("X-Signature-V2") ?? undefined)
  ) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  const parsed = ReceiveDiditWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Didit webhook payload" });
    return;
  }

  const { event_id: eventId, session_id: providerSessionId, webhook_type: eventType, status } = parsed.data;
  if (!isDiditStatus(status)) {
    res.status(400).json({ error: "Unknown Didit verification status" });
    return;
  }

  try {
    const outcome = await db.transaction(async (tx) => {
      const [existingEvent] = await tx
        .select({
          providerSessionId: identityWebhookEventsTable.providerSessionId,
          eventType: identityWebhookEventsTable.eventType,
        })
        .from(identityWebhookEventsTable)
        .where(eq(identityWebhookEventsTable.eventId, eventId))
        .for("update");

      if (existingEvent) {
        const matches =
          existingEvent.providerSessionId === providerSessionId &&
          existingEvent.eventType === eventType;
        return { duplicate: matches, conflict: !matches };
      }

      const [verification] = await tx
        .select()
        .from(identityVerificationsTable)
        .where(eq(identityVerificationsTable.providerSessionId, providerSessionId))
        .for("update");

      if (!verification) {
        throw new Error("Didit webhook references an unknown session");
      }

      const [event] = await tx
        .insert(identityWebhookEventsTable)
        .values({ eventId, providerSessionId, eventType })
        .onConflictDoNothing()
        .returning();

      if (!event) {
        const [concurrentEvent] = await tx
          .select({
            providerSessionId: identityWebhookEventsTable.providerSessionId,
            eventType: identityWebhookEventsTable.eventType,
          })
          .from(identityWebhookEventsTable)
          .where(eq(identityWebhookEventsTable.eventId, eventId));
        const matches =
          concurrentEvent?.providerSessionId === providerSessionId &&
          concurrentEvent.eventType === eventType;
        return { duplicate: matches, conflict: !matches };
      }

      if (statusRank(status) >= statusRank(verification.status)) {
        await tx
          .update(identityVerificationsTable)
          .set({
            status,
            lastWebhookEventId: eventId,
            lastWebhookType: eventType,
            updatedAt: new Date(),
          })
          .where(eq(identityVerificationsTable.id, verification.id));
      }

      await tx
        .update(identityWebhookEventsTable)
        .set({ matchedVerification: true })
        .where(eq(identityWebhookEventsTable.eventId, eventId));

      return { duplicate: false, conflict: false };
    });

    if (outcome.conflict) {
      req.log.warn({ eventId, providerSessionId }, "Didit webhook event identifier conflicts with a stored event");
      res.status(409).json({ error: "Didit event identifier conflicts with a previously received event" });
      return;
    }

    res.json(ReceiveDiditWebhookResponse.parse({ received: true, duplicate: outcome.duplicate }));
  } catch (error) {
    req.log.error({ err: error, eventId }, "Didit webhook processing failed");
    res.status(503).json({ error: "Webhook processing unavailable" });
  }
});

export default router;