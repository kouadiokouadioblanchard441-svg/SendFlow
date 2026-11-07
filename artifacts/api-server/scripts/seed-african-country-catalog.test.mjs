import assert from "node:assert/strict";
import test from "node:test";
import {
  AFRICAN_COUNTRIES,
  assertPleskProductionEnvironment,
  createProductionDatabaseOptions,
} from "./seed-african-country-catalog.mjs";

const productionEnvironment = {
  NODE_ENV: "production",
  SENDFLOW_DATABASE_TARGET: "production",
  DATABASE_URL: "postgresql://db.invalid/sendflow?sslmode=require",
  DATABASE_CA_CERT: "test-ca-certificate",
};

test("catalog contains exactly the 54 African ISO country records with unique codes", () => {
  assert.equal(AFRICAN_COUNTRIES.length, 54);
  assert.equal(new Set(AFRICAN_COUNTRIES.map((country) => country.countryCode)).size, 54);
  for (const country of AFRICAN_COUNTRIES) {
    assert.match(country.countryCode, /^[a-z]{2}$/);
    assert.match(country.phonePrefix, /^\+[1-9]\d{0,3}$/);
    assert.ok(country.minPhoneDigits >= 4);
    assert.ok(country.minPhoneDigits <= country.maxPhoneDigits);
    assert.ok(country.maxPhoneDigits + country.phonePrefix.length - 1 <= 15);
  }
});

test("new signup countries are enabled but every payment operation remains disabled", () => {
  for (const country of AFRICAN_COUNTRIES) {
    assert.equal(country.enabled, true);
    assert.equal(country.depositEnabled, false);
    assert.equal(country.interNetworkEnabled, false);
    assert.equal(country.internationalEnabled, false);
  }
});

test("known regulator-reviewed numbering lengths remain constrained", () => {
  for (const code of ["bj", "cm", "ci", "sn", "bf", "ml", "ne", "tg", "cg"]) {
    const country = AFRICAN_COUNTRIES.find((entry) => entry.countryCode === code);
    assert.ok(country, `${code} must exist`);
    assert.equal(country.minPhoneDigits, country.maxPhoneDigits);
  }
  assert.equal(AFRICAN_COUNTRIES.find((country) => country.countryCode === "bj").minPhoneDigits, 10);
  assert.equal(AFRICAN_COUNTRIES.find((country) => country.countryCode === "cm").minPhoneDigits, 9);
  assert.equal(AFRICAN_COUNTRIES.find((country) => country.countryCode === "ml").minPhoneDigits, 8);
  assert.equal(AFRICAN_COUNTRIES.find((country) => country.countryCode === "ne").minPhoneDigits, 8);
  assert.equal(AFRICAN_COUNTRIES.find((country) => country.countryCode === "cg").minPhoneDigits, 9);
});

test("seeding rejects Replit and any non-production target before database access", () => {
  assert.throws(
    () => assertPleskProductionEnvironment({ ...productionEnvironment, REPL_ID: "replit" }),
    /only in the Plesk production runtime/,
  );
  assert.throws(
    () => assertPleskProductionEnvironment({ ...productionEnvironment, SENDFLOW_DATABASE_TARGET: "shared-external" }),
    /only in the Plesk production runtime/,
  );
  assert.throws(
    () => assertPleskProductionEnvironment({ ...productionEnvironment, NODE_ENV: "development" }),
    /only in the Plesk production runtime/,
  );
  assert.throws(
    () => assertPleskProductionEnvironment({ ...productionEnvironment, DATABASE_URL: undefined }),
    /DATABASE_URL is required/,
  );
  assert.throws(
    () => assertPleskProductionEnvironment({ ...productionEnvironment, DATABASE_CA_CERT: undefined }),
    /DATABASE_CA_CERT is required/,
  );
});

test("database options force certificate and hostname verification without logging credentials", () => {
  const options = createProductionDatabaseOptions(productionEnvironment);
  const parsed = new URL(options.connectionString);
  assert.equal(parsed.searchParams.has("sslmode"), false);
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.ssl.servername, "db.invalid");
  assert.equal(options.ssl.ca, "test-ca-certificate");
  assert.equal(options.max, 1);
});

test("database connection strings that explicitly disable TLS are rejected", () => {
  assert.throws(
    () => createProductionDatabaseOptions({
      ...productionEnvironment,
      DATABASE_URL: "postgresql://db.invalid/sendflow?sslmode=disable",
    }),
    /Plesk production database configuration is invalid/,
  );
});
