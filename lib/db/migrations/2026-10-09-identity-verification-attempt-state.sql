-- Apply after 2026-10-09-identity-verification-attempts.sql.
BEGIN;

ALTER TABLE public.sf_identity_verification_attempts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';
ALTER TABLE public.sf_identity_verification_attempts
  ALTER COLUMN status SET DEFAULT 'creating';
ALTER TABLE public.sf_identity_verification_attempts
  ADD COLUMN IF NOT EXISTS provider_session_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_identity_verification_attempts'::regclass
      AND conname = 'sf_identity_verification_attempts_status_check'
  ) THEN
    ALTER TABLE public.sf_identity_verification_attempts
      ADD CONSTRAINT sf_identity_verification_attempts_status_check
      CHECK (status IN ('creating', 'completed', 'failed', 'abandoned')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_identity_verification_attempts'::regclass
      AND conname = 'sf_identity_verification_attempts_provider_session_id_unique'
  ) THEN
    ALTER TABLE public.sf_identity_verification_attempts
      ADD CONSTRAINT sf_identity_verification_attempts_provider_session_id_unique
      UNIQUE (provider_session_id);
  END IF;
END;
$$;

COMMIT;
