-- Add an additive, account-level 24-hour email step-up check to customer login.
-- Existing OTP rows remain intact; only new customer_login challenges carry user_id.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.sf_users
  ADD COLUMN IF NOT EXISTS last_login_completed_at timestamptz;

ALTER TABLE public.sf_phone_otp_challenges
  ADD COLUMN IF NOT EXISTS user_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'sf_phone_otp_user_id_fk'
       AND conrelid = 'public.sf_phone_otp_challenges'::regclass
  ) THEN
    ALTER TABLE public.sf_phone_otp_challenges
      ADD CONSTRAINT sf_phone_otp_user_id_fk
      FOREIGN KEY (user_id) REFERENCES public.sf_users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS sf_phone_otp_user_purpose_idx
  ON public.sf_phone_otp_challenges (user_id, purpose, status, expires_at);

ALTER TABLE public.sf_phone_otp_challenges
  DROP CONSTRAINT IF EXISTS sf_phone_otp_purpose_check;

ALTER TABLE public.sf_phone_otp_challenges
  ADD CONSTRAINT sf_phone_otp_purpose_check
  CHECK (purpose IN ('signup', 'password_reset', 'pin_reset', 'customer_login'))
  NOT VALID;

COMMIT;
