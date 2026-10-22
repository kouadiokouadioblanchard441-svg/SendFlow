BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';
CREATE TABLE IF NOT EXISTS public.sf_network_defense (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address varchar(45) NOT NULL UNIQUE,
  request_window_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  request_count integer NOT NULL DEFAULT 0 CHECK(request_count >= 0),
  probe_window_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  probe_count integer NOT NULL DEFAULT 0 CHECK(probe_count >= 0),
  blocked_until timestamptz,
  ban_count integer NOT NULL DEFAULT 0 CHECK(ban_count >= 0),
  rule varchar(32),
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CHECK(ip_address = host(ip_address::inet))
);
CREATE INDEX IF NOT EXISTS sf_network_defense_expiry_idx ON public.sf_network_defense(updated_at);
CREATE TABLE IF NOT EXISTS public.sf_network_defense_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address varchar(45) NOT NULL UNIQUE,
  reason varchar(500) NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 500),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_by text,
  revoked_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  CHECK ((revoked_at IS NULL) = (revoked_by IS NULL)),
  CHECK(ip_address = host(ip_address::inet))
);
CREATE TABLE IF NOT EXISTS public.sf_network_defense_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address varchar(45) NOT NULL,
  action varchar(32) NOT NULL CHECK(action IN ('automatic_block','admin_release')),
  rule varchar(32) NOT NULL,
  blocked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sf_network_defense_events_created_idx ON public.sf_network_defense_events(created_at);
CREATE OR REPLACE FUNCTION public.sf_protect_network_defense_history() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Network defense history is append-only' USING ERRCODE='42501';
END;
$$;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.sf_network_defense_events'::regclass
    AND tgname='sf_network_defense_history_guard') THEN
    CREATE TRIGGER sf_network_defense_history_guard BEFORE UPDATE OR DELETE OR TRUNCATE
    ON public.sf_network_defense_events FOR EACH STATEMENT
    EXECUTE FUNCTION public.sf_protect_network_defense_history();
  END IF;
END $$;
COMMIT;
