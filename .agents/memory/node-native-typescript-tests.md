---
name: Node native TypeScript tests
description: Constraints when Node's built-in test runner imports TypeScript service modules.
---

Node 24's strip-only TypeScript loader does not support parameter properties in classes.

**Why:** Direct TypeScript imports in the built-in test runner failed on constructor parameter properties even though the API package typechecked and bundled successfully.

**How to apply:** When a test uses `node --experimental-strip-types` to import service modules, declare class properties explicitly and assign them in the constructor, or use a full TypeScript transpiler.