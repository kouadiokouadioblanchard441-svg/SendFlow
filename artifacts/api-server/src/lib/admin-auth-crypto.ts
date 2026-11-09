import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  timingSafeEqual,
  verify,
} from "node:crypto";
import argon2 from "argon2";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
};
const ACCESS_TOKEN_TTL_SECONDS = 5 * 60;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export type AdminAccessClaims = {
  iss: "sendflow-admin";
  aud: "sendflow-admin-api";
  sub: "super-admin";
  sid: string;
  jti: string;
  iat: number;
  nbf: number;
  exp: number;
};

function decodeBase32(value: string): Buffer | null {
  const normalized = value.toUpperCase().replace(/=+$/u, "");
  if (!normalized || !/^[A-Z2-7]+$/u.test(normalized)) return null;
  let bits = 0;
  let accumulator = 0;
  const output: number[] = [];
  for (const character of normalized) {
    const digit = BASE32_ALPHABET.indexOf(character);
    if (digit < 0) return null;
    accumulator = (accumulator << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((accumulator >> bits) & 0xff);
    }
  }
  return Buffer.from(output);
}

export function encodeBase32(bytes: Uint8Array): string {
  let accumulator = 0;
  let bits = 0;
  let output = "";
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(accumulator >> bits) & 31];
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(accumulator << (5 - bits)) & 31];
  return output;
}

export function createTotpSecret() {
  return encodeBase32(randomBytes(20));
}

export function createTotpEnrollmentUri(secret: string, email: string) {
  const label = encodeURIComponent(`SendFlow:${email}`);
  const query = new URLSearchParams({
    secret,
    issuer: "SendFlow",
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

function totpAtStep(secret: string, step: number): string | null {
  const key = decodeBase32(secret);
  if (!key || key.length < 16 || !Number.isSafeInteger(step) || step < 0) return null;
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = (
    ((digest[offset]! & 0x7f) << 24)
    | ((digest[offset + 1]! & 0xff) << 16)
    | ((digest[offset + 2]! & 0xff) << 8)
    | (digest[offset + 3]! & 0xff)
  );
  return String(binary % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, "0");
}

export function verifyTotpCode(
  secret: string,
  candidate: string,
  nowMs = Date.now(),
  lastAcceptedStep: number | null = null,
): number | null {
  if (!/^[0-9]{6}$/u.test(candidate) || !Number.isFinite(nowMs) || nowMs < 0) return null;
  const currentStep = Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
  let acceptedStep: number | null = null;
  const candidateBytes = Buffer.from(candidate, "ascii");
  for (const step of [currentStep - 1, currentStep, currentStep + 1]) {
    if (step < 0 || (lastAcceptedStep !== null && step <= lastAcceptedStep)) continue;
    const expected = totpAtStep(secret, step);
    if (expected === null) continue;
    const expectedBytes = Buffer.from(expected, "ascii");
    if (timingSafeEqual(candidateBytes, expectedBytes)) acceptedStep = step;
  }
  return acceptedStep;
}

function decodeEncryptionKey(value: string | undefined): Buffer | null {
  if (!value) return null;
  try {
    const decoded = /^[0-9a-f]{64}$/iu.test(value)
      ? Buffer.from(value, "hex")
      : Buffer.from(value, "base64url");
    return decoded.length === 32 ? decoded : null;
  } catch {
    return null;
  }
}

export type EncryptedTotpSecret = {
  ciphertext: string;
  nonce: string;
  authTag: string;
};

export function encryptTotpSecret(
  secret: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): EncryptedTotpSecret | null {
  const key = decodeEncryptionKey(environment.SENDFLOW_ADMIN_TOTP_ENCRYPTION_KEY);
  if (!key || !decodeBase32(secret)) return null;
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    nonce: nonce.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
  };
}

export function decryptTotpSecret(
  encrypted: EncryptedTotpSecret,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const key = decodeEncryptionKey(environment.SENDFLOW_ADMIN_TOTP_ENCRYPTION_KEY);
  if (!key) return null;
  try {
    const nonce = Buffer.from(encrypted.nonce, "base64url");
    const tag = Buffer.from(encrypted.authTag, "base64url");
    const ciphertext = Buffer.from(encrypted.ciphertext, "base64url");
    if (nonce.length !== 12 || tag.length !== 16 || ciphertext.length < 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAuthTag(tag);
    const secret = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    return decodeBase32(secret) ? secret : null;
  } catch {
    return null;
  }
}

export function normalizeAdminEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (/[\u0000-\u001f\u007f]/u.test(value)) return null;
  const email = value.trim().normalize("NFKC").toLowerCase();
  if (email.length < 3 || email.length > 254 || /[\s\u0000-\u001f\u007f]/u.test(email)) return null;
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1 || email.indexOf("@") !== at) return null;
  if (email.slice(0, at).length > 64 || !email.slice(at + 1).includes(".")) return null;
  return email;
}

export async function hashAdminPassword(password: string) {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyAdminPassword(password: string, hash: string) {
  if (
    typeof password !== "string"
    || password.length < 1
    || Buffer.byteLength(password, "utf8") > 1024
    || typeof hash !== "string"
    || !hash.startsWith("$argon2id$")
    || hash.length > 512
  ) return false;
  try {
    return await argon2.verify(hash, password, { type: argon2.argon2id });
  } catch {
    return false;
  }
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(16).toString("hex").toUpperCase();
    const code = raw.match(/.{1,4}/gu)!.join("-");
    return { code, hash: hashRecoveryCode(code) };
  });
}

export function hashRecoveryCode(code: string) {
  const normalized = code.replace(/-/gu, "").toUpperCase();
  if (!/^[0-9A-F]{32}$/u.test(normalized)) return null;
  return createHash("sha256").update(normalized, "ascii").digest("hex");
}

function signingKeys(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const privatePem = environment.SENDFLOW_ADMIN_JWT_PRIVATE_KEY?.replace(/\\n/gu, "\n");
  const publicPem = environment.SENDFLOW_ADMIN_JWT_PUBLIC_KEY?.replace(/\\n/gu, "\n");
  if (!privatePem || !publicPem) return null;
  try {
    return {
      privateKey: createPrivateKey(privatePem),
      publicKey: createPublicKey(publicPem),
    };
  } catch {
    return null;
  }
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function createAdminAccessToken(
  sessionId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(sessionId)) {
    return null;
  }
  const keys = signingKeys(environment);
  if (!keys || !Number.isSafeInteger(nowSeconds) || nowSeconds < 0) return null;
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const claims: AdminAccessClaims = {
    iss: "sendflow-admin",
    aud: "sendflow-admin-api",
    sub: "super-admin",
    sid: sessionId,
    jti: randomBytes(16).toString("hex"),
    iat: nowSeconds,
    nbf: nowSeconds,
    exp: nowSeconds + ACCESS_TOKEN_TTL_SECONDS,
  };
  const payload = base64UrlJson(claims);
  const input = `${header}.${payload}`;
  const signature = sign("RSA-SHA256", Buffer.from(input), keys.privateKey).toString("base64url");
  return `${input}.${signature}`;
}

export function verifyAdminAccessToken(
  token: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AdminAccessClaims | null {
  if (!token || token.length > 4096 || !Number.isSafeInteger(nowSeconds)) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) return null;
  const keys = signingKeys(environment);
  if (!keys) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0]!, "base64url").toString("utf8"));
    if (header?.alg !== "RS256" || header?.typ !== "JWT") return null;
    const validSignature = verify(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      keys.publicKey,
      Buffer.from(parts[2]!, "base64url"),
    );
    if (!validSignature) return null;
    const claims = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as Partial<AdminAccessClaims>;
    if (
      claims.iss !== "sendflow-admin"
      || claims.aud !== "sendflow-admin-api"
      || claims.sub !== "super-admin"
      || typeof claims.sid !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(claims.sid)
      || typeof claims.jti !== "string"
      || !/^[0-9a-f]{32}$/u.test(claims.jti)
      || !Number.isSafeInteger(claims.iat)
      || !Number.isSafeInteger(claims.nbf)
      || !Number.isSafeInteger(claims.exp)
      || claims.iat! > nowSeconds + 15
      || claims.nbf! > nowSeconds + 15
      || claims.exp! <= nowSeconds
      || claims.exp! <= claims.iat!
      || claims.exp! - claims.iat! > ACCESS_TOKEN_TTL_SECONDS
    ) return null;
    return claims as AdminAccessClaims;
  } catch {
    return null;
  }
}

export const ADMIN_ACCESS_TOKEN_TTL_SECONDS = ACCESS_TOKEN_TTL_SECONDS;
