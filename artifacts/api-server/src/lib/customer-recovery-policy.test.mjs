import assert from "node:assert/strict";
import test from "node:test";
import { hashSecretForClaimedOtpChallenge } from "./customer-recovery-policy.ts";

test("recovery does not derive a secret hash when the OTP challenge was not claimed", async () => {
  let hashCalls = 0;
  const result = await hashSecretForClaimedOtpChallenge(null, async () => {
    hashCalls += 1;
    return "hash";
  });

  assert.equal(result, null);
  assert.equal(hashCalls, 0);
});

test("recovery derives a secret hash only for a locked, available challenge", async () => {
  let hashCalls = 0;
  const result = await hashSecretForClaimedOtpChallenge(
    { id: "isolated-test-challenge" },
    async () => {
      hashCalls += 1;
      return "hash";
    },
  );

  assert.equal(result, "hash");
  assert.equal(hashCalls, 1);
});
