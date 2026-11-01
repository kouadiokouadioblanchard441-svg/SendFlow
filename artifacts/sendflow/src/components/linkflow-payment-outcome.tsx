import { Check, ShieldCheck } from 'lucide-react';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import LinkFlowSecureFooter from '@/components/linkflow-secure-footer';
import { ErrorDialog } from '@/components/error-dialog';

export interface LinkFlowPaymentOutcomeProps {
  outcome: 'succeeded' | 'failed';
  merchantName: string;
  amountLabel: string;
  onFinish: () => void;
  simulation?: boolean;
}

export default function LinkFlowPaymentOutcome({
  outcome,
  merchantName,
  amountLabel,
  onFinish,
  simulation = false,
}: LinkFlowPaymentOutcomeProps) {
  if (outcome === 'failed') {
    return (
      <>
        <main className="sendflow-linkflow-failure-shell" aria-hidden="true">
          <section className="sendflow-linkflow-failure-card">
            <header className="sendflow-linkflow-failure-merchant">
              <strong>{merchantName}</strong>
            </header>
            <div className="sendflow-linkflow-failure-banner">
              <h1>Récapitulatif du paiement</h1>
              <p>{amountLabel}</p>
            </div>
            <LinkFlowSecureFooter />
          </section>
        </main>
        <ErrorDialog
          open
          title="Paiement non confirmé"
          message={simulation
            ? `La simulation du paiement de ${amountLabel} chez ${merchantName} n’a pas été confirmée. Aucun paiement réel n’a été effectué.`
            : `Le paiement de ${amountLabel} chez ${merchantName} n’a pas été confirmé. Vérifiez son état avant de réessayer.`}
          onClose={onFinish}
        />
      </>
    );
  }

  return (
    <main className="sendflow-linkflow-success-shell">
      <section className="sendflow-linkflow-success-card" aria-labelledby="linkflow-outcome-title">
        <header className="sendflow-linkflow-success-brand">
          <img src={sendflowWordmark} alt="SendFlow" />
        </header>

        <div className="sendflow-linkflow-success-banner">
          <div className="sendflow-linkflow-success-mark" aria-hidden="true">
            <Check size={48} strokeWidth={3} />
          </div>
          <p className="sendflow-linkflow-success-kicker">{simulation ? 'SIMULATION' : 'PAIEMENT CONFIRMÉ'}</p>
          <h1 id="linkflow-outcome-title">
            {simulation ? 'Simulation réussie' : 'Paiement réussi !'}
          </h1>
          <p className="sendflow-linkflow-success-merchant">{merchantName}</p>
        </div>

        <div className="sendflow-linkflow-success-content">
          <p className="sendflow-linkflow-success-copy">
            {simulation
              ? <>Le parcours de paiement pour <strong>{amountLabel}</strong> s’est terminé en simulation.</>
              : <>Votre paiement de <strong>{amountLabel}</strong> a été confirmé.</>}
          </p>
          <div className="sendflow-linkflow-success-verified" role="status">
            <ShieldCheck size={19} strokeWidth={2.2} aria-hidden="true" />
            <span>{simulation ? 'Aucun paiement réel n’a été effectué' : 'Confirmation vérifiée par SendFlow'}</span>
          </div>
          <button
            className="sendflow-linkflow-success-finish"
            type="button"
            onClick={onFinish}
          >
            Terminer
          </button>
        </div>
        <LinkFlowSecureFooter />
      </section>
    </main>
  );
}
