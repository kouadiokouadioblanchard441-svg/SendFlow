export type IdentityReviewStatus = "pending" | "approved" | "rejected";
export type IdentityPhotoKind = "front" | "back" | "selfie";

const requiredPhotoKinds: readonly IdentityPhotoKind[] = ["front", "back", "selfie"];

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
  return birthDate <= adultCutoff.toISOString().slice(0, 10)
    && documentExpiryDate > today;
}

export function canReviewIdentityRequest(status: IdentityReviewStatus): boolean {
  return status === "pending";
}

export function isIdentityUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "23505";
}
