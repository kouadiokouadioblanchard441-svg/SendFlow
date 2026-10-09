BEGIN;

CREATE TABLE IF NOT EXISTS public.sf_identity_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.sf_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_identity_verification_attempts_user_created_idx
  ON public.sf_identity_verification_attempts (user_id, created_at);

COMMIT;
