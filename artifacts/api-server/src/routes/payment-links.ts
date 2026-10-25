import {
  and,
  customerPaymentLinksTable,
  db,
  desc,
  eq,
  lt,
  or,
} from "@workspace/db";
import {
  CreateCustomerPaymentLinkBody,
  CreateCustomerPaymentLinkResponse,
  GetCustomerPaymentLinksQueryParams,
  GetCustomerPaymentLinksResponse,
} from "@workspace/api-zod";
import express, { Router, type IRouter, type RequestHandler } from "express";
import { consumePaymentLinkCreationQuota } from "../data/payment-link-quota";
import { requireCustomerSession } from "../lib/customer-session";
import {
  createPaymentLinkPublicToken,
  getPaymentLinkCurrencyDecimals,
  isPaymentLinkCreationAllowed,
  normalizePaymentLinkImage,
  normalizePaymentLinkInput,
  PaymentLinkIdempotencyConflict,
  PaymentLinkImageError,
  PaymentLinkInputError,
  PAYMENT_LINK_IMAGE_MAX_BYTES,
  PAYMENT_LINK_IMAGE_MIME_TYPES,
  PAYMENT_LINK_CURRENCIES,
  PAYMENT_LINK_METHODS,
  PAYMENT_LINK_VALIDITIES,
} from "../services/payment-links";

const router: IRouter = Router();
const paymentLinkResponseColumns = {
  id: customerPaymentLinksTable.id,
  publicToken: customerPaymentLinksTable.publicToken,
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
} as const;
const supportedImageMimeTypes = [...PAYMENT_LINK_IMAGE_MIME_TYPES];
const parsePaymentLinkImageBody = express.raw({
  type: supportedImageMimeTypes,
  limit: PAYMENT_LINK_IMAGE_MAX_BYTES,
  inflate: false,
});
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toResponse(row: Pick<
  typeof customerPaymentLinksTable.$inferSelect,
  | "id"
  | "publicToken"
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
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;
  res.setHeader("Cache-Control", "no-store, private");

  const parsed = GetCustomerPaymentLinksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Les paramètres de pagination sont invalides." });
    return;
  }

  try {
    const { cursor, limit } = parsed.data;
    const conditions = [eq(customerPaymentLinksTable.userId, session.userId)];
    if (cursor) {
      const [cursorRow] = await db.select({
        id: customerPaymentLinksTable.id,
        createdAt: customerPaymentLinksTable.createdAt,
      }).from(customerPaymentLinksTable).where(and(
        eq(customerPaymentLinksTable.id, cursor),
        eq(customerPaymentLinksTable.userId, session.userId),
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

router.post("/me/payment-links", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
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
    const normalized = normalizePaymentLinkInput(parsed.data);
    const [existing] = await db.select(paymentLinkIdempotencyColumns).from(customerPaymentLinksTable).where(and(
      eq(customerPaymentLinksTable.userId, session.userId),
      eq(customerPaymentLinksTable.idempotencyKey, normalized.requestId),
    )).limit(1);
    if (existing) {
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
    if ((error as { code?: string })?.code === "23505") {
      try {
        const parsed = CreateCustomerPaymentLinkBody.safeParse(req.body);
        if (parsed.success) {
          const normalized = normalizePaymentLinkInput(parsed.data);
        const [existing] = await db.select(paymentLinkIdempotencyColumns).from(customerPaymentLinksTable).where(and(
            eq(customerPaymentLinksTable.userId, session.userId),
            eq(customerPaymentLinksTable.idempotencyKey, normalized.requestId),
          )).limit(1);
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
        req.log.error({ err: retryError, userId: session.userId }, "Payment link idempotency lookup failed");
      }
    }
    req.log.error({ err: error, userId: session.userId }, "Customer payment link could not be created");
    res.status(503).json({ error: "La création du lien est momentanément indisponible." });
  }
});

const authorizePaymentLinkImageUpload: RequestHandler = async (req, res, next): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
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
