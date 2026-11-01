import { useSyncExternalStore } from 'react';
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

function ErrorBadgeIcon() {
  return (
    <div
      className="flex size-[58px] items-center justify-center rounded-full bg-[#fff1f2]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 72 72" className="size-[54px]" fill="none">
        <defs>
          <linearGradient id="sendflow-error-face" x1="22" y1="17" x2="51" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff8389" />
            <stop offset=".48" stopColor="#f04452" />
            <stop offset="1" stopColor="#cf263b" />
          </linearGradient>
          <linearGradient id="sendflow-error-side" x1="36" y1="17" x2="36" y2="62" gradientUnits="userSpaceOnUse">
            <stop stopColor="#d22c40" />
            <stop offset="1" stopColor="#a8172c" />
          </linearGradient>
          <filter id="sendflow-error-shadow" x="5" y="8" width="62" height="63" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#a8172c" floodOpacity=".22" />
          </filter>
        </defs>
        <path
          d="m32.8 15.7-22 38.2c-1.6 2.8.4 6.3 3.6 6.3h43.2c3.2 0 5.2-3.5 3.6-6.3l-22-38.2c-1.6-2.8-5.6-2.8-7.2 0Z"
          fill="url(#sendflow-error-side)"
        />
        <path
          d="m32.8 12.7-22 38.2c-1.6 2.8.4 6.3 3.6 6.3h43.2c3.2 0 5.2-3.5 3.6-6.3l-22-38.2c-1.6-2.8-5.6-2.8-7.2 0Z"
          fill="url(#sendflow-error-face)"
          filter="url(#sendflow-error-shadow)"
        />
        <path
          d="m35.2 17.6-18 31.2c-.6 1 .1 2.3 1.3 2.3h35c1.2 0 1.9-1.3 1.3-2.3l-18-31.2c-.6-1.1-2.2-1.1-2.8 0Z"
          fill="white"
          fillOpacity=".12"
        />
        <rect x="34" y="27" width="4" height="14" rx="2" fill="white" />
        <circle cx="36" cy="46.5" r="2.5" fill="white" />
      </svg>
    </div>
  );
}

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
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-[340px] gap-3 rounded-[22px] border border-[#f1edf4] bg-white px-5 py-5 shadow-xl sm:rounded-[22px]">
        <AlertDialogHeader className="items-center space-y-3 text-center">
          <ErrorBadgeIcon />
          <AlertDialogTitle className="text-lg font-bold leading-tight text-foreground">
            {error?.title ?? 'Une erreur est survenue'}
          </AlertDialogTitle>
          <AlertDialogDescription className="max-w-[290px] text-sm leading-[1.45]">
            {error?.message ?? 'La demande n’a pas abouti. Vérifiez votre connexion puis réessayez.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-0">
          <AlertDialogAction
            className="h-11 w-full rounded-full text-[15px] font-semibold"
            onClick={dismissGlobalApiError}
          >
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
