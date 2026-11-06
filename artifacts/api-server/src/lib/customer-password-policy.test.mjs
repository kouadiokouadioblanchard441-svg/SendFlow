import assert from "node:assert/strict";
import test from "node:test";
import {
  RegisterCustomerBody,
  ResetCustomerPasswordBody,
  SendEmailOtpBody,
  SignInCustomerBody,
  VerifyEmailOtpBody,
} from "../../../../lib/api-zod/src/generated/api.ts";

const phone = "+2250700000000";
const email = "aminata@example.invalid";
const turnstileToken = "fixture-turnstile-token";

test("new and reset customer passwords require eight characters while legacy sign-in remains compatible", () => {
  const shortPassword = "Ab12";
  const strongPassword = "Ab12cd34";

  assert.equal(
    RegisterCustomerBody.safeParse({
      phone,
      email,
      fullName: "Aminata Koné",
      birthDate: "1990-01-01",
      password: shortPassword,
      acceptedPrivacy: true,
      turnstileToken,
    }).success,
    false,
  );
  assert.equal(
    RegisterCustomerBody.safeParse({
      phone,
      email,
      fullName: "Aminata Koné",
      birthDate: "1990-01-01",
      password: strongPassword,
      acceptedPrivacy: true,
      turnstileToken,
    }).success,
    true,
  );
  assert.equal(
    RegisterCustomerBody.safeParse({
      phone,
      email,
      fullName: "Aminata Koné",
      birthDate: "1990-01-01",
      password: strongPassword,
      acceptedPrivacy: true,
      turnstileToken,
    }).success,
    true,
  );
  assert.equal(
    RegisterCustomerBody.safeParse({
      phone,
      email: "not-an-email",
      fullName: "Aminata Koné",
      birthDate: "1990-01-01",
      password: strongPassword,
      acceptedPrivacy: true,
      turnstileToken,
    }).success,
    false,
  );

  assert.equal(
    ResetCustomerPasswordBody.safeParse({
      challengeId: "a2f13f3c-bab6-41a9-a467-34b330e9f06b",
      email,
      newPassword: shortPassword,
      turnstileToken,
    }).success,
    false,
  );
  assert.equal(
    ResetCustomerPasswordBody.safeParse({
      challengeId: "a2f13f3c-bab6-41a9-a467-34b330e9f06b",
      email,
      newPassword: strongPassword,
      turnstileToken,
    }).success,
    true,
  );
  assert.equal(
    ResetCustomerPasswordBody.safeParse({
      challengeId: "a2f13f3c-bab6-41a9-a467-34b330e9f06b",
      phone,
      newPassword: strongPassword,
      turnstileToken,
    }).success,
    false,
  );
  assert.equal(
    SendEmailOtpBody.safeParse({ email, purpose: "password_reset", turnstileToken }).success,
    true,
  );
  assert.equal(
    SendEmailOtpBody.safeParse({ phone, purpose: "password_reset", turnstileToken }).success,
    false,
  );
  assert.equal(
    SendEmailOtpBody.safeParse({ phone, purpose: "pin_reset" }).success,
    true,
  );
  assert.equal(
    SendEmailOtpBody.safeParse({ phone, email, purpose: "signup", turnstileToken }).success,
    true,
  );

  assert.equal(
    SignInCustomerBody.safeParse({
      email: "customer@example.com",
      password: shortPassword,
      turnstileToken,
    }).success,
    true,
  );
  assert.equal(
    SignInCustomerBody.safeParse({ phone, password: shortPassword, turnstileToken }).success,
    false,
  );
});

test("Turnstile is mandatory on sign-in, signup, password-recovery, and OTP-verification contracts", () => {
  assert.equal(
    SignInCustomerBody.safeParse({
      email,
      password: "legacy-password",
    }).success,
    false,
  );
  assert.equal(
    RegisterCustomerBody.safeParse({
      phone,
      email,
      fullName: "Aminata Koné",
      birthDate: "1990-01-01",
      password: "Ab12cd34",
      acceptedPrivacy: true,
    }).success,
    false,
  );
  assert.equal(
    ResetCustomerPasswordBody.safeParse({
      challengeId: "a2f13f3c-bab6-41a9-a467-34b330e9f06b",
      email,
      newPassword: "Ab12cd34",
    }).success,
    false,
  );
  assert.equal(
    VerifyEmailOtpBody.safeParse({
      challengeId: "a2f13f3c-bab6-41a9-a467-34b330e9f06b",
      purpose: "signup",
      code: "123456",
    }).success,
    false,
  );
  assert.equal(
    VerifyEmailOtpBody.safeParse({
      challengeId: "a2f13f3c-bab6-41a9-a467-34b330e9f06b",
      purpose: "signup",
      code: "123456",
      turnstileToken,
    }).success,
    true,
  );
  assert.equal(SendEmailOtpBody.safeParse({ email, purpose: "password_reset" }).success, false);
  assert.equal(SendEmailOtpBody.safeParse({ phone, email, purpose: "signup" }).success, false);
  assert.equal(SendEmailOtpBody.safeParse({ phone, purpose: "pin_reset" }).success, true);
});
