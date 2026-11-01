import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import express, { Router, type IRouter, type Request, type RequestHandler, type Response } from "express";
import { z } from "zod";
import {
  and,
  count,
  customerIdentityRequestsTable,
  customerIdentityUploadsTable,
  db,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  isNotNull,
  or,
  usersTable,
} from "@workspace/db";
import { requireCustomerSession } from "../lib/customer-session";
import { isTrustedOrigin } from "../lib/request-security";
import {
  decryptSensitiveData,
  decryptSensitiveDataIfEncrypted,
  encryptSensitiveData,
} from "../lib/sensitive-data-crypto";
import {
  deletePrivateIdentityObject,
  getIdentityPrivateObjectPath,
  getIdentityPrivateObjectUrl,
  storePrivateIdentityImage,
} from "../lib/identity-verification-storage";
import {
  IDENTITY_IMAGE_MAX_BYTES,
  IDENTITY_IMAGE_MIN_BYTES,
  IdentityImageValidationError,
  normalizeIdentityImage,
  verifyStoredIdentityImage,
} from "../lib/identity-verification-image";
import { recordAdminAudit } from "../lib/admin-audit";
import { buildIdentityVerificationPdf } from "../lib/identity-verification-pdf";
import {
  canStartIdentityVerification,
  canReviewIdentityRequest,
  hasAllIdentityPhotoKinds,
  isIdentityUniqueConstraintViolation,
  meetsIdentityDateRules,
} from "../lib/identity-verification-policy";
import { respondAdminAuthError } from "./admin";

const customerRouter: IRouter = Router();
const adminRouter: IRouter = Router();
const archiver = createRequire(import.meta.url)("archiver") as (
  format: "zip",
  options: { zlib: { level: number } },
) => {
  on(event: "error", listener: (error: Error) => void): void;
  pipe(destination: Response): void;
  append(data: string | Buffer, options: { name: string }): void;
  finalize(): Promise<void>;
};
const MAX_IMAGE_BYTES = IDENTITY_IMAGE_MAX_BYTES;
const MIN_IMAGE_BYTES = IDENTITY_IMAGE_MIN_BYTES;
const UPLOAD_TICKET_TTL_MS = 15 * 60 * 1000;
const IDENTITY_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const parseIdentityImageRequestBody = express.raw({
  type: IDENTITY_IMAGE_TYPES,
  limit: IDENTITY_IMAGE_MAX_BYTES,
  inflate: false,
});
const DOCUMENT_TYPES = new Set([
  "Carte nationale d’identité (CNI, CIP)",
  "Passeport",
  "Carte CEDEAO ou carte consulaire",
  "Permis de conduire",
]);
const DOCUMENT_KINDS = ["front", "back", "selfie"] as const;
type DocumentKind = (typeof DOCUMENT_KINDS)[number];

const uploadRequestSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().min(MIN_IMAGE_BYTES).max(MAX_IMAGE_BYTES),
}).strict();

const identitySubmissionSchema = z.object({
  idempotencyKey: z.string().uuid(),
  personalData: z.object({
    firstName: z.string().trim().min(2).max(100).regex(/^[\p{L}\p{M} .'-]+$/u),
    lastName: z.string().trim().min(2).max(100).regex(/^[\p{L}\p{M} .'-]+$/u),
    documentType: z.string().refine((value) => DOCUMENT_TYPES.has(value)),
    documentNumber: z.string().trim().min(1).max(80).regex(/^[\p{L}\p{N} ./'-]+$/u),
    birthDate: z.string().date().refine((value) => value >= "1900-01-01"),
    documentExpiryDate: z.string().date(),
  }).strict(),
  uploads: z.array(z.object({
    id: z.string().uuid(),
    kind: z.enum(DOCUMENT_KINDS),
  }).strict()).length(3),
}).strict();

const decisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(500).optional(),
  confirmation: z.literal("CONFIRMER"),
}).strict();

const listQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  userId: z.string().min(1).max(255).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

class IdentityRequestError extends Error {
  constructor(
    public readonly statusCode: 400 | 403 | 404 | 409 | 410 | 413 | 415 | 422 | 429,
    message: string,
  ) {
    super(message);
    this.name = "IdentityRequestError";
  }
}

function trustedCustomerRequest(req: Request, res: Response) {
  if (isTrustedOrigin(req)) return true;
  res.status(403).json({ error: "Untrusted request origin" });
  return false;
}

async function readVerifiedImage(upload: {
  objectPath: string;
  contentType: string;
  expectedSizeBytes: number;
}) {
  const signedUrl = await getIdentityPrivateObjectUrl(upload.objectPath, "GET");
  const response = await fetch(signedUrl, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok || !response.body) throw new IdentityRequestError(422, "Identity photo upload is incomplete");

  const declaredLength = Number(response.headers.get("content-length"));
  if (!Number.isSafeInteger(declaredLength) || declaredLength < MIN_IMAGE_BYTES || declaredLength > MAX_IMAGE_BYTES) {
    throw new IdentityRequestError(413, "Identity photo is outside the permitted size");
  }
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      totalBytes += part.value.byteLength;
      if (totalBytes > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new IdentityRequestError(413, "Identity photo is outside the permitted size");
      }
      chunks.push(Buffer.from(part.value));
    }
  } finally {
    reader.releaseLock();
  }
  if (totalBytes !== declaredLength || totalBytes !== upload.expectedSizeBytes) {
    throw new IdentityRequestError(422, "Identity photo upload does not match its declared size");
  }

  const buffer = Buffer.concat(chunks);
  try {
    await verifyStoredIdentityImage(buffer, upload.contentType, upload.expectedSizeBytes);
  } catch (error) {
    if (error instanceof IdentityImageValidationError) {
      throw new IdentityRequestError(422, "Identity photo is not a valid supported image");
    }
    throw error;
  }
  return { buffer, contentType: upload.contentType };
}

const authorizeIdentityPhotoUpload: RequestHandler = async (req, res, next) => {
  if (!trustedCustomerRequest(req, res)) return;
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;
  const uploadId = z.string().uuid().safeParse(req.params.uploadId);
  if (!uploadId.success) {
    res.status(400).json({ error: "Invalid identity photo upload" });
    return;
  }
  try {
    const [ticket] = await db.select({ id: customerIdentityUploadsTable.id })
      .from(customerIdentityUploadsTable)
      .where(and(
        eq(customerIdentityUploadsTable.id, uploadId.data),
        eq(customerIdentityUploadsTable.userId, session.userId),
        isNull(customerIdentityUploadsTable.requestId),
        isNull(customerIdentityUploadsTable.uploadedAt),
        gte(customerIdentityUploadsTable.expiresAt, new Date()),
      ))
      .limit(1);
    if (!ticket) {
      res.status(409).json({ error: "This identity photo upload is no longer available" });
      return;
    }
  } catch {
    req.log.error({ failure: "upload-ticket-lookup" }, "Identity photo upload ticket lookup failed");
    res.status(503).json({ error: "La session de téléversement est indisponible." });
    return;
  }
  res.locals.identityPhotoUploadId = uploadId.data;
  res.locals.identityPhotoUploadUserId = session.userId;
  next();
};

const parseIdentityPhotoRequest: RequestHandler = (req, res, next): void => {
  parseIdentityImageRequestBody(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    const parserError = error as { type?: string };
    if (parserError.type === "entity.too.large") {
      res.status(413).json({ error: "La photo dépasse la limite de 8 Mo." });
      return;
    }
    if (parserError.type === "encoding.unsupported") {
      res.status(415).json({ error: "Les fichiers compressés ne sont pas acceptés." });
      return;
    }
    req.log.warn(
      { parserError: parserError.type ?? "invalid-identity-image-body" },
      "Identity photo request body rejected",
    );
    res.status(400).json({ error: "Le fichier image est invalide." });
  });
};

function getAdminUserId(req: Parameters<typeof respondAdminAuthError>[0], res: Parameters<typeof respondAdminAuthError>[1], permission: "read" | "mutate" = "read") {
  return respondAdminAuthError(req, res, permission);
}

function mapListItem(row: {
  id: string;
  userId: string;
  displayName: string | null;
  countryCode: string | null;
  status: "pending" | "approved" | "rejected";
  submittedAt: Date;
  reviewedAt: Date | null;
}) {
  return {
    id: row.id,
    userId: row.userId,
    displayName: decryptSensitiveDataIfEncrypted(row.displayName, "user-name"),
    countryCode: row.countryCode,
    status: row.status,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
  };
}

customerRouter.post("/me/identity-verification/uploads", async (req, res): Promise<void> => {
  if (!trustedCustomerRequest(req, res)) return;
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;
  res.setHeader("Cache-Control", "no-store, private");

  const parsed = uploadRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid identity photo upload request" });
    return;
  }
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + UPLOAD_TICKET_TTL_MS);
  try {
    await db.transaction(async (tx) => {
      const [user] = await tx.select({ status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.id, session.userId))
        .for("update")
        .limit(1);
      if (!user || user.status !== "active") {
        throw new IdentityRequestError(403, "Identity verification is unavailable for this account");
      }

      const [latestRequest] = await tx.select({
        status: customerIdentityRequestsTable.status,
      }).from(customerIdentityRequestsTable)
        .where(and(
          eq(customerIdentityRequestsTable.userId, session.userId),
          inArray(customerIdentityRequestsTable.status, ["pending", "approved"]),
        ))
        .limit(1);
      if (!canStartIdentityVerification(latestRequest?.status)) {
        throw new IdentityRequestError(409, "An identity verification request is already active or approved");
      }

      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const [uploadsToday] = await tx.select({ value: count() })
        .from(customerIdentityUploadsTable)
        .where(and(
          eq(customerIdentityUploadsTable.userId, session.userId),
          gte(customerIdentityUploadsTable.createdAt, dayStart),
        ));
      if (Number(uploadsToday?.value ?? 0) >= 12) {
        throw new IdentityRequestError(429, "Identity photo upload limit reached");
      }

      await tx.insert(customerIdentityUploadsTable).values({
        id,
        userId: session.userId,
        kind: parsed.data.kind,
        objectPath: getIdentityPrivateObjectPath(id),
        contentType: parsed.data.contentType,
        expectedSizeBytes: parsed.data.sizeBytes,
        expiresAt,
      });
    });
    res.status(201).json({ uploadId: id, expiresAt });
  } catch (error) {
    if (error instanceof IdentityRequestError) {
      if (error.statusCode === 429) res.setHeader("Retry-After", "60");
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    req.log.error({ failure: "ticket-creation" }, "Identity photo upload ticket creation failed");
    res.status(503).json({ error: "Identity photo storage is temporarily unavailable" });
  }
});

customerRouter.put(
  "/me/identity-verification/uploads/:uploadId/content",
  authorizeIdentityPhotoUpload,
  parseIdentityPhotoRequest,
  async (req, res): Promise<void> => {
    const userId = res.locals.identityPhotoUploadUserId as string | undefined;
    const uploadId = res.locals.identityPhotoUploadId as string | undefined;
    res.setHeader("Cache-Control", "no-store, private");
    if (!userId || !uploadId) {
      res.status(503).json({ error: "La session de téléversement est indisponible." });
      return;
    }
    const contentType = req.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!IDENTITY_IMAGE_TYPES.includes(contentType)) {
      res.status(415).json({ error: "Choisissez une photo JPG, PNG ou WebP." });
      return;
    }
    if (!Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: "Le fichier image est manquant." });
      return;
    }
    if (req.body.length > MAX_IMAGE_BYTES) {
      res.status(413).json({ error: "La photo doit peser entre 8 Ko et 8 Mo." });
      return;
    }
    if (req.body.length < MIN_IMAGE_BYTES) {
      res.status(422).json({ error: "La photo est trop petite pour être vérifiée." });
      return;
    }

    let objectPathForCleanup: string | undefined;
    try {
      const [ticket] = await db.select()
        .from(customerIdentityUploadsTable)
        .where(and(
          eq(customerIdentityUploadsTable.id, uploadId),
          eq(customerIdentityUploadsTable.userId, userId),
          isNull(customerIdentityUploadsTable.requestId),
          isNull(customerIdentityUploadsTable.uploadedAt),
          gte(customerIdentityUploadsTable.expiresAt, new Date()),
        ))
        .limit(1);
      if (!ticket) {
        throw new IdentityRequestError(409, "This identity photo upload is no longer available");
      }
      if (contentType !== ticket.contentType) {
        throw new IdentityRequestError(415, "The photo format does not match the upload request");
      }
      if (req.body.length !== ticket.expectedSizeBytes) {
        throw new IdentityRequestError(422, "The photo size does not match the upload request");
      }

      let normalized: Awaited<ReturnType<typeof normalizeIdentityImage>>;
      try {
        normalized = await normalizeIdentityImage(req.body, contentType);
      } catch (error) {
        if (error instanceof IdentityImageValidationError) {
          throw new IdentityRequestError(422, "Identity photo is not a valid supported image");
        }
        throw error;
      }

      await db.transaction(async (tx) => {
        const [user] = await tx.select({ status: usersTable.status })
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .for("update")
          .limit(1);
        if (!user || user.status !== "active") {
          throw new IdentityRequestError(403, "Identity verification is unavailable for this account");
        }

        const [latestRequest] = await tx.select({
          status: customerIdentityRequestsTable.status,
        }).from(customerIdentityRequestsTable)
          .where(and(
            eq(customerIdentityRequestsTable.userId, userId),
            inArray(customerIdentityRequestsTable.status, ["pending", "approved"]),
          ))
          .limit(1);
        if (!canStartIdentityVerification(latestRequest?.status)) {
          throw new IdentityRequestError(409, "An identity verification request is already active or approved");
        }

        const [lockedTicket] = await tx.select()
          .from(customerIdentityUploadsTable)
          .where(and(
            eq(customerIdentityUploadsTable.id, uploadId),
            eq(customerIdentityUploadsTable.userId, userId),
          ))
          .for("update")
          .limit(1);
        if (
          !lockedTicket
          || lockedTicket.requestId
          || lockedTicket.uploadedAt
          || lockedTicket.expiresAt.getTime() < Date.now()
        ) {
          throw new IdentityRequestError(409, "This identity photo upload is no longer available");
        }
        if (
          lockedTicket.contentType !== contentType
          || lockedTicket.expectedSizeBytes !== req.body.length
        ) {
          throw new IdentityRequestError(422, "The photo does not match its upload request");
        }

        objectPathForCleanup = lockedTicket.objectPath;
        await storePrivateIdentityImage(lockedTicket.objectPath, normalized.buffer);
        const [updated] = await tx.update(customerIdentityUploadsTable)
          .set({
            contentType: normalized.contentType,
            expectedSizeBytes: normalized.buffer.length,
            uploadedAt: new Date(),
          })
          .where(and(
            eq(customerIdentityUploadsTable.id, uploadId),
            eq(customerIdentityUploadsTable.userId, userId),
            isNull(customerIdentityUploadsTable.requestId),
            isNull(customerIdentityUploadsTable.uploadedAt),
            gte(customerIdentityUploadsTable.expiresAt, new Date()),
          ))
          .returning({ id: customerIdentityUploadsTable.id });
        if (!updated) throw new IdentityRequestError(409, "This identity photo upload is no longer available");
      });

      objectPathForCleanup = undefined;
      res.status(200).json({ uploadId, uploaded: true });
    } catch (error) {
      if (objectPathForCleanup) {
        try {
          await deletePrivateIdentityObject(objectPathForCleanup);
        } catch {
          req.log.warn({ cleanupFailed: true }, "Uncommitted identity image cleanup failed");
        }
      }
      if (error instanceof IdentityRequestError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      req.log.error({ failure: "private-image-upload" }, "Identity photo upload failed");
      res.status(503).json({ error: "La photo n’a pas pu être enregistrée. Réessayez." });
    }
  },
);

customerRouter.get("/me/identity-verification", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;
  res.setHeader("Cache-Control", "no-store, private");
  try {
    const [request] = await db.select({
      id: customerIdentityRequestsTable.id,
      status: customerIdentityRequestsTable.status,
      submittedAt: customerIdentityRequestsTable.submittedAt,
      reviewedAt: customerIdentityRequestsTable.reviewedAt,
    }).from(customerIdentityRequestsTable)
      .where(eq(customerIdentityRequestsTable.userId, session.userId))
      .orderBy(desc(customerIdentityRequestsTable.submittedAt))
      .limit(1);
    res.json(request ?? { status: "unverified", submittedAt: null, reviewedAt: null });
  } catch (error) {
    req.log.error({ err: error }, "Identity verification status lookup failed");
    res.status(503).json({ error: "Identity verification status is temporarily unavailable" });
  }
});

customerRouter.post("/me/identity-verification", async (req, res): Promise<void> => {
  if (!trustedCustomerRequest(req, res)) return;
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;
  res.setHeader("Cache-Control", "no-store, private");

  const parsed = identitySubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid identity verification submission" });
    return;
  }
  const { personalData, uploads, idempotencyKey } = parsed.data;
  if (!hasAllIdentityPhotoKinds(uploads.map((upload) => upload.kind))) {
    res.status(400).json({ error: "All required identity photos must be provided" });
    return;
  }
  if (!meetsIdentityDateRules(personalData.birthDate, personalData.documentExpiryDate)) {
    res.status(400).json({ error: "The provided dates are not eligible" });
    return;
  }

  try {
    const [existingByKey] = await db.select({
      id: customerIdentityRequestsTable.id,
      status: customerIdentityRequestsTable.status,
      submittedAt: customerIdentityRequestsTable.submittedAt,
    }).from(customerIdentityRequestsTable)
      .where(and(
        eq(customerIdentityRequestsTable.userId, session.userId),
        eq(customerIdentityRequestsTable.idempotencyKey, idempotencyKey),
      ))
      .limit(1);
    if (existingByKey) {
      res.status(200).json(existingByKey);
      return;
    }

    const uploadIds = uploads.map((item) => item.id);
    const uploadedRows = await db.select()
      .from(customerIdentityUploadsTable)
      .where(and(
        eq(customerIdentityUploadsTable.userId, session.userId),
        isNull(customerIdentityUploadsTable.requestId),
        isNotNull(customerIdentityUploadsTable.uploadedAt),
        gte(customerIdentityUploadsTable.expiresAt, new Date()),
      ));
    const selectedUploads = uploadedRows.filter((row) => uploadIds.includes(row.id));
    if (
      selectedUploads.length !== DOCUMENT_KINDS.length
      || new Set(selectedUploads.map((row) => row.kind)).size !== DOCUMENT_KINDS.length
      || uploads.some((item) => !selectedUploads.some((row) => row.id === item.id && row.kind === item.kind))
    ) {
      throw new IdentityRequestError(422, "Identity photo upload is missing or expired");
    }
    await Promise.all(selectedUploads.map((row) => readVerifiedImage(row)));

    const result = await db.transaction(async (tx) => {
      const [user] = await tx.select({ status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.id, session.userId))
        .for("update")
        .limit(1);
      if (!user || user.status !== "active") {
        throw new IdentityRequestError(409, "The account is not eligible for identity verification");
      }

      const [sameKey] = await tx.select({
        id: customerIdentityRequestsTable.id,
        status: customerIdentityRequestsTable.status,
        submittedAt: customerIdentityRequestsTable.submittedAt,
      }).from(customerIdentityRequestsTable)
        .where(and(
          eq(customerIdentityRequestsTable.userId, session.userId),
          eq(customerIdentityRequestsTable.idempotencyKey, idempotencyKey),
        ))
        .limit(1);
      if (sameKey) return { request: sameKey, replay: true };

      const [existingRequest] = await tx.select({
        id: customerIdentityRequestsTable.id,
        status: customerIdentityRequestsTable.status,
        submittedAt: customerIdentityRequestsTable.submittedAt,
      }).from(customerIdentityRequestsTable)
        .where(and(
          eq(customerIdentityRequestsTable.userId, session.userId),
          inArray(customerIdentityRequestsTable.status, ["pending", "approved"]),
        ))
        .limit(1);
      if (!canStartIdentityVerification(existingRequest?.status)) {
        throw new IdentityRequestError(409, "An identity verification request is already active or approved");
      }

      const [created] = await tx.insert(customerIdentityRequestsTable).values({
        userId: session.userId,
        idempotencyKey,
        personalDataEncrypted: encryptSensitiveData(
          JSON.stringify(personalData),
          "identity-verification-data",
        ),
        status: "pending",
      }).returning({
        id: customerIdentityRequestsTable.id,
        status: customerIdentityRequestsTable.status,
        submittedAt: customerIdentityRequestsTable.submittedAt,
      });
      if (!created) throw new Error("Identity request was not created");

      const updatedUploads = await tx.update(customerIdentityUploadsTable)
        .set({ requestId: created.id })
        .where(and(
          inArray(customerIdentityUploadsTable.id, uploadIds),
          eq(customerIdentityUploadsTable.userId, session.userId),
          isNull(customerIdentityUploadsTable.requestId),
          isNotNull(customerIdentityUploadsTable.uploadedAt),
          gte(customerIdentityUploadsTable.expiresAt, new Date()),
        ))
        .returning({
          id: customerIdentityUploadsTable.id,
          kind: customerIdentityUploadsTable.kind,
        });
      const linkedIds = new Set(updatedUploads.map((upload) => upload.id));
      if (uploadIds.some((id) => !linkedIds.has(id))) {
        throw new IdentityRequestError(409, "Identity photo uploads were already used");
      }
      return { request: created, replay: false };
    });

    res.status(result.replay ? 200 : 201).json(result.request);
  } catch (error) {
    if (error instanceof IdentityRequestError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    if (isIdentityUniqueConstraintViolation(error)) {
      const [sameRequest] = await db.select({
        id: customerIdentityRequestsTable.id,
        status: customerIdentityRequestsTable.status,
        submittedAt: customerIdentityRequestsTable.submittedAt,
      }).from(customerIdentityRequestsTable)
        .where(and(
          eq(customerIdentityRequestsTable.userId, session.userId),
          eq(customerIdentityRequestsTable.idempotencyKey, idempotencyKey),
        ))
        .limit(1);
      if (sameRequest) {
        res.status(200).json(sameRequest);
        return;
      }
      const [pendingRequest] = await db.select({
        id: customerIdentityRequestsTable.id,
        status: customerIdentityRequestsTable.status,
        submittedAt: customerIdentityRequestsTable.submittedAt,
      }).from(customerIdentityRequestsTable)
        .where(and(
          eq(customerIdentityRequestsTable.userId, session.userId),
          eq(customerIdentityRequestsTable.status, "pending"),
        ))
        .limit(1);
      if (pendingRequest) {
        res.status(409).json({ error: "An identity verification request is already pending" });
        return;
      }
    }
    req.log.error({ failure: "identity-submission" }, "Identity verification submission failed");
    res.status(503).json({ error: "Identity verification is temporarily unavailable" });
  }
});

adminRouter.get("/identity-verifications", async (req, res): Promise<void> => {
  const adminUserId = getAdminUserId(req, res);
  if (!adminUserId) return;
  res.setHeader("Cache-Control", "no-store, private");
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid identity verification filters" });
    return;
  }
  const { status, userId, search, page, pageSize } = parsed.data;
  const searchId = search ? z.string().uuid().safeParse(search) : null;
  const searchFilter = search
    ? or(
        searchId?.success ? eq(customerIdentityRequestsTable.id, searchId.data) : undefined,
        ilike(customerIdentityRequestsTable.userId, `%${search}%`),
      )
    : undefined;
  const filters = [
    status ? eq(customerIdentityRequestsTable.status, status) : undefined,
    userId ? eq(customerIdentityRequestsTable.userId, userId) : undefined,
    searchFilter,
  ].filter(Boolean);
  const where = filters.length ? and(...filters) : undefined;

  try {
    const [rows, totals, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      db.select({
        id: customerIdentityRequestsTable.id,
        userId: customerIdentityRequestsTable.userId,
        displayName: usersTable.displayName,
        countryCode: usersTable.countryCode,
        status: customerIdentityRequestsTable.status,
        submittedAt: customerIdentityRequestsTable.submittedAt,
        reviewedAt: customerIdentityRequestsTable.reviewedAt,
      }).from(customerIdentityRequestsTable)
        .innerJoin(usersTable, eq(usersTable.id, customerIdentityRequestsTable.userId))
        .where(where)
        .orderBy(desc(customerIdentityRequestsTable.submittedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ value: count() })
        .from(customerIdentityRequestsTable)
        .innerJoin(usersTable, eq(usersTable.id, customerIdentityRequestsTable.userId))
        .where(where),
      db.select({ value: count() }).from(customerIdentityRequestsTable)
        .where(eq(customerIdentityRequestsTable.status, "pending")),
      db.select({ value: count() }).from(customerIdentityRequestsTable)
        .where(eq(customerIdentityRequestsTable.status, "approved")),
      db.select({ value: count() }).from(customerIdentityRequestsTable)
        .where(eq(customerIdentityRequestsTable.status, "rejected")),
    ]);
    await recordAdminAudit({
      adminUserId,
      action: "view_identity_verification",
      resourceType: "identity_verification",
      resourceId: "list",
    });
    res.json({
      items: rows.map(mapListItem),
      page,
      pageSize,
      total: Number(totals[0]?.value ?? 0),
      counts: {
        pending: Number(pendingCount[0]?.value ?? 0),
        approved: Number(approvedCount[0]?.value ?? 0),
        rejected: Number(rejectedCount[0]?.value ?? 0),
      },
    });
  } catch (error) {
    req.log.error({ err: error }, "Identity verification list lookup failed");
    res.status(503).json({ error: "Identity verification records are temporarily unavailable" });
  }
});

adminRouter.get("/identity-verifications/:requestId", async (req, res): Promise<void> => {
  const adminUserId = getAdminUserId(req, res);
  if (!adminUserId) return;
  res.setHeader("Cache-Control", "no-store, private");
  const requestId = z.string().uuid().safeParse(req.params.requestId);
  if (!requestId.success) {
    res.status(400).json({ error: "Invalid identity verification identifier" });
    return;
  }
  try {
    const [request] = await db.select({
      id: customerIdentityRequestsTable.id,
      userId: customerIdentityRequestsTable.userId,
      personalDataEncrypted: customerIdentityRequestsTable.personalDataEncrypted,
      status: customerIdentityRequestsTable.status,
      decisionReasonEncrypted: customerIdentityRequestsTable.decisionReasonEncrypted,
      submittedAt: customerIdentityRequestsTable.submittedAt,
      reviewedAt: customerIdentityRequestsTable.reviewedAt,
      reviewedBy: customerIdentityRequestsTable.reviewedBy,
      displayName: usersTable.displayName,
      phone: usersTable.phone,
      emailEncrypted: usersTable.emailEncrypted,
      countryCode: usersTable.countryCode,
      userStatus: usersTable.status,
    }).from(customerIdentityRequestsTable)
      .innerJoin(usersTable, eq(usersTable.id, customerIdentityRequestsTable.userId))
      .where(eq(customerIdentityRequestsTable.id, requestId.data))
      .limit(1);
    if (!request) {
      res.status(404).json({ error: "Identity verification request not found" });
      return;
    }
    const documents = await db.select({
      id: customerIdentityUploadsTable.id,
      kind: customerIdentityUploadsTable.kind,
      contentType: customerIdentityUploadsTable.contentType,
      sizeBytes: customerIdentityUploadsTable.expectedSizeBytes,
    }).from(customerIdentityUploadsTable)
      .where(eq(customerIdentityUploadsTable.requestId, request.id));
    await recordAdminAudit({
      adminUserId,
      action: "view_identity_verification",
      resourceType: "identity_verification",
      resourceId: request.id,
    });
    let personalData: unknown;
    try {
      personalData = JSON.parse(decryptSensitiveData(
        request.personalDataEncrypted,
        "identity-verification-data",
      ));
    } catch {
      throw new Error("Identity verification data could not be decrypted");
    }
    const decisionReason = request.decisionReasonEncrypted
      ? decryptSensitiveData(request.decisionReasonEncrypted, "identity-verification-data")
      : null;
    res.json({
      id: request.id,
      status: request.status,
      submittedAt: request.submittedAt,
      reviewedAt: request.reviewedAt,
      reviewedBy: request.reviewedBy,
      decisionReason,
      personalData,
      user: {
        id: request.userId,
        displayName: decryptSensitiveDataIfEncrypted(request.displayName, "user-name"),
        phone: decryptSensitiveDataIfEncrypted(request.phone, "user-phone"),
        email: decryptSensitiveDataIfEncrypted(request.emailEncrypted, "user-email"),
        countryCode: request.countryCode,
        status: request.userStatus,
      },
      documents,
    });
  } catch (error) {
    req.log.error({ err: error, requestId: requestId.data }, "Identity verification detail lookup failed");
    res.status(503).json({ error: "Identity verification details are temporarily unavailable" });
  }
});

async function getAdminRequestDocuments(requestId: string) {
  const [request] = await db.select({
    id: customerIdentityRequestsTable.id,
    userId: customerIdentityRequestsTable.userId,
    personalDataEncrypted: customerIdentityRequestsTable.personalDataEncrypted,
    status: customerIdentityRequestsTable.status,
    submittedAt: customerIdentityRequestsTable.submittedAt,
    reviewedAt: customerIdentityRequestsTable.reviewedAt,
    reviewedBy: customerIdentityRequestsTable.reviewedBy,
    decisionReasonEncrypted: customerIdentityRequestsTable.decisionReasonEncrypted,
    displayName: usersTable.displayName,
    phone: usersTable.phone,
    emailEncrypted: usersTable.emailEncrypted,
    countryCode: usersTable.countryCode,
    userStatus: usersTable.status,
  }).from(customerIdentityRequestsTable)
    .innerJoin(usersTable, eq(usersTable.id, customerIdentityRequestsTable.userId))
    .where(eq(customerIdentityRequestsTable.id, requestId))
    .limit(1);
  if (!request) return null;
  const documents = await db.select()
    .from(customerIdentityUploadsTable)
    .where(eq(customerIdentityUploadsTable.requestId, requestId));
  return { request, documents };
}

adminRouter.get("/identity-verifications/:requestId/documents/:kind", async (req, res): Promise<void> => {
  const adminUserId = getAdminUserId(req, res);
  if (!adminUserId) return;
  res.setHeader("Cache-Control", "no-store, private");
  const requestId = z.string().uuid().safeParse(req.params.requestId);
  const kind = z.enum(DOCUMENT_KINDS).safeParse(req.params.kind);
  const query = z.object({ download: z.enum(["1"]).optional() }).strict().safeParse(req.query);
  if (!requestId.success || !kind.success || !query.success) {
    res.status(400).json({ error: "Invalid identity document request" });
    return;
  }
  try {
    const [document] = await db.select()
      .from(customerIdentityUploadsTable)
      .where(and(
        eq(customerIdentityUploadsTable.requestId, requestId.data),
        eq(customerIdentityUploadsTable.kind, kind.data),
      ))
      .limit(1);
    if (!document) {
      res.status(404).json({ error: "Identity document not found" });
      return;
    }
    const verifiedImage = await readVerifiedImage(document);
    await recordAdminAudit({
      adminUserId,
      action: "download_identity_verification",
      resourceType: "identity_verification",
      resourceId: requestId.data,
      reason: `document_${kind.data}`,
    });
    res.setHeader("Content-Type", document.contentType);
    const disposition = query.data.download === "1" ? "attachment" : "inline";
    res.setHeader("Content-Disposition", `${disposition}; filename="sendflow-identity-${kind.data}.${document.contentType === "image/jpeg" ? "jpg" : document.contentType.slice(6)}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Content-Length", String(verifiedImage.buffer.length));
    res.end(verifiedImage.buffer);
  } catch (error) {
    req.log.error(
      { failure: "private-document-read", requestId: requestId.data, documentKind: kind.data },
      "Identity document download failed",
    );
    if (!res.headersSent) res.status(503).json({ error: "Identity document is temporarily unavailable" });
    else if (!res.destroyed) res.destroy();
  }
});

adminRouter.get("/identity-verifications/:requestId/pdf", async (req, res): Promise<void> => {
  const adminUserId = getAdminUserId(req, res);
  if (!adminUserId) return;
  res.setHeader("Cache-Control", "no-store, private");
  const requestId = z.string().uuid().safeParse(req.params.requestId);
  if (!requestId.success) {
    res.status(400).json({ error: "Invalid identity verification identifier" });
    return;
  }
  try {
    const result = await getAdminRequestDocuments(requestId.data);
    if (!result) {
      res.status(404).json({ error: "Identity verification request not found" });
      return;
    }
    if (!hasAllIdentityPhotoKinds(result.documents.map((document) => document.kind))) {
      res.status(409).json({ error: "Identity verification dossier is incomplete" });
      return;
    }

    let personalData: z.infer<typeof identitySubmissionSchema>["personalData"];
    try {
      personalData = JSON.parse(decryptSensitiveData(
        result.request.personalDataEncrypted,
        "identity-verification-data",
      ));
    } catch {
      throw new Error("Identity verification data could not be decrypted");
    }
    const decisionReason = result.request.decisionReasonEncrypted
      ? decryptSensitiveData(result.request.decisionReasonEncrypted, "identity-verification-data")
      : null;
    const photos = await Promise.all(result.documents.map(async (document) => ({
      kind: document.kind,
      buffer: (await readVerifiedImage(document)).buffer,
    })));
    const pdf = await buildIdentityVerificationPdf({
      requestId: result.request.id,
      status: result.request.status,
      submittedAt: result.request.submittedAt,
      reviewedAt: result.request.reviewedAt,
      reviewedBy: result.request.reviewedBy,
      decisionReason,
      personalData,
      user: {
        id: result.request.userId,
        displayName: decryptSensitiveDataIfEncrypted(result.request.displayName, "user-name"),
        phone: decryptSensitiveDataIfEncrypted(result.request.phone, "user-phone"),
        email: decryptSensitiveDataIfEncrypted(result.request.emailEncrypted, "user-email"),
        countryCode: result.request.countryCode,
        status: result.request.userStatus,
      },
      photos,
    });
    await recordAdminAudit({
      adminUserId,
      action: "download_identity_verification",
      resourceType: "identity_verification",
      resourceId: result.request.id,
      reason: "complete_pdf_export",
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="sendflow-identity-${result.request.id}.pdf"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Length", String(pdf.length));
    res.end(pdf);
  } catch (error) {
    req.log.error({ failure: "identity-pdf-export", requestId: requestId.data }, "Identity verification PDF export failed");
    if (!res.headersSent) res.status(503).json({ error: "Identity verification PDF is temporarily unavailable" });
    else if (!res.destroyed) res.destroy();
  }
});

adminRouter.get("/identity-verifications/:requestId/export", async (req, res): Promise<void> => {
  const adminUserId = getAdminUserId(req, res);
  if (!adminUserId) return;
  res.setHeader("Cache-Control", "no-store, private");
  const requestId = z.string().uuid().safeParse(req.params.requestId);
  if (!requestId.success) {
    res.status(400).json({ error: "Invalid identity verification identifier" });
    return;
  }
  try {
    const result = await getAdminRequestDocuments(requestId.data);
    if (!result) {
      res.status(404).json({ error: "Identity verification request not found" });
      return;
    }
    if (!hasAllIdentityPhotoKinds(result.documents.map((document) => document.kind))) {
      res.status(409).json({ error: "Identity verification dossier is incomplete" });
      return;
    }
    const personalData = JSON.parse(decryptSensitiveData(
      result.request.personalDataEncrypted,
      "identity-verification-data",
    ));
    const decisionReason = result.request.decisionReasonEncrypted
      ? decryptSensitiveData(result.request.decisionReasonEncrypted, "identity-verification-data")
      : null;
    const userProfile = {
      id: result.request.userId,
      displayName: decryptSensitiveDataIfEncrypted(result.request.displayName, "user-name"),
      phone: decryptSensitiveDataIfEncrypted(result.request.phone, "user-phone"),
      email: decryptSensitiveDataIfEncrypted(result.request.emailEncrypted, "user-email"),
      countryCode: result.request.countryCode,
      status: result.request.userStatus,
    };
    const downloadedDocuments = await Promise.all(result.documents.map(async (document) => {
      const verifiedImage = await readVerifiedImage(document);
      return {
        kind: document.kind,
        contentType: verifiedImage.contentType,
        buffer: verifiedImage.buffer,
      };
    }));
    await recordAdminAudit({
      adminUserId,
      action: "download_identity_verification",
      resourceType: "identity_verification",
      resourceId: result.request.id,
      reason: "complete_export",
    });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="sendflow-identity-${result.request.id}.zip"`);
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (error: Error) => {
      req.log.error({ failure: "identity-archive", requestId: requestId.data }, "Identity verification archive failed");
      if (!res.destroyed) res.destroy();
    });
    archive.pipe(res);
    archive.append(JSON.stringify({
      requestId: result.request.id,
      status: result.request.status,
      submittedAt: result.request.submittedAt,
      reviewedAt: result.request.reviewedAt,
      reviewedBy: result.request.reviewedBy,
      decisionReason,
      personalData,
      user: userProfile,
    }, null, 2), { name: "identity-verification.json" });
    for (const document of downloadedDocuments) {
      const extension = document.contentType === "image/jpeg" ? "jpg" : document.contentType.slice(6);
      archive.append(document.buffer, { name: `documents/${document.kind}.${extension}` });
    }
    await archive.finalize();
  } catch (error) {
    req.log.error({ failure: "identity-export", requestId: requestId.data }, "Identity verification export failed");
    if (!res.headersSent) res.status(503).json({ error: "Identity verification export is temporarily unavailable" });
    else if (!res.destroyed) res.destroy();
  }
});

adminRouter.post("/identity-verifications/:requestId/decision", async (req, res): Promise<void> => {
  const adminUserId = getAdminUserId(req, res, "mutate");
  if (!adminUserId) return;
  res.setHeader("Cache-Control", "no-store, private");
  const requestId = z.string().uuid().safeParse(req.params.requestId);
  const parsed = decisionSchema.safeParse(req.body);
  if (!requestId.success || !parsed.success) {
    res.status(400).json({ error: "Invalid identity verification decision" });
    return;
  }
  const reason = parsed.data.reason?.trim() ?? "";
  if (parsed.data.decision === "rejected" && reason.length < 10) {
    res.status(400).json({ error: "A clear rejection reason is required" });
    return;
  }
  try {
    const [reviewableRequest] = await db.select({
      status: customerIdentityRequestsTable.status,
    }).from(customerIdentityRequestsTable)
      .where(eq(customerIdentityRequestsTable.id, requestId.data))
      .limit(1);
    if (!reviewableRequest) {
      res.status(404).json({ error: "Identity verification request not found" });
      return;
    }
    if (!canReviewIdentityRequest(reviewableRequest.status)) {
      res.status(409).json({ error: "This identity verification request has already been reviewed" });
      return;
    }

    if (parsed.data.decision === "approved") {
      const documents = await db.select()
        .from(customerIdentityUploadsTable)
        .where(and(
          eq(customerIdentityUploadsTable.requestId, requestId.data),
          isNotNull(customerIdentityUploadsTable.uploadedAt),
        ));
      if (!hasAllIdentityPhotoKinds(documents.map((document) => document.kind))) {
        res.status(409).json({ error: "Identity verification documents are incomplete" });
        return;
      }
      await Promise.all(documents.map((document) => readVerifiedImage(document)));
    }

    await db.transaction(async (tx) => {
      const [request] = await tx.select({
        id: customerIdentityRequestsTable.id,
        userId: customerIdentityRequestsTable.userId,
        status: customerIdentityRequestsTable.status,
      }).from(customerIdentityRequestsTable)
        .where(eq(customerIdentityRequestsTable.id, requestId.data))
        .for("update")
        .limit(1);
      if (!request) throw new IdentityRequestError(404, "Identity verification request not found");
      if (!canReviewIdentityRequest(request.status)) {
        throw new IdentityRequestError(409, "This identity verification request has already been reviewed");
      }
      const now = new Date();
      const [user] = await tx.select({ status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.id, request.userId))
        .for("update")
        .limit(1);
      if (!user || (parsed.data.decision === "approved" && user.status !== "active")) {
        throw new IdentityRequestError(409, "The account is not active");
      }
      await tx.update(customerIdentityRequestsTable)
        .set({
          status: parsed.data.decision,
          decisionReasonEncrypted: reason
            ? encryptSensitiveData(reason, "identity-verification-data")
            : null,
          reviewedAt: now,
          reviewedBy: adminUserId,
          updatedAt: now,
        })
        .where(eq(customerIdentityRequestsTable.id, request.id));
      await recordAdminAudit({
        adminUserId,
        action: "decide_identity_verification",
        resourceType: "identity_verification",
        resourceId: request.id,
        reason: parsed.data.decision === "approved" ? "approved" : "rejected",
      }, tx);
    });
    res.json({ id: requestId.data, status: parsed.data.decision });
  } catch (error) {
    if (error instanceof IdentityRequestError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    req.log.error({ failure: "identity-decision", requestId: requestId.data }, "Identity verification decision failed");
    res.status(503).json({ error: "Identity verification decision is temporarily unavailable" });
  }
});

export const adminRoutes = adminRouter;
export default customerRouter;
