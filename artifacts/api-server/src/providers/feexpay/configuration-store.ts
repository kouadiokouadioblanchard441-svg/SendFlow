import type { PoolClient } from "@workspace/db";
import { planFeexpayConfiguration, type FeexpayConfigurationSnapshot } from "./configuration-plan.ts";

export async function readFeexpayConfiguration(client: PoolClient): Promise<FeexpayConfigurationSnapshot> {
  const countries = (await client.query(`SELECT country_code,country_name,phone_prefix,
    min_phone_digits,max_phone_digits,enabled,deposit_enabled,inter_network_enabled,
    international_enabled,version FROM sf_countries ORDER BY country_code`)).rows;
  const operators = (await client.query(`SELECT operator_id,country_code,name,short_name,initials,brand,
    enabled,deposit_enabled,inter_network_enabled,international_enabled,version
    FROM sf_operator_catalog ORDER BY operator_id`)).rows;
  const providers = (await client.query("SELECT code,name,enabled,version FROM sf_payment_aggregators ORDER BY code")).rows;
  const routes = (await client.query(`SELECT scope_type,scope_key,country_code,operation,
    operator_id,aggregator_code,version FROM sf_operation_aggregator_routes
    ORDER BY scope_type,scope_key,operation`)).rows;
  return { countries, operators, providers, routes };
}

export class FeexpayConfigurationError extends Error {
  readonly code: "STALE_PLAN" | "MANUAL_CONFIGURATION_CONFLICT" | "CONFIGURATION_OUTCOME_UNKNOWN";
  constructor(code: "STALE_PLAN" | "MANUAL_CONFIGURATION_CONFLICT" | "CONFIGURATION_OUTCOME_UNKNOWN") {
    super(code);
    this.name = "FeexpayConfigurationError";
    this.code = code;
  }
}

/**
 * Explicit operational configuration, never a startup seed.
 * Inserts only: no activation, price change, country change or financial write.
 */
export async function applyFeexpayConfiguration(client: PoolClient, expectedFingerprint: string) {
  const actor = "system:feexpay-configuration";
  const created = { providers: 0, operators: 0, routes: 0, audits: 0 };
  let commitStarted = false;
  await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sendflow:feexpay:configuration'))");
    const plan = planFeexpayConfiguration(await readFeexpayConfiguration(client));
    if (!/^[a-f0-9]{64}$/.test(expectedFingerprint) || expectedFingerprint !== plan.fingerprint) {
      throw new FeexpayConfigurationError("STALE_PLAN");
    }
    if (plan.conflicts.length) throw new FeexpayConfigurationError("MANUAL_CONFIGURATION_CONFLICT");
    const reason = `FeexPay operator configuration, reviewed plan ${plan.fingerprint}; no activation or financial write`;
    async function audit(action: string, resourceType: string, resourceId: string) {
      await client.query(`INSERT INTO sf_admin_audit_logs
        (admin_user_id,action,resource_type,resource_id,reason) VALUES ($1,$2,$3,$4,$5)`,
      [actor, action, resourceType, resourceId, reason]);
      created.audits++;
    }
    if (plan.createProvider) {
      await client.query(`INSERT INTO sf_payment_aggregators
        (code,name,enabled,version,created_by,updated_by) VALUES ($1,$2,false,1,$3,$3)`,
      ["feexpay", "FeexPay", actor]);
      created.providers++;
      await audit("create_payment_aggregator", "payment_aggregator", "feexpay");
    }
    for (const operator of plan.newOperators) {
      await client.query(`INSERT INTO sf_operator_catalog
        (operator_id,country_code,name,short_name,initials,brand,enabled,
        deposit_enabled,inter_network_enabled,international_enabled,version,created_by,updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,false,false,false,false,1,$7,$7)`,
      [operator.operator_id, operator.country_code, operator.name, operator.short_name, operator.initials, operator.brand, actor]);
      created.operators++;
      await audit("create_operator", "operator", operator.operator_id);
    }
    for (const route of plan.newRoutes) {
      const scopeKey = `${route.country_code}:${route.operator_id}`;
      const result = await client.query(`INSERT INTO sf_operation_aggregator_routes
        (scope_type,scope_key,country_code,operation,operator_id,aggregator_code,version,created_by,updated_by)
        VALUES ('operator',$1,$2,$3,$4,'feexpay',1,$5,$5) RETURNING id`,
      [scopeKey, route.country_code, route.operation, route.operator_id, actor]);
      created.routes++;
      await audit("update_payment_route", "payment_route", result.rows[0].id);
    }
    commitStarted = true;
    await client.query("COMMIT");
    return created;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (commitStarted) throw new FeexpayConfigurationError("CONFIGURATION_OUTCOME_UNKNOWN");
    throw error;
  }
}
