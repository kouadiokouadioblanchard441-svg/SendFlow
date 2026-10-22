\set ON_ERROR_STOP on
\if :{?app_role}
\else
  DO $$ BEGIN RAISE EXCEPTION 'Required: -v app_role=DEDICATED_APPLICATION_LOGIN'; END $$;
\endif
\if :{?phase}
\else
  DO $$ BEGIN RAISE EXCEPTION 'Required: -v phase=before OR -v phase=after'; END $$;
\endif
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT set_config('sendflow.activation_role', :'app_role', true) AS role_setting,
       set_config('sendflow.activation_phase', :'phase', true) AS phase_setting;
SELECT current_database() AS database, current_user AS inspecting_role,
  current_setting('server_version') AS postgres_version;
\ir schema-contract.sql
-- Inventory is metadata only. BEFORE is not an approval of the existing ACL.
SELECT rolname,rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls,rolcanlogin
  FROM pg_roles WHERE rolname=:'app_role';
SELECT parent.rolname AS granted_role, m.admin_option
  FROM pg_auth_members m JOIN pg_roles child ON child.oid=m.member
  JOIN pg_roles parent ON parent.oid=m.roleid WHERE child.rolname=:'app_role';
SELECT c.relname,pg_get_userbyid(c.relowner) AS owner,c.relacl
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN
    ('sf_wallet_ledger','sf_admin_audit_logs','sf_api_request_limits');
SELECT c.conrelid::regclass AS tbl,c.conname,c.convalidated,pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c WHERE c.conrelid IN
    ('public.sf_wallets'::regclass,'public.sf_transactions'::regclass,
     'public.sf_wallet_ledger'::regclass,'public.sf_identity_webhook_events'::regclass,
     'public.sf_identity_verifications'::regclass,to_regclass('public.sf_api_request_limits'))
  ORDER BY 1,2;
SELECT tgrelid::regclass AS tbl,tgname,tgenabled,pg_get_triggerdef(oid) AS definition
  FROM pg_trigger WHERE tgrelid IN
    ('public.sf_wallet_ledger'::regclass,'public.sf_admin_audit_logs'::regclass) AND NOT tgisinternal;
SELECT pg_get_functiondef(to_regprocedure('public.sf_reject_financial_history_mutation()'))
  AS existing_history_guard;
SELECT p.oid::regprocedure AS routine,pg_get_userbyid(p.proowner) AS owner
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.prosecdef AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
    AND has_function_privilege(:'app_role',p.oid,'EXECUTE');
SELECT :'phase'='after' AS check_after \gset
\if :check_after
  \ir role-safety.sql
  \ir assert-permissions.sql
\endif
ROLLBACK;
\echo 'Catalog checks passed. Manual runbook gates and real restore rehearsal are still required.'
