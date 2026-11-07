import { db, sql } from "@workspace/db";
import { fingerprint } from "../lib/request-security";

const LIMITS = {
  session_create: 30,
  session_read: 120,
  direct_attempt: 5,
  direct_poll: 60,
  payout_read: 120,
  payout_create: 5,
} as const;

export type DeveloperApiOperation = keyof typeof LIMITS;

/** Rate-limit by a keyed fingerprint, never by storing an API key or client token. */
export async function consumeDeveloperApiQuota(identity: string, operation: DeveloperApiOperation) {
  if (!identity) throw new Error("Developer API quota identity is required");
  const bucket = fingerprint(`developer-api:${operation}:${identity}`);
  const limit = LIMITS[operation];
  const result = await db.execute(sql`
    INSERT INTO public.sf_api_request_limits (bucket_hash, window_started_at, request_count)
    VALUES (${bucket}, statement_timestamp(), 1)
    ON CONFLICT (bucket_hash) DO UPDATE SET
      window_started_at = CASE
        WHEN sf_api_request_limits.window_started_at <= statement_timestamp() - interval '1 minute'
        THEN statement_timestamp() ELSE sf_api_request_limits.window_started_at END,
      request_count = CASE
        WHEN sf_api_request_limits.window_started_at <= statement_timestamp() - interval '1 minute'
        THEN 1 ELSE sf_api_request_limits.request_count + 1 END
    WHERE sf_api_request_limits.window_started_at <= statement_timestamp() - interval '1 minute'
       OR sf_api_request_limits.request_count < ${limit}
    RETURNING request_count
  `);
  return result.rows.length === 1;
}
