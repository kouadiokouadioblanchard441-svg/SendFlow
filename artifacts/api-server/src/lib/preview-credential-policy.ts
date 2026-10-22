const PREFIX = "scrypt$preview-v1$";

// Legacy/production verifiers intentionally reject this credential version.
export function toPreviewPasswordHash(hash: string): string {
  if (!hash.startsWith("scrypt$v1$")) throw new Error("Unsupported password format");
  return hash.replace("scrypt$v1$", PREFIX);
}

export function previewPasswordForVerification(hash: string): string {
  return hash.startsWith(PREFIX) ? hash.replace(PREFIX, "scrypt$v1$") : "";
}
