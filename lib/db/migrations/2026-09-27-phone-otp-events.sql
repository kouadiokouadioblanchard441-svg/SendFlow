CREATE TABLE IF NOT EXISTS public.sf_phone_otp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid REFERENCES public.sf_phone_otp_challenges(id) ON DELETE SET NULL,
  event_type varchar(16) NOT NULL,
  outcome varchar(32) NOT NULL,
  provider_http_status integer,
  diagnostic_message varchar(300),
  attempt_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT sf_phone_otp_event_type_check
    CHECK (event_type IN ('send', 'verify')),
  CONSTRAINT sf_phone_otp_event_outcome_check
    CHECK (outcome IN (
      'requested',
      'rate_limited',
      'configuration_error',
      'reservation_error',
      'provider_accepted',
      'provider_rejected',
      'provider_error',
      'provider_rate_limited',
      'challenge_inactive',
      'challenge_expired',
      'challenge_locked',
      'already_verified',
      'not_approved',
      'verified',
      'state_conflict',
      'storage_error'
    )),
  CONSTRAINT sf_phone_otp_event_provider_status_check
    CHECK (provider_http_status IS NULL OR provider_http_status BETWEEN 100 AND 599),
  CONSTRAINT sf_phone_otp_event_attempt_check
    CHECK (attempt_number IS NULL OR attempt_number BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS sf_phone_otp_events_created_idx
  ON public.sf_phone_otp_events (created_at DESC);
CREATE INDEX IF NOT EXISTS sf_phone_otp_events_challenge_created_idx
  ON public.sf_phone_otp_events (challenge_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sf_phone_otp_events_outcome_created_idx
  ON public.sf_phone_otp_events (outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS sf_phone_otp_events_type_created_idx
  ON public.sf_phone_otp_events (event_type, created_at DESC);