ALTER TABLE public.sf_operator_catalog
  ADD COLUMN IF NOT EXISTS logo_data bytea,
  ADD COLUMN IF NOT EXISTS logo_content_type varchar(32);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sf_operator_catalog_logo_pair_check'
      AND conrelid = 'public.sf_operator_catalog'::regclass
  ) THEN
    ALTER TABLE public.sf_operator_catalog
      ADD CONSTRAINT sf_operator_catalog_logo_pair_check
      CHECK ((logo_data IS NULL) = (logo_content_type IS NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sf_operator_catalog_logo_size_check'
      AND conrelid = 'public.sf_operator_catalog'::regclass
  ) THEN
    ALTER TABLE public.sf_operator_catalog
      ADD CONSTRAINT sf_operator_catalog_logo_size_check
      CHECK (logo_data IS NULL OR octet_length(logo_data) BETWEEN 1 AND 524288);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sf_operator_catalog_logo_type_check'
      AND conrelid = 'public.sf_operator_catalog'::regclass
  ) THEN
    ALTER TABLE public.sf_operator_catalog
      ADD CONSTRAINT sf_operator_catalog_logo_type_check
      CHECK (logo_content_type IS NULL OR logo_content_type IN ('image/png', 'image/jpeg', 'image/webp'));
  END IF;
END $$;
