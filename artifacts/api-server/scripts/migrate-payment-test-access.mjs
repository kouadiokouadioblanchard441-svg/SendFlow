import pg from "pg";
import { resolveRuntimeDatabaseUrl } from "../../../lib/db/src/connection-config.ts";
import { applyPaymentTestAccess, planPaymentTestAccess } from "./payment-test-access-migration.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const expected = args.find((x) => x.startsWith("--expected-hash="))?.slice("--expected-hash=".length);
if (
  process.env.SENDFLOW_DATABASE_TARGET !== "shared-neon" ||
  args.some((x) => !["--apply", "--confirm-shared-neon"].includes(x) && !/^--expected-hash=[a-f0-9]{64}$/.test(x)) ||
  (apply && (!args.includes("--confirm-shared-neon") || !expected))
) {
  console.error("Stopped: shared-neon required; writes require --apply --confirm-shared-neon --expected-hash=<reviewed fingerprint>.");
  process.exit(1);
}
const client = new pg.Client({
  connectionString: resolveRuntimeDatabaseUrl(process.env),
  application_name: "sendflow_payment_test_access_migration",
  connectionTimeoutMillis: 10_000,
  query_timeout: 30_000,
});
try {
  await client.connect();
  if (apply) {
    console.log(JSON.stringify({ target: "shared-neon", ...await applyPaymentTestAccess(client, expected) }));
  } else {
    await client.query("BEGIN READ ONLY");
    const plan = await planPaymentTestAccess(client);
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ target: "shared-neon", ...plan }));
  }
} catch (error) {
  console.error(JSON.stringify({
    applied: error.code === "PAYMENT_TEST_ACCESS_OUTCOME_UNKNOWN" ? "unconfirmed" : false,
    error: error.code ?? "PAYMENT_TEST_ACCESS_MIGRATION_FAILED",
  }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
