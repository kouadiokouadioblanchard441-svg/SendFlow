import pg from "pg";
import { resolveRuntimeDatabaseConnectionOptions } from "../../../lib/db/src/connection-config.ts";
import {
  applyLinkFlowProviderRedirectMigration,
  planLinkFlowProviderRedirectMigration,
} from "./linkflow-provider-redirect-migration.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const expected = args.find((arg) => arg.startsWith("--expected-hash="))?.slice("--expected-hash=".length);
if (process.env.SENDFLOW_DATABASE_TARGET !== "shared-external" ||
  args.some((arg) => !["--apply", "--confirm-shared-database"].includes(arg) &&
    !/^--expected-hash=[a-f0-9]{64}$/.test(arg)) ||
  (apply && (!args.includes("--confirm-shared-database") || !expected))) {
  console.error("Stopped: shared database required; writes need --apply --confirm-shared-database --expected-hash=<reviewed fingerprint>.");
  process.exit(1);
}

const client = new pg.Client({
  ...resolveRuntimeDatabaseConnectionOptions(process.env),
  application_name: "sendflow_linkflow_provider_redirect_migration",
  connectionTimeoutMillis: 10_000,
  query_timeout: 30_000,
});
try {
  await client.connect();
  if (apply) {
    console.log(JSON.stringify({
      target: "shared-external",
      ...await applyLinkFlowProviderRedirectMigration(client, expected),
    }));
  } else {
    await client.query("BEGIN READ ONLY");
    const plan = await planLinkFlowProviderRedirectMigration(client);
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ target: "shared-external", ...plan }));
  }
} catch (error) {
  console.error(JSON.stringify({
    applied: error.code === "LINKFLOW_PROVIDER_REDIRECT_POSTCONDITION_FAILED" ? "unconfirmed" : false,
    error: error.code ?? "LINKFLOW_PROVIDER_REDIRECT_MIGRATION_FAILED",
  }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
