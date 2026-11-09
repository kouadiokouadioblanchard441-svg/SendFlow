-- Monthly incoming caps by identity tier plus audited per-user overrides.
-- Reaching the applicable cap blocks outgoing operations only; incoming
-- payments continue to be credited and count toward the current UTC month.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.sf_payment_limits
  ADD COLUMN IF NOT EXISTS maximum_verified_incoming_minor integer NOT NULL DEFAULT 4000000;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_payment_limits'::regclass
      AND conname = 'sf_payment_limits_verified_incoming_max_check'
  ) THEN
    ALTER TABLE public.sf_payment_limits
      ADD CONSTRAINT sf_payment_limits_verified_incoming_max_check
      CHECK (maximum_verified_incoming_minor BETWEEN 0 AND 2147483647);
  END IF;
END $$;

ALTER TABLE public.sf_users
  ADD COLUMN IF NOT EXISTS monthly_incoming_limit_override_minor integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_users'::regclass
      AND conname = 'sf_users_monthly_incoming_limit_override_check'
  ) THEN
    ALTER TABLE public.sf_users
      ADD CONSTRAINT sf_users_monthly_incoming_limit_override_check
      CHECK (
        monthly_incoming_limit_override_minor IS NULL
        OR monthly_incoming_limit_override_minor BETWEEN 0 AND 2147483647
      );
  END IF;
END $$;

COMMIT;
