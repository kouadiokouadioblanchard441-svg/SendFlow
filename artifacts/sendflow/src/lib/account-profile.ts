export type AccountProfile = {
  lastName: string;
  firstName: string;
  birthDate: string;
};

export const ACCOUNT_PROFILE_KEY = 'sendflow.account.profile';
const ACCOUNT_PROFILE_STORAGE_PREFIX = `${ACCOUNT_PROFILE_KEY}:`;

const DEFAULT_ACCOUNT_PROFILE: AccountProfile = {
  lastName: 'A.',
  firstName: 'Mariam',
  birthDate: '2000-01-01',
};

export function splitFullName(fullName: string): Pick<AccountProfile, 'lastName' | 'firstName'> {
  const parts = fullName.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }

  const [firstName, ...lastNameParts] = parts;
  return {
    firstName,
    lastName: lastNameParts.join(' ') || firstName,
  };
}

function getAccountProfileStorageKey(userId: string): string {
  return `${ACCOUNT_PROFILE_STORAGE_PREFIX}${userId}`;
}

export function clearLegacyAccountProfile(): void {
  window.localStorage.removeItem(ACCOUNT_PROFILE_KEY);
}

export function readAccountProfile(userId?: string): AccountProfile {
  if (typeof userId !== 'string' || !userId.trim()) return DEFAULT_ACCOUNT_PROFILE;

  // Old profiles have no account owner, so they cannot be safely migrated.
  clearLegacyAccountProfile();
  const storageKey = getAccountProfileStorageKey(userId);
  const storedProfile = window.localStorage.getItem(storageKey);
  if (!storedProfile) return DEFAULT_ACCOUNT_PROFILE;

  try {
    const parsed = JSON.parse(storedProfile) as Partial<AccountProfile>;
    if (
      typeof parsed.lastName === 'string' &&
      typeof parsed.firstName === 'string' &&
      typeof parsed.birthDate === 'string'
    ) {
      return {
        lastName: parsed.lastName,
        firstName: parsed.firstName,
        birthDate: parsed.birthDate,
      };
    }
  } catch {
    window.localStorage.removeItem(storageKey);
  }

  return DEFAULT_ACCOUNT_PROFILE;
}

export function saveAccountProfile(profile: AccountProfile, userId: string): void {
  if (!userId.trim()) {
    throw new Error('A customer account is required to save profile information.');
  }

  clearLegacyAccountProfile();
  window.localStorage.setItem(
    getAccountProfileStorageKey(userId),
    JSON.stringify(profile),
  );
}