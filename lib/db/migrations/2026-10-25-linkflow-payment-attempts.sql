-- Dedicated LinkFlow-to-financial-intent association for public payer polling.
-- All money state continues to use the guarded payment-intent/attempt/confirmation
-- and wallet-ledger structures. This migration neither enables provider calls
-- nor changes existing customer, wallet, transaction, or link rows.

CREATE TABLE public.sf_customer_payment_link_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_link_id uuid NOT NULL
    REFERENCES public.sf_customer_payment_links(id) ON DELETE RESTRICT,
  intent_id uuid NOT NULL
    REFERENCES public.sf_payment_intents(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  request_hash varchar(64) NOT NULL
    CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  poll_token_hash varchar(64) NOT NULL UNIQUE
    CHECK (poll_token_hash ~ '^[a-f0-9]{64}$'),
  merchant_name varchar(120) NOT NULL
    CHECK (length(btrim(merchant_name)) BETWEEN 1 AND 120),
  payer_first_name_encrypted varchar(512) NOT NULL
    CHECK (payer_first_name_encrypted LIKE 'sfenc-v1.%'),
  payer_last_name_encrypted varchar(512) NOT NULL
    CHECK (payer_last_name_encrypted LIKE 'sfenc-v1.%'),
  ussd_code varchar(32)
    CHECK (ussd_code IS NULL OR (ussd_code ~ '^[*][0-9]+([*][0-9]+)*#$' AND length(ussd_code) <= 32)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_customer_link_payment_idempotency_uq UNIQUE(payment_link_id, idempotency_key),
  CONSTRAINT sf_customer_link_payment_intent_uq UNIQUE(intent_id)
);

CREATE INDEX sf_customer_link_payment_link_created_idx
  ON public.sf_customer_payment_link_payments(payment_link_id, created_at, id);

CREATE TRIGGER sf_customer_link_payment_immutable
  BEFORE UPDATE OR DELETE ON public.sf_customer_payment_link_payments
  FOR EACH ROW EXECUTE FUNCTION public.sf_payments_reject_history_mutation();
