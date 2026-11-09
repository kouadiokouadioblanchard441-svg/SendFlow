import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

const FORMAT_VERSION = "sfenc-v1";
const CONTEXT_FORMAT_VERSION = "sfenc-v2";
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;
const KEY_DERIVATION_SALT = Buffer.from("sendflow-sensitive-data-v1", "utf8");
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

export type SensitiveDataEncryptionOptions = {
  /**
   * When present, use the context-bound sfenc-v2 envelope. The caller must
   * provide the exact same context when decrypting.
   */
  authenticatedContext?: string;
};

export type SensitiveDataPurpose =
  | "user-phone"
  | "user-email"
  | "user-name"
  | "user-birth-date"
  | "contact-label"
  | "contact-phone"
  | "transaction-sender-phone"
  | "transaction-recipient-phone"
  | "provider-reference"
  | "payment-confirmation-payload"
  | "linkflow-poll-token-seed"
  | "linkflow-poll-token-hash"
  | "linkflow-payer-name"
  | "provider-redirect-url"
  | "linkflow-request-fingerprint"
  | "linkflow-request-otp"
  | "identity-webhook-payload"
  | "identity-verification-data"
  | "developer-webhook-secret"
  | "developer-webhook-payload"
  | "developer-client-token"
  | "developer-webhook-url"
  | "developer-payment-metadata"
  | "payout-beneficiary-phone"
  | "payout-beneficiary-name"
  | "payout-execution-reference"
  | "payout-confirmation-evidence";

function activeKeyId() {
  const keyId = process.env.CUSTOMER_PII_ENCRYPTION_KEY_ID?.trim() || "primary";
  if (!KEY_ID_PATTERN.test(keyId)) {
    throw new Error("Sensitive-data encryption key identifier is invalid");
  }
  return keyId;
}

function lookupKeyId() {
  const keyId = process.env.CUSTOMER_PII_LOOKUP_KEY_ID?.trim() || activeKeyId();
  if (!KEY_ID_PATTERN.test(keyId)) {
    throw new Error("Sensitive-data lookup key identifier is invalid");
  }
  return keyId;
}

function readKeyring(): Record<string, string> {
  const encoded = process.env.CUSTOMER_PII_ENCRYPTION_KEYRING;
  if (!encoded) return {};
  if (Buffer.byteLength(encoded, "utf8") > 16_384) {
    throw new Error("Sensitive-data keyring configuration is invalid");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    throw new Error("Sensitive-data keyring configuration is invalid");
  }
  if (
    typeof parsed !== "object"
    || parsed === null
    || Array.isArray(parsed)
    || Object.keys(parsed).length > 32
  ) {
    throw new Error("Sensitive-data keyring configuration is invalid");
  }
  const keyring = parsed as Record<string, unknown>;
  for (const [keyId, key] of Object.entries(keyring)) {
    if (!KEY_ID_PATTERN.test(keyId) || typeof key !== "string" || Buffer.byteLength(key, "utf8") < KEY_BYTES) {
      throw new Error("Sensitive-data keyring configuration is invalid");
    }
  }
  return keyring as Record<string, string>;
}

function masterKeyForId(keyId: string) {
  if (!KEY_ID_PATTERN.test(keyId)) {
    throw new Error("Sensitive-data encryption key identifier is invalid");
  }
  const currentKeyId = activeKeyId();
  if (keyId === currentKeyId) {
    const masterKey = process.env.CUSTOMER_PII_ENCRYPTION_KEY;
    if (!masterKey || Buffer.byteLength(masterKey, "utf8") < KEY_BYTES) {
      throw new Error("Sensitive-data encryption key is missing or too short");
    }
    return masterKey;
  }
  const historicalKey = readKeyring()[keyId];
  if (!historicalKey) {
    throw new Error("Sensitive-data encryption key version is unavailable");
  }
  return historicalKey;
}

function deriveKey(purpose: "encryption" | "lookup", keyId = activeKeyId()): Buffer {
  const masterKey = masterKeyForId(purpose === "lookup" ? lookupKeyId() : keyId);
  if (!masterKey || Buffer.byteLength(masterKey, "utf8") < KEY_BYTES) {
    throw new Error("Sensitive-data encryption key is missing or too short");
  }

  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(masterKey, "utf8"),
      KEY_DERIVATION_SALT,
      Buffer.from(`sendflow:${purpose}:v1`, "utf8"),
      KEY_BYTES,
    ),
  );
}

function additionalData(
  purpose: SensitiveDataPurpose,
  version: typeof FORMAT_VERSION | typeof CONTEXT_FORMAT_VERSION,
  authenticatedContext?: string,
) {
  const contextPart = authenticatedContext === undefined ? "" : `:${authenticatedContext}`;
  return Buffer.from(`sendflow:${purpose}:${version}${contextPart}`, "utf8");
}

export function encryptSensitiveData(
  value: string,
  purpose: SensitiveDataPurpose,
  options: SensitiveDataEncryptionOptions = {},
): string {
  if (typeof value !== "string") throw new TypeError("Sensitive data must be a string");
  if (options.authenticatedContext !== undefined
    && (typeof options.authenticatedContext !== "string"
      || options.authenticatedContext.length < 1
      || options.authenticatedContext.length > 512)) {
    throw new TypeError("Sensitive data encryption context is invalid");
  }
  const keyId = activeKeyId();
  const version = options.authenticatedContext === undefined ? FORMAT_VERSION : CONTEXT_FORMAT_VERSION;
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveKey("encryption", keyId), nonce);
  cipher.setAAD(additionalData(purpose, version, options.authenticatedContext));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  if (version === CONTEXT_FORMAT_VERSION) {
    return [
      version,
      keyId,
      nonce.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  }
  return [
    FORMAT_VERSION,
    nonce.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSensitiveData(
  encoded: string,
  purpose: SensitiveDataPurpose,
  options: SensitiveDataEncryptionOptions = {},
): string {
  const parts = encoded.split(".");
  const isV1 = parts.length === 4 && parts[0] === FORMAT_VERSION;
  const isV2 = parts.length === 5 && parts[0] === CONTEXT_FORMAT_VERSION;
  if (!isV1 && !isV2) {
    throw new Error("Unsupported sensitive-data ciphertext format");
  }

  if (isV2 && options.authenticatedContext === undefined) {
    throw new Error("Sensitive-data encryption context is required");
  }
  if (isV1 && options.authenticatedContext !== undefined) {
    throw new Error("Sensitive-data ciphertext is not context-bound");
  }
  const keyId = isV2 ? parts[1]! : undefined;
  if (isV2 && !KEY_ID_PATTERN.test(keyId!)) {
    throw new Error("Sensitive-data encryption key identifier is invalid");
  }
  const nonce = Buffer.from(parts[isV2 ? 2 : 1]!, "base64url");
  const tag = Buffer.from(parts[isV2 ? 3 : 2]!, "base64url");
  const ciphertext = Buffer.from(parts[isV2 ? 4 : 3]!, "base64url");
  if (nonce.length !== NONCE_BYTES || tag.length !== AUTH_TAG_BYTES) {
    throw new Error("Invalid sensitive-data ciphertext");
  }

  const version = isV2 ? CONTEXT_FORMAT_VERSION : FORMAT_VERSION;
  const decryptWithKey = (candidateKeyId: string) => {
    const decipher = createDecipheriv("aes-256-gcm", deriveKey("encryption", candidateKeyId), nonce);
    decipher.setAAD(additionalData(purpose, version, options.authenticatedContext));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  };

  if (isV2) return decryptWithKey(keyId!);

  // sfenc-v1 predates key IDs. Keep old records readable after a rotation by
  // trying the active key first, then the explicitly configured historical
  // keyring. Reject ambiguous duplicate key material instead of guessing.
  const keyIds = [activeKeyId(), ...Object.keys(readKeyring()).filter((id) => id !== activeKeyId())];
  let decryptedValue: string | undefined;
  let successfulKeys = 0;
  for (const candidateKeyId of keyIds) {
    try {
      const candidateValue = decryptWithKey(candidateKeyId);
      successfulKeys += 1;
      if (successfulKeys === 1) decryptedValue = candidateValue;
    } catch {
      // Continue without retaining or logging cryptographic error details.
    }
  }
  if (successfulKeys === 1) return decryptedValue!;
  throw new Error("Sensitive-data ciphertext authentication failed");
}

export function decryptSensitiveDataIfEncrypted(
  value: string | null,
  purpose: SensitiveDataPurpose,
): string | null {
  if (value === null || !value.startsWith(`${FORMAT_VERSION}.`)) return value;
  return decryptSensitiveData(value, purpose);
}

export function createSensitiveDataLookupIndex(
  value: string,
  purpose: SensitiveDataPurpose,
): string {
  if (typeof value !== "string") throw new TypeError("Sensitive data index input must be a string");
  return createHmac("sha256", deriveKey("lookup"))
    .update(`sendflow:${purpose}:v1\0`, "utf8")
    .update(value, "utf8")
    .digest("hex");
}

export function normalizeSensitiveNameForLookup(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeSensitiveEmailForLookup(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}
