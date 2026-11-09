import { createInterface } from "node:readline";
import pg from "pg";
import qrcode from "qrcode";
import {
  createRecoveryCodes,
  createTotpEnrollmentUri,
  createTotpSecret,
  decryptTotpSecret,
  encryptTotpSecret,
  hashRecoveryCode,
  normalizeAdminEmail,
  verifyAdminPassword,
  verifyTotpCode,
} from "../src/lib/admin-auth-crypto.ts";

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
          reject(new Error("Recovery cancelled."));
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

async function main() {
  if (process.env.SENDFLOW_ADMIN_RECOVERY_CONFIRM !== "I_UNDERSTAND") {
    throw new Error("Set the one-time confirmation flag before recovering administrator MFA.");
  }
  const connectionString = process.env.SENDFLOW_ADMIN_MAINTENANCE_DATABASE_URL?.trim();
  if (!connectionString) throw new Error("The secured database maintenance connection is not configured.");
  if (!process.env.SENDFLOW_ADMIN_TOTP_ENCRYPTION_KEY?.trim()) {
    throw new Error("The TOTP encryption key is not configured.");
  }

  const email = normalizeAdminEmail(await askVisible("Administrator email: "));
  const password = await askHidden("Administrator password: ");
  const recoveryCode = (await askHidden("Unused recovery code: ")).trim();
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
    const credentialResult = await client.query(
      `SELECT password_hash, active
       FROM sf_super_admin_credentials
       WHERE id = 1 AND email_normalized = $1`,
      [email],
    );
    const credential = credentialResult.rows[0];
    const recoveryHash = hashRecoveryCode(recoveryCode);
    if (
      !credential
      || credential.active !== true
      || !(await verifyAdminPassword(password, credential.password_hash))
      || !recoveryHash
    ) {
      throw new Error("Administrator recovery could not be verified.");
    }
    const unusedCode = await client.query(
      "SELECT code_hash FROM sf_super_admin_recovery_codes WHERE code_hash = $1 AND used_at IS NULL",
      [recoveryHash],
    );
    if (unusedCode.rowCount !== 1) throw new Error("Administrator recovery could not be verified.");

    const secret = createTotpSecret();
    const uri = createTotpEnrollmentUri(secret, email);
    process.stdout.write("\nScan this temporary QR code in Google Authenticator:\n");
    process.stdout.write(await qrcode.toString(uri, { type: "terminal", small: true }));
    const code = (await askHidden("Enter the first six-digit authenticator code: ")).trim();
    const acceptedStep = verifyTotpCode(secret, code, Date.now(), null);
    if (acceptedStep === null) throw new Error("The new authenticator code was not accepted.");
    const encryptedTotp = encryptTotpSecret(secret);
    if (!encryptedTotp || !decryptTotpSecret(encryptedTotp)) {
      throw new Error("TOTP encryption could not be verified.");
    }
    const newRecoveryCodes = createRecoveryCodes();

    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    const lockedCredential = await client.query(
      `SELECT password_hash, active
       FROM sf_super_admin_credentials
       WHERE id = 1 AND email_normalized = $1
       FOR UPDATE`,
      [email],
    );
    const current = lockedCredential.rows[0];
    if (
      !current
      || current.active !== true
      || current.password_hash !== credential.password_hash
      || !(await verifyAdminPassword(password, current.password_hash))
    ) {
      throw new Error("Administrator recovery could not be verified.");
    }
    const consumed = await client.query(
      `UPDATE sf_super_admin_recovery_codes
       SET used_at = now()
       WHERE code_hash = $1 AND used_at IS NULL
       RETURNING code_hash`,
      [recoveryHash],
    );
    if (consumed.rowCount !== 1) throw new Error("Administrator recovery could not be verified.");

    await client.query(
      `UPDATE sf_super_admin_recovery_codes
       SET used_at = coalesce(used_at, now())
       WHERE credential_id = 1`,
    );
    await client.query(
      `UPDATE sf_super_admin_credentials
       SET totp_ciphertext = $1,
           totp_nonce = $2,
           totp_auth_tag = $3,
           last_totp_step = $4,
           updated_at = now()
       WHERE id = 1`,
      [encryptedTotp.ciphertext, encryptedTotp.nonce, encryptedTotp.authTag, acceptedStep],
    );
    for (const recovery of newRecoveryCodes) {
      const codeHash = hashRecoveryCode(recovery.code);
      if (!codeHash) throw new Error("Recovery code generation failed.");
      await client.query(
        "INSERT INTO sf_super_admin_recovery_codes (credential_id, code_hash) VALUES (1, $1)",
        [codeHash],
      );
    }
    await client.query(
      `UPDATE sf_super_admin_sessions
       SET revoked_at = now(), revocation_reason = 'mfa_recovery'
       WHERE revoked_at IS NULL`,
    );
    await client.query(
      `UPDATE sf_super_admin_refresh_tokens
       SET revoked_at = now()
       WHERE revoked_at IS NULL`,
    );
    await client.query(
      `UPDATE sf_super_admin_step_up_tokens
       SET consumed_at = now()
       WHERE consumed_at IS NULL`,
    );
    await client.query(
      `INSERT INTO sf_admin_audit_logs
        (admin_user_id, action, resource_type, resource_id, outcome)
       VALUES ('super-admin', 'admin_recovery', 'admin_access', 'super-admin', 'success')`,
    );
    await client.query("COMMIT");

    process.stdout.write("\nMFA recovery completed. Store these new one-time recovery codes offline:\n");
    process.stdout.write(`${newRecoveryCodes.map(({ code: value }) => value).join("\n")}\n`);
    process.stdout.write("All administrator sessions were revoked. The QR and codes will not be shown again.\n");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

try {
  await main();
} catch {
  process.stderr.write("Administrator MFA recovery failed. No credential values were logged.\n");
  process.exitCode = 1;
} finally {
  readline.close();
}
