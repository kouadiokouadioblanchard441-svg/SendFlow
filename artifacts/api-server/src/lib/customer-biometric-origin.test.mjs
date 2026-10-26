import assert from "node:assert/strict";
import test from "node:test";
import { getCustomerBiometricOrigin } from "./customer-biometric-origin.ts";

test("GET biometric status derives only from a configured request host when Origin is omitted", () => {
  const environment = { REPLIT_DEV_DOMAIN: "preview.sendflow.example" };
  assert.deepEqual(
    getCustomerBiometricOrigin("GET", undefined, "preview.sendflow.example", environment),
    { origin: "https://preview.sendflow.example", rpId: "preview.sendflow.example" },
  );
  assert.equal(getCustomerBiometricOrigin("GET", undefined, "attacker.example", environment), null);
});

test("biometric mutations require an explicit trusted origin", () => {
  const environment = { CORS_ALLOWED_ORIGINS: "https://sendflow.example" };
  assert.deepEqual(
    getCustomerBiometricOrigin("POST", "https://sendflow.example", "api.sendflow.example", environment),
    { origin: "https://sendflow.example", rpId: "sendflow.example" },
  );
  assert.equal(getCustomerBiometricOrigin("POST", undefined, "sendflow.example", environment), null);
  assert.equal(getCustomerBiometricOrigin("POST", "https://attacker.example", "sendflow.example", environment), null);
});

test("insecure non-local origins cannot register a biometric credential", () => {
  const environment = { CORS_ALLOWED_ORIGINS: "http://sendflow.example,http://localhost" };
  assert.equal(
    getCustomerBiometricOrigin("POST", "http://sendflow.example", "sendflow.example", environment),
    null,
  );
  assert.deepEqual(
    getCustomerBiometricOrigin("POST", "http://localhost", "localhost", environment),
    { origin: "http://localhost", rpId: "localhost" },
  );
});
