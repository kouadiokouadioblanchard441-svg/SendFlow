---
name: Customer-safe error dialogs
description: SendFlow user-facing API failures use consistent popup errors without exposing backend response details.
---

Display server and network failures in the shared SendFlow error dialog with concise, status-appropriate French copy. Do not display raw response bodies, provider messages, secrets, email addresses, or internal exception text. Keep client-side field validation adjacent to its input, and remind users to check a financial operation's status before retrying an ambiguous failure.

**Why:** The user explicitly wants clear error popups across the application while preventing disclosure of technical or sensitive details.

**How to apply:** Route API mutation failures, initial server/network load failures, and transaction failures through the same shared popup. Map statuses to fixed safe text, suppress expected authorization probes and background refresh noise, and preserve specialized blocked-account copy. Keep field validation inline; never label an uncertain payment as failed or successful.
