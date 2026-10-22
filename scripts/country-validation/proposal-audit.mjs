// Offline analysis only. Not imported by the server and never writes configuration.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const proposal = JSON.parse(readFileSync(
  new URL("../../docs/country-validation/proposals.json", import.meta.url), "utf8",
));

/** Subscriber-length envelope only; not mobile allocation, ownership or SMS proof. */
export function matchesLengthEnvelope(phone, country, digits = country.proposedDigits) {
  if (typeof phone !== "string" || !/^\+[1-9][0-9]{1,14}$/.test(phone)
    || !phone.startsWith(country.phonePrefix)) return false;
  const nationalLength = phone.length - country.phonePrefix.length;
  return nationalLength >= digits[0] && nationalLength <= digits[1];
}

// Parse only known VALUES in the historical seed, never open a database.
export function readSeedCountries() {
  const sql = readFileSync(new URL(`../../${proposal.baseline}`, import.meta.url), "utf8");
  return [...sql.matchAll(
    /\('([a-z]{2})', '[^']*', '(\+\d+)', (\d+), (\d+), true, 'system:migration', 'system:migration'\)/g,
  )].map(([, countryCode, phonePrefix, min, max]) => ({
    countryCode, phonePrefix, digits: [Number(min), Number(max)],
  }));
}

export function proposedLengthChanges() {
  return proposal.countries
    .filter((c) => c.baselineDigits.some((value, index) => value !== c.proposedDigits[index]))
    .map(({ countryCode, phonePrefix, baselineDigits, proposedDigits }) => ({
      countryCode, phonePrefix, before: baselineDigits, proposed: proposedDigits,
    }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify({
    mode: proposal.mode,
    reviewedOn: proposal.reviewedOn,
    comparison: "historical seed only, not live Neon",
    changes: proposedLengthChanges(),
    openingApproved: false,
  }, null, 2));
}
