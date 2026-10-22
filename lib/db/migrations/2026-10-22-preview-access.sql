-- Additive, deliberately scoped: no customer, wallet or payment data is changed.
CREATE TABLE IF NOT EXISTS public.sf_preview_access (
  slot integer PRIMARY KEY DEFAULT 1,
  user_id text NOT NULL UNIQUE REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT sf_preview_access_single_viewer CHECK (slot = 1),
  CONSTRAINT sf_preview_access_valid_expiry CHECK (expires_at > created_at)
);

-- Keep the viewing account restricted even if an older production server
-- attempts a password recovery or creates a session without preview support.
CREATE OR REPLACE FUNCTION public.sf_guard_preview_password()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sf_preview_access WHERE user_id = NEW.user_id)
    AND left(NEW.password_hash, length('scrypt$preview-v1$')) <> 'scrypt$preview-v1$'
  THEN
    RAISE EXCEPTION 'Preview credential scope required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sf_guard_preview_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sf_preview_access WHERE user_id = NEW.user_id)
    AND left(NEW.token_hash, 4) <> 'pv1_'
  THEN
    RAISE EXCEPTION 'Preview session scope required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sf_preview_password_scope'
    AND tgrelid = 'public.sf_customer_credentials'::regclass) THEN
    CREATE TRIGGER sf_preview_password_scope
      BEFORE INSERT OR UPDATE OF user_id, password_hash ON public.sf_customer_credentials
      FOR EACH ROW EXECUTE FUNCTION public.sf_guard_preview_password();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sf_preview_session_scope'
    AND tgrelid = 'public.sf_customer_sessions'::regclass) THEN
    CREATE TRIGGER sf_preview_session_scope
      BEFORE INSERT OR UPDATE OF user_id, token_hash ON public.sf_customer_sessions
      FOR EACH ROW EXECUTE FUNCTION public.sf_guard_preview_session();
  END IF;
END;
$$;
