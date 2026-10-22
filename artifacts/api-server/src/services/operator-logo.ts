import { createHash } from "node:crypto";
import { and, db, eq, operatorCatalogTable, type OperatorCatalogRecord } from "@workspace/db";
import { recordAdminAudit } from "../lib/admin-audit";

export const MAX_OPERATOR_LOGO_BYTES = 512 * 1024;

const allowedContentTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export class OperatorLogoError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 413 | 415 | 503,
  ) {
    super(message);
    this.name = "OperatorLogoError";
  }
}

function validDimensions(width: number, height: number): boolean {
  return Number.isInteger(width)
    && Number.isInteger(height)
    && width > 0
    && height > 0
    && width <= 4096
    && height <= 4096
    && width * height <= 4_194_304;
}

function jpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;

    const isStartOfFrame = [
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ].includes(marker);
    if (isStartOfFrame) {
      if (segmentLength < 7) return null;
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  return null;
}

function webpDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (
    bytes.length < 25
    || bytes.toString("ascii", 0, 4) !== "RIFF"
    || bytes.toString("ascii", 8, 12) !== "WEBP"
  ) return null;

  const chunkType = bytes.toString("ascii", 12, 16);
  if (chunkType === "VP8X" && bytes.length >= 30) {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3),
    };
  }
  if (chunkType === "VP8L" && bytes[20] === 0x2f && bytes.length >= 25) {
    const b1 = bytes[21] ?? 0;
    const b2 = bytes[22] ?? 0;
    const b3 = bytes[23] ?? 0;
    const b4 = bytes[24] ?? 0;
    return {
      width: 1 + (((b2 & 0x3f) << 8) | b1),
      height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
    };
  }
  if (
    chunkType === "VP8 "
    && bytes.length >= 30
    && bytes[23] === 0x9d
    && bytes[24] === 0x01
    && bytes[25] === 0x2a
  ) {
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }
  return null;
}

export function isValidOperatorLogo(bytes: Buffer, contentType: string): boolean {
  if (bytes.length < 12 || bytes.length > MAX_OPERATOR_LOGO_BYTES || !allowedContentTypes.has(contentType)) {
    return false;
  }

  if (contentType === "image/png") {
    if (
      bytes.length < 33
      || !bytes.subarray(0, 8).equals(pngSignature)
      || bytes.readUInt32BE(8) !== 13
      || bytes.toString("ascii", 12, 16) !== "IHDR"
    ) return false;
    return validDimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
  }

  if (contentType === "image/jpeg") {
    const dimensions = jpegDimensions(bytes);
    return dimensions !== null && validDimensions(dimensions.width, dimensions.height);
  }

  const dimensions = webpDimensions(bytes);
  return dimensions !== null && validDimensions(dimensions.width, dimensions.height);
}

export function operatorLogoUrl(operatorId: string, version: number, hasLogo: boolean): string | null {
  if (!hasLogo) return null;
  return `/api/operators/${encodeURIComponent(operatorId)}/logo?v=${version}`;
}

type OperatorDisplayRecord = Pick<
  OperatorCatalogRecord,
  "operatorId" | "countryCode" | "name" | "shortName" | "initials" | "brand" | "enabled" | "version" | "updatedAt"
>;

export function toManagedOperatorLogoRecord(
  operator: OperatorDisplayRecord,
  hasLogo: boolean,
) {
  return {
    operatorId: operator.operatorId,
    countryCode: operator.countryCode,
    name: operator.name,
    shortName: operator.shortName,
    initials: operator.initials,
    brand: operator.brand,
    logoUrl: operatorLogoUrl(operator.operatorId, operator.version, hasLogo),
    enabled: operator.enabled,
    version: operator.version,
    updatedAt: operator.updatedAt?.toISOString() ?? null,
  };
}

function validateMutation(actor: string, operatorId: string, expectedVersion: number, reason: string): void {
  if (!actor || actor.length > 255) {
    throw new OperatorLogoError("Administrator identity is invalid", 403);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(operatorId)) {
    throw new OperatorLogoError("Invalid operator", 400);
  }
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    throw new OperatorLogoError("Invalid operator version", 400);
  }
  if (reason.trim().length < 3 || reason.trim().length > 500) {
    throw new OperatorLogoError("An audit reason is required", 400);
  }
}

async function persistLogo(
  actor: string,
  operatorId: string,
  expectedVersion: number,
  reason: string,
  logoData: Buffer | null,
  logoContentType: string | null,
) {
  validateMutation(actor, operatorId, expectedVersion, reason);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(operatorCatalogTable)
      .set({
        logoData,
        logoContentType,
        version: expectedVersion + 1,
        updatedBy: actor,
        updatedAt: new Date(),
      })
      .where(and(
        eq(operatorCatalogTable.operatorId, operatorId),
        eq(operatorCatalogTable.version, expectedVersion),
      ))
      .returning({
        operatorId: operatorCatalogTable.operatorId,
        countryCode: operatorCatalogTable.countryCode,
        name: operatorCatalogTable.name,
        shortName: operatorCatalogTable.shortName,
        initials: operatorCatalogTable.initials,
        brand: operatorCatalogTable.brand,
        enabled: operatorCatalogTable.enabled,
        version: operatorCatalogTable.version,
        updatedAt: operatorCatalogTable.updatedAt,
      });

    if (!updated) {
      const [current] = await tx
        .select({ operatorId: operatorCatalogTable.operatorId })
        .from(operatorCatalogTable)
        .where(eq(operatorCatalogTable.operatorId, operatorId))
        .limit(1);
      throw new OperatorLogoError(current ? "Operator changed since it was loaded" : "Operator not found", current ? 409 : 404);
    }

    await recordAdminAudit({
      adminUserId: actor,
      action: "update_operator_logo",
      resourceType: "operator",
      resourceId: operatorId,
      reason: reason.trim(),
    }, tx);

    return toManagedOperatorLogoRecord(updated, logoData !== null);
  });
}

export async function uploadOperatorLogo(
  actor: string,
  operatorId: string,
  expectedVersion: number,
  reason: string,
  bytes: Buffer,
  contentType: string,
) {
  if (!allowedContentTypes.has(contentType)) {
    throw new OperatorLogoError("Only PNG, JPEG, and WebP images are accepted", 415);
  }
  if (bytes.length > MAX_OPERATOR_LOGO_BYTES) {
    throw new OperatorLogoError("Logo exceeds 512 KiB", 413);
  }
  if (!isValidOperatorLogo(bytes, contentType)) {
    throw new OperatorLogoError("The uploaded file is not a valid supported image", 400);
  }
  return persistLogo(actor, operatorId, expectedVersion, reason, bytes, contentType);
}

export async function deleteOperatorLogo(
  actor: string,
  operatorId: string,
  expectedVersion: number,
  reason: string,
) {
  return persistLogo(actor, operatorId, expectedVersion, reason, null, null);
}

export async function readOperatorLogo(operatorId: string) {
  const [record] = await db
    .select({
      logoData: operatorCatalogTable.logoData,
      logoContentType: operatorCatalogTable.logoContentType,
    })
    .from(operatorCatalogTable)
    .where(eq(operatorCatalogTable.operatorId, operatorId))
    .limit(1);

  if (!record?.logoData || !record.logoContentType) return null;
  const bytes = Buffer.from(record.logoData);
  if (!isValidOperatorLogo(bytes, record.logoContentType)) {
    throw new OperatorLogoError("Stored operator logo is invalid", 503);
  }
  return {
    bytes,
    contentType: record.logoContentType,
    etag: `"${createHash("sha256").update(bytes).digest("hex")}"`,
  };
}
