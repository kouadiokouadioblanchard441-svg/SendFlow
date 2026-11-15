const SCRYPT_PREFIX = "scrypt$preview-v1$";
const ARGON2ID_PREFIX = "argon2id$preview-v1$";

// Production verifiers intentionally reject preview-scoped password hashes.
export function toPreviewPasswordHash(hash: string): string {
  if (hash.startsWith("$argon2id$")) {
    return hash.replace("$argon2id$", ARGON2ID_PREFIX);
  }
  if (hash.startsWith("scrypt$v1$")) {
    return hash.replace("scrypt$v1$", SCRYPT_PREFIX);
  }
  throw new Error("Unsupported password format");
}

export function previewPasswordForVerification(hash: string): string {
  if (hash.startsWith(ARGON2ID_PREFIX)) {
    return hash.replace(ARGON2ID_PREFIX, "$argon2id$");
  }
  if (hash.startsWith(SCRYPT_PREFIX)) {
    return hash.replace(SCRYPT_PREFIX, "scrypt$v1$");
  }
  return "";
}
