-- Restrict Replit's shared-Neon live-payment path to one explicitly approved,
-- verified customer account, separate from the read-only preview viewer.
CREATE TABLE public.sf_replit_payment_test_access (
  user_id text PRIMARY KEY REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  state varchar(12) NOT NULL DEFAULT 'active' CHECK (state IN ('active','revoked')),
  granted_by varchar(120) NOT NULL,
  reason varchar(500) NOT NULL CHECK (length(reason) BETWEEN 10 AND 500),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by varchar(120),
  revoked_at timestamptz,
  CONSTRAINT sf_replit_payment_test_access_state_check CHECK (
    (state='active' AND revoked_at IS NULL AND revoked_by IS NULL)
    OR (state='revoked' AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
  )
);
CREATE UNIQUE INDEX sf_replit_payment_test_access_one_active_uq
  ON public.sf_replit_payment_test_access(state) WHERE state='active';

CREATE FUNCTION public.sf_guard_replit_payment_test_access() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE account_state text; phone_verified_at timestamptz; credential_hash text;
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT u.status::text,u.phone_verified_at,c.password_hash
      INTO account_state,phone_verified_at,credential_hash
      FROM public.sf_users u
      LEFT JOIN public.sf_customer_credentials c ON c.user_id=u.id
      WHERE u.id=NEW.user_id;
    IF NOT FOUND OR account_state<>'active' OR phone_verified_at IS NULL OR credential_hash IS NULL
      OR credential_hash LIKE 'scrypt$preview-v1$%'
      OR EXISTS(SELECT 1 FROM public.sf_preview_access p
        WHERE p.slot=1 AND p.user_id=NEW.user_id AND p.revoked_at IS NULL AND p.expires_at>now()) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payment test access requires a separate active, phone-verified customer';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW)-ARRAY['state','revoked_by','revoked_at'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','revoked_by','revoked_at'])
    OR OLD.state<>'active' OR NEW.state<>'revoked' OR NEW.revoked_at IS NULL
    OR NEW.revoked_by IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Test-payment access grants are immutable except for revocation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sf_replit_payment_test_access_guard
  BEFORE INSERT OR UPDATE ON public.sf_replit_payment_test_access
  FOR EACH ROW EXECUTE FUNCTION public.sf_guard_replit_payment_test_access();
CREATE TRIGGER sf_replit_payment_test_access_no_delete
  BEFORE DELETE ON public.sf_replit_payment_test_access
  FOR EACH ROW EXECUTE FUNCTION public.sf_payments_reject_history_mutation();
CREATE TRIGGER sf_replit_payment_test_access_no_truncate
  BEFORE TRUNCATE ON public.sf_replit_payment_test_access
  FOR EACH STATEMENT EXECUTE FUNCTION public.sf_payments_reject_history_mutation();
REVOKE ALL ON TABLE public.sf_replit_payment_test_access FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_guard_replit_payment_test_access() FROM PUBLIC;
