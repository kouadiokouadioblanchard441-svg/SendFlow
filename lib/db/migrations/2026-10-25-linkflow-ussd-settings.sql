BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.sf_countries
  ADD COLUMN IF NOT EXISTS ussd_code varchar(32);

ALTER TABLE public.sf_operator_catalog
  ADD COLUMN IF NOT EXISTS ussd_code_override varchar(32);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sf_countries_ussd_code_format_check'
      AND conrelid = 'public.sf_countries'::regclass
  ) THEN
    ALTER TABLE public.sf_countries
      ADD CONSTRAINT sf_countries_ussd_code_format_check
      CHECK (ussd_code IS NULL OR (ussd_code ~ '^[*][0-9]+([*][0-9]+)*#$' AND length(ussd_code) <= 32));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sf_operator_catalog_ussd_code_override_format_check'
      AND conrelid = 'public.sf_operator_catalog'::regclass
  ) THEN
    ALTER TABLE public.sf_operator_catalog
      ADD CONSTRAINT sf_operator_catalog_ussd_code_override_format_check
      CHECK (ussd_code_override IS NULL OR (ussd_code_override ~ '^[*][0-9]+([*][0-9]+)*#$' AND length(ussd_code_override) <= 32));
  END IF;
END $$;

COMMIT;
