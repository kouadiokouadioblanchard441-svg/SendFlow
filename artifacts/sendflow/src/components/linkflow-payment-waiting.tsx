import { Clock3, LoaderCircle, PhoneCall, ShieldCheck, Smartphone } from 'lucide-react';
import LinkFlowSecureFooter from '@/components/linkflow-secure-footer';
import {
  formatLinkFlowCountdown,
  LINKFLOW_PAYMENT_TIMEOUT_SECONDS,
} from '@/lib/linkflow-attempt-storage';

export interface LinkFlowPaymentWaitingProps {
  merchantName: string;
  amountLabel: string;
  ussdCode: string | null;
  state: 'waiting' | 'uncertain';
  onRefresh?: () => void;
  refreshing?: boolean;
  simulation?: boolean;
  countdownSeconds?: number;
}

export default function LinkFlowPaymentWaiting({
  merchantName,
  amountLabel,
  ussdCode,
  state,
  onRefresh,
  refreshing = false,
  simulation = false,
  countdownSeconds,
}: LinkFlowPaymentWaitingProps) {
  const uncertain = state === 'uncertain';
  const countdownProgress = countdownSeconds === undefined
    ? 0
    : Math.min(100, Math.max(0, (countdownSeconds / LINKFLOW_PAYMENT_TIMEOUT_SECONDS) * 100));
  const countdownLabel = countdownSeconds === undefined
    ? ''
    : formatLinkFlowCountdown(countdownSeconds);

  return (
    <main className="sendflow-linkflow-waiting-shell">
      <section className="sendflow-linkflow-flow-card sendflow-linkflow-waiting-card" aria-labelledby="linkflow-waiting-title">
        <div className="sendflow-linkflow-flow-merchant">
          <span className="sendflow-linkflow-flow-merchant-mark" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <strong>{merchantName}</strong>
        </div>

        {simulation && <span className="sendflow-linkflow-simulation-badge">Simulation</span>}

        <div className="sendflow-linkflow-flow-icon" aria-hidden="true">
          <Smartphone size={30} strokeWidth={1.8} />
        </div>
        <p className={`sendflow-linkflow-flow-status${uncertain ? ' is-uncertain' : ''}`} role="status" aria-live="polite">
          <LoaderCircle className="sendflow-linkflow-flow-spinner" size={15} />
          {simulation ? 'Aperçu de l’attente' : uncertain ? 'Vérification en cours…' : 'En attente de confirmation…'}
        </p>
        <h1 id="linkflow-waiting-title">
          {simulation ? 'Aperçu du paiement' : uncertain ? 'Nous vérifions votre paiement' : 'Confirmez sur votre téléphone'}
        </h1>
        <p className="sendflow-linkflow-flow-copy">
          {simulation
            ? 'Cette simulation n’envoie ni paiement ni code USSD à l’opérateur.'
            : uncertain
            ? 'La réponse du réseau prend plus de temps. Ne relancez pas le paiement et gardez cette page ouverte.'
            : 'Autorisez le paiement depuis votre téléphone, puis suivez les instructions de votre opérateur.'}
        </p>

        <p className="sendflow-linkflow-flow-amount">
          Montant demandé <strong>{amountLabel}</strong>
        </p>

        {simulation ? (
          <div className="sendflow-linkflow-simulation-note" role="status">
            Écran d’aperçu uniquement. Aucun paiement n’est en cours.
          </div>
        ) : ussdCode ? (
          <a
            className="sendflow-linkflow-ussd-code"
            href={`tel:${encodeURIComponent(ussdCode)}`}
            aria-label={`Composer le code USSD ${ussdCode}`}
          >
            <span className="sendflow-linkflow-ussd-call"><PhoneCall size={20} /></span>
            <strong>{ussdCode}</strong>
            <span className="sendflow-linkflow-ussd-arrow" aria-hidden="true">→</span>
          </a>
        ) : (
          <div className="sendflow-linkflow-ussd-unconfigured" role="status">
            Aucune instruction USSD n’est configurée pour ce réseau. Vérifiez la notification de paiement de votre opérateur.
          </div>
        )}
        {!simulation && ussdCode && <p className="sendflow-linkflow-ussd-hint">Touchez le code pour l’ouvrir dans le composeur de votre téléphone.</p>}

        {!simulation && (
          <ol className="sendflow-linkflow-steps">
            <li><span>1</span><p>{ussdCode ? `Composez ${ussdCode}.` : 'Ouvrez la notification de paiement de votre opérateur.'}</p></li>
            <li><span>2</span><p>Suivez les instructions affichées par votre opérateur.</p></li>
            <li><span>3</span><p>Vérifiez le montant, puis confirmez sur votre téléphone.</p></li>
            <li><span>4</span><p>Gardez cette page ouverte pendant la vérification.</p></li>
          </ol>
        )}

        {!simulation && countdownSeconds !== undefined && (
          <div
            className="sendflow-linkflow-expiry-countdown"
            role="timer"
            aria-label={`Expiration du paiement dans ${countdownLabel}`}
          >
            <div className="sendflow-linkflow-expiry-ring" aria-hidden="true">
              <svg viewBox="0 0 72 72">
                <circle className="sendflow-linkflow-expiry-ring-track" cx="36" cy="36" r="30" />
                <circle
                  className="sendflow-linkflow-expiry-ring-progress"
                  cx="36"
                  cy="36"
                  r="30"
                  pathLength="100"
                  strokeDasharray="100"
                  strokeDashoffset={100 - countdownProgress}
                />
              </svg>
              <span><Clock3 size={22} strokeWidth={1.8} /></span>
            </div>
            <p>Le délai de confirmation expire dans <strong>{countdownLabel}</strong></p>
          </div>
        )}

        {onRefresh && (
          <button
            className="sendflow-linkflow-flow-refresh"
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Vérification…' : 'Vérifier à nouveau'}
          </button>
        )}
        <LinkFlowSecureFooter />
      </section>
    </main>
  );
}
