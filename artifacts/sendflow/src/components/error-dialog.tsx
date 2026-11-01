import { useId } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ErrorDialogProps = {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

function ErrorBadgeIcon() {
  const iconId = useId().replace(/:/g, '');
  const faceId = `${iconId}-face`;
  const sideId = `${iconId}-side`;
  const shadowId = `${iconId}-shadow`;

  return (
    <div
      className="flex size-[58px] items-center justify-center rounded-full bg-[#fff1f2]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 72 72" className="size-[54px]" fill="none">
        <defs>
          <linearGradient id={faceId} x1="22" y1="17" x2="51" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff8389" />
            <stop offset=".48" stopColor="#f04452" />
            <stop offset="1" stopColor="#cf263b" />
          </linearGradient>
          <linearGradient id={sideId} x1="36" y1="17" x2="36" y2="62" gradientUnits="userSpaceOnUse">
            <stop stopColor="#d22c40" />
            <stop offset="1" stopColor="#a8172c" />
          </linearGradient>
          <filter id={shadowId} x="5" y="8" width="62" height="63" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#a8172c" floodOpacity=".22" />
          </filter>
        </defs>
        <path
          d="m32.8 15.7-22 38.2c-1.6 2.8.4 6.3 3.6 6.3h43.2c3.2 0 5.2-3.5 3.6-6.3l-22-38.2c-1.6-2.8-5.6-2.8-7.2 0Z"
          fill={`url(#${sideId})`}
        />
        <path
          d="m32.8 12.7-22 38.2c-1.6 2.8.4 6.3 3.6 6.3h43.2c3.2 0 5.2-3.5 3.6-6.3l-22-38.2c-1.6-2.8-5.6-2.8-7.2 0Z"
          fill={`url(#${faceId})`}
          filter={`url(#${shadowId})`}
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

export function ErrorDialog({ open, title, message, onClose }: ErrorDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-[340px] gap-3 rounded-[22px] border border-[#f1edf4] bg-white px-5 py-5 shadow-xl sm:rounded-[22px]">
        <AlertDialogHeader className="items-center space-y-3 text-center">
          <ErrorBadgeIcon />
          <AlertDialogTitle className="text-lg font-bold leading-tight text-foreground">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="max-w-[290px] text-sm leading-[1.45]">
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-0">
          <AlertDialogAction className="h-11 w-full rounded-full text-[15px] font-semibold">
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
