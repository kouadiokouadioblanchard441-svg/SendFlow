import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Redirect, useLocation } from 'wouter';
import { accountLimitProvider, formatAccountLimitAmount } from '@/lib/account-limit';
import { useSeo } from '@/lib/seo';

export default function AccountLimitPage() {
  const [, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const [verificationNoticeVisible, setVerificationNoticeVisible] = useState(false);
  const accountLimit = useMemo(() => accountLimitProvider.getAccountLimit(), []);
  const progress = Math.min(100, Math.max(0, (accountLimit.sentAmount / accountLimit.monthlyLimit) * 100));

  useSeo({
    path: '/account-limit',
    locale: 'fr',
    title: 'Plafond de compte · SendFlow',
    description: 'Consultez votre plafond mensuel SendFlow.',
    robots: 'noindex,nofollow',
  });

  useEffect(() => {
    if (!isUnlocked) {
      setLocation('/sign-in');
    }
  }, [isUnlocked, setLocation]);

  if (!isUnlocked) return <Redirect to="/sign-in" />;

  if (verificationNoticeVisible) {
    return (
      <main className="sendflow-account-limit-shell">
        <section className="sendflow-account-limit-page sendflow-account-limit-feedback-page" aria-labelledby="account-limit-feedback-title">
          <header className="sendflow-account-limit-header">
            <button
              type="button"
              className="sendflow-account-limit-back"
              onClick={() => setVerificationNoticeVisible(false)}
              aria-label="Revenir au plafond de compte"
              data-testid="button-account-limit-back"
            >
              <ArrowLeft size={22} strokeWidth={2} />
            </button>
            <span>Plafond de compte</span>
          </header>
          <section className="sendflow-account-limit-feedback" role="status" aria-live="polite">
            <div className="sendflow-account-limit-feedback-mark" aria-hidden="true">i</div>
            <h1 id="account-limit-feedback-title">Vérification bientôt disponible</h1>
            <p>
              Le parcours pour augmenter votre plafond sera bientôt disponible.
              Nous vous préviendrons dès qu’il pourra être lancé.
            </p>
            <button
              type="button"
              className="sendflow-account-limit-secondary"
              onClick={() => setVerificationNoticeVisible(false)}
              data-testid="button-account-limit-return"
            >
              Retourner à mon plafond
            </button>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="sendflow-account-limit-shell">
      <section className="sendflow-account-limit-page" aria-labelledby="account-limit-title">
        <header className="sendflow-account-limit-header">
          <button
            type="button"
            className="sendflow-account-limit-back"
            onClick={() => setLocation('/account')}
            aria-label="Revenir à mon compte"
            data-testid="button-account-limit-go-back"
          >
            <ArrowLeft size={22} strokeWidth={2} />
          </button>
          <h1 id="account-limit-title">Plafond de compte</h1>
        </header>

        <div className="sendflow-account-limit-content">
          <h2 data-testid="text-account-limit-section-title">Limites</h2>

          <section className="sendflow-account-limit-card" aria-labelledby="monthly-limit-title">
            <h3 id="monthly-limit-title">Limite mensuelle</h3>
            <div
              className="sendflow-account-limit-progress"
              role="progressbar"
              aria-label="Montant envoyé sur le plafond mensuel"
              aria-valuemin={0}
              aria-valuemax={accountLimit.monthlyLimit}
              aria-valuenow={accountLimit.sentAmount}
              data-testid="progress-account-monthly-limit"
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <p className="sendflow-account-limit-values" data-testid="text-account-limit-values">
              <span>{formatAccountLimitAmount(accountLimit.sentAmount)} {accountLimit.currency} envoyé</span>
              <strong>/ {formatAccountLimitAmount(accountLimit.monthlyLimit)} {accountLimit.currency} total</strong>
            </p>
          </section>

          <p className="sendflow-account-limit-explanation" data-testid="text-account-limit-explanation">
            Pour augmenter votre plafond veuillez renseigner l'ensemble
            de vos informations de compte et ajouter une pièce valide
          </p>
        </div>

        <button
          type="button"
          className="sendflow-account-limit-primary"
          onClick={() => setVerificationNoticeVisible(true)}
          data-testid="button-increase-account-limit"
        >
          Augmenter mon plafond
        </button>
      </section>
    </main>
  );
}