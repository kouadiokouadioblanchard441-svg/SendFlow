import { useSyncExternalStore } from 'react';
import { ErrorDialog } from '@/components/error-dialog';
import {
  dismissGlobalApiError,
  getGlobalApiError,
  subscribeToGlobalApiErrors,
} from '@/lib/global-api-errors';

export function GlobalErrorDialog() {
  const error = useSyncExternalStore(
    subscribeToGlobalApiErrors,
    getGlobalApiError,
    getGlobalApiError,
  );

  return (
    <ErrorDialog
      open={Boolean(error)}
      title={error?.title ?? 'Une erreur est survenue'}
      message={error?.message ?? 'La demande n’a pas abouti. Vérifiez votre connexion puis réessayez.'}
      onClose={dismissGlobalApiError}
    />
  );
}
