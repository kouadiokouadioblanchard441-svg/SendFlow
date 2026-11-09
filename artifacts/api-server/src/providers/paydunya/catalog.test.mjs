import test from "node:test";
import assert from "node:assert/strict";
import { isPaydunyaChannel, paydunyaChannelForOperator } from "./catalog.ts";

test("PayDunya channel mappings use the provider's published names by country and operator", () => {
  assert.equal(paydunyaChannelForOperator("ci", "orange-ci"), "orange-money-ci");
  assert.equal(paydunyaChannelForOperator("CI", "wave-ci"), "wave-ci");
  assert.equal(paydunyaChannelForOperator("sn", "free-sn"), "free-money-senegal");
  assert.equal(paydunyaChannelForOperator("bj", "celtiis-bj"), "celtiis-cash");
  assert.equal(paydunyaChannelForOperator("tg", "togocom-tg"), "t-money-togo");
  assert.equal(paydunyaChannelForOperator("BF", "wave-bf"), null);
  assert.equal(paydunyaChannelForOperator("CI", "orange-sn"), null);
  assert.equal(isPaydunyaChannel("orange-money-ci"), true);
  assert.equal(isPaydunyaChannel("made-up-operator"), false);
});
