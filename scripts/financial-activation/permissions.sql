-- NOT AUTO-RUN. Requires separate explicit authorization; run as the object owner/DBA.
\set ON_ERROR_STOP on
\if :{?app_role}
\else
  DO $$ BEGIN RAISE EXCEPTION 'Required: -v app_role=DEDICATED_APPLICATION_LOGIN'; END $$;
\endif
\if :{?approve_permissions}
\else
  DO $$ BEGIN RAISE EXCEPTION 'Required: -v approve_permissions=yes after explicit authorization'; END $$;
\endif
SELECT :'approve_permissions'='yes' AS approved \gset
\if :approved
\else
  DO $$ BEGIN RAISE EXCEPTION 'approve_permissions must be yes'; END $$;
\endif
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT set_config('sendflow.activation_role', :'app_role', true) AS role_setting,
       set_config('sendflow.activation_phase', 'after', true) AS phase_setting;
\ir schema-contract.sql
-- PUBLIC grants cannot be negated by a REVOKE from the application login.
-- The impact on other logins must be approved and rehearsed beforehand.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM :"app_role";
-- These existing SECURITY DEFINER trigger guards need no caller EXECUTE at
-- firing time. Remove direct invocation privileges, NOT the guards themselves.
-- Every other accessible elevated routine remains a blocking finding.
SELECT format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, %I',p.oid::regprocedure,:'app_role')
  FROM pg_proc p WHERE p.oid IN (
    to_regprocedure('public.sf_guard_preview_password()'),
    to_regprocedure('public.sf_guard_preview_session()'))
    AND p.prorettype='trigger'::regtype \gexec
\ir role-safety.sql
REVOKE ALL PRIVILEGES ON public.sf_wallet_ledger,public.sf_admin_audit_logs FROM PUBLIC;
REVOKE ALL PRIVILEGES ON public.sf_wallet_ledger,public.sf_admin_audit_logs FROM :"app_role";
-- Table-level REVOKE does not remove column-level UPDATE grants.
SELECT format('REVOKE UPDATE (%I) ON %I.%I FROM PUBLIC, %I',a.attname,n.nspname,c.relname,:'app_role')
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN ('sf_wallet_ledger','sf_admin_audit_logs')
    AND a.attnum>0 AND NOT a.attisdropped \gexec
GRANT USAGE ON SCHEMA public TO :"app_role";
GRANT SELECT,INSERT ON public.sf_wallet_ledger,public.sf_admin_audit_logs TO :"app_role";
GRANT SELECT,INSERT,UPDATE ON public.sf_api_request_limits TO :"app_role";
\ir assert-permissions.sql
COMMIT;
