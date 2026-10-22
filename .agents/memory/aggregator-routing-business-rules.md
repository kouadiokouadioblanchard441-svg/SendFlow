---
name: Aggregator and country configuration
description: User-confirmed operation names, manual routing and country/operator isolation.
---

« Retrait » means the existing international transfer, not a fourth transfer type.
There must be one primary aggregator per operation, with a country default and an
operator-specific exception. The administrator must be able to switch it manually
at any time; do not add automatic failover.

**Why:** The user explicitly clarified these choices when requesting configurable aggregators.

**How to apply:** Keep deposit, inter-network and international routing independent.
An operator setting belongs to its specific country, so changing MTN in Côte d’Ivoire
must not change MTN elsewhere or another operation. Preserve server ownership of
routing and provider readiness; a selected provider is not proof of a working API.

Countries added by an administrator must feed registration, login and the relevant
customer selections from server data, rather than require a new hardcoded country list.

**Why:** The user explicitly wants to manage country expansion from the administrator panel.

**How to apply:** Treat country creation, phone rules and operation availability as
separate server-managed configuration. Do not assume that creating a country
activates payment integrations, fees or operators.

FeexPay is the first payment partner requested by the user. They describe the
integration as « en SDK, c'est-à-dire l'API directe dans notre application ».
Use direct provider calls from the server, not a browser SDK that exposes credentials.

**Why:** The user selected FeexPay while reiterating that SendFlow is a large
financial application; their existing server-only secret and financial-authority
requirements still apply.

**How to apply:** Connect the provider through the server-owned country/operator/
operation routing. Installing an API client must not implicitly authorize real
payments, enable countries, or change customer page appearance.

For FeexPay, use the countries actually available in the official documentation,
not a user-selected country shortlist. The user chose Plesk for payment execution
and Replit for the current testing work.

**Why:** The user explicitly specified this coverage and hosting split.

**How to apply:** Separate documented coverage from account entitlements and
SendFlow activation. Keep Replit tests isolated from real funds; do not interpret
testing on Replit as permission to execute live Plesk payments.

The user explicitly rejected a FeexPay sandbox integration and chose direct
production API integration instead.

**Why:** « Nous allons pas faire l'intégration en sandbox on fait l'intégration directe ».

**How to apply:** Do not request sandbox credentials or require a sandbox phase.
Use live credentials only through secure server configuration. Keep offline
transport-mocked tests separate from real provider calls; this choice alone
does not authorize real charges, payouts or removal of preview safeguards.
