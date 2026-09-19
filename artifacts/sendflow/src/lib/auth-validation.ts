export type SignUpValidationInput = {
  fullName: string;
  birthDate: string;
  phone: string;
  password: string;
  confirmation: string;
  acceptedPrivacy: boolean;
};

export type SignInValidationInput = {
  phone: string;
  password: string;
};

export type SignUpField = keyof SignUpValidationInput;
export type SignInField = keyof SignInValidationInput;
export type FieldErrors<T extends string> = Partial<Record<T, string>>;
export const MIN_BIRTH_DATE = '1900-01-01';

export function getAdultBirthDateLimit(referenceDate = new Date()) {
  const limit = new Date(referenceDate);
  limit.setFullYear(limit.getFullYear() - 18);

  const year = limit.getFullYear();
  const month = String(limit.getMonth() + 1).padStart(2, '0');
  const day = String(limit.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '');
}

function validatePhone(phone: string) {
  const digits = normalizePhone(phone);

  if (!digits) return 'Le numéro de téléphone est requis.';
  if (digits.length < 8 || digits.length > 10) {
    return 'Saisissez un numéro valide de 8 à 10 chiffres.';
  }

  return undefined;
}

function validatePassword(password: string) {
  if (!password) return 'Le code secret est requis.';
  if (password.length < 4) return 'Le code secret doit contenir au moins 4 caractères.';
  if (password.length > 64) return 'Le code secret ne peut pas dépasser 64 caractères.';
  return undefined;
}

function validateBirthDate(birthDate: string) {
  if (!birthDate) return 'La date de naissance est requise.';

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return 'Saisissez une date de naissance valide.';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(year, month - 1, day);
  const isRealCalendarDate = (
    parsedDate.getFullYear() === year
    && parsedDate.getMonth() === month - 1
    && parsedDate.getDate() === day
  );

  if (!isRealCalendarDate || birthDate < MIN_BIRTH_DATE) {
    return 'Saisissez une date de naissance valide.';
  }

  if (birthDate > getAdultBirthDateLimit()) return 'Vous devez avoir au moins 18 ans.';

  return undefined;
}

export function validateSignUp(form: SignUpValidationInput): FieldErrors<SignUpField> {
  const errors: FieldErrors<SignUpField> = {};
  const fullName = form.fullName.trim().replace(/\s+/g, ' ');

  if (!fullName) {
    errors.fullName = 'Le nom et le prénom sont requis.';
  } else if (fullName.length < 2) {
    errors.fullName = 'Saisissez un nom et un prénom valides.';
  } else if (fullName.split(' ').filter(Boolean).length < 2) {
    errors.fullName = 'Saisissez votre nom et votre prénom.';
  } else if (!/[A-Za-zÀ-ÿ]/.test(fullName)) {
    errors.fullName = 'Saisissez un nom avec des lettres.';
  }

  const birthDateError = validateBirthDate(form.birthDate);
  if (birthDateError) errors.birthDate = birthDateError;

  const phoneError = validatePhone(form.phone);
  if (phoneError) errors.phone = phoneError;

  const passwordError = validatePassword(form.password);
  if (passwordError) errors.password = passwordError;

  if (!form.confirmation) {
    errors.confirmation = 'Confirmez votre code secret.';
  } else if (form.password !== form.confirmation) {
    errors.confirmation = 'Les deux codes secrets doivent être identiques.';
  }

  if (!form.acceptedPrivacy) {
    errors.acceptedPrivacy = 'Vous devez accepter la politique de confidentialité.';
  }

  return errors;
}

export function validateSignIn(form: SignInValidationInput): FieldErrors<SignInField> {
  const errors: FieldErrors<SignInField> = {};
  const phoneError = validatePhone(form.phone);
  const passwordError = validatePassword(form.password);

  if (phoneError) errors.phone = phoneError;
  if (passwordError) errors.password = passwordError;

  return errors;
}