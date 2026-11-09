import { createHash } from "node:crypto";
import pg from "pg";
import { resolveRuntimeDatabaseConnectionOptions } from "../../../lib/db/src/connection-config.ts";

const providerCodes = ["feexpay", "paydunya"];
const providerNames = { feexpay: "FeexPay", paydunya: "PayDunya" };
const actor = "system:explicit-provider-activation";
const reason = "Owner explicitly requested provider enablement; provider flags only, no routes, fees, payout settings, or payment rows changed.";
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const expected = args.find((arg) => arg.startsWith("--expected-hash="))?.slice("--expected-hash=".length);

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

if (process.env.SENDFLOW_DATABASE_TARGET !== "shared-external" ||
  args.some((arg) => !["--apply", "--confirm-shared-database"].includes(arg) &&
    !/^--expected-hash=[a-f0-9]{64}$/.test(arg)) ||
  (apply && (!args.includes("--confirm-shared-database") || !expected))) {
  console.error("Stopped: shared Supabase target required; writes need --apply --confirm-shared-database --expected-hash=<reviewed fingerprint>.");
  process.exit(1);
}

const client = new pg.Client({
  ...resolveRuntimeDatabaseConnectionOptions(process.env),
  application_name: "sendflow_payment_provider_activation",
  connectionTimeoutMillis: 10_000,
  query_timeout: 20_000,
});

async function readState() {
  const [providers, routes] = await Promise.all([
    client.query(
      `SELECT code, name, enabled, version
       FROM public.sf_payment_aggregators
       WHERE code = ANY($1::text[])
       ORDER BY code`,
      [providerCodes],
    ),
    client.query(
      `SELECT count(*)::int AS route_count
       FROM public.sf_operation_aggregator_routes
       WHERE aggregator_code = ANY($1::text[])`,
      [providerCodes],
    ),
  ]);
  return { providers: providers.rows, routeCount: routes.rows[0]?.route_count ?? null };
}

function planFromState(current) {
  const conflicts = [];
  const missingProviders = providerCodes.filter((code) =>
    !current.providers.some((provider) => provider.code === code));
  for (const provider of current.providers) {
    if (provider.name !== providerNames[provider.code]) {
      conflicts.push(`Unexpected provider name for ${provider.code}`);
    }
  }
  if (current.routeCount !== 0) {
    conflicts.push("Provider routes exist; activation-only plan requires no routes to be changed or newly activated");
  }
  if (current.providers.some((provider) => !Number.isInteger(provider.version) || provider.version < 1)) {
    conflicts.push("Provider version is invalid");
  }
  return {
    target: process.env.SENDFLOW_DATABASE_TARGET,
    providerCodes,
    current,
    missingProviders,
    conflicts,
    changes: current.providers
      .filter((provider) => !provider.enabled)
      .map((provider) => ({ code: provider.code, enabled: true, expectedVersion: provider.version })),
  };
}

try {
  await client.connect();
  if (!apply) {
    await client.query("BEGIN READ ONLY");
    const plan = planFromState(await readState());
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ ...plan, fingerprint: hash(plan) }, null, 2));
  } else {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sendflow:payment-provider:explicit-activation'))");
    const plan = planFromState(await readState());
    if (hash(plan) !== expected || plan.conflicts.length || plan.missingProviders.length) {
      const error = new Error("Provider activation plan changed or contains conflicts");
      error.code = "PROVIDER_ACTIVATION_PLAN_CHANGED";
      throw error;
    }

    let updated = 0;
    for (const change of plan.changes) {
      const result = await client.query(
        `UPDATE public.sf_payment_aggregators
         SET enabled = true, version = version + 1, updated_by = $3, updated_at = now()
         WHERE code = $1 AND version = $2 AND enabled = false
         RETURNING code, enabled, version`,
        [change.code, change.expectedVersion, actor],
      );
      if (result.rowCount !== 1) {
        const error = new Error("Provider version changed during activation");
        error.code = "PROVIDER_ACTIVATION_VERSION_CONFLICT";
        throw error;
      }
      await client.query(
        `INSERT INTO public.sf_admin_audit_logs
          (admin_user_id, action, resource_type, resource_id, reason)
         VALUES ($1, 'update_payment_aggregator', 'payment_aggregator', $2, $3)`,
        [actor, change.code, reason],
      );
      updated++;
    }
    const postState = await readState();
    if (postState.providers.length !== providerCodes.length ||
      postState.providers.some((provider) => !provider.enabled) ||
      postState.routeCount !== 0) {
      const error = new Error("Provider activation postcondition failed");
      error.code = "PROVIDER_ACTIVATION_POSTCONDITION_FAILED";
      throw error;
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({
      target: "shared-external",
      activated: postState.providers.map(({ code, enabled, version }) => ({ code, enabled, version })),
      updated,
      routesChanged: 0,
      paymentRowsChanged: 0,
      auditRowsCreated: updated,
    }));
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({
    applied: false,
    error: error.code ?? "PROVIDER_ACTIVATION_FAILED",
  }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
