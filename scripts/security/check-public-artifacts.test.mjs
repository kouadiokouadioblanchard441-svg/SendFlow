import assert from "node:assert/strict";
import test from "node:test";
import { scanPublicArtifactText } from "./check-public-artifacts.mjs";

test("public Turnstile site key is not classified as a secret", () => {
  const findings = scanPublicArtifactText(
    "artifacts/sendflow/dist/public/assets/auth.js",
    'const siteKey="1x00000000000000000000AA";',
  );
  assert.deepEqual(findings, []);
});

test("server secret assignments and client exposure are detected without returning values", () => {
  const marker = "synthetic-never-use-secret-value-123456789";
  const assignmentSource = [
    "const TURNSTILE_SECRET_KEY=",
    JSON.stringify(marker),
    ";",
  ].join("");
  const assignment = scanPublicArtifactText(
    "artifacts/sendflow/dist/public/assets/auth.js",
    assignmentSource,
  );
  const clientAccess = scanPublicArtifactText(
    "artifacts/sendflow/dist/public/assets/auth.js",
    "const secret = import.meta.env.TURNSTILE_SECRET_KEY;",
  );
  assert.ok(assignment.some((finding) => finding.rule === "literal-credential"));
  assert.ok(clientAccess.some((finding) => finding.rule === "server-secret-client-access"));
  assert.equal(JSON.stringify([...assignment, ...clientAccess]).includes(marker), false);
});

test("API response and log text can be scanned without disclosing matched values", () => {
  const marker = "synthetic-log-secret-value-987654321";
  const apiResponse = JSON.stringify({
    error: "Service temporarily unavailable",
    TURNSTILE_SECRET_KEY: marker,
  });
  const logLine = JSON.stringify({
    level: 50,
    msg: "Request failed",
    SESSION_SECRET: marker,
  });
  const findings = [
    ...scanPublicArtifactText("api-response.json", apiResponse),
    ...scanPublicArtifactText("api-output.log", logLine),
  ];
  assert.equal(findings.length, 2);
  assert.equal(JSON.stringify(findings).includes(marker), false);
});
