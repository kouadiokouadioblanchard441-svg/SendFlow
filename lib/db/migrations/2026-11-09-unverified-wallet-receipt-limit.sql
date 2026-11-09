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
UPDATE public.sf_wallets AS wallet
SET unverified_received_minor = LEAST(
  COALESCE((
    SELECT SUM(intent.recipient_total_minor)::numeric
    FROM public.sf_payment_intents AS intent
    JOIN public.sf_transactions AS payment_transaction
      ON payment_transaction.id = intent.transaction_id
    WHERE payment_transaction.user_id = wallet.user_id
      AND intent.state = 'succeeded'
      AND intent.ledger_entry_id IS NOT NULL
  ), 0),
  9007199254740991
)::bigint
WHERE NOT EXISTS (
  SELECT 1
  FROM public.sf_customer_identity_requests AS identity_request
  WHERE identity_request.user_id = wallet.user_id
    AND identity_request.status = 'approved'
);

COMMIT;
