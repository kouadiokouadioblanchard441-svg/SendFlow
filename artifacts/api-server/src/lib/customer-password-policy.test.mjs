import assert from "node:assert/strict";
import test from "node:test";
import {
  RegisterCustomerBody,
  ResetCustomerPasswordBody,
  SignInCustomerBody,
} from "../../../../lib/api-zod/src/generated/api.ts";

const phone = "+2250700000000";

test("new and reset customer passwords require eight characters while legacy sign-in remains compatible", () => {
  const shortPassword = "Ab12";
  const strongPassword = "Ab12cd34";

  assert.equal(
    RegisterCustomerBody.safeParse({
      phone,
      fullName: "Aminata Koné",
      birthDate: "1990-01-01",
      password: shortPassword,
      acceptedPrivacy: true,
    }).success,
    false,
  );
  assert.equal(
    RegisterCustomerBody.safeParse({
      phone,
      fullName: "Aminata Koné",
      birthDate: "1990-01-01",
      password: strongPassword,
      acceptedPrivacy: true,
    }).success,
    true,
  );

  assert.equal(
    ResetCustomerPasswordBody.safeParse({
      challengeId: "a2f13f3c-bab6-41a9-a467-34b330e9f06b",
      phone,
      newPassword: shortPassword,
    }).success,
    false,
  );
  assert.equal(
    ResetCustomerPasswordBody.safeParse({
      challengeId: "a2f13f3c-bab6-41a9-a467-34b330e9f06b",
      phone,
      newPassword: strongPassword,
    }).success,
    true,
  );

  assert.equal(
    SignInCustomerBody.safeParse({ phone, password: shortPassword }).success,
    true,
  );
});
