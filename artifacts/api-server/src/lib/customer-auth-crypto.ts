import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import argon2 from "argon2";

const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const CUSTOMER_PASSWORD_ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  saltLength: 16,
  hashLength: 32,
} as const;
const CUSTOMER_PIN_ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  saltLength: 16,
  hashLength: 32,
} as const;
const ARGON2ID_HASH_PATTERN =
  /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/u;

function deriveSecret(secret: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      secret,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

function isBoundedCustomerArgon2idHash(encodedHash: string) {
  if (typeof encodedHash !== "string" || encodedHash.length > 512) return false;
  const match = ARGON2ID_HASH_PATTERN.exec(encodedHash);
  if (!match) return false;
  const memoryCost = Number(match[1]);
  const timeCost = Number(match[2]);
  const parallelism = Number(match[3]);
  return Number.isSafeInteger(memoryCost) && memoryCost >= 19_456 && memoryCost <= 65_536
    && Number.isSafeInteger(timeCost) && timeCost >= 2 && timeCost <= 5
    && Number.isSafeInteger(parallelism) && parallelism >= 1 && parallelism <= 4;
}

export async function hashCustomerSecret(secret: string) {
  const salt = randomBytes(16);
  const derivedKey = await deriveSecret(secret, salt);
  return [
    "scrypt",
    "v1",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyCustomerSecret(secret: string, encodedHash: string) {
  const parts = encodedHash.split("$");
  if (parts.length !== 7) return false;
  if (
    parts[0] !== "scrypt"
    || parts[1] !== "v1"
    || parts[2] !== String(SCRYPT_N)
    || parts[3] !== String(SCRYPT_R)
    || parts[4] !== String(SCRYPT_P)
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(parts[5]!, "base64url");
    const expected = Buffer.from(parts[6]!, "base64url");
    if (salt.length !== 16 || expected.length !== SCRYPT_KEY_LENGTH) return false;
    const actual = await deriveSecret(secret, salt);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function hashCustomerPassword(password: string) {
  return argon2.hash(password, CUSTOMER_PASSWORD_ARGON2_OPTIONS);
}

export async function hashCustomerPin(pin: string) {
  return argon2.hash(pin, CUSTOMER_PIN_ARGON2_OPTIONS);
}

export function isCustomerPasswordArgon2idHash(encodedHash: string) {
  return isBoundedCustomerArgon2idHash(encodedHash);
}

export function isCustomerPinArgon2idHash(encodedHash: string) {
  return isBoundedCustomerArgon2idHash(encodedHash);
}

export async function verifyCustomerPassword(password: string, encodedHash: string) {
  if (typeof password !== "string" || typeof encodedHash !== "string") return false;
  if (isCustomerPasswordArgon2idHash(encodedHash)) {
    try {
      return await argon2.verify(encodedHash, password);
    } catch {
      return false;
    }
  }
  // Existing customer passwords use this format until their next successful
  // sign-in; that sign-in upgrades the stored value to Argon2id.
  return verifyCustomerSecret(password, encodedHash);
}

export async function verifyCustomerPin(pin: string, encodedHash: string) {
  if (typeof pin !== "string" || typeof encodedHash !== "string") return false;
  if (isCustomerPinArgon2idHash(encodedHash)) {
    try {
      return await argon2.verify(encodedHash, pin);
    } catch {
      return false;
    }
  }
  // Legacy PINs remain usable until the first successful verification,
  // which upgrades the stored hash in the same database transaction.
  return verifyCustomerSecret(pin, encodedHash);
}

export function createCustomerSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashCustomerSessionToken(
  token: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  // A viewer cookie cannot authenticate against production, even on an older
  // deployment sharing these tables. Production hashes remain unchanged.
  const scope = environment.SENDFLOW_DATABASE_TARGET === "shared-external" ? "sendflow-preview:v1:" : "";
  const digest = createHash("sha256").update(scope).update(token).digest("hex");
  // Retain 240 bits while making the realm enforceable by a database trigger.
  // A legacy production SHA-256 lookup can never produce this prefix.
  return scope ? `pv1_${digest.slice(0, 60)}` : digest;
}

export function isCustomerSessionToken(value: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}