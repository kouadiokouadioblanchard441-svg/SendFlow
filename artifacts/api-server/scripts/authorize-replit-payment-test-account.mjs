import pg from "pg";
import { resolveRuntimeDatabaseUrl } from "../../../lib/db/src/connection-config.ts";
import { createSensitiveDataLookupIndex } from "../src/lib/sensitive-data-crypto.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
if (
  process.env.SENDFLOW_DATABASE_TARGET !== "shared-neon" ||
  process.env.FEEXPAY_EXECUTION_HOST !== "replit" ||
  !process.env.SENDFLOW_PAYMENT_TEST_PHONE ||
  args.some((arg) => !["--apply", "--confirm-shared-neon"].includes(arg)) ||
  (apply && !args.includes("--confirm-shared-neon"))
) {
  console.error("Stopped: shared-Neon Replit target and SENDFLOW_PAYMENT_TEST_PHONE are required; writes require --apply --confirm-shared-neon.");
  process.exit(1);
}

const phoneHash = createSensitiveDataLookupIndex(process.env.SENDFLOW_PAYMENT_TEST_PHONE, "user-phone");
const client = new pg.Client({
  connectionString: resolveRuntimeDatabaseUrl(process.env),
  application_name: "sendflow_authorize_replit_payment_test_account",
  connectionTimeoutMillis: 10_000,
  query_timeout: 30_000,
});
let committed = false;
try {
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  await client.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='10s'");
  const lock = await client.query(
    "SELECT pg_try_advisory_xact_lock(hashtextextended('sf_replit_payment_test_access',0)) AS acquired",
  );
  if (!lock.rows[0].acquired) throw Object.assign(new Error(), { code: "TEST_ACCESS_LOCKED" });

  const { rows } = await client.query(`SELECT u.id,u.status::text AS status,u.phone_verified_at,
      c.password_hash,c.pin_hash,
      EXISTS(SELECT 1 FROM public.sf_preview_access p WHERE p.user_id=u.id) AS is_viewer,
      EXISTS(SELECT 1 FROM public.sf_replit_payment_test_access a
        WHERE a.user_id=u.id AND a.state='active') AS already_authorized
    FROM public.sf_users u
    JOIN public.sf_customer_credentials c ON c.user_id=u.id
    WHERE u.phone_lookup_hash=$1
    FOR UPDATE OF u`, [phoneHash]);
  if (rows.length !== 1) throw Object.assign(new Error(), { code: "TEST_ACCOUNT_NOT_FOUND" });
  const account = rows[0];
  if (account.is_viewer) throw Object.assign(new Error(), { code: "VIEWER_CANNOT_BE_PAYMENT_ACCOUNT" });
  if (account.status !== "active" || !account.phone_verified_at ||
    !account.password_hash?.startsWith("scrypt$v1$") ||
    !account.pin_hash || account.password_hash.startsWith("scrypt$preview-v1$")) {
    throw Object.assign(new Error(), { code: "TEST_ACCOUNT_NOT_READY" });
  }
  if (account.already_authorized) {
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ target: "shared-neon", alreadyAuthorized: true, activeTestAccounts: 1 }));
    process.exit(0);
  }
  const { rows: activeRows } = await client.query(
    "SELECT count(*)::int AS count FROM public.sf_replit_payment_test_access WHERE state='active'",
  );
  if (activeRows[0].count !== 0) throw Object.assign(new Error(), { code: "ANOTHER_TEST_ACCOUNT_IS_AUTHORIZED" });
  if (!apply) {
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ target: "shared-neon", eligible: true, activeTestAccounts: 0, writes: false }));
    process.exit(0);
  }

  await client.query(`INSERT INTO public.sf_replit_payment_test_access
    (user_id,state,granted_by,reason)
    VALUES($1,'active','user-authorized-replit-test','One separate verified customer account authorized for Replit live-payment tests.')`,
  [account.id]);
  await client.query("COMMIT");
  committed = true;
  console.log(JSON.stringify({ target: "shared-neon", authorized: true, activeTestAccounts: 1 }));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({ authorized: false, error: error.code ?? "TEST_ACCOUNT_AUTHORIZATION_FAILED" }));
  process.exitCode = 1;
} finally {
  // Do not echo the account phone, its hash, the account ID, or database URL.
  await client.end().catch(() => {});
  void committed;
}
