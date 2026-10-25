-- Add a per-link public merchant name without changing existing payment links.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.sf_customer_payment_links
  ADD COLUMN IF NOT EXISTS link_name varchar(120);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.sf_customer_payment_links'::regclass
      AND conname = 'sf_customer_payment_links_link_name_check'
  ) THEN
    ALTER TABLE public.sf_customer_payment_links
      ADD CONSTRAINT sf_customer_payment_links_link_name_check
      CHECK (link_name IS NULL OR length(btrim(link_name)) BETWEEN 2 AND 120) NOT VALID;
  END IF;
END;
$$;

COMMIT;
