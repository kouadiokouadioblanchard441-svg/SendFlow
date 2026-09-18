import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Redirect, useLocation } from 'wouter';
import { accountLimitProvider, formatAccountLimitAmount } from '@/lib/account-limit';
import { useSeo } from '@/lib/seo';

export default function AccountLimitPage() {
  const [, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const accountLimit = useMemo(() => accountLimitProvider.getAccountLimit(), []);
  const [verificationStatus, setVerificationStatus] = useState(accountLimit.status);
  const isPending = verificationStatus === 'pending';
  const isVerified = verificationStatus === 'verified';
  const canStartVerification = verificationStatus === 'unverified';
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

          <section
            className="sendflow-account-limit-card"
            aria-labelledby={!isVerified ? 'monthly-limit-title' : undefined}
            aria-label={isVerified ? 'Progression de la limite mensuelle' : undefined}
          >
            {!isVerified && <h3 id="monthly-limit-title">Limite mensuelle</h3>}
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
            {!isVerified && (
              <p className="sendflow-account-limit-values" data-testid="text-account-limit-values">
                <span>{formatAccountLimitAmount(accountLimit.sentAmount)} {accountLimit.currency} envoyé</span>
                <strong>/ {formatAccountLimitAmount(accountLimit.monthlyLimit)} {accountLimit.currency} total</strong>
              </p>
            )}
          </section>

          {isPending && (
            <p className="sendflow-account-limit-status is-pending" role="status" aria-live="polite" data-testid="status-account-limit-pending">
              Vérification en attente
            </p>
          )}

          {isVerified && (
            <p className="sendflow-account-limit-status is-verified" role="status" aria-live="polite" data-testid="status-account-limit-verified">
              Vous êtes authentifié
            </p>
          )}

          {canStartVerification && (
            <>
              <p className="sendflow-account-limit-explanation" data-testid="text-account-limit-explanation">
                Pour augmenter votre plafond veuillez renseigner l'ensemble
                de vos informations de compte et ajouter une pièce valide
              </p>

              <section className="sendflow-account-limit-info" aria-labelledby="account-limit-info-title">
                <span className="sendflow-account-limit-info-icon" aria-hidden="true">
                  <ShieldCheck size={20} strokeWidth={2} />
                </span>
                <div>
                  <h3 id="account-limit-info-title">Pourquoi vérifier mon identité ?</h3>
                  <p>
                    La vérification permet d’accéder à un plafond mensuel supérieur
                    tout en renforçant la sécurité de votre compte.
                  </p>
                </div>
              </section>
            </>
          )}
        </div>

        {canStartVerification && (
          <button
            type="button"
            className="sendflow-account-limit-primary"
            onClick={() => setVerificationStatus('pending')}
            data-testid="button-increase-account-limit"
          >
            Relever mon plafond
          </button>
        )}
      </section>
    </main>
  );
}