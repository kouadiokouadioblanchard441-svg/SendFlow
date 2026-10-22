-- Run with the actual Plesk runtime login, not the migration/owner login.
-- psql -X --set=ON_ERROR_STOP=1 --file=scripts/plesk-catalogue-readonly.sql
-- Supply connection settings through the approved secret manager, never argv.
-- No customer rows, actor identifiers, credentials or configuration values emitted.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';

SELECT current_user AS effective_role, session_user AS login_role,
       current_setting('transaction_read_only') AS read_only,
       rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
FROM pg_roles WHERE rolname = current_user;

SELECT parent.rolname AS member_of
FROM pg_auth_members membership
JOIN pg_roles parent ON parent.oid = membership.roleid
JOIN pg_roles child ON child.oid = membership.member
WHERE child.rolname IN (current_user, session_user)
ORDER BY parent.rolname;

-- Missing relations remain visible, rather than disappearing from the report.
WITH expected(name) AS (VALUES
  ('sf_countries'), ('sf_operator_catalog'), ('sf_operator_pricing_rates'),
  ('sf_operation_aggregator_routes'), ('sf_payment_aggregator_routes'),
  ('sf_payment_aggregators'), ('sf_admin_audit_logs'))
SELECT expected.name, c.oid IS NOT NULL AS present,
       pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls,
       has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage,
       has_table_privilege(c.oid, 'SELECT') AS can_select,
       has_table_privilege(c.oid, 'INSERT') AS can_insert,
       has_table_privilege(c.oid, 'UPDATE') AS can_update,
       has_table_privilege(c.oid, 'DELETE') AS can_delete,
       has_table_privilege(c.oid, 'TRUNCATE') AS can_truncate
FROM expected LEFT JOIN pg_class c
  ON c.oid = to_regclass('public.' || expected.name)
ORDER BY expected.name;

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('sf_countries', 'sf_operator_catalog', 'sf_operation_aggregator_routes')
  AND column_name IN ('deposit_enabled', 'inter_network_enabled',
                      'international_enabled', 'operation')
ORDER BY table_name, column_name;

SELECT c.relname AS relation, con.conname, con.convalidated,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('sf_countries', 'sf_operation_aggregator_routes')
ORDER BY c.relname, con.conname;

SELECT c.relname AS relation, i.relname AS index_name,
       x.indisvalid, x.indisunique, pg_get_indexdef(i.oid) AS definition
FROM pg_index x JOIN pg_class c ON c.oid = x.indrelid
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'sf_operation_aggregator_routes'
ORDER BY i.relname;

-- Fail explicitly if a required relation/column/SELECT privilege is absent.
-- These are configuration aggregates, not customer or audit records.
SELECT count(*) AS countries,
       count(*) FILTER (WHERE enabled) AS enabled,
       count(*) FILTER (WHERE deposit_enabled) AS deposits,
       count(*) FILTER (WHERE inter_network_enabled) AS inter_network,
       count(*) FILTER (WHERE international_enabled) AS international
FROM public.sf_countries;

SELECT count(*) AS operators,
       count(*) FILTER (WHERE o.enabled) AS enabled,
       count(*) FILTER (WHERE o.deposit_enabled) AS deposits,
       count(*) FILTER (WHERE o.inter_network_enabled) AS inter_network,
       count(*) FILTER (WHERE o.international_enabled) AS international,
       count(*) FILTER (WHERE c.country_code IS NULL) AS unknown_country
FROM public.sf_operator_catalog o
LEFT JOIN public.sf_countries c ON c.country_code = o.country_code;

SELECT operation, count(*) AS routes
FROM public.sf_operation_aggregator_routes
GROUP BY operation ORDER BY operation;

-- Zero mismatches only proves identical stored choices NOW, not backend parity.
-- NULL aggregator is inheritance/no explicit selection, not a provider.
WITH expanded_legacy AS (
  SELECT l.scope_type, l.scope_key, op.operation, l.aggregator_code
  FROM public.sf_payment_aggregator_routes l
  CROSS JOIN (VALUES ('deposit'), ('inter-network'), ('international')) op(operation)
), compared AS (
  SELECT coalesce(n.operation, l.operation) AS operation,
         l.scope_key IS NULL AS only_new,
         n.scope_key IS NULL AS only_legacy,
         n.aggregator_code IS DISTINCT FROM l.aggregator_code AS different_choice
  FROM expanded_legacy l
  FULL JOIN public.sf_operation_aggregator_routes n
    ON n.scope_type = l.scope_type AND n.scope_key = l.scope_key
    AND n.operation = l.operation
)
SELECT operation, count(*) AS scopes,
       count(*) FILTER (WHERE only_new) AS only_new,
       count(*) FILTER (WHERE only_legacy) AS only_legacy,
       count(*) FILTER (WHERE NOT only_new AND NOT only_legacy AND different_choice)
         AS different_choices
FROM compared GROUP BY operation ORDER BY operation;

ROLLBACK;
