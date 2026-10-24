import { db, sql } from "@workspace/db";
import { fingerprint } from "../lib/request-security";

const PAYMENT_LINK_CREATION_LIMIT_PER_MINUTE = 10;

/** One atomic customer bucket per server-clock minute; database errors fail closed. */
export async function consumePaymentLinkCreationQuota(userId: string) {
  if (!userId) throw new Error("Authenticated customer is required");
  const bucket = fingerprint(`customer-payment-link:${userId}`);
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
       OR sf_api_request_limits.request_count < ${PAYMENT_LINK_CREATION_LIMIT_PER_MINUTE}
    RETURNING request_count
  `);
  return result.rows.length === 1;
}
