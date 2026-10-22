import { Router, type IRouter } from "express";
import {
  asc,
  and,
  desc,
  db,
  eq,
  gt,
  inArray,
  identityVerificationsTable,
  identityVerificationAttemptsTable,
  identityWebhookEventsTable,
  lte,
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
  assertDiditConfiguration,
  DiditConfigurationError,
  getSafeCallbackUrl,
  isFreshSignedDiditTimestamp,
  isDiditStatus,
  isSandboxEnvironment,
  isValidDiditSignature,
} from "../lib/didit";
import { ExternalProviderCallUnavailableError } from "../lib/provider-call-policy";
import {
  isDiditStatusUpdateEvent,
  isExpectedDiditWebhookEnvironment,
} from "../lib/didit-webhook-policy";
import {
  ACTIVE_DIDIT_VERIFICATION_STATUSES,
  isReusableDiditVerificationStatus,
  canApplyDiditStatusTransition,
} from "../lib/didit-verification-policy";
import { loadLatestIdentityVerification } from "../data/identity-verification";
import { prepareIdentityWebhookReceipt, getDiditRecordUpdateTime } from "../lib/identity-webhook-receipt";
import {
  DIDIT_SESSION_ATTEMPT_LIMIT,
  DIDIT_SESSION_ATTEMPT_WINDOW_MS,
  DIDIT_SESSION_CREATION_LEASE_MS,
  getDiditSessionCreationRetryAfter,
  getDiditSessionRetryAfter,
} from "../lib/didit-session-rate-limit";
import { requireCustomerSession } from "../lib/customer-session";
import { isTrustedOrigin } from "../lib/request-security";
import { getAccountLimitSnapshot } from "../lib/account-limit";
import { mapDiditStatusToAccountLimitStatus } from "../lib/account-limit-policy";

const router: IRouter = Router();

function inactiveAccountMessage(status: "active" | "suspended" | "deleted" | undefined) {
  if (status === "suspended") return "Account suspended";
  if (status === "deleted") return "Account deleted";
  return null;
}

async function markDiditAttemptFailed(
  userId: string,
  attemptId: string,
  providerSessionId?: string,
): Promise<void> {
  const update = providerSessionId
    ? { status: "failed" as const, providerSessionId }
    : { status: "failed" as const };
  const [updated] = await db
    .update(identityVerificationAttemptsTable)
    .set(update)
    .where(
      and(
        eq(identityVerificationAttemptsTable.id, attemptId),
        eq(identityVerificationAttemptsTable.userId, userId),
        eq(identityVerificationAttemptsTable.status, "creating"),
      ),
    )
    .returning({ id: identityVerificationAttemptsTable.id });

  if (!updated) {
    throw new Error("Didit attempt reservation could not be marked failed");
  }
}

async function reserveDiditSessionAttempt(userId: string) {
  return db.transaction(async (tx) => {
    const [lockedUser] = await tx
      .select({ id: usersTable.id, status: usersTable.status })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .for("update");

    if (!lockedUser) throw new Error("Account could not be locked");
    const inactiveAccount = inactiveAccountMessage(lockedUser.status);
    if (inactiveAccount) return { kind: "blocked", message: inactiveAccount } as const;

    const existing = await loadLatestIdentityVerification(userId, tx);
    if (existing && isReusableDiditVerificationStatus(existing.status)) {
      return { kind: "reused", verification: existing } as const;
    }

    // Capture time after acquiring the per-user lock so a long lock wait cannot
    // extend the rolling window or create a reservation with an old timestamp.
    const reservationTime = new Date();
    const attemptsSince = new Date(
      reservationTime.getTime() - DIDIT_SESSION_ATTEMPT_WINDOW_MS,
    );
    const leaseCutoff = new Date(
      reservationTime.getTime() - DIDIT_SESSION_CREATION_LEASE_MS,
    );

    await tx
      .delete(identityVerificationAttemptsTable)
      .where(
        and(
          eq(identityVerificationAttemptsTable.userId, userId),
          lte(identityVerificationAttemptsTable.createdAt, attemptsSince),
        ),
      );

    await tx
      .update(identityVerificationAttemptsTable)
      .set({ status: "abandoned" })
      .where(
        and(
          eq(identityVerificationAttemptsTable.userId, userId),
          eq(identityVerificationAttemptsTable.status, "creating"),
          gt(identityVerificationAttemptsTable.createdAt, attemptsSince),
          lte(identityVerificationAttemptsTable.createdAt, leaseCutoff),
        ),
      );

    const [pendingAttempt] = await tx
      .select({ createdAt: identityVerificationAttemptsTable.createdAt })
      .from(identityVerificationAttemptsTable)
      .where(
        and(
          eq(identityVerificationAttemptsTable.userId, userId),
          eq(identityVerificationAttemptsTable.status, "creating"),
          gt(identityVerificationAttemptsTable.createdAt, leaseCutoff),
        ),
      )
      .orderBy(asc(identityVerificationAttemptsTable.createdAt))
      .limit(1);
    if (pendingAttempt) {
      const retryAfterSeconds = getDiditSessionCreationRetryAfter(
        [pendingAttempt.createdAt],
        reservationTime,
      );
      if (retryAfterSeconds !== null) {
        return { kind: "in_progress", retryAfterSeconds } as const;
      }
    }

    const attempts = await tx
      .select({ createdAt: identityVerificationAttemptsTable.createdAt })
      .from(identityVerificationAttemptsTable)
      .where(
        and(
          eq(identityVerificationAttemptsTable.userId, userId),
          gt(identityVerificationAttemptsTable.createdAt, attemptsSince),
        ),
      )
      .orderBy(asc(identityVerificationAttemptsTable.createdAt))
      .limit(DIDIT_SESSION_ATTEMPT_LIMIT);
    const retryAfterSeconds = getDiditSessionRetryAfter(
      attempts.map((attempt) => attempt.createdAt),
      reservationTime,
    );
    if (retryAfterSeconds !== null) {
      return { kind: "rate_limited", retryAfterSeconds } as const;
    }

    const [attempt] = await tx
      .insert(identityVerificationAttemptsTable)
      .values({ userId, createdAt: reservationTime })
      .returning({ id: identityVerificationAttemptsTable.id });
    if (!attempt) throw new Error("Didit session attempt was not reserved");

    return { kind: "reserved", attemptId: attempt.id } as const;
  });
}

router.get("/me/account-limit", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;
  const { userId } = session;
  res.setHeader("Cache-Control", "no-store, private");

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

    res.json(
      GetCurrentAccountLimitResponse.parse({
        ...await getAccountLimitSnapshot(userId),
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

    const verification = await loadLatestIdentityVerification(userId);

    res.json(
      GetIdentityVerificationStatusResponse.parse({
        status: mapDiditStatusToAccountLimitStatus(verification?.status ?? null),
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

  let callback: string | undefined;
  try {
    assertDiditConfiguration();
    callback = getSafeCallbackUrl();
  } catch (error) {
    if (
      error instanceof DiditConfigurationError
      || error instanceof ExternalProviderCallUnavailableError
    ) {
      res.status(503).json({ error: "Identity verification is unavailable in this environment" });
      return;
    }
    req.log.error({ err: error, userId }, "Didit configuration could not be checked");
    res.status(503).json({ error: "Identity verification configuration unavailable" });
    return;
  }

  let reservation: Awaited<ReturnType<typeof reserveDiditSessionAttempt>>;
  try {
    reservation = await reserveDiditSessionAttempt(userId);
  } catch (error) {
    req.log.error({ err: error, userId }, "Didit session reservation failed");
    res.status(503).json({ error: "Identity verification storage unavailable" });
    return;
  }

  if (reservation.kind === "blocked") {
    res.status(403).json({ error: reservation.message });
    return;
  }

  if (reservation.kind === "reused") {
    const { verification } = reservation;
    res.status(200).json(
      CreateIdentityVerificationSessionResponse.parse({
        sessionId: verification.providerSessionId,
        verificationUrl: verification.verificationUrl,
        status: mapDiditStatusToAccountLimitStatus(verification.status),
        diditStatus: verification.status,
        sandboxScenario: verification.sandboxScenario,
        reused: true,
      }),
    );
    return;
  }

  if (reservation.kind === "in_progress" || reservation.kind === "rate_limited") {
    res.setHeader("Retry-After", String(reservation.retryAfterSeconds));
    if (reservation.kind === "in_progress") {
      res.status(409).json({
        error: "Une création de vérification est déjà en cours. Réessayez après le délai indiqué.",
      });
      return;
    }
    res.status(429).json({
      error: "Vous avez atteint la limite de 3 tentatives de vérification sur 24 heures. Réessayez plus tard.",
    });
    return;
  }

  let diditSession: Awaited<ReturnType<typeof createDiditSession>>;
  try {
    diditSession = await createDiditSession({
      vendorData: `sendflow:user:${userId}`,
      sandboxScenario: scenario,
      callback,
    });
  } catch (providerError) {
    try {
      await markDiditAttemptFailed(userId, reservation.attemptId);
    } catch (storageError) {
      req.log.error(
        { err: storageError, userId, attemptId: reservation.attemptId },
        "Failed Didit request could not be recorded",
      );
      res.status(503).json({ error: "Identity verification storage unavailable" });
      return;
    }

    if (
      providerError instanceof DiditConfigurationError
      || providerError instanceof ExternalProviderCallUnavailableError
    ) {
      res.status(503).json({ error: "Identity verification is unavailable in this environment" });
      return;
    }
    req.log.error({ err: providerError, userId }, "Didit session creation failed");
    res.status(502).json({ error: "Identity verification provider unavailable" });
    return;
  }

  const vendorData = `sendflow:user:${userId}`;
  let verification: typeof identityVerificationsTable.$inferSelect;
  try {
    verification = await db.transaction(async (tx) => {
      const [attempt] = await tx
        .select({ status: identityVerificationAttemptsTable.status })
        .from(identityVerificationAttemptsTable)
        .where(
          and(
            eq(identityVerificationAttemptsTable.id, reservation.attemptId),
            eq(identityVerificationAttemptsTable.userId, userId),
          ),
        )
        .for("update");
      if (!attempt || attempt.status !== "creating") {
        throw new Error("Didit session reservation is no longer active");
      }

      const [storedVerification] = await tx
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
      if (!storedVerification) {
        throw new Error("Identity verification session was not stored");
      }

      const [completedAttempt] = await tx
        .update(identityVerificationAttemptsTable)
        .set({
          status: "completed",
          providerSessionId: diditSession.session_id,
        })
        .where(
          and(
            eq(identityVerificationAttemptsTable.id, reservation.attemptId),
            eq(identityVerificationAttemptsTable.userId, userId),
            eq(identityVerificationAttemptsTable.status, "creating"),
          ),
        )
        .returning({ id: identityVerificationAttemptsTable.id });
      if (!completedAttempt) {
        throw new Error("Didit session attempt could not be completed");
      }

      return storedVerification;
    });
  } catch (storageError) {
    req.log.error(
      { err: storageError, userId, attemptId: reservation.attemptId },
      "Created Didit session could not be persisted",
    );
    try {
      await markDiditAttemptFailed(
        userId,
        reservation.attemptId,
        diditSession.session_id,
      );
    } catch (markError) {
      req.log.error(
        { err: markError, userId, attemptId: reservation.attemptId },
        "Didit session persistence failure could not be recorded",
      );
    }
    res.status(503).json({ error: "Identity verification storage unavailable" });
    return;
  }

  res.status(201).json(
    CreateIdentityVerificationSessionResponse.parse({
      sessionId: verification.providerSessionId,
      verificationUrl: verification.verificationUrl,
      status: mapDiditStatusToAccountLimitStatus(verification.status),
      diditStatus: verification.status,
      sandboxScenario: verification.sandboxScenario,
      reused: false,
    }),
  );
});

router.post("/webhooks/didit", async (req, res): Promise<void> => {
  if (
    !isFreshSignedDiditTimestamp(req.body, req.header("X-Timestamp") ?? undefined) ||
    !isValidDiditSignature(req.body, req.header("X-Signature-V2") ?? undefined)
  ) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  const webhookBody =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : null;
  const rawEventType = webhookBody?.webhook_type;
  if (typeof rawEventType !== "string" || rawEventType.trim().length === 0) {
    res.status(400).json({ error: "Invalid Didit webhook payload" });
    return;
  }

  if (
    !isExpectedDiditWebhookEnvironment(
      webhookBody?.environment,
      process.env.DIDIT_ENVIRONMENT,
    )
  ) {
    req.log.warn("Didit webhook environment does not match server configuration");
    res.status(403).json({ error: "Didit webhook environment mismatch" });
    return;
  }

  if (!isDiditStatusUpdateEvent(rawEventType)) {
    req.log.info(
      { eventType: rawEventType.slice(0, 128) },
      "Ignoring non-status Didit webhook event",
    );
    res.json(ReceiveDiditWebhookResponse.parse({ received: true, duplicate: false }));
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
  const providerEventAt = getDiditRecordUpdateTime(req.body);
  if (!providerEventAt) {
    res.status(400).json({ error: "Invalid Didit record update timestamp" });
    return;
  }

  try {
    const receipt = prepareIdentityWebhookReceipt(req.body);
    const outcome = await db.transaction(async (tx) => {
      const [existingEvent] = await tx
        .select({
          providerSessionId: identityWebhookEventsTable.providerSessionId,
          eventType: identityWebhookEventsTable.eventType,
          payloadDigest: identityWebhookEventsTable.payloadDigest,
        })
        .from(identityWebhookEventsTable)
        .where(eq(identityWebhookEventsTable.eventId, eventId))
        .for("update");

      if (existingEvent) {
        const matches =
          existingEvent.providerSessionId === providerSessionId &&
          existingEvent.eventType === eventType &&
          (existingEvent.payloadDigest === null || existingEvent.payloadDigest === receipt.payloadDigest);
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
        .values({ eventId, providerSessionId, eventType, status, ...receipt })
        .onConflictDoNothing()
        .returning();

      if (!event) {
        const [concurrentEvent] = await tx
          .select({
            providerSessionId: identityWebhookEventsTable.providerSessionId,
            eventType: identityWebhookEventsTable.eventType,
            payloadDigest: identityWebhookEventsTable.payloadDigest,
          })
          .from(identityWebhookEventsTable)
          .where(eq(identityWebhookEventsTable.eventId, eventId));
        const matches =
          concurrentEvent?.providerSessionId === providerSessionId &&
          concurrentEvent.eventType === eventType &&
          (concurrentEvent.payloadDigest === null || concurrentEvent.payloadDigest === receipt.payloadDigest);
        return { duplicate: matches, conflict: !matches };
      }

      const statusApplied = canApplyDiditStatusTransition(
        verification.status, status, providerEventAt, verification.lastProviderEventAt,
      );
      if (statusApplied) {
        await tx
          .update(identityVerificationsTable)
          .set({
            status,
            lastWebhookEventId: eventId,
            lastWebhookType: eventType,
            lastProviderEventAt: providerEventAt,
            updatedAt: new Date(),
          })
          .where(eq(identityVerificationsTable.id, verification.id));
      }

      await tx
        .update(identityWebhookEventsTable)
        .set({ matchedVerification: true, statusApplied })
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