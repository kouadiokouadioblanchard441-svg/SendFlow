-- Restore the registration setting required by the current auth route.
-- The email-verification column uses the default already declared in Drizzle.
BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '12s';

ALTER TABLE public.sf_registration_settings
  ADD COLUMN IF NOT EXISTS email_verification_enabled boolean NOT NULL DEFAULT true;

-- Preserve any existing setting; create the singleton only when it is absent.
INSERT INTO public.sf_registration_settings (id, email_verification_enabled)
SELECT 'signup', true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.sf_registration_settings
  WHERE id = 'signup'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
