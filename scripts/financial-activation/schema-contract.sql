-- Included by preflight.sql. Catalogs only; no customer rows are read.
DO $contract$
DECLARE
  item record;
  actual record;
  target oid;
  phase text := current_setting('sendflow.activation_phase');
BEGIN
  IF phase NOT IN ('before', 'after') THEN
    RAISE EXCEPTION 'phase must be before or after';
  END IF;
  IF current_setting('server_version_num')::integer < 150000 THEN
    RAISE EXCEPTION 'PostgreSQL 15+ required for parameter privilege checks';
  END IF;
  FOR item IN SELECT * FROM (VALUES
    ('sf_wallets'), ('sf_transactions'), ('sf_wallet_ledger'),
    ('sf_admin_audit_logs'), ('sf_identity_webhook_events'), ('sf_identity_verifications')
  ) AS v(name) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=item.name AND c.relkind='r'
        AND NOT c.relispartition AND NOT EXISTS
          (SELECT 1 FROM pg_inherits WHERE inhrelid=c.oid OR inhparent=c.oid)) THEN
      RAISE EXCEPTION 'Missing or unsupported baseline table: %', item.name;
    END IF;
  END LOOP;
  -- The affected SQL contract, not a synchronization of the entire Drizzle schema.
  FOR item IN SELECT * FROM (VALUES
    ('sf_wallet_ledger','id','uuid',true,false),
    ('sf_wallet_ledger','wallet_id','uuid',true,false),
    ('sf_wallet_ledger','user_id','text',true,false),
    ('sf_wallet_ledger','direction','sf_wallet_ledger_direction',true,false),
    ('sf_wallet_ledger','amount_minor','bigint',true,false),
    ('sf_wallet_ledger','balance_before_minor','bigint',true,false),
    ('sf_wallet_ledger','balance_after_minor','bigint',true,false),
    ('sf_wallet_ledger','idempotency_key','character varying(128)',true,false),
    ('sf_admin_audit_logs','id','uuid',true,false),
    ('sf_admin_audit_logs','admin_user_id','character varying(255)',true,false),
    ('sf_admin_audit_logs','action','character varying(64)',true,false),
    ('sf_admin_audit_logs','resource_type','character varying(32)',true,false),
    ('sf_admin_audit_logs','resource_id','text',true,false),
    ('sf_wallets','balance_minor','bigint',true,false),
    ('sf_transactions','amount_minor','bigint',true,false),
    ('sf_transactions','fee_minor','bigint',true,false),
    ('sf_identity_verifications','provider_session_id','text',true,false),
    ('sf_identity_verifications','status','text',true,false),
    ('sf_identity_webhook_events','event_id','text',true,false),
    ('sf_identity_webhook_events','provider_session_id','text',true,false),
    ('sf_identity_webhook_events','event_type','text',true,false),
    ('sf_identity_webhook_events','matched_verification','boolean',true,false),
    ('sf_identity_webhook_events','received_at','timestamp with time zone',true,false),
    ('sf_identity_webhook_events','payload_digest','text',false,true),
    ('sf_identity_webhook_events','encrypted_payload','text',false,true),
    ('sf_identity_webhook_events','status','text',false,true),
    ('sf_identity_webhook_events','status_applied','boolean',false,true),
    ('sf_identity_verifications','last_provider_event_at','timestamp with time zone',false,true),
    ('sf_api_request_limits','bucket_hash','character varying(64)',true,true),
    ('sf_api_request_limits','window_started_at','timestamp with time zone',true,true),
    ('sf_api_request_limits','request_count','integer',true,true)
  ) AS v(tbl,col,typ,required,added) LOOP
    SELECT format_type(a.atttypid,a.atttypmod) AS typ, a.attnotnull AS required,
      a.attgenerated, a.attidentity INTO actual
      FROM pg_attribute a WHERE a.attrelid=to_regclass('public.'||item.tbl)
        AND a.attname=item.col AND a.attnum>0 AND NOT a.attisdropped;
    IF NOT FOUND THEN
      IF phase='before' AND item.added AND
        (item.tbl<>'sf_api_request_limits' OR to_regclass('public.sf_api_request_limits') IS NULL)
        THEN CONTINUE; END IF;
      RAISE EXCEPTION 'Missing column %.%', item.tbl,item.col;
    END IF;
    IF actual.typ<>item.typ OR actual.required<>item.required
      OR actual.attgenerated<>'' OR actual.attidentity<>'' THEN
      RAISE EXCEPTION 'Incompatible column %.% (type/nullability/generated)',item.tbl,item.col;
    END IF;
  END LOOP;
  -- IF NOT EXISTS does not repair a wrong table or conflicting function.
  target := to_regclass('public.sf_api_request_limits');
  IF target IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=target AND relkind='r' AND NOT relispartition)
      OR EXISTS (SELECT 1 FROM pg_inherits WHERE inhrelid=target OR inhparent=target)
      OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=target AND contype='p'
        AND conkey=ARRAY[(SELECT attnum FROM pg_attribute
          WHERE attrelid=target AND attname='bucket_hash')]::smallint[])
      OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=target
        AND conname='sf_api_request_limits_count_check' AND contype='c' AND convalidated
        AND pg_get_expr(conbin,conrelid)='((request_count >= 1) AND (request_count <= 60))') THEN
      RAISE EXCEPTION 'Incompatible quota table/primary key/check';
    END IF;
  END IF;
  FOR item IN SELECT * FROM (VALUES
    ('sf_wallet_ledger','idempotency_key','u'),
    ('sf_identity_webhook_events','event_id','p'),
    ('sf_identity_verifications','provider_session_id','u')
  ) AS v(tbl,col,kind) LOOP
    target:=to_regclass('public.'||item.tbl);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=target
      AND contype::text=item.kind AND NOT condeferrable
      AND conkey=ARRAY[(SELECT attnum FROM pg_attribute
        WHERE attrelid=target AND attname=item.col)]::smallint[]) THEN
      RAISE EXCEPTION 'Missing immediate uniqueness: %.%',item.tbl,item.col;
    END IF;
  END LOOP;
  IF phase='after' THEN
    FOR item IN SELECT * FROM (VALUES
      ('sf_wallet_ledger','sf_wallet_ledger_append_only',27),
      ('sf_wallet_ledger','sf_wallet_ledger_no_truncate',34),
      ('sf_admin_audit_logs','sf_admin_audit_append_only',27),
      ('sf_admin_audit_logs','sf_admin_audit_no_truncate',34)
    ) AS v(tbl,name,kind) LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.'||item.tbl)
        AND tgname=item.name AND tgtype=item.kind AND tgenabled IN ('O','A')
        AND NOT tgisinternal AND tgnargs=0 AND tgqual IS NULL
        AND tgfoid=to_regprocedure('public.sf_reject_financial_history_mutation()')) THEN
        RAISE EXCEPTION 'Missing or altered append-only trigger: %',item.name;
      END IF;
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.sf_reject_financial_history_mutation()')
      AND NOT prosecdef AND prorettype='trigger'::regtype
      AND prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
      AND proconfig=ARRAY['search_path=pg_catalog']
      AND btrim(prosrc)=btrim($body$
BEGIN
  RAISE EXCEPTION 'Financial history is append-only; a compensating entry is required'
    USING ERRCODE = '23514';
END;
$body$)) THEN
      RAISE EXCEPTION 'Missing or altered append-only function';
    END IF;
  END IF;
END;
$contract$;
