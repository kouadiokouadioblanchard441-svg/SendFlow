import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import pg from "pg";
import qrcode from "qrcode";
import {
  createAdminAccessToken,
  createRecoveryCodes,
  createTotpEnrollmentUri,
  createTotpSecret,
  decryptTotpSecret,
  encryptTotpSecret,
  hashAdminPassword,
  hashRecoveryCode,
  normalizeAdminEmail,
  verifyAdminAccessToken,
  verifyTotpCode,
} from "../src/lib/admin-auth-crypto.ts";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const readline = createInterface({ input: process.stdin, output: process.stdout });

function askVisible(prompt) {
  return new Promise((resolveAnswer) => readline.question(prompt, resolveAnswer));
}

function askHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("This command requires a secure interactive terminal.");
  }
  return new Promise((resolveAnswer, reject) => {
    const input = process.stdin;
    const wasRaw = input.isRaw;
    let value = "";
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    const restore = () => {
      input.off("data", onData);
      input.setRawMode(Boolean(wasRaw));
      process.stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const character of String(chunk)) {
        if (character === "\u0003") {
          restore();
          reject(new Error("Setup cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          restore();
          resolveAnswer(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else if (character >= " " && character <= "~") {
          value += character;
        }
      }
    };
    input.on("data", onData);
  });
}

function decodeKeyMaterial(value) {
  const normalized = value?.trim();
  if (!normalized) return null;
  const decoded = Buffer.from(normalized, "base64url");
  return decoded.length === 32 ? decoded : null;
}

async function main() {
  if (process.env.SENDFLOW_ADMIN_BOOTSTRAP_CONFIRM !== "I_UNDERSTAND") {
    throw new Error("Set the one-time confirmation flag before initializing the administrator.");
  }
  const connectionString = process.env.SENDFLOW_ADMIN_MAINTENANCE_DATABASE_URL?.trim();
  if (!connectionString) throw new Error("The secured database maintenance connection is not configured.");
  const totpKey = decodeKeyMaterial(process.env.SENDFLOW_ADMIN_TOTP_ENCRYPTION_KEY);
  if (!totpKey) throw new Error("The TOTP encryption key is missing or invalid.");
  const jwtProbe = createAdminAccessToken(randomUUID(), Math.floor(Date.now() / 1000));
  if (!jwtProbe || !verifyAdminAccessToken(jwtProbe)) {
    throw new Error("Administrator JWT signing keys are missing or inconsistent.");
  }

  const email = normalizeAdminEmail(await askVisible("Administrator email: "));
  if (!email) throw new Error("The email address is invalid.");
  const password = await askHidden("New administrator password: ");
  const repeatedPassword = await askHidden("Repeat administrator password: ");
  if (password !== repeatedPassword || password.length < 12 || password.length > 1024) {
    throw new Error("The password confirmation is invalid or does not meet the minimum length.");
  }

  const secret = createTotpSecret();
  const enrollmentUri = createTotpEnrollmentUri(secret, email);
  process.stdout.write("\nScan this temporary QR code in Google Authenticator:\n");
  process.stdout.write(await qrcode.toString(enrollmentUri, { type: "terminal", small: true }));
  const firstCode = (await askHidden("Enter the first six-digit authenticator code: ")).trim();
  const firstStep = verifyTotpCode(secret, firstCode, Date.now(), null);
  if (firstStep === null) throw new Error("The first authenticator code was not accepted.");

  const encryptedTotp = encryptTotpSecret(secret);
  if (!encryptedTotp || !decryptTotpSecret(encryptedTotp)) {
    throw new Error("TOTP encryption could not be verified.");
  }
  const passwordHash = await hashAdminPassword(password);
  const recoveryCodes = createRecoveryCodes();
  const pool = new pg.Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: true,
      ...(process.env.DATABASE_CA_CERT?.trim() ? { ca: process.env.DATABASE_CA_CERT.trim() } : {}),
    },
    connectionTimeoutMillis: 8_000,
    max: 1,
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    const current = await client.query(
      "SELECT id FROM sf_super_admin_credentials WHERE id = 1 FOR UPDATE",
    );
    if (current.rowCount !== 0) throw new Error("The single administrator credential already exists.");

    await client.query(
      `INSERT INTO sf_super_admin_credentials
        (id, email_normalized, password_hash, totp_ciphertext, totp_nonce, totp_auth_tag,
         last_totp_step, active, created_at, updated_at, password_changed_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, true, now(), now(), now())`,
      [
        email,
        passwordHash,
        encryptedTotp.ciphertext,
        encryptedTotp.nonce,
        encryptedTotp.authTag,
        firstStep,
      ],
    );
    for (const recovery of recoveryCodes) {
      const codeHash = hashRecoveryCode(recovery.code);
      if (!codeHash) throw new Error("Recovery code generation failed.");
      await client.query(
        "INSERT INTO sf_super_admin_recovery_codes (credential_id, code_hash) VALUES (1, $1)",
        [codeHash],
      );
    }
    await client.query(
      `INSERT INTO sf_admin_audit_logs
        (admin_user_id, action, resource_type, resource_id, outcome)
       VALUES ('super-admin', 'provision_admin', 'admin_access', 'super-admin', 'success')`,
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  process.stdout.write("\nAdministrator initialized. Store these one-time recovery codes offline:\n");
  process.stdout.write(`${recoveryCodes.map(({ code }) => code).join("\n")}\n`);
  process.stdout.write("The QR code and recovery codes will not be shown again.\n");
}

try {
  await main();
} catch {
  process.stderr.write("Administrator initialization failed. No credential values were logged.\n");
  process.exitCode = 1;
} finally {
  readline.close();
}
