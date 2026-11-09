import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Router as WouterRouter } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import PageLoadingScreen from '@/components/page-loading-screen';
import { GlobalErrorDialog } from '@/components/global-error-dialog';
import { ErrorBoundary } from '@/components/error-boundary';
import { queryClient } from '@/lib/query-client';

const AdminAccessPage = lazy(() => import('@/pages/admin-access'));
export default function PrivateAccessApp() {
  return (
    <ErrorBoundary>
      <WouterRouter hook={useHashLocation}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Suspense fallback={<PageLoadingScreen />}>
              <AdminAccessPage />
            </Suspense>
            <Toaster />
            <GlobalErrorDialog />
          </TooltipProvider>
        </QueryClientProvider>
      </WouterRouter>
    </ErrorBoundary>
  );
}
