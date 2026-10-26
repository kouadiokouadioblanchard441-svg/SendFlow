-- Allow LinkFlow links to omit the fixed amount and description.
-- A zero amount marks a payer-entered amount; existing links remain unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.sf_customer_payment_links
  DROP CONSTRAINT IF EXISTS sf_customer_payment_links_amount_check,
  DROP CONSTRAINT IF EXISTS sf_customer_payment_links_description_check;

ALTER TABLE public.sf_customer_payment_links
  ADD CONSTRAINT sf_customer_payment_links_amount_check
    CHECK (
      (currency = 'XOF' and amount_minor between 0 and 9007199254740991)
      or (currency = 'XAF' and amount_minor between 10 and 9007199254740991)
      or (currency in ('CHF','NGN','EUR','USD','CAD') and amount_minor between 1000 and 9007199254740991)
    ) NOT VALID,
  ADD CONSTRAINT sf_customer_payment_links_description_check
    CHECK (length(btrim(description)) between 0 and 240) NOT VALID;

ALTER TABLE public.sf_customer_payment_links
  VALIDATE CONSTRAINT sf_customer_payment_links_amount_check,
  VALIDATE CONSTRAINT sf_customer_payment_links_description_check;

COMMIT;
