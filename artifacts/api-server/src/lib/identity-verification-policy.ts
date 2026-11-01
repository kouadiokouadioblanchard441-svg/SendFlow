export type IdentityReviewStatus = "pending" | "approved" | "rejected";
export type IdentityPhotoKind = "front" | "back" | "selfie";

const requiredPhotoKinds: readonly IdentityPhotoKind[] = ["front", "back", "selfie"];
export const MIN_IDENTITY_BIRTH_DATE = "1900-01-01";

export function hasAllIdentityPhotoKinds(kinds: readonly IdentityPhotoKind[]): boolean {
  return kinds.length === requiredPhotoKinds.length
    && new Set(kinds).size === requiredPhotoKinds.length
    && requiredPhotoKinds.every((kind) => kinds.includes(kind));
}

export function meetsIdentityDateRules(
  birthDate: string,
  documentExpiryDate: string,
  now = new Date(),
): boolean {
  const today = now.toISOString().slice(0, 10);
  const adultCutoff = new Date(now);
  adultCutoff.setUTCFullYear(adultCutoff.getUTCFullYear() - 18);
  return birthDate >= MIN_IDENTITY_BIRTH_DATE
    && birthDate <= adultCutoff.toISOString().slice(0, 10)
    && documentExpiryDate > today;
}

export function canReviewIdentityRequest(status: IdentityReviewStatus): boolean {
  return status === "pending";
}

export function canStartIdentityVerification(
  status: IdentityReviewStatus | "unverified" | null | undefined,
): boolean {
  return status === undefined || status === null || status === "unverified" || status === "rejected";
}

export function getIdentityUploadCleanupCutoffs(now = new Date(), graceMs = 60 * 60 * 1000) {
  return {
    expiredBefore: new Date(now.getTime() - graceMs),
    createdBefore: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
  };
}

export function isIdentityUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "23505";
}
