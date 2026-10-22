---
name: Node native TypeScript tests
description: Constraints when Node's built-in test runner imports TypeScript service modules.
---

Node 24's strip-only TypeScript loader does not support parameter properties in classes.

**Why:** Direct TypeScript imports in the built-in test runner failed on constructor parameter properties even though the API package typechecked and bundled successfully.

**How to apply:** When a test uses `node --experimental-strip-types` to import service modules, declare class properties explicitly and assign them in the constructor, or use a full TypeScript transpiler.

Server modules loaded natively by Vite's configuration runtime also need explicit
runtime-resolvable relative import extensions.

**Why:** An API bundle and TypeScript checks succeeded while the website returned
503: Vite externalized a shared server entry, and Node could not resolve its
extensionless TypeScript import. A successful esbuild bundle does not verify that
native runtime boundary.

**How to apply:** For a native-loaded server entry, verify its transitive imports
with Node as well as the application build. Preserve explicit `.ts` imports and
the matching declaration-only TypeScript compiler setting where needed.