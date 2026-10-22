DO $acl$
DECLARE
  app oid := (SELECT oid FROM pg_roles WHERE rolname=current_setting('sendflow.activation_role'));
  tbl regclass;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['public.sf_wallet_ledger'::regclass,'public.sf_admin_audit_logs'::regclass] LOOP
    IF has_table_privilege(app,tbl,'UPDATE') OR has_any_column_privilege(app,tbl,'UPDATE')
      OR has_table_privilege(app,tbl,'DELETE') OR has_table_privilege(app,tbl,'TRUNCATE')
      OR has_table_privilege(app,tbl,'TRIGGER')
      OR NOT has_table_privilege(app,tbl,'SELECT') OR NOT has_table_privilege(app,tbl,'INSERT') THEN
      RAISE EXCEPTION 'Incorrect effective append-only ACL: %',tbl;
    END IF;
  END LOOP;
  IF NOT has_schema_privilege(app,'public','USAGE')
    OR NOT has_table_privilege(app,'public.sf_api_request_limits','SELECT')
    OR NOT has_table_privilege(app,'public.sf_api_request_limits','INSERT')
    OR NOT has_table_privilege(app,'public.sf_api_request_limits','UPDATE') THEN
    RAISE EXCEPTION 'Application lacks schema/quota privileges';
  END IF;
END;
$acl$;
