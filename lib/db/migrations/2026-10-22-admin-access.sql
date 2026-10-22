BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE IF NOT EXISTS sf_admin_grants (
  user_id text PRIMARY KEY REFERENCES sf_users(id) ON DELETE CASCADE,
  can_mutate boolean NOT NULL DEFAULT false,
  pin_hash text NOT NULL,
  authorization_version uuid NOT NULL DEFAULT gen_random_uuid(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sf_admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES sf_admin_grants(user_id) ON DELETE CASCADE,
  authorization_version uuid NOT NULL,
  token_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  pin_verified_until timestamptz,
  revoked_at timestamptz,
  CONSTRAINT sf_admin_sessions_expiry_check CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS sf_admin_sessions_token_uq ON sf_admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS sf_admin_sessions_user_expiry_idx ON sf_admin_sessions(user_id, expires_at);
ALTER TABLE sf_phone_otp_challenges DROP CONSTRAINT IF EXISTS sf_phone_otp_purpose_check;
ALTER TABLE sf_phone_otp_challenges ADD CONSTRAINT sf_phone_otp_purpose_check
  CHECK (purpose IN ('signup', 'password_reset', 'pin_reset', 'admin_login'));
-- A PIN or permission change invalidates all previous sessions, even after a revoke/regrant.
CREATE OR REPLACE FUNCTION sf_rotate_admin_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.authorization_version := gen_random_uuid();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sf_admin_grant_rotation ON sf_admin_grants;
CREATE TRIGGER sf_admin_grant_rotation BEFORE UPDATE ON sf_admin_grants
  FOR EACH ROW EXECUTE FUNCTION sf_rotate_admin_authorization();
COMMIT;
