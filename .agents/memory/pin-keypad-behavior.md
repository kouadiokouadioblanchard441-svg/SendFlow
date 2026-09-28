---
name: SendFlow PIN keypad behavior
description: User-confirmed requirement for a changing PIN keypad during entry.
---

The customer PIN keypad must reshuffle its digit positions after each entered digit, including during first-time setup and confirmation. Do not freeze the layout as a workaround for PIN mismatch reports.

**Why:** The user explicitly corrected an attempted fix that kept the keypad stable; changing positions is an intentional part of the desired PIN experience. A PIN comparison failure should be investigated in input capture, flow state, or validation instead.

**How to apply:** When changing PIN setup, unlock, or PIN change flows, preserve reshuffling after each digit and verify matching entries still submit while mismatches do not.