import { Check, ShieldCheck } from 'lucide-react';
import sendflowWordmark from '@/assets/sendflow-wordmark-original.png';

export interface LinkFlowPaymentConfirmation {
  mode: 'simulation';
  status: 'simulated_success';
  chargeOccurred: false;
  merchantName: string;
  amountMinor: number;
  currency: string;
  currencyDecimals: number;
}

export interface LinkFlowPaymentSuccessProps {
  confirmation: LinkFlowPaymentConfirmation;
  onFinish: () => void;
}

function formatMoney(amountMinor: number, currency: string, decimals: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amountMinor / (10 ** decimals));
}

export default function LinkFlowPaymentSuccess({
  confirmation,
  onFinish,
}: LinkFlowPaymentSuccessProps) {
  const amountLabel = formatMoney(
    confirmation.amountMinor,
    confirmation.currency,
    confirmation.currencyDecimals,
  );

  return (
    <main className="sendflow-linkflow-success-shell">
      <section className="sendflow-linkflow-success-card" aria-labelledby="linkflow-success-title">
        <header className="sendflow-linkflow-success-brand">
          <img src={sendflowWordmark} alt="SendFlow" />
        </header>

        <div className="sendflow-linkflow-success-banner">
          <div className="sendflow-linkflow-success-mark" aria-hidden="true">
            <Check size={54} strokeWidth={3.5} />
          </div>
          <p className="sendflow-linkflow-success-kicker">MODE SIMULATION</p>
          <h1 id="linkflow-success-title">Simulation réussie</h1>
          <p className="sendflow-linkflow-success-merchant">{confirmation.merchantName}</p>
        </div>

        <div className="sendflow-linkflow-success-content">
          <p className="sendflow-linkflow-success-copy">
            Le parcours de paiement pour <strong>{amountLabel}</strong> s’est terminé en simulation.
          </p>
          <div className="sendflow-linkflow-success-verified" role="status">
            <ShieldCheck size={19} strokeWidth={2.2} aria-hidden="true" />
            <span>Aucun paiement réel n’a été effectué</span>
          </div>
          <button
            className="sendflow-linkflow-success-finish"
            type="button"
            onClick={onFinish}
            data-testid="button-linkflow-payment-finish"
          >
            Terminer
          </button>
        </div>
      </section>
    </main>
  );
}
