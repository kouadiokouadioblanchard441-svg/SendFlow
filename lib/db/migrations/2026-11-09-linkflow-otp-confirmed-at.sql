-- Add the nullable confirmation timestamp used to serialize provider OTP flows.
-- No existing payment rows are rewritten and this does not enable payment calls.
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.sf_payment_attempts') IS NULL THEN
    RAISE EXCEPTION 'sf_payment_attempts is missing';
  END IF;
END $$;

ALTER TABLE public.sf_payment_attempts
  ADD COLUMN IF NOT EXISTS otp_confirmed_at timestamptz;

DO $$
DECLARE column_type text; nullable_state text; default_value text;
BEGIN
  SELECT data_type, is_nullable, column_default
  INTO column_type, nullable_state, default_value
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'sf_payment_attempts'
    AND column_name = 'otp_confirmed_at';

  IF column_type IS DISTINCT FROM 'timestamp with time zone'
    OR nullable_state IS DISTINCT FROM 'YES'
    OR default_value IS NOT NULL THEN
    RAISE EXCEPTION 'otp_confirmed_at has an unexpected definition';
  END IF;
END $$;

COMMENT ON COLUMN public.sf_payment_attempts.otp_confirmed_at
  IS 'Server timestamp for a provider OTP confirmation; never stores the OTP value.';
