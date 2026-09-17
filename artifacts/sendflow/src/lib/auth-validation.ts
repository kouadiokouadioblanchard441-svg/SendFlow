export type SignUpValidationInput = {
  fullName: string;
  phone: string;
  password: string;
  confirmation: string;
  acceptedTerms: boolean;
};

export type SignInValidationInput = {
  phone: string;
  password: string;
};

export type SignUpField = keyof SignUpValidationInput;
export type SignInField = keyof SignInValidationInput;
export type FieldErrors<T extends string> = Partial<Record<T, string>>;

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

  const phoneError = validatePhone(form.phone);
  if (phoneError) errors.phone = phoneError;

  const passwordError = validatePassword(form.password);
  if (passwordError) errors.password = passwordError;

  if (!form.confirmation) {
    errors.confirmation = 'Confirmez votre code secret.';
  } else if (form.password !== form.confirmation) {
    errors.confirmation = 'Les deux codes secrets doivent être identiques.';
  }

  if (!form.acceptedTerms) {
    errors.acceptedTerms = 'Vous devez accepter les conditions générales.';
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