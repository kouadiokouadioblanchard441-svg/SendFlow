import { lazy, Suspense, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { ClerkProvider } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getGetCustomerSessionQueryKey, useGetCustomerSession } from '@workspace/api-client-react';
import { LegalMentionsPage, PrivacyPage, type LegalPageProps } from '@/pages/legal';
import NotFound from '@/pages/not-found';
import AccountPage from '@/pages/account';
import AccountInfoPage from '@/pages/account-info';
import AccountLimitPage from '@/pages/account-limit';
import CustomerServicePage from '@/pages/customer-service';
import DepositPage from '@/pages/deposit';
import HistoryPage from '@/pages/history';
import TransactionDetailPage from '@/pages/transaction-detail';
import InternationalTransferPage from '@/pages/international-transfer';
import InterNetworkTransferPage from '@/pages/inter-transfer';
import NotificationsPage, { NotificationDetailPage } from '@/pages/notifications';
import PinPage, { ChangePinPage } from '@/pages/pin';
import PinChangeSuccessPage from '@/pages/pin-success';
import PricingPage from '@/pages/pricing';
import ResetPage from '@/pages/reset';
import SigninPage from '@/pages/sign-in';
import SignupPage from '@/pages/sign-up';
import OnboardingPage from '@/pages/onboarding';
import { useSeo } from '@/lib/seo';
import { clearPinUnlock, getPinUnlockExpiry } from '@/lib/pin-unlock';
import { requiresCustomerPinUnlock, shouldRelockCustomerPinUnlock } from '@/lib/customer-route-guard';
import { ADMIN_ROUTE_PATH } from '@/lib/admin-route';

const AdminAccessPage = lazy(() => import('@/pages/admin-access'));
const AdminSignInPage = lazy(() => import('@/pages/admin-access').then((module) => ({
  default: module.AdminSignInPage,
})));

function getHttpStatus(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { status?: number; response?: { status?: number } };
  return candidate.status ?? candidate.response?.status;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = getHttpStatus(error);
        if (status !== undefined && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

function CustomerPinGuard({ children }: { children: ReactNode }) {
  const [path, setLocation] = useLocation();
  const [, forceRefresh] = useState(0);
  const expiry = getPinUnlockExpiry();
  const sessionQuery = useGetCustomerSession({
    query: {
      queryKey: getGetCustomerSessionQueryKey(),
      enabled: expiry !== null,
      retry: false,
      refetchInterval: expiry !== null ? 30_000 : false,
      refetchOnWindowFocus: true,
      staleTime: 0,
    },
  });

  useEffect(() => {
    const sessionStatus = getHttpStatus(sessionQuery.error);
    if (!shouldRelockCustomerPinUnlock(sessionQuery.data?.pinUnlocked, sessionStatus)) return;

    clearPinUnlock();
    queryClient.clear();
    forceRefresh((value) => value + 1);

    if (sessionStatus === 401) {
      setLocation('/sign-in');
    } else if (sessionQuery.data?.pinConfigured === false) {
      setLocation('/create-pin');
    }
  }, [
    sessionQuery.data?.pinConfigured,
    sessionQuery.data?.pinUnlocked,
    sessionQuery.error,
    setLocation,
  ]);

  useEffect(() => {
    if (expiry === null) return;
    const lockIfExpired = () => {
      if (getPinUnlockExpiry() !== null) return;
      queryClient.clear();
      forceRefresh((value) => value + 1);
    };
    const timer = window.setTimeout(lockIfExpired, Math.max(0, expiry - Date.now()) + 1);
    window.addEventListener('focus', lockIfExpired);
    document.addEventListener('visibilitychange', lockIfExpired);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', lockIfExpired);
      document.removeEventListener('visibilitychange', lockIfExpired);
    };
  }, [expiry]);

  const isProtected = requiresCustomerPinUnlock(path);
  if (isProtected && expiry === null) return <Redirect to="/pin" />;
  return <>{children}</>;
}
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function PublicLegalRoute({
  page: Page,
  path,
  title,
  description,
}: {
  page: (props: LegalPageProps) => ReactElement;
  path: string;
  title: string;
  description: string;
}) {
  useSeo({
    path,
    locale: 'fr',
    title,
    description,
    robots: 'noindex,nofollow',
  });

  return <Page />;
}

function NotFoundRoute() {
  useSeo({
    path: '/404',
    locale: 'fr',
    title: 'Page introuvable · SendFlow',
    description: 'La page demandée est introuvable.',
    robots: 'noindex,nofollow',
  });
  return <NotFound />;
}

function useProtectImages() {
  useEffect(() => {
    const isImageTarget = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest('img'));

    const preventImageAction = (event: Event) => {
      if (isImageTarget(event.target)) event.preventDefault();
    };

    const markImagesAsNonDraggable = (root: ParentNode = document) => {
      root.querySelectorAll('img').forEach((image) => {
        image.draggable = false;
      });
    };

    document.addEventListener('contextmenu', preventImageAction, true);
    document.addEventListener('dragstart', preventImageAction, true);
    document.addEventListener('selectstart', preventImageAction, true);
    markImagesAsNonDraggable();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            if (node instanceof HTMLImageElement) node.draggable = false;
            markImagesAsNonDraggable(node);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('contextmenu', preventImageAction, true);
      document.removeEventListener('dragstart', preventImageAction, true);
      document.removeEventListener('selectstart', preventImageAction, true);
      observer.disconnect();
    };
  }, []);
}

function App() {
  useProtectImages();

  return (
    <WouterRouter base={basePath}>
      <ClerkProvider
        publishableKey={clerkPubKey}
        proxyUrl={clerkProxyUrl}
        signInUrl={`${basePath}${ADMIN_ROUTE_PATH}/sign-in`}
        signUpUrl={`${basePath}${ADMIN_ROUTE_PATH}/sign-in`}
        appearance={{
          theme: shadcn,
          cssLayerName: 'clerk',
          options: {
            logoPlacement: 'inside',
            logoLinkUrl: `${basePath}${ADMIN_ROUTE_PATH}/sign-in`,
            logoImageUrl: `${window.location.origin}${basePath}/sendflow-favicon.png`,
          },
          variables: {
            colorPrimary: '#6d35d8',
            colorForeground: '#17131f',
            colorMutedForeground: '#667386',
            colorBackground: '#ffffff',
            colorInput: '#f8f5ff',
            colorInputForeground: '#17131f',
            colorNeutral: '#e2e8ef',
            colorDanger: '#c53b3b',
            fontFamily: 'DM Sans',
            borderRadius: '0.75rem',
          },
          elements: {
            rootBox: 'w-full flex justify-center',
            cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden',
            card: '!shadow-none !border-0 !bg-transparent',
            footer: '!shadow-none !border-0 !bg-transparent',
            headerTitle: 'text-[#17131f]',
            headerSubtitle: 'text-[#667386]',
            socialButtonsBlockButtonText: 'text-[#17131f]',
            formFieldLabel: 'text-[#17131f]',
            footerActionLink: 'text-[#6d35d8]',
            footerActionText: 'text-[#667386]',
            dividerText: 'text-[#667386]',
            formButtonPrimary: 'bg-[#6d35d8] hover:bg-[#5421b8]',
            formFieldInput: 'bg-[#f8f5ff] text-[#17131f] border-[#e2e8ef]',
          },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <CustomerPinGuard>
            <Switch>
              <Route
                path={`${ADMIN_ROUTE_PATH}/sign-in/*?`}
                component={() => (
                  <Suspense fallback={<div role="status" aria-live="polite" className="flex min-h-[60vh] items-center justify-center text-muted-foreground">Chargement de la connexion administrateur…</div>}>
                    <AdminSignInPage />
                  </Suspense>
                )}
              />
              <Route
                path={`${ADMIN_ROUTE_PATH}/*?`}
                component={() => (
                  <Suspense fallback={<div role="status" aria-live="polite" className="flex min-h-[60vh] items-center justify-center text-muted-foreground">Chargement de l’espace administrateur…</div>}>
                    <AdminAccessPage />
                  </Suspense>
                )}
              />
              <Route path="/" component={OnboardingPage} />
              <Route path="/sign-in/*?" component={SigninPage} />
              <Route path="/sign-up/*?" component={SignupPage} />
              <Route path="/create-pin" component={() => <PinPage mode="create" />} />
              <Route path="/pin" component={() => <PinPage mode="enter" />} />
              <Route path="/change-pin" component={ChangePinPage} />
              <Route path="/change-pin-success" component={PinChangeSuccessPage} />
              <Route path="/pricing" component={PricingPage} />
              <Route path="/forgot-password" component={() => <ResetPage mode="password" />} />
              <Route path="/forgot-pin" component={() => <ResetPage mode="pin" />} />
              <Route path="/account" component={AccountPage} />
              <Route path="/account-info" component={AccountInfoPage} />
              <Route path="/account-limit" component={AccountLimitPage} />
              <Route path="/customer-service" component={CustomerServicePage} />
              <Route path="/deposit" component={DepositPage} />
              <Route path="/international-transfer" component={InternationalTransferPage} />
              <Route path="/inter-transfer" component={InterNetworkTransferPage} />
              <Route path="/history" component={HistoryPage} />
              <Route path="/transaction/:id" component={TransactionDetailPage} />
              <Route path="/notifications/:id" component={NotificationDetailPage} />
              <Route path="/notifications" component={NotificationsPage} />
              <Route
                path="/confidentialite"
                component={() => (
                  <PublicLegalRoute
                    page={PrivacyPage}
                    path="/confidentialite"
                    title="Confidentialité · SendFlow"
                    description="Politique de confidentialité de SendFlow."
                  />
                )}
              />
              <Route
                path="/mentions-legales"
                component={() => (
                  <PublicLegalRoute
                    page={LegalMentionsPage}
                    path="/mentions-legales"
                    title="Mentions légales · SendFlow"
                    description="Mentions légales de SendFlow."
                  />
                )}
              />
              <Route component={NotFoundRoute} />
            </Switch>
            </CustomerPinGuard>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ClerkProvider>
    </WouterRouter>
  );
}

export default App;