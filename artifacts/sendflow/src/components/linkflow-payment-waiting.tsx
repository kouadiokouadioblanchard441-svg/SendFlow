import { LoaderCircle, PhoneCall, ShieldCheck, Smartphone } from 'lucide-react';
import LinkFlowSecureFooter from '@/components/linkflow-secure-footer';

export interface LinkFlowPaymentWaitingProps {
  merchantName: string;
  amountLabel: string;
  ussdCode: string | null;
  state: 'waiting' | 'uncertain';
  onRefresh?: () => void;
  refreshing?: boolean;
  simulation?: boolean;
}

export default function LinkFlowPaymentWaiting({
  merchantName,
  amountLabel,
  ussdCode,
  state,
  onRefresh,
  refreshing = false,
  simulation = false,
}: LinkFlowPaymentWaitingProps) {
  const uncertain = state === 'uncertain';

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
