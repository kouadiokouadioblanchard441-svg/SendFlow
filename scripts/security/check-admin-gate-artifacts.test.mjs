import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { assertNoAdminGateSecretsInArtifacts } from "./check-admin-gate-artifacts.mjs";

test("build artifact scan rejects either configured access value without echoing it", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "sendflow-admin-gate-artifacts-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "bundle.js");
  const fixturePath = "/fixture-only-path-value-never-production-482019";
  const fixtureToken = "fixture-only-token-never-production-913847";
  await writeFile(file, "safe bundle");
  await assertNoAdminGateSecretsInArtifacts([root], [fixturePath, fixtureToken]);
  await writeFile(file, `unexpected ${fixturePath}`);
  await assert.rejects(
    assertNoAdminGateSecretsInArtifacts([root], [fixturePath, fixtureToken]),
    (error) => {
      assert.equal(error.message, "Administrator access secrets were detected in a build artifact.");
      assert.equal(error.message.includes(fixturePath), false);
      assert.equal(error.message.includes(fixtureToken), false);
      return true;
    },
  );
});
