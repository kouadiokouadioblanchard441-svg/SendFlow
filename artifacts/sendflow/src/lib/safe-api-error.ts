export type SafeApiErrorCopy = {
  title: string;
  message: string;
};

type ErrorLike = {
  status?: unknown;
  url?: unknown;
  response?: {
    status?: unknown;
    url?: unknown;
  };
};

const SUPPORT_NOTE = 'Si le problème persiste, contactez le service client SendFlow.';

function safeCopy(title: string, message: string): SafeApiErrorCopy {
  return { title, message: `${message} ${SUPPORT_NOTE}` };
}

function asErrorLike(error: unknown): ErrorLike | undefined {
  return error !== null && typeof error === 'object'
    ? error as ErrorLike
    : undefined;
}

export function getApiErrorStatus(error: unknown): number | undefined {
  const candidate = asErrorLike(error);
  const status = candidate?.status ?? candidate?.response?.status;
  return typeof status === 'number' && status >= 400 && status <= 599
    ? status
    : undefined;
}

function getRequestPath(error: unknown): string {
  const candidate = asErrorLike(error);
  const url = candidate?.url ?? candidate?.response?.url;
  if (typeof url !== 'string' || !url) return '';

  try {
    return new URL(url, 'https://sendflow.invalid').pathname.toLowerCase();
  } catch {
    return '';
  }
}

function isFinancialRequest(path: string): boolean {
  return /payment|transaction|transfer|payout|withdraw|deposit|checkout|linkflow/.test(path);
}

function isTransferQuoteRequest(path: string): boolean {
  return /\/transfer-quote(?:\/|$)/.test(path);
}

export function getSafeApiErrorCopy(error: unknown): SafeApiErrorCopy {
  const status = getApiErrorStatus(error);
  const path = getRequestPath(error);

  if (status === 423 && path.endsWith('/auth/sign-in')) {
    return safeCopy('Compte bloqué', 'Votre compte est bloqué.');
  }

  if (status === 401 && path.endsWith('/auth/sign-in')) {
    return safeCopy('Connexion impossible', 'L’adresse e-mail ou le code secret est incorrect. Vérifiez vos informations.');
  }

  if (status === 401 && /pin|otp|verify|verification|reset/.test(path)) {
    return safeCopy('Vérification impossible', 'Le code saisi est incorrect ou a expiré. Vérifiez-le puis réessayez.');
  }

  if (status === 400 || status === 422) {
    return safeCopy('Informations incorrectes', 'Certaines informations sont manquantes ou incorrectes. Vérifiez les champs puis réessayez.');
  }

  if (status === 401) {
    return safeCopy('Connexion à renouveler', 'Reconnectez-vous puis réessayez.');
  }

  if (status === 403) {
    if (/pin|otp|verify|verification/.test(path)) {
      return safeCopy('Vérification refusée', 'Le code saisi est incorrect ou cette action n’est pas autorisée.');
    }
    return safeCopy('Action non autorisée', 'Votre compte ne peut pas effectuer cette action.');
  }

  if (status === 404) {
    return safeCopy('Élément introuvable', 'Cet élément n’est plus disponible. Actualisez la page puis réessayez.');
  }

  if (status === 409) {
    if (/auth\/reset-password|auth\/reset-pin|auth\/verify-otp/.test(path)) {
      return safeCopy('Code à renouveler', 'Le code a expiré ou a déjà été utilisé. Demandez-en un nouveau.');
    }
    if (isTransferQuoteRequest(path)) {
      return safeCopy(
        'Plafond mensuel dépassé',
        'Ce montant dépasse la limite disponible sur votre compte. Aucun transfert n’a été lancé. Réduisez le montant puis réessayez.',
      );
    }
    if (isFinancialRequest(path)) {
      return safeCopy(
        'Opération à vérifier',
        'Cette opération ne peut pas être préparée. Vérifiez le montant et les limites applicables, puis réessayez.',
      );
    }
    return safeCopy('Modification non enregistrée', 'Les informations ont changé. Actualisez la page puis vérifiez avant de recommencer.');
  }

  if (status === 413) {
    return safeCopy('Fichier trop volumineux', 'Choisissez un fichier plus léger.');
  }

  if (status === 415) {
    return safeCopy('Format non accepté', 'Choisissez un type de fichier autorisé.');
  }

  if (status === 423) {
    return safeCopy('Action temporairement bloquée', 'Cette action ne peut pas être effectuée pour le moment.');
  }

  if (status === 429) {
    return safeCopy('Trop de tentatives', 'Patientez un instant avant de réessayer.');
  }

  if (status !== undefined && status >= 500) {
    if (isTransferQuoteRequest(path)) {
      return safeCopy(
        'Vérification indisponible',
        'Nous ne pouvons pas vérifier le montant pour le moment. Aucun transfert n’a été lancé. Réessayez plus tard.',
      );
    }
    return safeCopy(
      'Service momentanément indisponible',
      isFinancialRequest(path)
        ? 'Nous n’avons pas pu confirmer cette opération. Consultez son état avant de recommencer pour éviter un doublon.'
        : 'Le service est momentanément indisponible. Réessayez dans quelques instants.',
    );
  }

  return safeCopy(
    isTransferQuoteRequest(path)
      ? 'Vérification indisponible'
      : 'Une erreur est survenue',
    isTransferQuoteRequest(path)
      ? 'Nous ne pouvons pas vérifier le montant pour le moment. Aucun transfert n’a été lancé. Réessayez plus tard.'
      : isFinancialRequest(path)
      ? 'Nous n’avons pas pu confirmer cette opération. Consultez son état avant de recommencer pour éviter un doublon.'
      : 'La demande n’a pas abouti. Vérifiez votre connexion puis réessayez.',
  );
}

export function shouldShowGlobalQueryError(error: unknown): boolean {
  if (
    error !== null
    && typeof error === 'object'
    && 'name' in error
    && (error as { name?: unknown }).name === 'AbortError'
  ) return false;

  const status = getApiErrorStatus(error);
  // Auth, not-found, and validation responses are often expected while the app
  // checks access. A financial conflict is actionable and belongs in the dialog.
  const financialConflict = status === 409 && isFinancialRequest(getRequestPath(error));
  return status === undefined || status === 429 || status >= 500 || financialConflict;
}
