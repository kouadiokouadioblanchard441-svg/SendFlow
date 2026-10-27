import { createHash, randomBytes, randomUUID } from "node:crypto";
import cors from "cors";
import express, { Router, type IRouter, type Request, type Response } from "express";
import {
  and,
  customerPaymentLinkAttemptsTable,
  customerPaymentLinksTable,
  db,
  desc,
  developerApiKeysTable,
  developerPaymentSessionsTable,
  developerWebhookDeliveriesTable,
  developerWebhookEndpointsTable,
  eq,
  isNull,
  paymentAttemptsTable,
  paymentIntentsTable,
  sql,
  usersTable,
  walletsTable,
} from "@workspace/db";
import {
  CreateDeveloperApiKeyBody,
  CreateDeveloperApiKeyResponse,
  CreateDeveloperPaymentSessionBody,
  CreateDeveloperPaymentSessionHeader,
  CreateDeveloperPaymentSessionResponse,
  CreateDeveloperWebhookBody,
  CreateDeveloperWebhookResponse,
  GetDeveloperDirectPaymentStatusHeader,
  GetDeveloperDirectPaymentStatusParams,
  GetDeveloperDirectPaymentStatusResponse,
  GetDeveloperPaymentSessionParams,
  GetDeveloperPaymentSessionResponse,
  GetDeveloperPublicPaymentSessionHeader,
  GetDeveloperPublicPaymentSessionParams,
  GetDeveloperPublicPaymentSessionResponse,
  ListDeveloperApiKeysResponse,
  ListDeveloperWebhookDeliveriesParams,
  ListDeveloperWebhookDeliveriesResponse,
  ListDeveloperWebhooksResponse,
  RevokeDeveloperApiKeyParams,
  RevokeDeveloperWebhookParams,
  StartDeveloperDirectPaymentBody,
  StartDeveloperDirectPaymentHeader,
  StartDeveloperDirectPaymentParams,
  StartDeveloperDirectPaymentResponse,
} from "@workspace/api-zod";
import { consumeDeveloperApiQuota } from "../data/developer-api-quota";
import { consumePaymentLinkCreationQuota, consumePublicPaymentLinkQuota } from "../data/payment-link-quota";
import { requireCustomerSession } from "../lib/customer-session";
import {
  decryptSensitiveData,
  decryptSensitiveDataIfEncrypted,
  encryptSensitiveData,
} from "../lib/sensitive-data-crypto";
import {
  createDeveloperApiKeyMaterial,
  createDeveloperClientToken,
  deriveDeveloperAttemptIdempotencyKey,
  hashDeveloperClientToken,
  hashDeveloperPublicKey,
  hashDeveloperRequest,
  hashDeveloperSecretKey,
  resolvePublicWebhookTarget,
} from "../services/developer-api-security";
import { formatCustomerDisplayName } from "../lib/customer-profile-policy";
import {
  createPaymentLinkPublicToken,
  isPaymentLinkCreationAllowed,
  normalizePaymentLinkInput,
  PaymentLinkInputError,
} from "../services/payment-links";
import {
  getLinkFlowPaymentAttemptStatus,
  getLinkFlowPaymentAttemptStatusByMappingId,
  LinkFlowPaymentError,
  startLinkFlowPaymentAttempt,
} from "../services/linkflow-payment-execution";
import { isLinkFlowPaymentExecutionEnabled } from "../services/linkflow-payment-policy";
import { getPublicPaymentLinkChoices } from "./public-payment-links";

const router: IRouter = Router();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicKeyPattern = /^sfpk_live_[A-Za-z0-9_-]{43}$/;
const secretKeyPattern = /^sfsk_live_[A-Za-z0-9_-]{43}$/;
const clientTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const pollTokenPattern = /^[a-f0-9]{64}$/;

router.use("/v1/public", cors({
  origin: true,
  credentials: false,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "X-SendFlow-Public-Key",
    "X-SendFlow-Client-Token",
    "X-LinkFlow-Attempt-Token",
    "Idempotency-Key",
  ],
  maxAge: 600,
}));

function isPinUnlocked(session: Awaited<ReturnType<typeof requireCustomerSession>>) {
  return Boolean(session?.pinConfigured && session.pinUnlocked && session.phoneVerified);
}

async function requireDeveloperPanelSession(req: Request, res: Response) {
  const session = await requireCustomerSession(req, res, false);
  if (!session) return null;
  if (!isPinUnlocked(session)) {
    res.status(403).json({ error: "Vérifiez votre code PIN et votre numéro avant de gérer les intégrations." });
    return null;
  }
  return session;
}

function safeKeyResponse(row: typeof developerApiKeysTable.$inferSelect) {
  return {
    id: row.id,
    label: row.label,
    publicKey: row.publicKey,
    publicKeyPrefix: row.publicKeyPrefix,
    secretKeyPrefix: row.secretKeyPrefix,
    status: row.status,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  };
}

function safeWebhookResponse(row: typeof developerWebhookEndpointsTable.$inferSelect) {
  return {
    id: row.id,
    label: row.label,
    url: decryptSensitiveData(row.urlEncrypted, "developer-webhook-url"),
    events: row.events,
    status: row.status,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  };
}

function normalizeMetadata(metadata: Record<string, unknown> | undefined) {
  const value = metadata ?? {};
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 8_192) {
    throw new Error("metadata_too_large");
  }
  return value;
}

function parseAuthorization(req: Request) {
  const header = req.get("authorization") ?? "";
  const match = /^Bearer (sfsk_live_[A-Za-z0-9_-]{43})$/.exec(header);
  return match?.[1] ?? null;
}

async function hasPaymentTestAccess(userId: string) {
  const [row] = await db.select({ userId: usersTable.id }).from(usersTable)
    .where(and(
      eq(usersTable.id, userId),
      sql`exists (
        select 1 from public.sf_replit_payment_test_access a
        where a.user_id=${usersTable.id} and a.state='active'
      )`,
    )).limit(1);
  return Boolean(row);
}

async function requireSecretApiKey(req: Request, res: Response) {
  const rawKey = parseAuthorization(req);
  if (!rawKey || !secretKeyPattern.test(rawKey)) {
    res.status(401).json({ error: "La clé API secrète est invalide ou désactivée." });
    return null;
  }
  const [row] = await db.select({
    id: developerApiKeysTable.id,
    userId: developerApiKeysTable.userId,
    publicKey: developerApiKeysTable.publicKey,
    status: developerApiKeysTable.status,
    accountStatus: usersTable.status,
    phoneVerifiedAt: usersTable.phoneVerifiedAt,
    paymentTestAccount: sql<boolean>`exists (
      select 1 from public.sf_replit_payment_test_access a
      where a.user_id=${usersTable.id} and a.state='active'
    )`,
  }).from(developerApiKeysTable)
    .innerJoin(usersTable, eq(usersTable.id, developerApiKeysTable.userId))
    .where(and(
      eq(developerApiKeysTable.secretKeyHash, hashDeveloperSecretKey(rawKey)),
      eq(developerApiKeysTable.status, "active"),
      eq(usersTable.status, "active"),
      sql`${usersTable.phoneVerifiedAt} is not null`,
    ))
    .limit(1);
  if (!row) {
    res.status(401).json({ error: "La clé API secrète est invalide ou désactivée." });
    return null;
  }
  if (row.paymentTestAccount ||
    !isPaymentLinkCreationAllowed({ paymentTestAccount: row.paymentTestAccount })) {
    res.status(403).json({ error: "La création de paiements API n’est pas disponible pour ce compte d’essai." });
    return null;
  }
  if (!await consumeDeveloperApiQuota(row.id, "session_read")) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Trop de requêtes API. Réessayez dans une minute." });
    return null;
  }
  const now = new Date();
  await db.update(developerApiKeysTable).set({ lastUsedAt: now, updatedAt: now })
    .where(eq(developerApiKeysTable.id, row.id));
  return row;
}

async function readPublicSessionCredentials(
  req: Request,
  res: Response,
  sessionId: string,
  options: { allowExpired?: boolean } = {},
) {
  const parsedHeader = GetDeveloperPublicPaymentSessionHeader.safeParse({
    "X-SendFlow-Public-Key": req.get("X-SendFlow-Public-Key"),
    "X-SendFlow-Client-Token": req.get("X-SendFlow-Client-Token"),
  });
  if (!parsedHeader.success) {
    res.status(404).json({ error: "Cette session de paiement n’est pas disponible." });
    return null;
  }
  const publicKey = parsedHeader.data["X-SendFlow-Public-Key"];
  const clientToken = parsedHeader.data["X-SendFlow-Client-Token"];
  if (!publicKeyPattern.test(publicKey) || !clientTokenPattern.test(clientToken)) {
    res.status(404).json({ error: "Cette session de paiement n’est pas disponible." });
    return null;
  }
  const [session] = await db.select({
    apiKeyId: developerPaymentSessionsTable.apiKeyId,
    userId: developerPaymentSessionsTable.userId,
    paymentLinkId: developerPaymentSessionsTable.paymentLinkId,
    mode: developerPaymentSessionsTable.mode,
    amountMinor: developerPaymentSessionsTable.amountMinor,
    currency: developerPaymentSessionsTable.currency,
    merchantReference: developerPaymentSessionsTable.merchantReference,
    expiresAt: developerPaymentSessionsTable.expiresAt,
    createdAt: developerPaymentSessionsTable.createdAt,
    clientTokenHash: developerPaymentSessionsTable.clientTokenHash,
    linkName: customerPaymentLinksTable.linkName,
    description: customerPaymentLinksTable.description,
    publicToken: customerPaymentLinksTable.publicToken,
    linkStatus: customerPaymentLinksTable.status,
    deletedAt: customerPaymentLinksTable.deletedAt,
    keyId: developerApiKeysTable.id,
    paymentTestAccount: sql<boolean>`exists (
      select 1 from public.sf_replit_payment_test_access a
      where a.user_id=${developerPaymentSessionsTable.userId} and a.state='active'
    )`,
  }).from(developerPaymentSessionsTable)
    .innerJoin(customerPaymentLinksTable, eq(customerPaymentLinksTable.id, developerPaymentSessionsTable.paymentLinkId))
    .innerJoin(developerApiKeysTable, eq(developerApiKeysTable.id, developerPaymentSessionsTable.apiKeyId))
    .innerJoin(usersTable, eq(usersTable.id, developerPaymentSessionsTable.userId))
    .where(and(
      eq(developerPaymentSessionsTable.id, sessionId),
      eq(customerPaymentLinksTable.userId, developerPaymentSessionsTable.userId),
      eq(developerApiKeysTable.userId, developerPaymentSessionsTable.userId),
      eq(developerApiKeysTable.publicKeyHash, hashDeveloperPublicKey(publicKey)),
      eq(developerApiKeysTable.publicKey, publicKey),
      eq(developerApiKeysTable.status, "active"),
      eq(usersTable.status, "active"),
      sql`${usersTable.phoneVerifiedAt} is not null`,
      eq(developerPaymentSessionsTable.clientTokenHash, hashDeveloperClientToken(clientToken)),
      eq(developerPaymentSessionsTable.mode, "direct"),
      eq(customerPaymentLinksTable.source, "api"),
      isNull(customerPaymentLinksTable.deletedAt),
    ))
    .limit(1);
  if (!session || session.paymentTestAccount ||
    (!options.allowExpired && session.expiresAt.getTime() <= Date.now()) ||
    session.linkStatus !== "active" || session.clientTokenHash !== hashDeveloperClientToken(clientToken)) {
    res.status(404).json({ error: "Cette session de paiement n’est pas disponible." });
    return null;
  }
  if (session.apiKeyId !== session.keyId) {
    res.status(404).json({ error: "Cette session de paiement n’est pas disponible." });
    return null;
  }
  if (!await consumeDeveloperApiQuota(session.apiKeyId, "session_read")) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Trop de requêtes API. Réessayez dans une minute." });
    return null;
  }
  if (!await consumePublicPaymentLinkQuota(
    req.ip || req.socket.remoteAddress || "unknown",
    "quote",
  )) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Trop de vérifications de session. Réessayez dans une minute." });
    return null;
  }
  return { ...session, publicKey, clientToken };
}

async function latestLinkFlowAttempt(paymentLinkId: string) {
  const [latest] = await db.select({
    mappingId: customerPaymentLinkAttemptsTable.id,
    intentState: paymentIntentsTable.state,
    attemptState: paymentAttemptsTable.status,
  }).from(customerPaymentLinkAttemptsTable)
    .innerJoin(paymentIntentsTable, eq(paymentIntentsTable.id, customerPaymentLinkAttemptsTable.intentId))
    .innerJoin(paymentAttemptsTable, and(
      eq(paymentAttemptsTable.intentId, paymentIntentsTable.id),
      eq(paymentAttemptsTable.direction, "payin"),
    ))
    .where(eq(customerPaymentLinkAttemptsTable.paymentLinkId, paymentLinkId))
    .orderBy(desc(customerPaymentLinkAttemptsTable.createdAt), desc(customerPaymentLinkAttemptsTable.id))
    .limit(1);
  return latest ?? null;
}

function sessionStateFromAttempt(
  attempt: { intentState: string; attemptState: string } | null,
): "created" | "waiting" | "uncertain" | "succeeded" | "failed" {
  if (!attempt) return "created";
  if (attempt.intentState === "succeeded" && attempt.attemptState === "succeeded") return "succeeded";
  if (attempt.intentState === "failed" || attempt.attemptState === "failed") return "failed";
  if (attempt.intentState === "uncertain" || attempt.attemptState === "uncertain") return "uncertain";
  if (["created", "collecting"].includes(attempt.intentState) ||
    ["prepared", "dispatching", "pending"].includes(attempt.attemptState)) return "waiting";
  return "created";
}

router.get("/me/developer/api-keys", async (req, res): Promise<void> => {
  const session = await requireDeveloperPanelSession(req, res);
  if (!session) return;
  try {
    const items = await db.select().from(developerApiKeysTable)
      .where(eq(developerApiKeysTable.userId, session.userId))
      .orderBy(desc(developerApiKeysTable.createdAt), desc(developerApiKeysTable.id));
    res.json(ListDeveloperApiKeysResponse.parse({ items: items.map(safeKeyResponse) }));
  } catch {
    req.log.error({ userId: session.userId }, "Developer API keys could not be listed");
    res.status(503).json({ error: "Les clés API sont momentanément indisponibles." });
  }
});

router.post("/me/developer/api-keys", async (req, res): Promise<void> => {
  const session = await requireDeveloperPanelSession(req, res);
  if (!session) return;
  if (await hasPaymentTestAccess(session.userId) || !isPaymentLinkCreationAllowed(session)) {
    res.status(403).json({ error: "Les clés de paiement live ne sont pas disponibles pour ce compte d’essai." });
    return;
  }
  const parsed = CreateDeveloperApiKeyBody.safeParse(req.body);
  const label = parsed.success ? parsed.data.label.trim() : "";
  if (!parsed.success || !label || label.length > 80) {
    res.status(400).json({ error: "Donnez un nom valide à cette clé API." });
    return;
  }
  try {
    const activeKeys = await db.select({ id: developerApiKeysTable.id })
      .from(developerApiKeysTable)
      .where(and(
        eq(developerApiKeysTable.userId, session.userId),
        eq(developerApiKeysTable.status, "active"),
      ));
    if (activeKeys.length >= 5) {
      res.status(400).json({ error: "La limite de cinq paires de clés actives est atteinte." });
      return;
    }
    const keys = createDeveloperApiKeyMaterial();
    const { secretKey, ...storedKeys } = keys;
    const [created] = await db.insert(developerApiKeysTable).values({
      userId: session.userId,
      label,
      ...storedKeys,
    }).returning();
    if (!created) throw new Error("API key insert returned no row");
    res.status(201).json(CreateDeveloperApiKeyResponse.parse({
      key: safeKeyResponse(created),
      publicKey: keys.publicKey,
      secretKey,
    }));
  } catch {
    req.log.error({ userId: session.userId }, "Developer API key could not be created");
    res.status(503).json({ error: "La création de la clé API est momentanément indisponible." });
  }
});

router.delete("/me/developer/api-keys/:apiKeyId", async (req, res): Promise<void> => {
  const session = await requireDeveloperPanelSession(req, res);
  if (!session) return;
  const params = RevokeDeveloperApiKeyParams.safeParse(req.params);
  if (!params.success || !uuidPattern.test(params.data.apiKeyId)) {
    res.status(404).json({ error: "Clé API introuvable." });
    return;
  }
  try {
    const now = new Date();
    const [revoked] = await db.update(developerApiKeysTable).set({
      status: "revoked",
      revokedAt: now,
      updatedAt: now,
    }).where(and(
      eq(developerApiKeysTable.id, params.data.apiKeyId),
      eq(developerApiKeysTable.userId, session.userId),
      eq(developerApiKeysTable.status, "active"),
    )).returning({ id: developerApiKeysTable.id });
    if (!revoked) {
      res.status(404).json({ error: "Clé API introuvable." });
      return;
    }
    res.status(204).end();
  } catch {
    req.log.error({ userId: session.userId }, "Developer API key could not be revoked");
    res.status(503).json({ error: "La révocation de la clé API est momentanément indisponible." });
  }
});

router.get("/me/developer/webhooks", async (req, res): Promise<void> => {
  const session = await requireDeveloperPanelSession(req, res);
  if (!session) return;
  try {
    const items = await db.select().from(developerWebhookEndpointsTable)
      .where(eq(developerWebhookEndpointsTable.userId, session.userId))
      .orderBy(desc(developerWebhookEndpointsTable.createdAt), desc(developerWebhookEndpointsTable.id));
    res.json(ListDeveloperWebhooksResponse.parse({ items: items.map(safeWebhookResponse) }));
  } catch {
    req.log.error({ userId: session.userId }, "Developer webhook endpoints could not be listed");
    res.status(503).json({ error: "Les webhooks sont momentanément indisponibles." });
  }
});

router.post("/me/developer/webhooks", async (req, res): Promise<void> => {
  const session = await requireDeveloperPanelSession(req, res);
  if (!session) return;
  const parsed = CreateDeveloperWebhookBody.safeParse(req.body);
  if (
    !parsed.success
    || !parsed.data.label.trim()
    || parsed.data.label.trim().length > 80
    || new Set(parsed.data.events).size !== parsed.data.events.length
  ) {
    res.status(400).json({ error: "Vérifiez le nom, l’adresse HTTPS et les événements sélectionnés." });
    return;
  }
  let target: Awaited<ReturnType<typeof resolvePublicWebhookTarget>>;
  try {
    target = await resolvePublicWebhookTarget(parsed.data.url);
  } catch {
    res.status(400).json({ error: "L’adresse webhook doit être publique, sûre et accessible en HTTPS." });
    return;
  }
  try {
    const active = await db.select({ id: developerWebhookEndpointsTable.id })
      .from(developerWebhookEndpointsTable)
      .where(and(
        eq(developerWebhookEndpointsTable.userId, session.userId),
        eq(developerWebhookEndpointsTable.status, "active"),
      ));
    if (active.length >= 5) {
      res.status(400).json({ error: "La limite de cinq webhooks actifs est atteinte." });
      return;
    }
    const signingSecret = `whsec_${randomBytes(32).toString("base64url")}`;
    const [created] = await db.insert(developerWebhookEndpointsTable).values({
      userId: session.userId,
      label: parsed.data.label.trim(),
      urlEncrypted: encryptSensitiveData(target.url, "developer-webhook-url"),
      events: [...new Set(parsed.data.events)],
      signingSecretEncrypted: encryptSensitiveData(signingSecret, "developer-webhook-secret"),
    }).returning();
    if (!created) throw new Error("Webhook endpoint insert returned no row");
    res.status(201).json(CreateDeveloperWebhookResponse.parse({
      endpoint: safeWebhookResponse(created),
      signingSecret,
    }));
  } catch {
    req.log.error({ userId: session.userId }, "Developer webhook endpoint could not be created");
    res.status(503).json({ error: "La création du webhook est momentanément indisponible." });
  }
});

router.delete("/me/developer/webhooks/:endpointId", async (req, res): Promise<void> => {
  const session = await requireDeveloperPanelSession(req, res);
  if (!session) return;
  const params = RevokeDeveloperWebhookParams.safeParse(req.params);
  if (!params.success || !uuidPattern.test(params.data.endpointId)) {
    res.status(404).json({ error: "Webhook introuvable." });
    return;
  }
  try {
    const now = new Date();
    const [revoked] = await db.update(developerWebhookEndpointsTable).set({
      status: "revoked",
      revokedAt: now,
      updatedAt: now,
    }).where(and(
      eq(developerWebhookEndpointsTable.id, params.data.endpointId),
      eq(developerWebhookEndpointsTable.userId, session.userId),
      eq(developerWebhookEndpointsTable.status, "active"),
    )).returning({ id: developerWebhookEndpointsTable.id });
    if (!revoked) {
      res.status(404).json({ error: "Webhook introuvable." });
      return;
    }
    res.status(204).end();
  } catch {
    req.log.error({ userId: session.userId }, "Developer webhook endpoint could not be revoked");
    res.status(503).json({ error: "La désactivation du webhook est momentanément indisponible." });
  }
});

router.get("/me/developer/webhooks/:endpointId/deliveries", async (req, res): Promise<void> => {
  const session = await requireDeveloperPanelSession(req, res);
  if (!session) return;
  const params = ListDeveloperWebhookDeliveriesParams.safeParse(req.params);
  if (!params.success || !uuidPattern.test(params.data.endpointId)) {
    res.status(404).json({ error: "Webhook introuvable." });
    return;
  }
  try {
    const [endpoint] = await db.select({ id: developerWebhookEndpointsTable.id })
      .from(developerWebhookEndpointsTable)
      .where(and(
        eq(developerWebhookEndpointsTable.id, params.data.endpointId),
        eq(developerWebhookEndpointsTable.userId, session.userId),
      )).limit(1);
    if (!endpoint) {
      res.status(404).json({ error: "Webhook introuvable." });
      return;
    }
    const items = await db.select({
      id: developerWebhookDeliveriesTable.id,
      eventType: developerWebhookDeliveriesTable.eventType,
      status: developerWebhookDeliveriesTable.status,
      attempts: developerWebhookDeliveriesTable.attempts,
      lastHttpStatus: developerWebhookDeliveriesTable.lastHttpStatus,
      lastErrorClass: developerWebhookDeliveriesTable.lastErrorClass,
      createdAt: developerWebhookDeliveriesTable.createdAt,
      lastAttemptAt: developerWebhookDeliveriesTable.lastAttemptAt,
      deliveredAt: developerWebhookDeliveriesTable.deliveredAt,
    }).from(developerWebhookDeliveriesTable)
      .where(eq(developerWebhookDeliveriesTable.endpointId, endpoint.id))
      .orderBy(desc(developerWebhookDeliveriesTable.createdAt), desc(developerWebhookDeliveriesTable.id))
      .limit(20);
    res.json(ListDeveloperWebhookDeliveriesResponse.parse({ items: items.map((item) => ({
      ...item,
      lastHttpStatus: item.lastHttpStatus ? Number(item.lastHttpStatus) : null,
    })) }));
  } catch {
    req.log.error({ userId: session.userId }, "Developer webhook deliveries could not be listed");
    res.status(503).json({ error: "L’historique webhook est momentanément indisponible." });
  }
});

router.post("/v1/payment-sessions", async (req, res): Promise<void> => {
  const key = await requireSecretApiKey(req, res);
  if (!key) return;
  if (!isLinkFlowPaymentExecutionEnabled()) {
    res.status(503).json({
      error: "La création des paiements API reste désactivée jusqu’à l’activation de la confirmation serveur du prestataire.",
    });
    return;
  }
  const parsedHeader = CreateDeveloperPaymentSessionHeader.safeParse({
    "Idempotency-Key": req.get("Idempotency-Key"),
  });
  const parsedBody = CreateDeveloperPaymentSessionBody.safeParse(req.body);
  if (!parsedHeader.success || !parsedBody.success) {
    res.status(400).json({ error: "Vérifiez le montant, la devise, la référence et le mode de paiement." });
    return;
  }
  const idempotencyKey = parsedHeader.data["Idempotency-Key"];
  if (idempotencyKey.trim() !== idempotencyKey) {
    res.status(400).json({ error: "La clé Idempotency-Key est invalide." });
    return;
  }
  let metadata: Record<string, unknown>;
  let normalized: ReturnType<typeof normalizePaymentLinkInput>;
  let requestHash: string;
  try {
    metadata = normalizeMetadata(parsedBody.data.metadata);
    normalized = normalizePaymentLinkInput({
      requestId: randomUUID(),
      currency: "XOF",
      amount: String(parsedBody.data.amountMinor),
      linkName: "Paiement en ligne",
      description: parsedBody.data.description?.trim() || `Paiement ${parsedBody.data.merchantReference}`.slice(0, 240),
      paymentMethod: "mobile_money",
      validity: "hour",
      maximumUses: 1,
      returnUrl: parsedBody.data.returnUrl ?? null,
      suffix: null,
    });
    requestHash = hashDeveloperRequest({
      ...parsedBody.data,
      returnUrl: normalized.returnUrl,
      description: normalized.description,
      metadata,
    });
  } catch (error) {
    if (error instanceof PaymentLinkInputError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof Error && error.message === "metadata_too_large") {
      res.status(400).json({ error: "Les métadonnées dépassent la limite de 8 Ko." });
      return;
    }
    res.status(400).json({ error: "Les données de la session de paiement sont invalides." });
    return;
  }
  if (!await consumeDeveloperApiQuota(key.id, "session_create") ||
    !await consumePaymentLinkCreationQuota(key.userId)) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Trop de créations de paiement. Réessayez dans une minute." });
    return;
  }
  try {
    const [existing] = await db.select().from(developerPaymentSessionsTable)
      .where(and(
        eq(developerPaymentSessionsTable.userId, key.userId),
        eq(developerPaymentSessionsTable.idempotencyKey, idempotencyKey),
      )).limit(1);
    if (existing) {
      if (existing.requestHash !== requestHash || existing.apiKeyId !== key.id) {
        res.status(409).json({ error: "Cette clé Idempotency-Key a déjà été utilisée avec une autre demande." });
        return;
      }
      const [existingLink] = await db.select({
        publicToken: customerPaymentLinksTable.publicToken,
      }).from(customerPaymentLinksTable)
        .where(eq(customerPaymentLinksTable.id, existing.paymentLinkId))
        .limit(1);
      if (!existingLink) throw new Error("Existing session link missing");
      const clientToken = decryptSensitiveData(existing.clientTokenEncrypted, "developer-client-token");
      const latest = await latestLinkFlowAttempt(existing.paymentLinkId);
      res.status(201).json(CreateDeveloperPaymentSessionResponse.parse({
        id: existing.id,
        merchantReference: existing.merchantReference,
        mode: existing.mode,
        state: sessionStateFromAttempt(latest),
        amountMinor: existing.amountMinor,
        currency: existing.currency,
        checkoutPath: existing.mode === "hosted" ? `/pay/${existingLink.publicToken}` : null,
        clientToken,
        publicKey: key.publicKey,
        expiresAt: existing.expiresAt,
      }));
      return;
    }
    const [merchant] = await db.select({
      displayName: usersTable.displayName,
      phoneVerifiedAt: usersTable.phoneVerifiedAt,
      status: usersTable.status,
    }).from(usersTable).where(eq(usersTable.id, key.userId)).limit(1);
    const [wallet] = await db.select({ id: walletsTable.id, status: walletsTable.status, currency: walletsTable.currency })
      .from(walletsTable).where(eq(walletsTable.userId, key.userId)).limit(1);
    if (!merchant || merchant.status !== "active" || !merchant.phoneVerifiedAt ||
      !wallet || wallet.status !== "active" || wallet.currency !== "XOF") {
      res.status(403).json({ error: "Le compte marchand n’est pas prêt à recevoir des paiements." });
      return;
    }
    const displayName = formatCustomerDisplayName(
      decryptSensitiveDataIfEncrypted(merchant.displayName, "user-name"),
    );
    const merchantName = displayName && displayName.length >= 2
      ? displayName.slice(0, 120)
      : "Paiement en ligne";
    const publicToken = createPaymentLinkPublicToken();
    const clientToken = createDeveloperClientToken();
    const expiresAt = normalized.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000);
    const outcome = await db.transaction(async (tx) => {
      const [link] = await tx.insert(customerPaymentLinksTable).values({
        userId: key.userId,
        publicToken,
        idempotencyKey: normalized.requestId,
        requestHash: normalized.requestHash,
        currency: "XOF",
        amountMinor: parsedBody.data.amountMinor,
        linkName: merchantName,
        description: normalized.description,
        paymentMethod: "mobile_money",
        source: "api",
        expiresAt,
        maximumUses: 1,
        returnUrl: normalized.returnUrl,
        status: "active",
      }).returning({ id: customerPaymentLinksTable.id });
      if (!link) throw new Error("Developer payment link insert returned no row");
      const [created] = await tx.insert(developerPaymentSessionsTable).values({
        userId: key.userId,
        apiKeyId: key.id,
        paymentLinkId: link.id,
        idempotencyKey,
        merchantReference: parsedBody.data.merchantReference.trim(),
        requestHash,
        clientTokenHash: hashDeveloperClientToken(clientToken),
        clientTokenEncrypted: encryptSensitiveData(clientToken, "developer-client-token"),
        mode: parsedBody.data.mode,
        amountMinor: parsedBody.data.amountMinor,
        currency: "XOF",
        metadataEncrypted: encryptSensitiveData(JSON.stringify(metadata), "developer-payment-metadata"),
        expiresAt,
      }).returning();
      if (!created) throw new Error("Developer payment session insert returned no row");
      return { session: created, publicToken };
    });
    res.status(201).json(CreateDeveloperPaymentSessionResponse.parse({
      id: outcome.session.id,
      merchantReference: outcome.session.merchantReference,
      mode: outcome.session.mode,
      state: "created",
      amountMinor: outcome.session.amountMinor,
      currency: outcome.session.currency,
      checkoutPath: outcome.session.mode === "hosted" ? `/pay/${outcome.publicToken}` : null,
      clientToken,
      publicKey: key.publicKey,
      expiresAt: outcome.session.expiresAt,
    }));
  } catch {
    try {
      const [existing] = await db.select().from(developerPaymentSessionsTable)
        .where(and(
          eq(developerPaymentSessionsTable.userId, key.userId),
          eq(developerPaymentSessionsTable.idempotencyKey, idempotencyKey),
        )).limit(1);
      if (existing) {
        if (existing.requestHash !== requestHash || existing.apiKeyId !== key.id) {
          res.status(409).json({ error: "Cette clé Idempotency-Key a déjà été utilisée avec une autre demande." });
          return;
        }
        const [existingLink] = await db.select({
          publicToken: customerPaymentLinksTable.publicToken,
        }).from(customerPaymentLinksTable)
          .where(eq(customerPaymentLinksTable.id, existing.paymentLinkId))
          .limit(1);
        if (!existingLink) throw new Error("Existing session link missing");
        const clientToken = decryptSensitiveData(existing.clientTokenEncrypted, "developer-client-token");
        const latest = await latestLinkFlowAttempt(existing.paymentLinkId);
        res.status(201).json(CreateDeveloperPaymentSessionResponse.parse({
          id: existing.id,
          merchantReference: existing.merchantReference,
          mode: existing.mode,
          state: sessionStateFromAttempt(latest),
          amountMinor: existing.amountMinor,
          currency: existing.currency,
          checkoutPath: existing.mode === "hosted" ? `/pay/${existingLink.publicToken}` : null,
          clientToken,
          publicKey: key.publicKey,
          expiresAt: existing.expiresAt,
        }));
        return;
      }
      const [referenceCollision] = await db.select({ id: developerPaymentSessionsTable.id })
        .from(developerPaymentSessionsTable)
        .where(and(
          eq(developerPaymentSessionsTable.userId, key.userId),
          eq(developerPaymentSessionsTable.merchantReference, parsedBody.data.merchantReference.trim()),
        )).limit(1);
      if (referenceCollision) {
        res.status(409).json({ error: "Cette référence marchand a déjà été utilisée." });
        return;
      }
    } catch {
      // Keep the generic response if the recovery lookup itself is unavailable.
    }
    req.log.error({ userId: key.userId, keyId: key.id }, "Developer payment session could not be created");
    res.status(503).json({ error: "La session de paiement est momentanément indisponible." });
  }
});

router.get("/v1/payment-sessions/:sessionId", async (req, res): Promise<void> => {
  const key = await requireSecretApiKey(req, res);
  if (!key) return;
  const params = GetDeveloperPaymentSessionParams.safeParse(req.params);
  if (!params.success || !uuidPattern.test(params.data.sessionId)) {
    res.status(404).json({ error: "Session de paiement introuvable." });
    return;
  }
  try {
    const [session] = await db.select().from(developerPaymentSessionsTable)
      .where(and(
        eq(developerPaymentSessionsTable.id, params.data.sessionId),
        eq(developerPaymentSessionsTable.userId, key.userId),
        eq(developerPaymentSessionsTable.apiKeyId, key.id),
      )).limit(1);
    if (!session) {
      res.status(404).json({ error: "Session de paiement introuvable." });
      return;
    }
    const latest = await latestLinkFlowAttempt(session.paymentLinkId);
    const current = latest ? await getLinkFlowPaymentAttemptStatusByMappingId(latest.mappingId) : null;
    const state = current?.state ?? sessionStateFromAttempt(latest);
    res.json(GetDeveloperPaymentSessionResponse.parse({
      id: session.id,
      merchantReference: session.merchantReference,
      mode: session.mode,
      state,
      amountMinor: session.amountMinor,
      currency: session.currency,
      attemptId: latest?.mappingId ?? null,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));
  } catch (error) {
    if (error instanceof LinkFlowPaymentError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    req.log.error({ userId: key.userId, keyId: key.id }, "Developer payment session status could not be read");
    res.status(503).json({ error: "Le statut de paiement est momentanément indisponible." });
  }
});

router.get("/v1/public/payment-sessions/:sessionId", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, private");
  const params = GetDeveloperPublicPaymentSessionParams.safeParse(req.params);
  if (!params.success || !uuidPattern.test(params.data.sessionId)) {
    res.status(404).json({ error: "Cette session de paiement n’est pas disponible." });
    return;
  }
  try {
    const session = await readPublicSessionCredentials(req, res, params.data.sessionId);
    if (!session) return;
    const [link] = await db.select({
      name: customerPaymentLinksTable.linkName,
      description: customerPaymentLinksTable.description,
    }).from(customerPaymentLinksTable)
      .where(eq(customerPaymentLinksTable.id, session.paymentLinkId))
      .limit(1);
    if (!link) {
      res.status(404).json({ error: "Cette session de paiement n’est pas disponible." });
      return;
    }
    const latest = await latestLinkFlowAttempt(session.paymentLinkId);
    const state = sessionStateFromAttempt(latest);
    const countries = state === "succeeded" ? [] : await getPublicPaymentLinkChoices(session.publicToken);
    if (!countries) {
      res.status(404).json({ error: "Cette session de paiement n’est pas disponible." });
      return;
    }
    res.json(GetDeveloperPublicPaymentSessionResponse.parse({
      id: params.data.sessionId,
      merchantName: link.name?.trim() || "SendFlow",
      description: link.description,
      mode: session.mode,
      state,
      amountMinor: session.amountMinor,
      currency: session.currency,
      expiresAt: session.expiresAt,
      countries,
    }));
  } catch {
    res.status(503).json({ error: "Les informations du paiement sont momentanément indisponibles." });
  }
});

router.post("/v1/public/payment-sessions/:sessionId/attempts", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, private");
  const params = StartDeveloperDirectPaymentParams.safeParse(req.params);
  const headers = StartDeveloperDirectPaymentHeader.safeParse({
    "X-SendFlow-Public-Key": req.get("X-SendFlow-Public-Key"),
    "X-SendFlow-Client-Token": req.get("X-SendFlow-Client-Token"),
    "Idempotency-Key": req.get("Idempotency-Key"),
  });
  const body = StartDeveloperDirectPaymentBody.safeParse(req.body);
  if (!params.success || !headers.success || !body.success) {
    res.status(400).json({ error: "Les informations de paiement sont invalides." });
    return;
  }
  const publicKey = headers.data["X-SendFlow-Public-Key"];
  const clientToken = headers.data["X-SendFlow-Client-Token"];
  if (!publicKeyPattern.test(publicKey) || !clientTokenPattern.test(clientToken) ||
    headers.data["Idempotency-Key"].trim() !== headers.data["Idempotency-Key"]) {
    res.status(404).json({ error: "Cette session de paiement n’est pas disponible." });
    return;
  }
  try {
    const session = await readPublicSessionCredentials(req, res, params.data.sessionId);
    if (!session) return;
    if (!await consumeDeveloperApiQuota(session.apiKeyId, "direct_attempt") ||
      !await consumePublicPaymentLinkQuota(req.ip || req.socket.remoteAddress || "unknown", "attempt")) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Trop de demandes de paiement. Réessayez dans une minute." });
      return;
    }
    const result = await startLinkFlowPaymentAttempt(session.publicToken, {
      ...body.data,
      amount: String(session.amountMinor),
      idempotencyKey: deriveDeveloperAttemptIdempotencyKey(params.data.sessionId, headers.data["Idempotency-Key"]),
    });
    res.status(201).json(StartDeveloperDirectPaymentResponse.parse({
      id: params.data.sessionId,
      attemptId: result.attemptId,
      state: result.state,
      amountMinor: result.amountMinor,
      currency: result.currency,
      ussdCode: result.ussdCode,
      pollToken: result.pollToken,
      merchantReference: session.merchantReference,
    }));
  } catch (error) {
    if (error instanceof LinkFlowPaymentError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    req.log.error({ path: req.path }, "Developer direct payment attempt could not be started");
    res.status(503).json({ error: "Le paiement est momentanément indisponible. Aucun résultat définitif n’a été confirmé." });
  }
});

router.get("/v1/public/payment-sessions/:sessionId/attempts/:attemptId", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, private");
  const params = GetDeveloperDirectPaymentStatusParams.safeParse(req.params);
  const headers = GetDeveloperDirectPaymentStatusHeader.safeParse({
    "X-SendFlow-Public-Key": req.get("X-SendFlow-Public-Key"),
    "X-SendFlow-Client-Token": req.get("X-SendFlow-Client-Token"),
    "X-LinkFlow-Attempt-Token": req.get("X-LinkFlow-Attempt-Token"),
  });
  if (!params.success || !headers.success || !uuidPattern.test(params.data.sessionId) ||
    !uuidPattern.test(params.data.attemptId) ||
    !publicKeyPattern.test(headers.data["X-SendFlow-Public-Key"]) ||
    !clientTokenPattern.test(headers.data["X-SendFlow-Client-Token"]) ||
    !pollTokenPattern.test(headers.data["X-LinkFlow-Attempt-Token"])) {
    res.status(404).json({ error: "Cette demande de paiement n’est pas disponible." });
    return;
  }
  try {
    const session = await readPublicSessionCredentials(req, res, params.data.sessionId, { allowExpired: true });
    if (!session) return;
    if (!await consumeDeveloperApiQuota(session.apiKeyId, "direct_poll") ||
      !await consumePublicPaymentLinkQuota(req.ip || req.socket.remoteAddress || "unknown", "poll")) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Trop de vérifications du paiement. Réessayez dans une minute." });
      return;
    }
    const [mapping] = await db.select({ id: customerPaymentLinkAttemptsTable.id })
      .from(customerPaymentLinkAttemptsTable)
      .where(and(
        eq(customerPaymentLinkAttemptsTable.id, params.data.attemptId),
        eq(customerPaymentLinkAttemptsTable.paymentLinkId, session.paymentLinkId),
      )).limit(1);
    if (!mapping) {
      res.status(404).json({ error: "Cette demande de paiement n’est pas disponible." });
      return;
    }
    const result = await getLinkFlowPaymentAttemptStatus(
      mapping.id,
      headers.data["X-LinkFlow-Attempt-Token"],
    );
    res.json(GetDeveloperDirectPaymentStatusResponse.parse({
      id: params.data.sessionId,
      attemptId: result.attemptId,
      state: result.state,
      amountMinor: result.amountMinor,
      currency: result.currency,
      ussdCode: result.ussdCode,
      pollToken: headers.data["X-LinkFlow-Attempt-Token"],
      merchantReference: session.merchantReference,
    }));
  } catch (error) {
    if (error instanceof LinkFlowPaymentError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(503).json({ error: "La vérification du paiement est momentanément indisponible." });
  }
});

export default router;
