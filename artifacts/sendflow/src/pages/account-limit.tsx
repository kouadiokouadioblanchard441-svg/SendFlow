import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Redirect, useLocation } from 'wouter';
import type { AccountLimitResult } from '@workspace/api-client-react';
import { fetchWithCsrf, resolveApiUrl } from '@workspace/api-client-react';
import { formatAccountLimitAmount } from '@/lib/account-limit';
import { useSeo } from '@/lib/seo';
import limitVerificationIllustration from '@assets/generated_images/sendflow-account-limit-verification-3d-transparent.png';

export default function AccountLimitPage() {
  const [, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const [accountLimit, setAccountLimit] = useState<AccountLimitResult | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<AccountLimitResult['status']>('unverified');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const isPending = verificationStatus === 'pending';
  const isVerified = verificationStatus === 'verified';
  const isFailed = verificationStatus === 'failed';
  const isReview = verificationStatus === 'review';
  const canStartVerification = verificationStatus === 'unverified' || isFailed;
  const periodLabel = accountLimit
    ? new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(accountLimit.periodStart))
    : null;
  const progress = accountLimit
    ? Math.min(100, Math.max(0, (accountLimit.sentAmount / accountLimit.monthlyLimit) * 100))
    : 0;

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

  useEffect(() => {
    if (!isUnlocked) return;

    let cancelled = false;
    setIsLoading(true);
    fetch(resolveApiUrl('/api/me/account-limit'), { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json().catch(() => null) as (AccountLimitResult & { error?: string }) | null;
        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? 'Votre session sécurisée a expiré. Veuillez vous reconnecter.'
              : 'Le statut de vérification est temporairement indisponible.',
          );
        }
        return body;
      })
      .then((body) => {
        if (cancelled || !body) return;
        setAccountLimit(body);
        setVerificationStatus(body.status);
        setStatusMessage(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatusMessage(error instanceof Error ? error.message : 'Impossible de charger le statut de vérification.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isUnlocked]);

  const startVerification = async () => {
    if (isStarting) return;
    setIsStarting(true);
    setStatusMessage(null);

    try {
      const response = await fetchWithCsrf(resolveApiUrl('/api/me/identity-verification'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => null) as {
        status?: typeof verificationStatus;
        verificationUrl?: string;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? 'Votre session sécurisée a expiré. Veuillez vous reconnecter.'
            : response.status === 429
              ? body?.error ?? 'Vous avez atteint la limite de nouvelles tentatives. Réessayez plus tard.'
              : response.status === 409
                ? body?.error ?? 'Une vérification est déjà en cours. Réessayez dans quelques secondes.'
                : response.status === 503
                  ? 'Le service de vérification est temporairement indisponible. Veuillez réessayer plus tard.'
                  : 'Impossible de démarrer la vérification pour le moment.',
        );
      }
      if (!body?.verificationUrl) {
        throw new Error('Didit n’a pas fourni de lien de vérification.');
      }

      setVerificationStatus(body.status ?? 'pending');
      window.location.assign(body.verificationUrl);
    } catch (error: unknown) {
      setStatusMessage(error instanceof Error ? error.message : 'Impossible de démarrer la vérification.');
    } finally {
      setIsStarting(false);
    }
  };

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
            {accountLimit && (
              <>
                <p className="sendflow-account-limit-period" data-testid="text-account-limit-period">
                  {periodLabel}
                </p>
                <div
                  className="sendflow-account-limit-progress"
                  role="progressbar"
                  aria-label="Montant comptabilisé sur le plafond mensuel"
                  aria-valuemin={0}
                  aria-valuemax={accountLimit.monthlyLimit}
                  aria-valuenow={accountLimit.sentAmount}
                  data-testid="progress-account-monthly-limit"
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
              <p className="sendflow-account-limit-values" data-testid="text-account-limit-values">
                  <span>{formatAccountLimitAmount(accountLimit.sentAmount)} FCFA pris en compte</span>
                  <strong>/ {formatAccountLimitAmount(accountLimit.monthlyLimit)} FCFA total</strong>
              </p>
              <p className="sendflow-account-limit-remaining" data-testid="text-account-limit-remaining">
                <span>Restant ce mois-ci</span>
                <strong>{formatAccountLimitAmount(accountLimit.remainingAmount)} FCFA</strong>
              </p>
              </>
            )}
          </section>

           {isLoading && (
             <p className="sendflow-account-limit-status is-loading" role="status" aria-live="polite" data-testid="status-account-limit-loading">
               Chargement du statut de vérification…
             </p>
           )}

           {isPending && !isLoading && (
            <p className="sendflow-account-limit-status is-pending" role="status" aria-live="polite" data-testid="status-account-limit-pending">
                Vérification en attente
            </p>
          )}

           {isReview && !isLoading && (
             <p className="sendflow-account-limit-status is-review" role="status" aria-live="polite" data-testid="status-account-limit-review">
               Votre dossier est en cours d’examen
             </p>
           )}

           {isVerified && !isLoading && (
            <p className="sendflow-account-limit-status is-verified" role="status" aria-live="polite" data-testid="status-account-limit-verified">
              Vous êtes authentifié
            </p>
          )}

           {isFailed && !isLoading && (
            <p className="sendflow-account-limit-status is-failed" role="alert" aria-live="assertive" data-testid="status-account-limit-failed">
              La vérification a échoué. Vous pouvez réessayer.
            </p>
          )}

           {statusMessage && (
             <p className="sendflow-account-limit-status is-error" role="alert" data-testid="status-account-limit-error">
               {statusMessage}
             </p>
           )}

           {canStartVerification && !isLoading && (
            <>
              <p className="sendflow-account-limit-explanation" data-testid="text-account-limit-explanation">
                Pour augmenter votre plafond veuillez renseigner l'ensemble
                de vos informations de compte et ajouter une pièce valide
              </p>

               <figure className="sendflow-account-limit-illustration" aria-hidden="true">
                 <img src={limitVerificationIllustration} alt="" />
               </figure>
            </>
          )}
        </div>

         {canStartVerification && !isLoading && (
          <button
            type="button"
            className="sendflow-account-limit-primary"
             onClick={startVerification}
             disabled={isStarting}
            data-testid="button-increase-account-limit"
          >
             {isStarting ? 'Préparation de la vérification…' : 'Relever mon plafond'}
          </button>
        )}
      </section>
    </main>
  );
}