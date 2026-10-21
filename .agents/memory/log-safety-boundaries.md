---
name: Safe HTTP logging
description: Preserve secret-safe error serialization across base and HTTP child loggers.
---

Apply the same safe error serialization explicitly to the base logger and HTTP middleware. Do not assume a safe base logger protects its HTTP children.

**Why:** pino-http installs its own default error serializer, which can restore raw messages, stacks, database parameters and provider details even when the parent logger is sanitized.

**How to apply:** When changing logging or middleware, verify both direct and HTTP-child logs with isolated synthetic sensitive inputs. Keep only bounded error classifications and safe codes; never log whole provider or database errors.
