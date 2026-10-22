import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAdultBirthDate,
  formatCustomerDisplayName,
  normalizeCustomerProfile,
  serializeCustomerProfileName,
  splitCustomerDisplayName,
} from "./customer-profile-policy.ts";

const fixedNow = new Date("2026-10-22T12:00:00.000Z");

test("normalizes whitespace in names and preserves the calendar date", () => {
  assert.deepEqual(
    normalizeCustomerProfile({
      firstName: "  Aïcha   Marie ",
      lastName: " Koné  ",
      birthDate: "1996-04-12",
    }, fixedNow),
    {
      firstName: "Aïcha Marie",
      lastName: "Koné",
      birthDate: "1996-04-12",
    },
  );
});

test("rejects empty, malformed, overlong, and underage profile values", () => {
  const valid = { firstName: "Aïcha", lastName: "Koné", birthDate: "1996-04-12" };
  assert.equal(normalizeCustomerProfile({ ...valid, firstName: "  " }, fixedNow), null);
  assert.equal(normalizeCustomerProfile({ ...valid, firstName: "A" }, fixedNow), null);
  assert.equal(normalizeCustomerProfile({ ...valid, lastName: "X".repeat(81) }, fixedNow), null);
  assert.equal(normalizeCustomerProfile({ ...valid, birthDate: "2020-02-31" }, fixedNow), null);
  assert.equal(normalizeCustomerProfile({ ...valid, birthDate: "2008-10-23" }, fixedNow), null);
  assert.equal(normalizeCustomerProfile({ ...valid, birthDate: "2008-10-22" }, fixedNow) !== null, true);
});

test("rejects a valid-looking name that cannot fit in the existing encrypted database column", () => {
  assert.equal(
    normalizeCustomerProfile({
      firstName: "ሀ".repeat(60),
      lastName: "ሀ".repeat(59),
      birthDate: "1996-04-12",
    }, fixedNow),
    null,
  );
});

test("rejects invalid calendar days and handles exact adult cutoff", () => {
  assert.equal(isAdultBirthDate("2000-02-30", fixedNow), false);
  assert.equal(isAdultBirthDate("2008-10-23", fixedNow), false);
  assert.equal(isAdultBirthDate("2008-10-22", fixedNow), true);
});

test("splits only stored names and leaves missing values empty", () => {
  assert.deepEqual(splitCustomerDisplayName("Aïcha Marie Koné"), {
    firstName: "Aïcha",
    lastName: "Marie Koné",
  });
  assert.deepEqual(splitCustomerDisplayName(null), { firstName: "", lastName: "" });
});

test("preserves compound given names in the encrypted display-name representation", () => {
  const storedName = serializeCustomerProfileName({
    firstName: "Aïcha Marie",
    lastName: "Koné",
  });
  assert.deepEqual(splitCustomerDisplayName(storedName), {
    firstName: "Aïcha Marie",
    lastName: "Koné",
  });
  assert.equal(formatCustomerDisplayName(storedName), "Aïcha Marie Koné");
  assert.deepEqual(splitCustomerDisplayName("Aïcha Marie Koné"), {
    firstName: "Aïcha",
    lastName: "Marie Koné",
  });
});
