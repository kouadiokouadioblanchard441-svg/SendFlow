import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

const FORMAT_VERSION = "sfenc-v1";
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;
const KEY_DERIVATION_SALT = Buffer.from("sendflow-sensitive-data-v1", "utf8");

export type SensitiveDataPurpose =
  | "user-phone"
  | "user-name"
  | "user-birth-date"
  | "contact-label"
  | "contact-phone"
  | "transaction-sender-phone"
  | "transaction-recipient-phone"
  | "provider-reference"
  | "identity-webhook-payload";

function deriveKey(purpose: "encryption" | "lookup"): Buffer {
  const masterKey = process.env.CUSTOMER_PII_ENCRYPTION_KEY;
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

function additionalData(purpose: SensitiveDataPurpose) {
  return Buffer.from(`sendflow:${purpose}:${FORMAT_VERSION}`, "utf8");
}

export function encryptSensitiveData(value: string, purpose: SensitiveDataPurpose): string {
  if (typeof value !== "string") throw new TypeError("Sensitive data must be a string");
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveKey("encryption"), nonce);
  cipher.setAAD(additionalData(purpose));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

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
): string {
  const parts = encoded.split(".");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new Error("Unsupported sensitive-data ciphertext format");
  }

  const nonce = Buffer.from(parts[1]!, "base64url");
  const tag = Buffer.from(parts[2]!, "base64url");
  const ciphertext = Buffer.from(parts[3]!, "base64url");
  if (nonce.length !== NONCE_BYTES || tag.length !== AUTH_TAG_BYTES) {
    throw new Error("Invalid sensitive-data ciphertext");
  }

  const decipher = createDecipheriv("aes-256-gcm", deriveKey("encryption"), nonce);
  decipher.setAAD(additionalData(purpose));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
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
