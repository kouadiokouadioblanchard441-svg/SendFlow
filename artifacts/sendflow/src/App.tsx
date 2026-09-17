import { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Route, Router as WouterRouter, Switch } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LegalMentionsPage, PrivacyPage, TermsPage, type LegalPageProps } from '@/pages/legal';
import NotFound from '@/pages/not-found';
import AccountPage from '@/pages/account';
import PinPage from '@/pages/pin';
import SigninPage from '@/pages/sign-in';
import SignupPage from '@/pages/sign-up';
import { useSeo } from '@/lib/seo';

const queryClient = new QueryClient();
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

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Switch>
            <Route path="/" component={() => <Redirect to="/sign-in" />} />
            <Route path="/sign-in/*?" component={SigninPage} />
            <Route path="/sign-up/*?" component={SignupPage} />
            <Route path="/create-pin" component={() => <PinPage mode="create" />} />
            <Route path="/pin" component={() => <PinPage mode="enter" />} />
            <Route path="/account" component={AccountPage} />
            <Route
              path="/conditions-utilisation"
              component={() => (
                <PublicLegalRoute
                  page={TermsPage}
                  path="/conditions-utilisation"
                  title="Conditions d’utilisation · SendFlow"
                  description="Conditions d’utilisation de SendFlow."
                />
              )}
            />
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
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;