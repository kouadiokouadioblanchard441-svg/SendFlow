---
name: Database connection priority
description: This project prioritizes the Neon connection variable for schema, seed scripts, and the running API.
---

The project database layer resolves `NEON_DATABASE_URL` before `DATABASE_URL`; schema pushes and targeted seed helpers must use the same priority as the application.

**Why:** A generic development SQL helper can point at a different database when both variables exist, making a successfully applied Neon table appear missing.

**How to apply:** Use the project’s db package scripts or app connection for development data initialization, and verify the resulting row through `/api/landing`.