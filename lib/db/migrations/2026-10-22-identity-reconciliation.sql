-- Prepared only. Apply with explicit authorization before the new server.
BEGIN;
ALTER TABLE public.sf_identity_verifications
  ADD COLUMN IF NOT EXISTS reconciliation_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconciliation_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reconciliation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;
CREATE INDEX IF NOT EXISTS sf_identity_reconciliation_pending_idx
  ON public.sf_identity_verifications(reconciliation_requested_at)
  WHERE reconciliation_required;
-- Existing ambiguous receipts must not retain an approval during upgrade.
UPDATE public.sf_identity_verifications v
SET reconciliation_required=true, reconciliation_version=reconciliation_version+1,
    reconciliation_requested_at=now(),
    status=CASE WHEN v.status='Approved' THEN 'In Review' ELSE v.status END
WHERE NOT reconciliation_required AND EXISTS (
  SELECT 1 FROM public.sf_identity_webhook_events e
  WHERE e.provider_session_id=v.provider_session_id AND e.status_applied=false
    AND (v.reconciled_at IS NULL OR e.received_at > v.reconciled_at)
);
COMMIT;
