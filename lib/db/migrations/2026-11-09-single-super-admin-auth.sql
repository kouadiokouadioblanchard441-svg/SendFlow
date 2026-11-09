BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS sf_super_admin_credentials (
  id smallint PRIMARY KEY DEFAULT 1,
  email_normalized varchar(254) NOT NULL,
  password_hash text NOT NULL,
  totp_ciphertext text NOT NULL,
  totp_nonce varchar(24) NOT NULL,
  totp_auth_tag varchar(32) NOT NULL,
  last_totp_step bigint,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  password_changed_at timestamptz,
  CONSTRAINT sf_super_admin_singleton_check CHECK (id = 1),
  CONSTRAINT sf_super_admin_email_normalized_check
    CHECK (email_normalized = lower(btrim(email_normalized))),
  CONSTRAINT sf_super_admin_password_hash_check
    CHECK (password_hash LIKE '$argon2id$%'),
  CONSTRAINT sf_super_admin_totp_nonce_check
    CHECK (totp_nonce ~ '^[A-Za-z0-9_-]{16}$'),
  CONSTRAINT sf_super_admin_totp_tag_check
    CHECK (totp_auth_tag ~ '^[A-Za-z0-9_-]{22}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS sf_super_admin_email_uq
  ON sf_super_admin_credentials(email_normalized);

CREATE TABLE IF NOT EXISTS sf_super_admin_recovery_codes (
  code_hash varchar(64) PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  CONSTRAINT sf_super_admin_recovery_hash_check CHECK (code_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS sf_super_admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refresh_token_hash varchar(64) NOT NULL,
  refresh_family_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  ip_hash varchar(64),
  user_agent_hash varchar(64),
  revoked_at timestamptz,
  revocation_reason varchar(80),
  CONSTRAINT sf_super_admin_sessions_expiry_check
    CHECK (created_at < idle_expires_at
      AND idle_expires_at <= absolute_expires_at
      AND created_at < absolute_expires_at),
  CONSTRAINT sf_super_admin_sessions_refresh_hash_check
    CHECK (refresh_token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sf_super_admin_sessions_ip_hash_check
    CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sf_super_admin_sessions_ua_hash_check
    CHECK (user_agent_hash IS NULL OR user_agent_hash ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS sf_super_admin_sessions_refresh_uq
  ON sf_super_admin_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS sf_super_admin_sessions_family_idx
  ON sf_super_admin_sessions(refresh_family_id);
CREATE INDEX IF NOT EXISTS sf_super_admin_sessions_expiry_idx
  ON sf_super_admin_sessions(idle_expires_at, absolute_expires_at);

CREATE TABLE IF NOT EXISTS sf_super_admin_refresh_tokens (
  token_hash varchar(64) PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sf_super_admin_sessions(id) ON DELETE CASCADE,
  family_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  replaced_by_hash varchar(64),
  revoked_at timestamptz,
  CONSTRAINT sf_super_admin_refresh_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sf_super_admin_refresh_replacement_hash_check
    CHECK (replaced_by_hash IS NULL OR replaced_by_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX IF NOT EXISTS sf_super_admin_refresh_family_idx
  ON sf_super_admin_refresh_tokens(family_id, created_at);
CREATE INDEX IF NOT EXISTS sf_super_admin_refresh_session_idx
  ON sf_super_admin_refresh_tokens(session_id, created_at);

CREATE TABLE IF NOT EXISTS sf_super_admin_step_up_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sf_super_admin_sessions(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL,
  action_key varchar(128) NOT NULL,
  payload_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT sf_super_admin_step_up_token_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sf_super_admin_step_up_payload_hash_check CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sf_super_admin_step_up_expiry_check CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS sf_super_admin_step_up_token_uq
  ON sf_super_admin_step_up_tokens(token_hash);
CREATE INDEX IF NOT EXISTS sf_super_admin_step_up_session_expiry_idx
  ON sf_super_admin_step_up_tokens(session_id, expires_at);

ALTER TABLE sf_admin_audit_logs
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS ip_hash varchar(64),
  ADD COLUMN IF NOT EXISTS user_agent_hash varchar(64),
  ADD COLUMN IF NOT EXISTS outcome varchar(24) NOT NULL DEFAULT 'success';
ALTER TABLE sf_admin_audit_logs
  ADD CONSTRAINT sf_admin_audit_ip_hash_check
    CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$') NOT VALID,
  ADD CONSTRAINT sf_admin_audit_user_agent_hash_check
    CHECK (user_agent_hash IS NULL OR user_agent_hash ~ '^[0-9a-f]{64}$') NOT VALID,
  ADD CONSTRAINT sf_admin_audit_outcome_check
    CHECK (outcome IN ('success', 'failure', 'denied', 'revoked')) NOT VALID;

CREATE OR REPLACE FUNCTION sf_reject_admin_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Administrator audit records are append-only';
END;
$$;
DROP TRIGGER IF EXISTS sf_admin_audit_append_only ON sf_admin_audit_logs;
CREATE TRIGGER sf_admin_audit_append_only
  BEFORE UPDATE OR DELETE ON sf_admin_audit_logs
  FOR EACH ROW EXECUTE FUNCTION sf_reject_admin_audit_mutation();

COMMIT;
