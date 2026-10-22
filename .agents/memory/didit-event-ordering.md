---
name: Didit event ordering
description: Provider retries refresh dispatch timestamps; AML can withdraw an approval.
---

Use Didit's signed record update time (`created_at`) for state ordering, not its retry dispatch time (`timestamp` or `X-Timestamp`). Exclude only the refreshed dispatch field from the semantic duplicate digest; retain the original encrypted evidence.

**Why:** Official webhook documentation says retries refresh dispatch time. Comparing the complete payload digest rejects legitimate retries; ordering by dispatch time lets stale decisions appear new.

**How to apply:** Preserve a session's last applied provider record time. Reject older approvals and hold conflicting same-second approval changes for reconciliation rather than restoring privileges.

Bind the freshness header to the signed dispatch timestamp in the body.

**Why:** V2 signs the body, not HTTP headers. Checking only whether an unsigned `X-Timestamp` is recent allows a captured old signature to pass the freshness check after replacing that header.

**How to apply:** Require the signed numeric `timestamp` to match `X-Timestamp` and validate its five-minute window independently of `created_at`, which orders record changes.

Do not treat Approved as immutable: AML monitoring may later send In Review or Declined, and KYC expiry removes verified privileges. Use the latest customer verification, not an arbitrary historical approval.

**Why:** Didit's help center explicitly documents AML withdrawals and manual reopenings beyond the narrower API lifecycle table.

**How to apply:** Handle withdrawals immediately when signed and correctly ordered; accept a reopened decision only with a strictly newer signed record time. Consult both official status references before changing this policy.

The decision API's ISO `created_at` is the session creation date, not the webhook's numeric record-update date. Do not use it as an ordering watermark when reconciling.

**Why:** The two official response schemas use the same name for different timestamps; mixing them can revive a stale approval.

**How to apply:** Resolve ambiguity from a bound server-to-provider decision read, reject a snapshot overtaken by a new webhook, and keep a conservative server-read freshness fence.
