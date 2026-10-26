ALTER TABLE public.sf_customer_biometric_credentials
  ADD COLUMN rp_id text NOT NULL;

CREATE INDEX sf_customer_biometric_user_rp_idx
  ON public.sf_customer_biometric_credentials (user_id, rp_id);
