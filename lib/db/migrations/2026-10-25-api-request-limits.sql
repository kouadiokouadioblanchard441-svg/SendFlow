-- Targeted prerequisite for server-side API rate limits.
-- Additive: creates only the quota table and does not modify existing rows.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.sf_api_request_limits (
  bucket_hash varchar(64) PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL,
  CONSTRAINT sf_api_request_limits_count_check CHECK (request_count BETWEEN 1 AND 60)
);

COMMIT;
