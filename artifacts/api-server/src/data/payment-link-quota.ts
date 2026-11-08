import { db, sql } from "@workspace/db";
import { fingerprint } from "../lib/request-security";

const PAYMENT_LINK_CREATION_LIMIT_PER_MINUTE = 10;
const PUBLIC_PAYMENT_LINK_QUOTE_LIMIT_PER_MINUTE = 30;
const PUBLIC_PAYMENT_LINK_ATTEMPT_LIMIT_PER_MINUTE = 5;
const PUBLIC_PAYMENT_LINK_POLL_LIMIT_PER_MINUTE = 60;

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

/** Rate-limit public link reads/quotes without retaining raw IPs or link tokens. */
export async function consumePublicPaymentLinkQuota(
  clientAddress: string,
  operation: "read" | "quote" | "image" | "attempt" | "poll" | "otp",
) {
  if (!clientAddress) throw new Error("Public payment-link quota identity is required");
  // Keep one bucket per client and operation. Including random bearer tokens
  // would let an attacker create unbounded quota rows by varying the token.
  const bucket = fingerprint(`public-payment-link:${operation}:${clientAddress}`);
  const limit = operation === "quote"
    ? PUBLIC_PAYMENT_LINK_QUOTE_LIMIT_PER_MINUTE
    : operation === "attempt" || operation === "otp"
      ? PUBLIC_PAYMENT_LINK_ATTEMPT_LIMIT_PER_MINUTE
      : operation === "poll"
        ? PUBLIC_PAYMENT_LINK_POLL_LIMIT_PER_MINUTE
        : 120;
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
