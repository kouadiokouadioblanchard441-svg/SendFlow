CREATE TABLE IF NOT EXISTS public.sf_customer_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  public_token varchar(43) NOT NULL,
  idempotency_key uuid NOT NULL,
  request_hash varchar(64) NOT NULL,
  currency varchar(3) NOT NULL,
  amount_minor bigint NOT NULL,
  description varchar(240) NOT NULL,
  payment_method varchar(20) NOT NULL,
  expires_at timestamptz,
  maximum_uses integer,
  usage_count integer NOT NULL DEFAULT 0,
  return_url varchar(2048),
  custom_suffix varchar(32),
  status varchar(24) NOT NULL DEFAULT 'draft',
  image_data bytea,
  image_size_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_customer_payment_links_token_check
    CHECK (public_token ~ '^[A-Za-z0-9_-]{43}$'),
  CONSTRAINT sf_customer_payment_links_request_hash_check
    CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_customer_payment_links_currency_check
    CHECK (currency IN ('XOF','XAF','CHF','NGN','EUR','USD','CAD')),
  CONSTRAINT sf_customer_payment_links_amount_check
    CHECK (
      (currency IN ('XOF','XAF') AND amount_minor BETWEEN 10 AND 9007199254740991)
      OR (currency IN ('CHF','NGN','EUR','USD','CAD')
        AND amount_minor BETWEEN 1000 AND 9007199254740991)
    ),
  CONSTRAINT sf_customer_payment_links_description_check
    CHECK (length(btrim(description)) BETWEEN 2 AND 240),
  CONSTRAINT sf_customer_payment_links_payment_method_check
    CHECK (payment_method IN ('mobile_money','card','all')),
  CONSTRAINT sf_customer_payment_links_maximum_uses_check
    CHECK (maximum_uses IS NULL OR maximum_uses BETWEEN 1 AND 999999),
  CONSTRAINT sf_customer_payment_links_usage_count_check
    CHECK (usage_count BETWEEN 0 AND 999999
      AND (maximum_uses IS NULL OR usage_count <= maximum_uses)),
  CONSTRAINT sf_customer_payment_links_suffix_check
    CHECK (custom_suffix IS NULL OR custom_suffix ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT sf_customer_payment_links_return_url_check
    CHECK (return_url IS NULL OR return_url ~ '^https://'),
  CONSTRAINT sf_customer_payment_links_status_check
    CHECK (status IN ('draft','active','paused','expired','exhausted')),
  CONSTRAINT sf_customer_payment_links_image_data_check
    CHECK (
      (image_data IS NULL AND image_size_bytes IS NULL)
      OR (image_data IS NOT NULL AND image_size_bytes BETWEEN 1 AND 5242880
        AND octet_length(image_data) = image_size_bytes)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_customer_payment_links_public_token_uq
  ON public.sf_customer_payment_links(public_token);
CREATE UNIQUE INDEX IF NOT EXISTS sf_customer_payment_links_owner_idempotency_uq
  ON public.sf_customer_payment_links(user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS sf_customer_payment_links_owner_created_idx
  ON public.sf_customer_payment_links(user_id, created_at, id);
