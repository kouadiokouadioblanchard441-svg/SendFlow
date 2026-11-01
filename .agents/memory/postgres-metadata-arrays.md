---
name: PostgreSQL metadata arrays
description: Avoid false schema-verification failures when collecting PostgreSQL catalog identifiers through node-postgres.
---

When building schema snapshots from `pg_indexes` or `information_schema`, cast identifier columns such as `indexname` and `column_name` to `text` before `array_agg`. PostgreSQL's `name[]` result may arrive through node-postgres as a brace-delimited string rather than a JavaScript array, making an otherwise correct comparison fail.

**Why:** A transactionally rehearsed schema migration exposed a false mismatch after the created columns were correct; the verifier had compared a parsed text array with an unparsed catalog-name array.

**How to apply:** For migration plan/apply verifiers that compare catalog metadata, explicitly cast to text, rehearse the DDL inside a rollback-only transaction, and keep the final apply behind a fingerprinted schema preflight.
