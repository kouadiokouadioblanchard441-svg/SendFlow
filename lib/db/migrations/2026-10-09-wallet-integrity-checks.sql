BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_wallets'::regclass
      AND conname = 'sf_wallets_balance_minor_nonnegative_check'
  ) THEN
    ALTER TABLE public.sf_wallets
      ADD CONSTRAINT sf_wallets_balance_minor_nonnegative_check
      CHECK (balance_minor >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_transactions'::regclass
      AND conname = 'sf_transactions_amount_minor_positive_check'
  ) THEN
    ALTER TABLE public.sf_transactions
      ADD CONSTRAINT sf_transactions_amount_minor_positive_check
      CHECK (amount_minor > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_transactions'::regclass
      AND conname = 'sf_transactions_fee_minor_nonnegative_check'
  ) THEN
    ALTER TABLE public.sf_transactions
      ADD CONSTRAINT sf_transactions_fee_minor_nonnegative_check
      CHECK (fee_minor >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_wallet_ledger'::regclass
      AND conname = 'sf_wallet_ledger_amount_minor_positive_check'
  ) THEN
    ALTER TABLE public.sf_wallet_ledger
      ADD CONSTRAINT sf_wallet_ledger_amount_minor_positive_check
      CHECK (amount_minor > 0) NOT VALID;
  END IF;
END;
$$;

COMMIT;
