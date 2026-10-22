export type CustomerProfileInput = {
  firstName: string;
  lastName: string;
  birthDate: string;
};

// sf_users.display_name is varchar(512); the sfenc-v1 envelope reserves 49 characters for metadata and base64 expansion.
const MAX_ENCRYPTED_DISPLAY_NAME_PLAINTEXT_BYTES = 347;

export function normalizeCustomerProfile(
  profile: CustomerProfileInput,
  now = new Date(),
): CustomerProfileInput | null {
  const firstName = profile.firstName.trim().replace(/\s+/g, " ");
  const lastName = profile.lastName.trim().replace(/\s+/g, " ");
  const fullName = `${firstName} ${lastName}`;

  if (
    firstName.length < 2 ||
    firstName.length > 80 ||
    !/\p{L}/u.test(firstName) ||
    lastName.length < 2 ||
    lastName.length > 80 ||
    !/\p{L}/u.test(lastName) ||
    fullName.length > 120 ||
    new TextEncoder().encode(serializeCustomerProfileName({ firstName, lastName })).byteLength >
      MAX_ENCRYPTED_DISPLAY_NAME_PLAINTEXT_BYTES ||
    !isAdultBirthDate(profile.birthDate, now)
  ) {
    return null;
  }

  return { firstName, lastName, birthDate: profile.birthDate };
}

export function isAdultBirthDate(value: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return false;

  const cutoff = new Date(Date.UTC(
    now.getUTCFullYear() - 18,
    now.getUTCMonth(),
    now.getUTCDate(),
  ));
  return parsed.getTime() <= cutoff.getTime();
}

const PROFILE_NAME_PREFIX = "sendflow-profile-v1:";

export function serializeCustomerProfileName(
  profile: Pick<CustomerProfileInput, "firstName" | "lastName">,
): string {
  return `${PROFILE_NAME_PREFIX}${JSON.stringify({
    firstName: profile.firstName,
    lastName: profile.lastName,
  })}`;
}

export function formatCustomerDisplayName(value: string | null): string | null {
  if (value === null) return null;
  const parsed = parseCustomerProfileName(value);
  return parsed ? `${parsed.firstName} ${parsed.lastName}` : value;
}

export function splitCustomerDisplayName(value: string | null): Pick<CustomerProfileInput, "firstName" | "lastName"> {
  const parsed = value === null ? null : parseCustomerProfileName(value);
  if (parsed) return parsed;
  const parts = (value ?? "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const [firstName = "", ...lastNameParts] = parts;
  return { firstName, lastName: lastNameParts.join(" ") };
}

function parseCustomerProfileName(value: string): Pick<CustomerProfileInput, "firstName" | "lastName"> | null {
  if (!value.startsWith(PROFILE_NAME_PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(PROFILE_NAME_PREFIX.length)) as Record<string, unknown>;
    if (typeof parsed.firstName !== "string" || typeof parsed.lastName !== "string") return null;
    return { firstName: parsed.firstName, lastName: parsed.lastName };
  } catch {
    return null;
  }
}
