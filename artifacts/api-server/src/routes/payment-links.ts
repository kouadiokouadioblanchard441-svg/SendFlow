import {
  and,
  customerPaymentLinksTable,
  customerPaymentLinkAttemptsTable,
  db,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  paymentAttemptsTable,
  paymentIntentsTable,
  or,
} from "@workspace/db";
import {
  CreateCustomerPaymentLinkBody,
  CreateCustomerPaymentLinkResponse,
  DeleteCustomerPaymentLinkParams,
  GetCustomerPaymentLinksQueryParams,
  GetCustomerPaymentLinksResponse,
  GetCustomerPaymentLinkParams,
  GetCustomerPaymentLinkResponse,
  SimulateCustomerPaymentLinkBody,
  SimulateCustomerPaymentLinkParams,
  SimulateCustomerPaymentLinkResponse,
  UpdateCustomerPaymentLinkBody,
  UpdateCustomerPaymentLinkParams,
  UpdateCustomerPaymentLinkResponse,
} from "@workspace/api-zod";
import express, { Router, type IRouter, type RequestHandler } from "express";
import { consumePaymentLinkCreationQuota, consumePublicPaymentLinkQuota } from "../data/payment-link-quota";
import { loadPaymentLimits } from "../data/payment-limits";
import { requireCustomerSession } from "../lib/customer-session";
import {
  createPaymentLinkPublicToken,
  getPaymentLinkCurrencyDecimals,
  isPaymentLinkCreationAllowed,
  normalizePaymentLinkImage,
  normalizePaymentLinkInput,
  parseLinkFlowPayerAmount,
  parsePaymentLinkAmountInput,
  PaymentLinkIdempotencyConflict,
  PaymentLinkImageError,
  PaymentLinkInputError,
  PAYMENT_LINK_IMAGE_MAX_BYTES,
  PAYMENT_LINK_IMAGE_MIME_TYPES,
  PAYMENT_LINK_CURRENCIES,
  PAYMENT_LINK_METHODS,
  PAYMENT_LINK_VALIDITIES,
  isPaymentLinkSimulationAllowed,
} from "../services/payment-links";

const router: IRouter = Router();

async function requirePaymentLinkSession(req: Parameters<typeof requireCustomerSession>[0], res: Parameters<typeof requireCustomerSession>[1]) {
  const session = await requireCustomerSession(req, res, false);
  if (!session) return null;
  const viewerWithoutPin = isPaymentLinkSimulationAllowed(session);
  if (!viewerWithoutPin && (!session.pinConfigured || !session.pinUnlocked)) {
    res.status(403).json({ error: "PIN verification required" });
    return null;
  }
  return session;
}

const paymentLinkResponseColumns = {
  id: customerPaymentLinksTable.id,
  publicToken: customerPaymentLinksTable.publicToken,
  linkName: customerPaymentLinksTable.linkName,
  currency: customerPaymentLinksTable.currency,
  amountMinor: customerPaymentLinksTable.amountMinor,
  description: customerPaymentLinksTable.description,
  paymentMethod: customerPaymentLinksTable.paymentMethod,
  expiresAt: customerPaymentLinksTable.expiresAt,
  maximumUses: customerPaymentLinksTable.maximumUses,
  usageCount: customerPaymentLinksTable.usageCount,
  returnUrl: customerPaymentLinksTable.returnUrl,
  customSuffix: customerPaymentLinksTable.customSuffix,
  status: customerPaymentLinksTable.status,
  createdAt: customerPaymentLinksTable.createdAt,
} as const;
const paymentLinkIdempotencyColumns = {
  ...paymentLinkResponseColumns,
  requestHash: customerPaymentLinksTable.requestHash,
  deletedAt: customerPaymentLinksTable.deletedAt,
} as const;
const supportedImageMimeTypes = [...PAYMENT_LINK_IMAGE_MIME_TYPES];
const parsePaymentLinkImageBody = express.raw({
  type: supportedImageMimeTypes,
  limit: PAYMENT_LINK_IMAGE_MAX_BYTES,
  inflate: false,
});
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeErrorTypes = new Set(["TypeError", "RangeError", "ReferenceError", "SyntaxError", "ZodError"]);
const activeLinkPaymentAttemptStates = ["prepared", "dispatching", "pending", "uncertain", "succeeded"] as const;
const activeLinkPaymentIntentStates = ["created", "collecting", "uncertain"] as const;

function getSafeErrorType(error: unknown) {
  if (!(error instanceof Error)) return "UnknownError";
  return safeErrorTypes.has(error.name) ? error.name : "Error";
}

function toResponse(row: Pick<
  typeof customerPaymentLinksTable.$inferSelect,
  | "id"
  | "publicToken"
   | "linkName"
  | "currency"
  | "amountMinor"
  | "description"
  | "paymentMethod"
  | "expiresAt"
  | "maximumUses"
  | "usageCount"
  | "returnUrl"
  | "customSuffix"
  | "status"
  | "createdAt"
>) {
  return {
    id: row.id,
    code: row.publicToken.slice(0, 8),
    linkName: row.linkName,
    sharePath: `/pay/${row.publicToken}`,
    currency: row.currency,
    currencyDecimals: getPaymentLinkCurrencyDecimals(row.currency),
    amountMinor: row.amountMinor,
    description: row.description,
    paymentMethod: row.paymentMethod,
    expiresAt: row.expiresAt,
    maximumUses: row.maximumUses,
    usageCount: row.usageCount,
    returnUrl: row.returnUrl,
    suffix: row.customSuffix,
    status: row.status,
    createdAt: row.createdAt,
  };
}

router.get("/me/payment-links", async (req, res): Promise<void> => {
  const session = await requirePaymentLinkSession(req, res);
  if (!session) return;
  res.setHeader("Cache-Control", "no-store, private");

  const parsed = GetCustomerPaymentLinksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Les paramètres de pagination sont invalides." });
    return;
  }

  try {
    const { cursor, limit } = parsed.data;
    const conditions = [
      eq(customerPaymentLinksTable.userId, session.userId),
      eq(customerPaymentLinksTable.source, "linkflow"),
      isNull(customerPaymentLinksTable.deletedAt),
    ];
    if (cursor) {
      const [cursorRow] = await db.select({
        id: customerPaymentLinksTable.id,
        createdAt: customerPaymentLinksTable.createdAt,
      }).from(customerPaymentLinksTable).where(and(
        eq(customerPaymentLinksTable.id, cursor),
        eq(customerPaymentLinksTable.userId, session.userId),
        eq(customerPaymentLinksTable.source, "linkflow"),
        isNull(customerPaymentLinksTable.deletedAt),
      )).limit(1);
      if (!cursorRow) {
        res.status(400).json({ error: "Le curseur de pagination est invalide." });
        return;
      }
      conditions.push(or(
        lt(customerPaymentLinksTable.createdAt, cursorRow.createdAt),
        and(
          eq(customerPaymentLinksTable.createdAt, cursorRow.createdAt),
          lt(customerPaymentLinksTable.id, cursorRow.id),
        ),
      )!);
    }

    const rows = await db.select(paymentLinkResponseColumns).from(customerPaymentLinksTable)
      .where(and(...conditions))
      .orderBy(desc(customerPaymentLinksTable.createdAt), desc(customerPaymentLinksTable.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const result = {
      items: page.map(toResponse),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
      currencyOptions: PAYMENT_LINK_CURRENCIES,
      paymentMethods: PAYMENT_LINK_METHODS,
      validityOptions: PAYMENT_LINK_VALIDITIES,
    };
    res.json(GetCustomerPaymentLinksResponse.parse(result));
  } catch (error) {
    req.log.error({ err: error, userId: session.userId }, "Customer payment links could not be listed");
    res.status(503).json({ error: "Les liens de paiement sont momentanément indisponibles." });
  }
});

router.get("/me/payment-links/:linkId", async (req, res): Promise<void> => {
  const session = await requirePaymentLinkSession(req, res);
  if (!session) return;
  res.setHeader("Cache-Control", "no-store, private");

  const params = GetCustomerPaymentLinkParams.safeParse(req.params);
  if (!params.success || !uuidPattern.test(params.data.linkId)) {
    res.status(404).json({ error: "Lien introuvable." });
    return;
  }

  try {
    const [link] = await db.select(paymentLinkResponseColumns).from(customerPaymentLinksTable).where(and(
      eq(customerPaymentLinksTable.id, params.data.linkId),
      eq(customerPaymentLinksTable.userId, session.userId),
      eq(customerPaymentLinksTable.source, "linkflow"),
      isNull(customerPaymentLinksTable.deletedAt),
    )).limit(1);
    if (!link) {
      res.status(404).json({ error: "Lien introuvable." });
      return;
    }
    res.json(GetCustomerPaymentLinkResponse.parse(toResponse(link)));
  } catch (error) {
    req.log.error({ err: error, userId: session.userId }, "Customer payment link could not be read");
    res.status(503).json({ error: "Les informations du lien sont momentanément indisponibles." });
  }
});

router.patch("/me/payment-links/:linkId", async (req, res): Promise<void> => {
  const session = await requirePaymentLinkSession(req, res);
  if (!session) return;
  res.setHeader("Cache-Control", "no-store, private");

  const params = UpdateCustomerPaymentLinkParams.safeParse(req.params);
  if (!params.success || !uuidPattern.test(params.data.linkId)) {
    res.status(404).json({ error: "Lien introuvable." });
    return;
  }
  const parsed = UpdateCustomerPaymentLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Vérifiez les modifications du lien." });
    return;
  }
  if (
    parsed.data.amount === undefined
    && parsed.data.description === undefined
    && parsed.data.maximumUses === undefined
  ) {
    res.status(400).json({ error: "Aucune modification n’a été fournie." });
    return;
  }

  try {
    const paymentLimits = await loadPaymentLimits();
    const outcome = await db.transaction(async (tx) => {
      const [link] = await tx.select().from(customerPaymentLinksTable).where(and(
        eq(customerPaymentLinksTable.id, params.data.linkId),
        eq(customerPaymentLinksTable.userId, session.userId),
        eq(customerPaymentLinksTable.source, "linkflow"),
        isNull(customerPaymentLinksTable.deletedAt),
      )).for("update").limit(1);

      if (!link) return { kind: "not_found" as const };
      if (
        !["draft", "active"].includes(link.status)
        || (link.expiresAt !== null && link.expiresAt.getTime() <= Date.now())
      ) {
        return { kind: "conflict" as const, message: "Ce lien n’est plus modifiable." };
      }

      const amountMinor = parsed.data.amount === undefined
        ? link.amountMinor
        : parsePaymentLinkAmountInput(parsed.data.amount, link.currency, paymentLimits);
      const description = parsed.data.description === undefined
        ? link.description
        : parsed.data.description.trim();
      if (description.length > 240) {
        throw new PaymentLinkInputError("La description ne peut pas dépasser 240 caractères.");
      }
      const maximumUses = parsed.data.maximumUses === undefined
        ? link.maximumUses
        : parsed.data.maximumUses;
      if (
        maximumUses !== null
        && (!Number.isSafeInteger(maximumUses) || maximumUses < 1 || maximumUses > 999_999)
      ) {
        throw new PaymentLinkInputError("La limite d’utilisations est invalide.");
      }
      if (maximumUses !== null && maximumUses < link.usageCount) {
        throw new PaymentLinkInputError("La limite ne peut pas être inférieure aux utilisations déjà enregistrées.");
      }
      if (maximumUses !== null) {
        const activeReservations = await tx.select({ id: customerPaymentLinkAttemptsTable.id })
          .from(customerPaymentLinkAttemptsTable)
          .innerJoin(paymentIntentsTable, eq(paymentIntentsTable.id, customerPaymentLinkAttemptsTable.intentId))
          .innerJoin(paymentAttemptsTable, and(
            eq(paymentAttemptsTable.intentId, paymentIntentsTable.id),
            eq(paymentAttemptsTable.direction, "payin"),
          ))
          .where(and(
            eq(customerPaymentLinkAttemptsTable.paymentLinkId, link.id),
            inArray(paymentAttemptsTable.status, activeLinkPaymentAttemptStates),
            inArray(paymentIntentsTable.state, activeLinkPaymentIntentStates),
          ));
        if (maximumUses < link.usageCount + activeReservations.length) {
          return {
            kind: "conflict" as const,
            message: "La limite ne peut pas être inférieure aux paiements déjà en cours.",
          };
        }
      }

      const amountChanged = amountMinor !== link.amountMinor;
      const descriptionChanged = description !== link.description;
      if (link.usageCount > 0 && (amountChanged || descriptionChanged)) {
        return {
          kind: "conflict" as const,
          message: "Le montant et la description ne peuvent plus changer après une utilisation.",
        };
      }

      const [updated] = await tx.update(customerPaymentLinksTable).set({
        amountMinor,
        description,
        maximumUses,
        updatedAt: new Date(),
      }).where(and(
        eq(customerPaymentLinksTable.id, link.id),
        eq(customerPaymentLinksTable.userId, session.userId),
        eq(customerPaymentLinksTable.source, "linkflow"),
        isNull(customerPaymentLinksTable.deletedAt),
      )).returning(paymentLinkResponseColumns);
      return updated ? { kind: "updated" as const, link: updated } : { kind: "not_found" as const };
    });

    if (outcome.kind === "not_found") {
      res.status(404).json({ error: "Lien introuvable." });
      return;
    }
    if (outcome.kind === "conflict") {
      res.status(409).json({ error: outcome.message });
      return;
    }
    res.json(UpdateCustomerPaymentLinkResponse.parse(toResponse(outcome.link)));
  } catch (error) {
    if (error instanceof PaymentLinkInputError) {
      res.status(400).json({ error: error.message });
      return;
    }
    req.log.error({ err: error, userId: session.userId }, "Customer payment link could not be updated");
    res.status(503).json({ error: "La modification du lien est momentanément indisponible." });
  }
});

router.delete("/me/payment-links/:linkId", async (req, res): Promise<void> => {
  const session = await requirePaymentLinkSession(req, res);
  if (!session) return;
  res.setHeader("Cache-Control", "no-store, private");

  const params = DeleteCustomerPaymentLinkParams.safeParse(req.params);
  if (!params.success || !uuidPattern.test(params.data.linkId)) {
    res.status(404).json({ error: "Lien introuvable." });
    return;
  }

  try {
    const now = new Date();
    const [deleted] = await db.update(customerPaymentLinksTable).set({
      deletedAt: now,
      updatedAt: now,
    }).where(and(
      eq(customerPaymentLinksTable.id, params.data.linkId),
      eq(customerPaymentLinksTable.userId, session.userId),
      eq(customerPaymentLinksTable.source, "linkflow"),
      isNull(customerPaymentLinksTable.deletedAt),
    )).returning({ id: customerPaymentLinksTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Lien introuvable." });
      return;
    }
    res.status(204).end();
  } catch (error) {
    req.log.error({ err: error, userId: session.userId }, "Customer payment link could not be removed");
    res.status(503).json({ error: "La suppression du lien est momentanément indisponible." });
  }
});

router.post("/me/payment-links", async (req, res): Promise<void> => {
  const session = await requirePaymentLinkSession(req, res);
  if (!session) return;
  res.setHeader("Cache-Control", "no-store, private");

  if (!isPaymentLinkCreationAllowed(session)) {
    res.status(403).json({ error: "La création de liens n’est pas autorisée pour ce compte d’essai." });
    return;
  }

  try {
    if (!await consumePaymentLinkCreationQuota(session.userId)) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Trop de créations de liens. Réessayez dans une minute." });
      return;
    }

    const parsed = CreateCustomerPaymentLinkBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Vérifiez les informations du lien." });
      return;
    }
    const normalized = normalizePaymentLinkInput(parsed.data, await loadPaymentLimits());
    const [existing] = await db.select(paymentLinkIdempotencyColumns).from(customerPaymentLinksTable).where(and(
      eq(customerPaymentLinksTable.userId, session.userId),
      eq(customerPaymentLinksTable.source, "linkflow"),
      eq(customerPaymentLinksTable.idempotencyKey, normalized.requestId),
    )).limit(1);
    if (existing) {
      if (existing.deletedAt) {
        res.status(409).json({ error: "Cette demande de création a déjà été utilisée pour un lien supprimé." });
        return;
      }
      if (existing.requestHash !== normalized.requestHash) {
        throw new PaymentLinkIdempotencyConflict();
      }
      res.status(201).json(CreateCustomerPaymentLinkResponse.parse(toResponse(existing)));
      return;
    }

    let [created] = await db.insert(customerPaymentLinksTable).values({
      userId: session.userId,
      publicToken: createPaymentLinkPublicToken(),
      idempotencyKey: normalized.requestId,
      requestHash: normalized.requestHash,
      currency: normalized.currency,
      amountMinor: normalized.amountMinor,
      linkName: normalized.linkName,
      description: normalized.description,
      paymentMethod: normalized.paymentMethod,
      expiresAt: normalized.expiresAt,
      maximumUses: normalized.maximumUses,
      returnUrl: normalized.returnUrl,
      customSuffix: normalized.suffix,
      status: "active",
    }).returning();

    if (!created) throw new Error("Payment link insert returned no row");
    res.status(201).json(CreateCustomerPaymentLinkResponse.parse(toResponse(created)));
  } catch (error) {
    if (error instanceof PaymentLinkInputError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof PaymentLinkIdempotencyConflict) {
      res.status(409).json({ error: "Cette demande a déjà été utilisée avec d’autres informations." });
      return;
    }
    try {
      const parsed = CreateCustomerPaymentLinkBody.safeParse(req.body);
      if (parsed.success) {
        const normalized = normalizePaymentLinkInput(parsed.data, await loadPaymentLimits());
        const [existing] = await db.select(paymentLinkIdempotencyColumns).from(customerPaymentLinksTable).where(and(
          eq(customerPaymentLinksTable.userId, session.userId),
          eq(customerPaymentLinksTable.source, "linkflow"),
          eq(customerPaymentLinksTable.idempotencyKey, normalized.requestId),
        )).limit(1);
        if (existing?.deletedAt) {
          res.status(409).json({ error: "Cette demande de création a déjà été utilisée pour un lien supprimé." });
          return;
        }
        if (existing && existing.requestHash === normalized.requestHash) {
          res.status(201).json(CreateCustomerPaymentLinkResponse.parse(toResponse(existing)));
          return;
        }
        if (existing) {
          res.status(409).json({ error: "Cette demande a déjà été utilisée avec d’autres informations." });
          return;
        }
      }
    } catch (retryError) {
      req.log.error({
        errorType: getSafeErrorType(retryError),
        err: retryError,
        userId: session.userId,
      }, "Payment link idempotency lookup failed");
    }
    req.log.error({
      errorType: getSafeErrorType(error),
      err: error,
      userId: session.userId,
    }, "Customer payment link could not be created");
    res.status(503).json({ error: "La création du lien est momentanément indisponible." });
  }
});

router.post("/me/payment-links/simulate/:token", async (req, res): Promise<void> => {
  const session = await requirePaymentLinkSession(req, res);
  if (!session) return;
  res.setHeader("Cache-Control", "no-store, private");

  if (!isPaymentLinkSimulationAllowed(session)) {
    res.status(404).json({ error: "Ce lien de paiement est indisponible." });
    return;
  }

  const parsed = SimulateCustomerPaymentLinkParams.safeParse(req.params);
  const parsedBody = SimulateCustomerPaymentLinkBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(404).json({ error: "Ce lien de paiement est indisponible." });
    return;
  }
  if (!parsedBody.success) {
    res.status(400).json({ error: "Le montant du paiement est invalide." });
    return;
  }

  try {
    if (!await consumePublicPaymentLinkQuota(
      req.ip || req.socket.remoteAddress || "unknown",
      "quote",
    )) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Trop de simulations. Réessayez dans une minute." });
      return;
    }

    const [link] = await db.select({
      linkName: customerPaymentLinksTable.linkName,
      currency: customerPaymentLinksTable.currency,
      amountMinor: customerPaymentLinksTable.amountMinor,
      expiresAt: customerPaymentLinksTable.expiresAt,
      maximumUses: customerPaymentLinksTable.maximumUses,
      usageCount: customerPaymentLinksTable.usageCount,
      status: customerPaymentLinksTable.status,
    }).from(customerPaymentLinksTable).where(and(
      eq(customerPaymentLinksTable.publicToken, parsed.data.token),
      eq(customerPaymentLinksTable.userId, session.userId),
      eq(customerPaymentLinksTable.source, "linkflow"),
      isNull(customerPaymentLinksTable.deletedAt),
    )).limit(1);

    if (!link || link.status !== "active"
      || (link.expiresAt !== null && link.expiresAt.getTime() <= Date.now())
      || (link.maximumUses !== null && link.usageCount >= link.maximumUses)) {
      res.status(404).json({ error: "Ce lien de paiement est indisponible." });
      return;
    }

    const amountMinor = parseLinkFlowPayerAmount(
      parsedBody.data.amount,
      link.amountMinor,
      link.currency,
      await loadPaymentLimits(),
    );
    res.json(SimulateCustomerPaymentLinkResponse.parse({
      mode: "simulation",
      status: "simulated_success",
      chargeOccurred: false,
      merchantName: link.linkName?.trim() || "SendFlow",
      amountMinor,
      currency: link.currency,
      currencyDecimals: getPaymentLinkCurrencyDecimals(link.currency),
    }));
  } catch (error) {
    if (error instanceof PaymentLinkInputError) {
      res.status(400).json({ error: error.message });
      return;
    }
    req.log.error({ err: error, userId: session.userId }, "Payment-link simulation could not be prepared");
    res.status(503).json({ error: "La simulation est momentanément indisponible." });
  }
});

const authorizePaymentLinkImageUpload: RequestHandler = async (req, res, next): Promise<void> => {
  const session = await requirePaymentLinkSession(req, res);
  if (!session) return;
  res.setHeader("Cache-Control", "no-store, private");

  if (!isPaymentLinkCreationAllowed(session)) {
    res.status(403).json({ error: "Le téléversement n’est pas autorisé pour ce compte d’essai." });
    return;
  }

  const rawLinkId = req.params.linkId;
  if (typeof rawLinkId !== "string" || !uuidPattern.test(rawLinkId)) {
    res.status(400).json({ error: "Identifiant de lien invalide." });
    return;
  }
  const linkId = rawLinkId;
  const contentType = req.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!PAYMENT_LINK_IMAGE_MIME_TYPES.includes(contentType as typeof PAYMENT_LINK_IMAGE_MIME_TYPES[number])) {
    res.status(415).json({ error: "Seuls les fichiers PNG, JPEG, GIF et WebP sont acceptés." });
    return;
  }
  const contentEncoding = req.get("content-encoding")?.trim().toLowerCase();
  if (contentEncoding && contentEncoding !== "identity") {
    res.status(415).json({ error: "Les fichiers compressés ne sont pas acceptés." });
    return;
  }
  const rawContentLength = req.get("content-length");
  if (rawContentLength && !/^\d+$/.test(rawContentLength)) {
    res.status(400).json({ error: "Taille de fichier invalide." });
    return;
  }
  if (rawContentLength && Number(rawContentLength) > PAYMENT_LINK_IMAGE_MAX_BYTES) {
    res.status(413).json({ error: "L’image dépasse la limite de 5 Mo." });
    return;
  }

  try {
    const [link] = await db.select({
      id: customerPaymentLinksTable.id,
      status: customerPaymentLinksTable.status,
      usageCount: customerPaymentLinksTable.usageCount,
    }).from(customerPaymentLinksTable).where(and(
      eq(customerPaymentLinksTable.id, linkId),
      eq(customerPaymentLinksTable.userId, session.userId),
      eq(customerPaymentLinksTable.source, "linkflow"),
      isNull(customerPaymentLinksTable.deletedAt),
    )).limit(1);

    if (!link) {
      res.status(404).json({ error: "Lien introuvable." });
      return;
    }
    if (!["draft", "active"].includes(link.status) || link.usageCount > 0) {
      res.status(409).json({ error: "L’image ne peut plus être modifiée après l’utilisation du lien." });
      return;
    }
    if (!await consumePaymentLinkCreationQuota(session.userId)) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Trop de téléversements. Réessayez dans une minute." });
      return;
    }

    res.locals.paymentLinkImageUserId = session.userId;
    res.locals.paymentLinkImageId = link.id;
    next();
  } catch (error) {
    req.log.error({ err: error, userId: session.userId }, "Payment-link image authorization failed");
    res.status(503).json({ error: "L’image n’a pas pu être enregistrée." });
  }
};

const parsePaymentLinkImage: RequestHandler = (req, res, next): void => {
  parsePaymentLinkImageBody(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    const parserError = error as { type?: string };
    if (parserError.type === "entity.too.large") {
      res.status(413).json({ error: "L’image dépasse la limite de 5 Mo." });
      return;
    }
    if (parserError.type === "encoding.unsupported") {
      res.status(415).json({ error: "Les fichiers compressés ne sont pas acceptés." });
      return;
    }
    req.log.warn({ parserError: parserError.type ?? "invalid-image-body" }, "Payment-link image request body rejected");
    res.status(400).json({ error: "Le fichier image est invalide." });
  });
};

router.post(
  "/me/payment-links/:linkId/image",
  authorizePaymentLinkImageUpload,
  parsePaymentLinkImage,
  async (req, res): Promise<void> => {
    const userId = res.locals.paymentLinkImageUserId as string | undefined;
    const linkId = res.locals.paymentLinkImageId as string | undefined;
    const contentType = req.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!userId || !linkId) {
      res.status(503).json({ error: "La session du lien est indisponible." });
      return;
    }
    if (!Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: "Le fichier image est manquant." });
      return;
    }

    try {
      const imageData = await normalizePaymentLinkImage(req.body, contentType);
      const [updated] = await db.update(customerPaymentLinksTable).set({
        imageData,
        imageSizeBytes: imageData.length,
        updatedAt: new Date(),
      }).where(and(
        eq(customerPaymentLinksTable.id, linkId),
        eq(customerPaymentLinksTable.userId, userId),
        eq(customerPaymentLinksTable.source, "linkflow"),
        isNull(customerPaymentLinksTable.deletedAt),
        or(
          eq(customerPaymentLinksTable.status, "draft"),
          and(
            eq(customerPaymentLinksTable.status, "active"),
            eq(customerPaymentLinksTable.usageCount, 0),
          ),
        ),
      )).returning({ id: customerPaymentLinksTable.id });
      if (!updated) {
        res.status(409).json({ error: "Le brouillon a changé. Actualisez la page puis réessayez." });
        return;
      }
      res.status(204).end();
    } catch (error) {
      if (error instanceof PaymentLinkImageError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      req.log.error({ err: error, userId }, "Customer payment-link image could not be saved");
      res.status(503).json({ error: "L’image n’a pas pu être enregistrée." });
    }
  },
);

export default router;
