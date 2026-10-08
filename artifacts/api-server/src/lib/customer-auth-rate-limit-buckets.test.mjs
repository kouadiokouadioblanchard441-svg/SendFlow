import assert from "node:assert/strict";
import test from "node:test";

const {
  getCustomerAccessAttemptBuckets,
  getCustomerAccessAttemptBucketsForRequest,
  getCustomerLoginPhoneAttemptBucket,
  getCustomerPinAttemptBucket,
} = await import("./customer-auth-rate-limit-buckets.ts");

const fingerprint = (value) => `test:${value}`;

test("sign-in and signup derive the same account and requester buckets", () => {
  const phone = "+2250700000000";
  const requesterAddress = "203.0.113.42";
  const signInBuckets = getCustomerAccessAttemptBucketsForRequest(
    phone,
    requesterAddress,
    fingerprint,
  );
  const otpBuckets = getCustomerAccessAttemptBuckets(
    fingerprint(`phone:${phone}`),
    fingerprint(`requester:${requesterAddress}`),
    fingerprint,
  );

  assert.deepEqual(signInBuckets, otpBuckets);
});

test("different accounts share only the requester bucket, not the account bucket", () => {
  const requesterAddress = "203.0.113.42";
  const firstAccount = getCustomerAccessAttemptBucketsForRequest(
    "+2250700000000",
    requesterAddress,
    fingerprint,
  );
  const secondAccount = getCustomerAccessAttemptBucketsForRequest(
    "+2250700000001",
    requesterAddress,
    fingerprint,
  );

  assert.notEqual(firstAccount[0], secondAccount[0]);
  assert.equal(firstAccount[1], secondAccount[1]);
});

test("recovery uses the same phone and PIN attempt bucket identities as authentication", () => {
  const phone = "+2250700000000";
  assert.equal(
    getCustomerLoginPhoneAttemptBucket(phone, fingerprint),
    fingerprint(`customer-login-phone:${phone}`),
  );
  assert.equal(
    getCustomerPinAttemptBucket("customer-123", fingerprint),
    fingerprint("customer-pin-user:customer-123"),
  );
});
