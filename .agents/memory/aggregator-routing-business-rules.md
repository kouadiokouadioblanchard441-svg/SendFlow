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
