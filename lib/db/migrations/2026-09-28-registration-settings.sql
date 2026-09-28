BEGIN;

CREATE TABLE IF NOT EXISTS public.sf_registration_settings (
  id varchar(32) PRIMARY KEY,
  sms_verification_enabled boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  updated_by varchar(255) NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sf_registration_settings (id, sms_verification_enabled, version, updated_by)
VALUES ('signup', true, 1, 'system')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.sf_users
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

COMMIT;