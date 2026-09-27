BEGIN;

ALTER TABLE public.sf_users
  ADD COLUMN IF NOT EXISTS birth_date date;

ALTER TABLE public.sf_phone_otp_challenges
  ADD COLUMN IF NOT EXISTS purpose varchar(24) NOT NULL DEFAULT 'signup',
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sf_phone_otp_purpose_check'
      AND conrelid = 'public.sf_phone_otp_challenges'::regclass
  ) THEN
    ALTER TABLE public.sf_phone_otp_challenges
      ADD CONSTRAINT sf_phone_otp_purpose_check
      CHECK (purpose IN ('signup', 'password_reset', 'pin_reset'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sf_phone_otp_consumed_check'
      AND conrelid = 'public.sf_phone_otp_challenges'::regclass
  ) THEN
    ALTER TABLE public.sf_phone_otp_challenges
      ADD CONSTRAINT sf_phone_otp_consumed_check
      CHECK (consumed_at IS NULL OR status = 'verified');
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS sf_phone_otp_phone_purpose_idx
  ON public.sf_phone_otp_challenges (phone_hash, purpose, status, expires_at);

CREATE TABLE IF NOT EXISTS public.sf_customer_credentials (
  user_id text PRIMARY KEY REFERENCES public.sf_users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  pin_hash text,
  privacy_accepted_at timestamptz NOT NULL,
  privacy_policy_version varchar(100) NOT NULL,
  password_updated_at timestamptz NOT NULL DEFAULT now(),
  pin_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sf_customer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.sf_users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  pin_verified_until timestamptz,
  last_seen_at timestamptz,
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_customer_sessions_token_hash_uq
  ON public.sf_customer_sessions (token_hash);
CREATE INDEX IF NOT EXISTS sf_customer_sessions_user_expiry_idx
  ON public.sf_customer_sessions (user_id, expires_at);

CREATE TABLE IF NOT EXISTS public.sf_customer_auth_attempts (
  bucket_hash varchar(64) PRIMARY KEY,
  failure_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_customer_auth_attempts_count_check
    CHECK (failure_count BETWEEN 0 AND 20)
);

COMMIT;