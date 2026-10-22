export type AccountProfile = {
  lastName: string;
  firstName: string;
  birthDate: string;
};

export const ACCOUNT_PROFILE_KEY = 'sendflow.account.profile';
const ACCOUNT_PROFILE_STORAGE_PREFIX = `${ACCOUNT_PROFILE_KEY}:`;

export function splitFullName(fullName: string): Pick<AccountProfile, 'lastName' | 'firstName'> {
  const parts = fullName.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  const [firstName = '', ...lastNameParts] = parts;
  return {
    firstName,
    lastName: lastNameParts.join(' '),
  };
}

export function clearLegacyAccountProfile(): void {
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key === ACCOUNT_PROFILE_KEY || key?.startsWith(ACCOUNT_PROFILE_STORAGE_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Browser storage may be unavailable; it is no longer used as a profile source.
  }
}
