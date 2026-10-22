import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

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

export function createCustomerSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashCustomerSessionToken(
  token: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  // A viewer cookie cannot authenticate against production, even on an older
  // deployment sharing these tables. Production hashes remain unchanged.
  const scope = environment.SENDFLOW_DATABASE_TARGET === "shared-neon" ? "sendflow-preview:v1:" : "";
  const digest = createHash("sha256").update(scope).update(token).digest("hex");
  // Retain 240 bits while making the realm enforceable by a database trigger.
  // A legacy production SHA-256 lookup can never produce this prefix.
  return scope ? `pv1_${digest.slice(0, 60)}` : digest;
}

export function isCustomerSessionToken(value: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}