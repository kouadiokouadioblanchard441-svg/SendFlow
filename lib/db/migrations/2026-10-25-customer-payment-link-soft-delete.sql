ALTER TABLE public.sf_customer_payment_links
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
