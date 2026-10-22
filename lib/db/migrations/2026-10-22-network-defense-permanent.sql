BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='10s';
ALTER TABLE public.sf_network_defense ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
-- Preserve every unrevoked legacy decision, even if its old deadline passed.
-- Explicitly released rows have blocked_until NULL and stay released.
UPDATE public.sf_network_defense
SET blocked_at=updated_at,version=version+1
WHERE blocked_until IS NOT NULL AND blocked_at IS NULL;
COMMENT ON COLUMN public.sf_network_defense.blocked_until IS
  'Legacy deadline only; not an expiration authority. Explicit release clears this and blocked_at.';
COMMIT;
