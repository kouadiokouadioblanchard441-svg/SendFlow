---
name: Didit event ordering
description: Provider retries refresh dispatch timestamps; AML can withdraw an approval.
---

Use Didit's signed record update time (`created_at`) for state ordering, not its retry dispatch time (`timestamp` or `X-Timestamp`). Exclude only the refreshed dispatch field from the semantic duplicate digest; retain the original encrypted evidence.

**Why:** Official webhook documentation says retries refresh dispatch time. Comparing the complete payload digest rejects legitimate retries; ordering by dispatch time lets stale decisions appear new.

**How to apply:** Preserve a session's last applied provider record time. Reject older approvals and hold conflicting same-second approval changes for reconciliation rather than restoring privileges.

Do not treat Approved as immutable: AML monitoring may later send In Review or Declined, and KYC expiry removes verified privileges. Use the latest customer verification, not an arbitrary historical approval.

**Why:** Didit's help center explicitly documents AML withdrawals and manual reopenings beyond the narrower API lifecycle table.

**How to apply:** Handle withdrawals immediately when signed and correctly ordered; accept a reopened decision only with a strictly newer signed record time. Consult both official status references before changing this policy.
