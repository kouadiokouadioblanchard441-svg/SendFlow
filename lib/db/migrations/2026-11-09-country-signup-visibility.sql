DO $migration$
DECLARE
  column_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sf_countries'
      AND column_name = 'signup_enabled'
  ) INTO column_exists;

  IF NOT column_exists THEN
    ALTER TABLE public.sf_countries
      ADD COLUMN signup_enabled boolean NOT NULL DEFAULT false;
    UPDATE public.sf_countries
      SET signup_enabled = enabled;
  END IF;
END
$migration$;
