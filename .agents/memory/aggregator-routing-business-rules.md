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
not a user-selected country shortlist. The user chose Plesk for payment execution,
but explicitly requires the complete setup and user journeys to work and be
testable in Replit first, not just catalog entries and isolated API-client tests.

**Why:** The user specified this coverage and hosting split, then reiterated:
« Il faut configurer tout ici tout doit fonctionner correctement je dois pouvoir
tester tout ici d'abord ».

**How to apply:** Separate documented coverage from account entitlements and
SendFlow activation. Do not treat a Plesk-only code gate as a reason to leave the
Replit test journey unfinished. The user explicitly chose
« Vrais paiements FeexPay ici, avec débits, versements et frais possibles ».
This authorizes preparing real-payment execution in Replit; do not initiate an
unspecified charge or payout as a test without an approved concrete operation.
The user explicitly requires « la vraie base de données connecter actuellement »:
use the existing shared Neon, not a separate preview database. Do not request a
separate connection again as a prerequisite. This authorization must not open
all production customer data to preview or bypass account-level permissions.

The user explicitly rejected a FeexPay sandbox integration and chose direct
production API integration instead.

**Why:** « Nous allons pas faire l'intégration en sandbox on fait l'intégration directe ».

**How to apply:** Do not request sandbox credentials or require a sandbox phase.
Use live credentials only through secure server configuration. Keep offline
transport-mocked tests separate from real provider calls; this choice alone
does not authorize real charges, payouts or removal of preview safeguards.

Supplier and aggregator names must not appear on customer payment pages,
transaction history or elsewhere on the customer-facing site.

**Why:** The user explicitly requested no supplier mentions on these surfaces.

**How to apply:** Keep technical partner identity separate from customer-facing
SendFlow presentation. Check error text, receipts, support messages and
server-provided content, not just payment form labels. Distinguish Mobile Money
operator choices from technical aggregators, and do not promise that an external
provider page or legally required disclosure can be hidden.

Preparatory FeexPay configuration uses explicit operator/operation assignments,
not new country defaults, and must preserve existing activations and prices.

**Why:** A country default could silently cover undocumented operators; shared
Neon also serves Plesk, so preparing coverage must not activate real payments.

**How to apply:** Review the dry-run plan before shared-Neon writes. Operator
assignments take precedence over later country defaults until explicitly changed.
Keep Coris deposit-only while a single inter-network flag covers both sender and
recipient eligibility; separating those roles is required before widening it.
