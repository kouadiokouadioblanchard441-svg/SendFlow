-- Apply after 2026-10-09-wallet-integrity-checks.sql.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_wallets'::regclass
      AND conname = 'sf_wallets_balance_minor_safe_integer_check'
  ) THEN
    ALTER TABLE public.sf_wallets
      ADD CONSTRAINT sf_wallets_balance_minor_safe_integer_check
      CHECK (balance_minor <= 9007199254740991) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_transactions'::regclass
      AND conname = 'sf_transactions_amount_minor_safe_integer_check'
  ) THEN
    ALTER TABLE public.sf_transactions
      ADD CONSTRAINT sf_transactions_amount_minor_safe_integer_check
      CHECK (amount_minor <= 9007199254740991) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_transactions'::regclass
      AND conname = 'sf_transactions_fee_minor_safe_integer_check'
  ) THEN
    ALTER TABLE public.sf_transactions
      ADD CONSTRAINT sf_transactions_fee_minor_safe_integer_check
      CHECK (fee_minor <= 9007199254740991) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_wallet_ledger'::regclass
      AND conname = 'sf_wallet_ledger_amount_minor_safe_integer_check'
  ) THEN
    ALTER TABLE public.sf_wallet_ledger
      ADD CONSTRAINT sf_wallet_ledger_amount_minor_safe_integer_check
      CHECK (amount_minor <= 9007199254740991) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_wallet_ledger'::regclass
      AND conname = 'sf_wallet_ledger_balance_before_safe_range_check'
  ) THEN
    ALTER TABLE public.sf_wallet_ledger
      ADD CONSTRAINT sf_wallet_ledger_balance_before_safe_range_check
      CHECK (balance_before_minor >= 0 AND balance_before_minor <= 9007199254740991) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_wallet_ledger'::regclass
      AND conname = 'sf_wallet_ledger_balance_after_safe_range_check'
  ) THEN
    ALTER TABLE public.sf_wallet_ledger
      ADD CONSTRAINT sf_wallet_ledger_balance_after_safe_range_check
      CHECK (balance_after_minor >= 0 AND balance_after_minor <= 9007199254740991) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_wallet_ledger'::regclass
      AND conname = 'sf_wallet_ledger_balance_reconciles_check'
  ) THEN
    ALTER TABLE public.sf_wallet_ledger
      ADD CONSTRAINT sf_wallet_ledger_balance_reconciles_check
      CHECK (
        (direction = 'credit' AND balance_after_minor = balance_before_minor + amount_minor)
        OR (direction = 'debit' AND balance_before_minor = balance_after_minor + amount_minor)
      ) NOT VALID;
  END IF;
END;
$$;

COMMIT;
