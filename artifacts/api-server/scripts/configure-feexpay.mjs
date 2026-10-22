import pg from "pg";
import { resolveRuntimeDatabaseUrl } from "../../../lib/db/src/connection-config.ts";
import { planFeexpayConfiguration } from "../src/providers/feexpay/configuration-plan.ts";
import { applyFeexpayConfiguration, readFeexpayConfiguration } from "../src/providers/feexpay/configuration-store.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const fingerprint = args.find((argument) => argument.startsWith("--expected-hash="))?.slice("--expected-hash=".length);
if (args.some((arg) => !["--apply", "--confirm-shared-neon"].includes(arg) && !/^--expected-hash=[a-f0-9]{64}$/.test(arg)) ||
    (apply && (!args.includes("--confirm-shared-neon") || !fingerprint)) ||
    process.env.SENDFLOW_DATABASE_TARGET !== "shared-neon") {
  console.error("Stopped: explicit shared-neon target required; writes also require --apply --confirm-shared-neon --expected-hash=<reviewed hash>.");
  process.exit(1);
}
const pool = new pg.Pool({
  connectionString: resolveRuntimeDatabaseUrl(process.env),
  application_name: "sendflow_feexpay_configuration",
  connectionTimeoutMillis: 10_000, query_timeout: 20_000,
});
let client;
try {
  client = await pool.connect();
  if (apply) {
    console.log(JSON.stringify({
      target: "shared-neon", applied: true,
      created: await applyFeexpayConfiguration(client, fingerprint),
      financialExecutionEnabled: false,
    }));
  } else {
    await client.query("BEGIN READ ONLY");
    const plan = planFeexpayConfiguration(await readFeexpayConfiguration(client));
    await client.query("ROLLBACK");
    const routesByCountry = {};
    for (const route of plan.newRoutes) routesByCountry[route.country_code] = (routesByCountry[route.country_code] ?? 0) + 1;
    console.log(JSON.stringify({
      target: "shared-neon", applied: false, fingerprint: plan.fingerprint,
      createProvider: plan.createProvider,
      operatorsToCreate: plan.newOperators.map((operator) => operator.operator_id),
      routesToCreate: plan.newRoutes.length, routesByCountry,
      pendingCurrencyCountries: plan.pendingCurrencyCountries, conflicts: plan.conflicts,
      countryDefaultsChanged: false, activationsChanged: false, feesChanged: false,
    }, null, 2));
  }
} catch (error) {
  // Never print connection strings, driver messages or underlying credentials.
  console.error(JSON.stringify({
    applied: error.code === "CONFIGURATION_OUTCOME_UNKNOWN" ? "unconfirmed" : false,
    error: error.code ?? "CONFIGURATION_FAILED",
  }));
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
