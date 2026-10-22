BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';
CREATE TABLE IF NOT EXISTS public.sf_ip_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address varchar(45) NOT NULL UNIQUE,
  reason varchar(500) NOT NULL,
  blocked_by text NOT NULL,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  revoked_by text,
  revoked_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT sf_ip_blocklist_positive_version CHECK (version > 0),
  CONSTRAINT sf_ip_blocklist_revocation_pair CHECK ((revoked_at IS NULL) = (revoked_by IS NULL)),
  CONSTRAINT sf_ip_blocklist_host CHECK (
    ip_address = host(ip_address::inet)
    AND masklen(ip_address::inet) = CASE family(ip_address::inet) WHEN 4 THEN 32 ELSE 128 END
  )
);
COMMIT;
