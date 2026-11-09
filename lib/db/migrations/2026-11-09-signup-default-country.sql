DO $$
BEGIN
  IF (SELECT count(*) FROM public.sf_registration_settings) <> 1
    OR NOT EXISTS (SELECT 1 FROM public.sf_registration_settings WHERE id = 'signup') THEN
    RAISE EXCEPTION 'Expected exactly one signup registration-settings row';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sf_countries
    WHERE country_code = 'ci' AND enabled = true
  ) THEN
    RAISE EXCEPTION 'The enabled Côte d’Ivoire catalog row is required';
  END IF;
END $$;

ALTER TABLE public.sf_registration_settings
  ADD COLUMN IF NOT EXISTS default_country_code varchar(2);

DO $$
DECLARE
  previous_country_code varchar(2);
BEGIN
  SELECT default_country_code
  INTO previous_country_code
  FROM public.sf_registration_settings
  WHERE id = 'signup'
  FOR UPDATE;

  IF previous_country_code IS DISTINCT FROM 'ci' THEN
    UPDATE public.sf_registration_settings
    SET default_country_code = 'ci',
        version = version + 1,
        updated_by = 'system:signup-default-country',
        updated_at = now()
    WHERE id = 'signup';

    INSERT INTO public.sf_admin_audit_logs
      (admin_user_id, action, resource_type, resource_id, reason)
    VALUES (
      'system:signup-default-country',
      'update_registration_settings',
      'registration_settings',
      'signup',
      'Default signup country changed from ' || coalesce(previous_country_code, 'unset') || ' to ci'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sf_registration_settings_default_country_code_fk'
      AND conrelid = 'public.sf_registration_settings'::regclass
  ) THEN
    ALTER TABLE public.sf_registration_settings
      ADD CONSTRAINT sf_registration_settings_default_country_code_fk
      FOREIGN KEY (default_country_code)
      REFERENCES public.sf_countries(country_code);
  ELSIF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sf_registration_settings_default_country_code_fk'
      AND conrelid = 'public.sf_registration_settings'::regclass
      AND convalidated = false
  ) THEN
    ALTER TABLE public.sf_registration_settings
      VALIDATE CONSTRAINT sf_registration_settings_default_country_code_fk;
  END IF;
END $$;

ALTER TABLE public.sf_registration_settings
  ALTER COLUMN default_country_code SET NOT NULL;
