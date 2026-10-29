-- Shared, server-authoritative payment thresholds.
-- Apply only through the reviewed migration process for the target database.
CREATE TABLE IF NOT EXISTS public.sf_payment_limits (
  id varchar(16) PRIMARY KEY,
  minimum_deposit_minor integer NOT NULL DEFAULT 200,
  minimum_payout_minor integer NOT NULL DEFAULT 200,
  minimum_inter_network_minor integer NOT NULL DEFAULT 1,
  maximum_transfer_minor integer NOT NULL DEFAULT 10000000,
  maximum_payin_minor integer NOT NULL DEFAULT 2000000,
  version integer NOT NULL DEFAULT 1,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_payment_limits_singleton_check CHECK (id = 'global'),
  CONSTRAINT sf_payment_limits_deposit_check CHECK (minimum_deposit_minor BETWEEN 200 AND 2000000),
  CONSTRAINT sf_payment_limits_payout_check CHECK (minimum_payout_minor BETWEEN 200 AND 2000000),
  CONSTRAINT sf_payment_limits_inter_network_check CHECK (minimum_inter_network_minor BETWEEN 1 AND 10000000),
  CONSTRAINT sf_payment_limits_transfer_max_check CHECK (maximum_transfer_minor BETWEEN 1 AND 10000000),
  CONSTRAINT sf_payment_limits_payin_max_check CHECK (maximum_payin_minor BETWEEN 200 AND 2000000),
  CONSTRAINT sf_payment_limits_deposit_transfer_order_check
    CHECK (minimum_deposit_minor <= maximum_transfer_minor),
  CONSTRAINT sf_payment_limits_payout_transfer_order_check
    CHECK (minimum_payout_minor <= maximum_transfer_minor),
  CONSTRAINT sf_payment_limits_inter_network_transfer_order_check
    CHECK (minimum_inter_network_minor <= maximum_transfer_minor),
  CONSTRAINT sf_payment_limits_deposit_payin_order_check
    CHECK (minimum_deposit_minor <= maximum_payin_minor),
  CONSTRAINT sf_payment_limits_version_check CHECK (version >= 1)
);

INSERT INTO public.sf_payment_limits (
  id, minimum_deposit_minor, minimum_payout_minor, minimum_inter_network_minor,
  maximum_transfer_minor, maximum_payin_minor, version
)
VALUES ('global', 200, 200, 1, 10000000, 2000000, 1)
ON CONFLICT (id) DO NOTHING;
