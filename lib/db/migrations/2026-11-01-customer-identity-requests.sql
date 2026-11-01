BEGIN;

CREATE TABLE IF NOT EXISTS public.sf_customer_identity_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  idempotency_key varchar(64) NOT NULL,
  personal_data_encrypted text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decision_reason_encrypted text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_customer_identity_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT sf_customer_identity_requests_user_idempotency_uq
    UNIQUE (user_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_customer_identity_requests_one_pending_uq
  ON public.sf_customer_identity_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS sf_customer_identity_requests_user_submitted_idx
  ON public.sf_customer_identity_requests (user_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.sf_customer_identity_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  request_id uuid REFERENCES public.sf_customer_identity_requests(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('front', 'back', 'selfie')),
  object_path text NOT NULL UNIQUE,
  content_type varchar(64) NOT NULL,
  expected_size_bytes integer NOT NULL CHECK (expected_size_bytes BETWEEN 1 AND 8388608),
  expires_at timestamptz NOT NULL,
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_customer_identity_uploads_pending_expiry_idx
  ON public.sf_customer_identity_uploads (expires_at)
  WHERE request_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sf_customer_identity_uploads_request_kind_uq
  ON public.sf_customer_identity_uploads (request_id, kind)
  WHERE request_id IS NOT NULL;

COMMIT;
