-- Included inside a transaction after app_role is stored via set_config.
-- Deliberately conservative: require a dedicated, membership-free login.
DO $safety$
DECLARE
  app oid := (SELECT oid FROM pg_roles WHERE rolname=current_setting('sendflow.activation_role'));
BEGIN
  IF app IS NULL THEN RAISE EXCEPTION 'Application role does not exist'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE oid=app AND
    (NOT rolcanlogin OR rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls))
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member=app) THEN
    RAISE EXCEPTION 'Use a dedicated login without elevated attributes or role memberships';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=app)
    OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner=app)
    OR EXISTS (SELECT 1 FROM pg_class WHERE relowner=app)
    OR EXISTS (SELECT 1 FROM pg_proc WHERE proowner=app)
    OR has_database_privilege(app,current_database(),'CREATE') THEN
    RAISE EXCEPTION 'Application must not own objects or have database CREATE';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema'
    AND has_schema_privilege(app,oid,'CREATE')) THEN
    RAISE EXCEPTION 'Application can CREATE in a persistent schema';
  END IF;
  IF has_parameter_privilege(app,'session_replication_role','SET')
    OR has_parameter_privilege(app,'session_replication_role','ALTER SYSTEM') THEN
    RAISE EXCEPTION 'Application can change session_replication_role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.prosecdef AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
      AND has_function_privilege(app,p.oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'Executable SECURITY DEFINER routine requires separate review/revocation';
  END IF;
END;
$safety$;
