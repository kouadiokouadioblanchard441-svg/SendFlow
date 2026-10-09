import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldSeedOperatorPricingCatalog } from "./operator-pricing-seed-policy.ts";

test("shared Neon previews never run the operator catalog seed", () => {
  assert.equal(
    shouldSeedOperatorPricingCatalog({ SENDFLOW_DATABASE_TARGET: "shared-neon" }),
    false,
  );
});

test("the seed remains available for explicit development and production targets", () => {
  assert.equal(
    shouldSeedOperatorPricingCatalog({ SENDFLOW_DATABASE_TARGET: "development" }),
    true,
  );
  assert.equal(
    shouldSeedOperatorPricingCatalog({ SENDFLOW_DATABASE_TARGET: "production" }),
    true,
  );
});

test("missing and unknown database targets fail closed", () => {
  assert.equal(shouldSeedOperatorPricingCatalog({}), false);
  assert.equal(
    shouldSeedOperatorPricingCatalog({ SENDFLOW_DATABASE_TARGET: "unexpected" }),
    false,
  );
});
