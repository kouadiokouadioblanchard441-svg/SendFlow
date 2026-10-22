-- Owner-only, explicitly invoked after the admin-access migration. Never auto-run on merge.
\set ON_ERROR_STOP on
\if :{?app_role}
\else
  DO $$ BEGIN RAISE EXCEPTION 'Required: -v app_role=DEDICATED_APPLICATION_LOGIN'; END $$;
\endif
BEGIN;
REVOKE ALL ON sf_admin_grants FROM PUBLIC, :"app_role";
-- Also remove existing column-level grants, which table-level REVOKE does not clear.
SELECT format('REVOKE INSERT (%I), UPDATE (%I), REFERENCES (%I) ON public.sf_admin_grants FROM PUBLIC, %I',
  attname,attname,attname,:'app_role')
  FROM pg_attribute WHERE attrelid='public.sf_admin_grants'::regclass
  AND attnum>0 AND NOT attisdropped \gexec
GRANT SELECT ON sf_admin_grants TO :"app_role";
REVOKE ALL ON sf_admin_sessions FROM PUBLIC, :"app_role";
GRANT SELECT, INSERT, UPDATE ON sf_admin_sessions TO :"app_role";
REVOKE EXECUTE ON FUNCTION sf_rotate_admin_authorization() FROM PUBLIC, :"app_role";
-- Reject application roles that own the table or inherit another role's write permissions.
SELECT has_table_privilege(:'app_role','sf_admin_grants','INSERT')
  OR has_table_privilege(:'app_role','sf_admin_grants','UPDATE')
  OR has_table_privilege(:'app_role','sf_admin_grants','DELETE')
  OR has_any_column_privilege(:'app_role','sf_admin_grants','INSERT')
  OR has_any_column_privilege(:'app_role','sf_admin_grants','UPDATE')
  OR EXISTS(SELECT 1 FROM pg_class WHERE oid='sf_admin_grants'::regclass
    AND pg_has_role(:'app_role',relowner,'USAGE')) AS unsafe \gset
\if :unsafe
  DO $$ BEGIN RAISE EXCEPTION 'Application role can change administrator grants or owns the table'; END $$;
\endif
COMMIT;
