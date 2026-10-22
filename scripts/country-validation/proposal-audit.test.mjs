import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { proposal, matchesLengthEnvelope, readSeedCountries, proposedLengthChanges } from "./proposal-audit.mjs";
import {
  RegisterCustomerBody, SendPhoneOtpBody, CreateCustomerTransferQuoteBody, UpdateAdminCountryBody,
} from "../../lib/api-zod/src/generated/api.ts";
import {
  calculateCustomerTransferQuote,
  TransferQuoteError,
} from "../../artifacts/api-server/src/services/transfer-quote.ts";

// No server, db package, environment file or provider client is imported.
const originalFetch = globalThis.fetch;
before(() => { globalThis.fetch = () => { throw new Error("Network forbidden in country audit"); }; });
after(() => { globalThis.fetch = originalFetch; });

const byCode = (code) => proposal.countries.find((c) => c.countryCode === code);
const seed = readSeedCountries();
const deps = (country) => ({
  countries: [{
    ...country, minPhoneDigits: country.proposedDigits[0], maxPhoneDigits: country.proposedDigits[1],
    enabled: true, depositEnabled: true, interNetworkEnabled: true, internationalEnabled: true,
  }],
  operators: ["source", "destination"].map((operatorId) => ({
    operatorId, countryCode: country.countryCode, enabled: true,
    depositEnabled: true, interNetworkEnabled: true, internationalEnabled: true,
  })),
  rates: [
    {operatorId: "source", categoryId: "deposit", feePercent: 1, version: 1},
    {operatorId: "source", categoryId: "inter-network", feePercent: 1, version: 1},
    {operatorId: "destination", categoryId: "international", feePercent: 1, version: 1},
  ],
  remainingMonthlyAmount: async () => 1_000_000,
});
const input = (country, kind, phone = country.syntheticMobile) => ({
  kind, amountMinor: 1_000, senderPaysFees: true,
  ...(kind === "international"
    ? {destinationOperatorId: "destination", destinationCountryCode: country.countryCode, recipientPhone: phone}
    : kind === "deposit"
      ? {sourceOperatorId: "source", senderPhone: phone}
      : {sourceOperatorId: "source", destinationOperatorId: "destination",
        senderPhone: phone, recipientPhone: phone}),
});
const quote = (c, kind, phone, dependencies = deps(c)) =>
  calculateCustomerTransferQuote("synthetic-customer", input(c, kind, phone), dependencies);
const invalidQuote = (promise) => assert.rejects(promise,
  (err) => err instanceof TransferQuoteError && err.statusCode === 400);

test("review covers every historical seed country exactly once, without changing the seed", () => {
  assert.equal(seed.length, 9);
  assert.equal(new Set(proposal.countries.map((c) => c.countryCode)).size, 9);
  assert.deepEqual(seed.map((c) => c.countryCode).sort(),
    proposal.countries.map((c) => c.countryCode).sort());
  for (const c of proposal.countries) {
    const original = seed.find((s) => s.countryCode === c.countryCode);
    assert.equal(original.phonePrefix, c.phonePrefix);
    assert.deepEqual(original.digits, c.baselineDigits);
    assert.match(c.source, /^https:\/\/www\.itu\.int\/dms_pub\/itu-t\/oth\/02\/02\/.+PDFE\.pdf$/);
    assert.ok(c.regulator && c.noticeDate && c.formatNotes);
  }
});

test("only Mali, Niger and Congo have proposed length changes", () => {
  assert.deepEqual(proposedLengthChanges().map((c) => [c.countryCode, c.before, c.proposed]), [
    ["ml", [9, 9], [8, 8]], ["ne", [9, 9], [8, 8]], ["cg", [7, 12], [9, 9]],
  ]);
});

test("public coverage is evidence, never approval or delivery proof", () => {
  assert.equal(proposal.mode, "proposal-only");
  assert.equal(proposal.coverageSource, "https://sms.esmsafrica.io/api/pricing/coverage");
  for (const c of proposal.countries) {
    assert.equal(c.publicSms.status, "available");
    assert.equal(c.publicSms.dialCode, c.phonePrefix.slice(1));
    assert.equal(c.publicSms.routeCode, `ESMS_${c.countryCode.toUpperCase()}`);
    assert.equal(c.verifyAppAuthorization, "unverified");
    assert.equal(c.delivery, "untested");
    assert.equal(c.openingApproved, false);
    assert.ok(c.proposedDigits[1] + c.phonePrefix.length - 1 <= 15);
  }
});

test("proposed lengths satisfy the actual administrator update contract", () => {
  for (const c of proposal.countries) {
    assert.ok(UpdateAdminCountryBody.safeParse({
      countryName: c.countryName, phonePrefix: c.phonePrefix,
      minPhoneDigits: c.proposedDigits[0], maxPhoneDigits: c.proposedDigits[1],
      enabled: false, operations: {deposit: false, interNetwork: false, international: false},
      expectedVersion: 1, reason: "Synthetic offline numbering review",
    }).success);
  }
  // Version 1 above is a fixture, never an instruction to patch shared configuration.
});

for (const c of proposal.countries) {
  test(`${c.countryCode}: actual signup/OTP/quote schemas preserve canonical digits`, () => {
    const schemas = [
      RegisterCustomerBody.shape.phone, SendPhoneOtpBody.shape.phone,
      CreateCustomerTransferQuoteBody.shape.senderPhone,
      CreateCustomerTransferQuoteBody.shape.recipientPhone,
    ];
    for (const schema of schemas) {
      assert.equal(schema.parse(c.syntheticMobile), c.syntheticMobile);
      for (const malformed of [
        `${c.syntheticMobile}ext1`, c.syntheticMobile.replace(c.phonePrefix, `${c.phonePrefix} `),
        c.syntheticMobile.replace(c.phonePrefix, `${c.phonePrefix}-`), c.syntheticMobile.slice(1),
      ]) assert.equal(schema.safeParse(malformed).success, false);
    }
  });

  test(`${c.countryCode}: canonical length, short/long boundaries, country mismatch and malformed formats`, () => {
    assert.ok(matchesLengthEnvelope(c.syntheticMobile, c));
    for (const bad of [
      c.syntheticMobile.slice(0, -1), `${c.syntheticMobile}0`,
      c.syntheticMobile.replace(c.phonePrefix, "+999"),
      c.syntheticMobile.slice(1), `00${c.syntheticMobile.slice(1)}`,
      `${c.syntheticMobile}ext1`, `${c.syntheticMobile}\n`,
      c.syntheticMobile.replace(c.phonePrefix, `${c.phonePrefix} `),
      c.syntheticMobile.replace(c.phonePrefix, `${c.phonePrefix}-`),
      c.syntheticMobile.replace(/[0-9]$/, "０"),
      null,
    ]) assert.equal(matchesLengthEnvelope(bad, c), false);
  });

  test(`${c.countryCode}: actual quote service accepts proposed length for all three operations`, async () => {
    for (const kind of ["deposit", "inter-network", "international"]) {
      await assert.doesNotReject(quote(c, kind));
      await invalidQuote(quote(c, kind, c.syntheticMobile.slice(0, -1)));
      await invalidQuote(quote(c, kind, `${c.syntheticMobile}0`));
      await invalidQuote(quote(c, kind, c.syntheticMobile.replace(c.phonePrefix, "+999")));
    }
  });

  test(`${c.countryCode}: number validity never bypasses country or operation suspension`, async () => {
    for (const kind of ["deposit", "inter-network", "international"]) {
      const disabled = deps(c);
      disabled.countries[0].enabled = false;
      await invalidQuote(quote(c, kind, c.syntheticMobile, disabled));
      const operationDisabled = deps(c);
      operationDisabled.countries[0][{
        deposit: "depositEnabled", "inter-network": "interNetworkEnabled", international: "internationalEnabled",
      }[kind]] = false;
      await invalidQuote(quote(c, kind, c.syntheticMobile, operationDisabled));
    }
  });
}

test("Mali/Niger seed rejects the reviewed eight-digit shape and accepts an extra digit", async () => {
  for (const code of ["ml", "ne"]) {
    const c = byCode(code);
    assert.equal(matchesLengthEnvelope(c.syntheticMobile, c, c.baselineDigits), false);
    assert.equal(matchesLengthEnvelope(`${c.syntheticMobile}0`, c, c.baselineDigits), true);
    const old = deps(c);
    [old.countries[0].minPhoneDigits, old.countries[0].maxPhoneDigits] = c.baselineDigits;
    await invalidQuote(quote(c, "international", c.syntheticMobile, old));
    await assert.doesNotReject(quote(c, "international", `${c.syntheticMobile}0`, old));
  }
});

test("Congo seed admits obsolete seven digits and ten to twelve digits; proposal rejects them", () => {
  const c = byCode("cg");
  for (const n of [7, 8, 10, 11, 12]) {
    const phone = c.phonePrefix + "0".repeat(n);
    assert.ok(matchesLengthEnvelope(phone, c, c.baselineDigits));
    assert.equal(matchesLengthEnvelope(phone, c), false);
  }
});

test("significant zero is preserved in CI, BJ, BF and CG; old BJ and CG shapes are rejected", () => {
  for (const code of ["ci", "bj", "bf", "cg"]) {
    const c = byCode(code);
    assert.equal(c.syntheticMobile[c.phonePrefix.length], "0");
    assert.ok(matchesLengthEnvelope(c.syntheticMobile, c));
    assert.equal(matchesLengthEnvelope(c.phonePrefix + c.syntheticMobile.slice(c.phonePrefix.length + 1), c), false);
  }
  assert.equal(matchesLengthEnvelope("+22997000000", byCode("bj")), false);
  assert.equal(matchesLengthEnvelope("+2426000000", byCode("cg")), false);
});

test("known gap: length configuration cannot reject fixed lines or wrong service prefixes", async () => {
  // Characterization, NOT a claim that these shapes are eligible for SMS/mobile money.
  for (const [code, phone] of [
    ["ci", "+2252700000000"], ["bj", "+2290121000000"], ["cm", "+237222000000"],
    ["ci", "+2259900000000"], ["bj", "+2290297000000"],
  ]) {
    const c = byCode(code);
    assert.ok(matchesLengthEnvelope(phone, c));
    await assert.doesNotReject(quote(c, "international", phone));
  }
});

test("known gap: quote service strips nondigits; strict offline envelope does not", async () => {
  const c = byCode("ci");
  const phone = "+22507-00000000";
  assert.equal(matchesLengthEnvelope(phone, c), false);
  await assert.doesNotReject(quote(c, "international", phone));
});
