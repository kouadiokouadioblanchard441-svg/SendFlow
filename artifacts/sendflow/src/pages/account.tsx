import { useEffect } from 'react';
import { Redirect, useLocation } from 'wouter';
import { useSeo } from '@/lib/seo';

export default function AccountPage() {
  const [, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';

  useSeo({
    path: '/account',
    locale: 'fr',
    title: 'Mon compte · SendFlow',
    description: 'Votre espace SendFlow.',
    robots: 'noindex,nofollow',
  });

  useEffect(() => {
    if (!isUnlocked) {
      setLocation('/sign-in');
    }
  }, [isUnlocked, setLocation]);

  if (!isUnlocked) return <Redirect to="/sign-in" />;

  return (
    <main className="sendflow-account-shell">
      <section className="sendflow-account-card" aria-labelledby="account-title">
        <p className="sendflow-account-eyebrow">SendFlow</p>
        <h1 id="account-title">Votre compte est déverrouillé</h1>
        <p>Vous pourrez bientôt effectuer vos transferts depuis cet espace sécurisé.</p>
        <button
          type="button"
          className="sendflow-account-logout"
          onClick={() => {
            window.sessionStorage.removeItem('sendflow.pin.unlocked');
            setLocation('/sign-in');
          }}
        >
          Se déconnecter
        </button>
      </section>
    </main>
  );
}