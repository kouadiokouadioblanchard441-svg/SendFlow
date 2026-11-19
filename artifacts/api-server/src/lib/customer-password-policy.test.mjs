import assert from "node:assert/strict";
import test from "node:test";
import {
  RegisterCustomerBody,
  ResetCustomerPasswordBody,
  SendEmailOtpBody,
  SignInCustomerBody,
  SignInCustomerResponse,
  GetCustomerSessionResponse,
  VerifyEmailOtpBody,
} from "../../../../lib/api-zod/src/generated/api.ts";

const phone = "+2250700000000";
const email = "aminata@example.invalid";
const turnstileToken = "fixture-turnstile-token";

test("new and reset passwords require eight characters, a letter, and a digit", () => {
  const shortPassword = "Ab12";
  const strongPassword = "Ab12cd34";
  const lettersOnly = "abcdefgh";
  const digitsOnly = "12345678";

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
      password: lettersOnly,
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
      password: digitsOnly,
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
    ResetCustomerPasswordBody.safeParse({
      challengeId: "a2f13f3c-bab6-41a9-a467-34b330e9f06b",
      email,
      newPassword: lettersOnly,
      turnstileToken,
    }).success,
    false,
  );
  assert.equal(
    ResetCustomerPasswordBody.safeParse({
      challengeId: "a2f13f3c-bab6-41a9-a467-34b330e9f06b",
      email,
      newPassword: digitsOnly,
      turnstileToken,
    }).success,
    false,
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
    SendEmailOtpBody.safeParse({ email, purpose: "customer_login", turnstileToken }).success,
    false,
    "login OTPs must only be issued internally after password verification",
  );

  assert.equal(
    SignInCustomerResponse.safeParse({
      otpRequired: true,
      challengeId: "a2f13f3c-bab6-41a9-a467-34b330e9f06b",
      expiresAt: "2026-11-18T12:00:00.000Z",
      resendAfterSeconds: 60,
    }).success,
    true,
  );
  const parsedOtpRequiredResponse = SignInCustomerResponse.parse({
    otpRequired: true,
    challengeId: "a2f13f3c-bab6-41a9-a467-34b330e9f06b",
    expiresAt: "2026-11-18T12:00:00.000Z",
    resendAfterSeconds: 60,
    sessionToken: "forged-client-session",
  });
  assert.equal(
    "sessionToken" in parsedOtpRequiredResponse,
    false,
    "the OTP-required response strips any unknown session token field",
  );
  assert.deepEqual(
    SignInCustomerResponse.parse({ pinConfigured: true }),
    { pinConfigured: true },
    "password-only sign-in exposes only the PIN setup state",
  );
  assert.deepEqual(
    SignInCustomerResponse.parse({
      pinConfigured: true,
      userId: "profile-data-must-not-be-accepted",
    }),
    { pinConfigured: true },
    "the sign-in response schema strips profile data before PIN unlock",
  );
  assert.deepEqual(
    GetCustomerSessionResponse.parse({
      pinConfigured: true,
      pinUnlocked: false,
    }),
    { pinConfigured: true, pinUnlocked: false },
  );
  assert.deepEqual(
    GetCustomerSessionResponse.parse({
      pinConfigured: true,
      pinUnlocked: false,
      phone: "+2250000000000",
    }),
    { pinConfigured: true, pinUnlocked: false },
    "the session response schema strips profile data before PIN unlock",
  );

  assert.equal(
    SignInCustomerBody.safeParse({
      email: "customer@example.com",
      password: "1234",
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
  assert.equal(
    VerifyEmailOtpBody.safeParse({
      challengeId: "a2f13f3c-bab6-41a9-a467-34b330e9f06b",
      purpose: "customer_login",
      code: "123456",
      turnstileToken,
    }).success,
    true,
  );
  assert.equal(SendEmailOtpBody.safeParse({ email, purpose: "password_reset" }).success, false);
  assert.equal(SendEmailOtpBody.safeParse({ phone, email, purpose: "signup" }).success, false);
  assert.equal(SendEmailOtpBody.safeParse({ phone, purpose: "pin_reset" }).success, true);
});
