import assert from "node:assert/strict";
import test from "node:test";
import { renderEmailOtpContent } from "./email-otp-template.ts";
import { EMAIL_OTP_LIFETIME_SECONDS } from "./email-otp-code.ts";

const testDate = new Date("2026-11-01T12:00:00.000Z");

test("renders the branded French OTP email for each supported purpose", () => {
  assert.equal(EMAIL_OTP_LIFETIME_SECONDS, 5 * 60);
  for (const purpose of ["signup", "password_reset", "pin_reset", "admin_login"]) {
    const email = renderEmailOtpContent(purpose, "123456", {
      publicSiteUrl: "https://merchant.business.sendflow.africa",
      now: testDate,
    });

    assert.match(email.subject, /SendFlow/);
    assert.match(email.html, /Vérifiez votre adresse|Réinitialisation|Connexion administrateur/);
    assert.match(email.html, /Votre code de vérification/);
    assert.match(email.html, /Ce code est valable pendant 5 minutes/);
    assert.match(email.html, /src="https:\/\/merchant\.business\.sendflow\.africa\/sendflow-favicon\.png"/);
    assert.match(email.html, /© 2026 SendFlow/);
    assert.match(email.text, /123456/);
  }
});

test("uses the SendFlow wordmark when no safe public logo origin is configured", () => {
  const email = renderEmailOtpContent("signup", "123456", {
    publicSiteUrl: "http://merchant.business.sendflow.africa",
    now: testDate,
  });

  assert.match(email.html, />SendFlow</);
  assert.doesNotMatch(email.html, /<img\b/);
});

test("rejects non-six-digit verification values before rendering", () => {
  assert.throws(
    () => renderEmailOtpContent("signup", "<123456>", { now: testDate }),
    /Invalid email verification code/,
  );
});
