-- Add an admin-configurable receipt threshold for unverified wallets.
-- Incoming payments remain available; the server uses this total only to
-- gate outgoing transfers and withdrawals until identity verification.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.sf_payment_limits
  ADD COLUMN IF NOT EXISTS maximum_unverified_incoming_minor integer NOT NULL DEFAULT 20000;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_payment_limits'::regclass
      AND conname = 'sf_payment_limits_unverified_incoming_max_check'
  ) THEN
    ALTER TABLE public.sf_payment_limits
      ADD CONSTRAINT sf_payment_limits_unverified_incoming_max_check
      CHECK (maximum_unverified_incoming_minor BETWEEN 0 AND 2147483647);
  END IF;
END $$;

-- The payment-limits table is expected to have this singleton. Restore the
-- original migration defaults only if it is missing; never overwrite an
-- administrator's existing values.
INSERT INTO public.sf_payment_limits (
  id,
  minimum_deposit_minor,
  minimum_payout_minor,
  maximum_payout_daily_minor,
  minimum_inter_network_minor,
  maximum_transfer_minor,
  maximum_payin_minor,
  maximum_unverified_incoming_minor,
  version
)
VALUES ('global', 200, 200, NULL, 1, 10000000, 2000000, 20000, 1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.sf_wallets
  ADD COLUMN IF NOT EXISTS unverified_received_minor bigint NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_wallets'::regclass
      AND conname = 'sf_wallets_unverified_received_minor_nonnegative_check'
  ) THEN
    ALTER TABLE public.sf_wallets
      ADD CONSTRAINT sf_wallets_unverified_received_minor_nonnegative_check
      CHECK (unverified_received_minor >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_wallets'::regclass
      AND conname = 'sf_wallets_unverified_received_minor_safe_integer_check'
  ) THEN
    ALTER TABLE public.sf_wallets
      ADD CONSTRAINT sf_wallets_unverified_received_minor_safe_integer_check
      CHECK (unverified_received_minor <= 9007199254740991);
  END IF;
END $$;

-- Backfill confirmed wallet credits for accounts that do not yet have an
-- approved identity dossier. Manual administrator wallet adjustments are
-- intentionally excluded because they are not incoming customer receipts.
WITH unverified_wallets AS MATERIALIZED (
  SELECT wallet.id, wallet.user_id
  FROM public.sf_wallets AS wallet
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.sf_customer_identity_requests AS identity_request
    WHERE identity_request.user_id = wallet.user_id
      AND identity_request.status = 'approved'
  )
),
receipt_totals AS MATERIALIZED (
  SELECT payment_transaction.user_id,
    LEAST(SUM(intent.recipient_total_minor)::numeric, 9007199254740991)::bigint AS received_minor
  FROM public.sf_payment_intents AS intent
  JOIN public.sf_transactions AS payment_transaction
    ON payment_transaction.id = intent.transaction_id
  JOIN unverified_wallets AS wallet
    ON wallet.user_id = payment_transaction.user_id
  WHERE intent.state = 'succeeded'
    AND intent.ledger_entry_id IS NOT NULL
  GROUP BY payment_transaction.user_id
)
UPDATE public.sf_wallets AS wallet
SET unverified_received_minor = COALESCE(receipt.received_minor, 0)
FROM unverified_wallets AS unverified_wallet
LEFT JOIN receipt_totals AS receipt
  ON receipt.user_id = unverified_wallet.user_id
WHERE wallet.id = unverified_wallet.id;

COMMIT;
