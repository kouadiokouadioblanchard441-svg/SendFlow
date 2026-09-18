export type AccountProfile = {
  lastName: string;
  firstName: string;
  birthDate: string;
};

export const ACCOUNT_PROFILE_KEY = 'sendflow.account.profile';

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

export function readAccountProfile(): AccountProfile {
  const storedProfile = window.localStorage.getItem(ACCOUNT_PROFILE_KEY);
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
    window.localStorage.removeItem(ACCOUNT_PROFILE_KEY);
  }

  return DEFAULT_ACCOUNT_PROFILE;
}

export function saveAccountProfile(profile: AccountProfile) {
  window.localStorage.setItem(ACCOUNT_PROFILE_KEY, JSON.stringify(profile));
}