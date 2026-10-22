-- Additive; deploy BEFORE the matching API. Never run against shared Neon in tests.
-- No historical rows are updated or decrypted. Existing webhook receipts remain
-- metadata-only; all newly accepted status events carry an encrypted receipt.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.sf_api_request_limits (
  bucket_hash varchar(64) PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL,
  CONSTRAINT sf_api_request_limits_count_check CHECK (request_count BETWEEN 1 AND 60)
);

ALTER TABLE public.sf_identity_webhook_events
  ADD COLUMN IF NOT EXISTS payload_digest text,
  ADD COLUMN IF NOT EXISTS encrypted_payload text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS status_applied boolean;

ALTER TABLE public.sf_identity_verifications
  ADD COLUMN IF NOT EXISTS last_provider_event_at timestamptz;

CREATE OR REPLACE FUNCTION public.sf_reject_financial_history_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Financial history is append-only; a compensating entry is required'
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS sf_wallet_ledger_append_only ON public.sf_wallet_ledger;
CREATE TRIGGER sf_wallet_ledger_append_only
  BEFORE UPDATE OR DELETE ON public.sf_wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.sf_reject_financial_history_mutation();
DROP TRIGGER IF EXISTS sf_wallet_ledger_no_truncate ON public.sf_wallet_ledger;
CREATE TRIGGER sf_wallet_ledger_no_truncate
  BEFORE TRUNCATE ON public.sf_wallet_ledger
  FOR EACH STATEMENT EXECUTE FUNCTION public.sf_reject_financial_history_mutation();

DROP TRIGGER IF EXISTS sf_admin_audit_append_only ON public.sf_admin_audit_logs;
CREATE TRIGGER sf_admin_audit_append_only
  BEFORE UPDATE OR DELETE ON public.sf_admin_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.sf_reject_financial_history_mutation();
DROP TRIGGER IF EXISTS sf_admin_audit_no_truncate ON public.sf_admin_audit_logs;
CREATE TRIGGER sf_admin_audit_no_truncate
  BEFORE TRUNCATE ON public.sf_admin_audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.sf_reject_financial_history_mutation();
COMMIT;
