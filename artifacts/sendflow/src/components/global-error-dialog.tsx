import { useSyncExternalStore } from 'react';
import { CircleAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
    <AlertDialog
      open={Boolean(error)}
      onOpenChange={(open) => {
        if (!open) dismissGlobalApiError();
      }}
    >
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-[380px] gap-5 rounded-[26px] border-0 bg-white px-6 py-7 shadow-2xl sm:rounded-[26px]">
        <AlertDialogHeader className="items-center space-y-4 text-center">
          <div
            className="flex size-[68px] items-center justify-center rounded-full bg-red-50 text-red-500"
            aria-hidden="true"
          >
            <CircleAlert className="size-8" strokeWidth={2.2} />
          </div>
          <AlertDialogTitle className="text-xl font-bold text-foreground">
            {error?.title ?? 'Une erreur est survenue'}
          </AlertDialogTitle>
          <AlertDialogDescription className="max-w-[300px] text-[15px] leading-6">
            {error?.message ?? 'La demande n’a pas abouti. Vérifiez votre connexion puis réessayez.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-1">
          <AlertDialogAction
            className="h-12 w-full rounded-full text-base font-semibold"
            onClick={dismissGlobalApiError}
          >
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
