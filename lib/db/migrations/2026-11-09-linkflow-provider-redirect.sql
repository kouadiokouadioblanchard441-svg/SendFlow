ALTER TABLE public.sf_customer_payment_link_payments
  ADD COLUMN provider_redirect_url_encrypted text;

ALTER TABLE public.sf_customer_payment_link_payments
  ADD CONSTRAINT sf_customer_link_provider_redirect_cipher_check
  CHECK (
    provider_redirect_url_encrypted IS NULL OR (
      provider_redirect_url_encrypted ~ '^sfenc-v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
      AND octet_length(provider_redirect_url_encrypted) <= 4096
    )
  );
