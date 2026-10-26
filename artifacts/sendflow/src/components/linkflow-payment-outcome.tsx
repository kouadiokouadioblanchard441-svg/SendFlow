import { ArrowRight, Check, CircleAlert, X } from 'lucide-react';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';

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
  const succeeded = outcome === 'succeeded';

  return (
    <main className={`sendflow-public-pay-shell sendflow-linkflow-flow-shell${succeeded ? ' is-success' : ' is-failure'}`}>
      <section className="sendflow-linkflow-flow-card sendflow-linkflow-outcome-card" aria-labelledby="linkflow-outcome-title">
        <header className="sendflow-linkflow-flow-brand">
          <img src={sendflowWordmark} alt="SendFlow" />
        </header>

        <div className="sendflow-linkflow-outcome-banner">
          <div className="sendflow-linkflow-outcome-mark" aria-hidden="true">
            {succeeded ? <Check size={48} strokeWidth={3} /> : <X size={44} strokeWidth={2.8} />}
          </div>
          <p className="sendflow-linkflow-outcome-kicker">
            {simulation ? 'SIMULATION' : succeeded ? 'PAIEMENT CONFIRMÉ' : 'RÉSULTAT DU PAIEMENT'}
          </p>
          <h1 id="linkflow-outcome-title">
            {simulation && succeeded ? 'Simulation réussie' : succeeded ? 'Paiement réussi !' : 'Paiement non confirmé'}
          </h1>
          <p className="sendflow-linkflow-outcome-merchant">{merchantName}</p>
        </div>

        <div className="sendflow-linkflow-outcome-content">
          <p>
            {succeeded
              ? simulation
                ? <>Le parcours de paiement pour <strong>{amountLabel}</strong> s’est terminé en simulation.</>
                : <>Votre paiement de <strong>{amountLabel}</strong> a été confirmé.</>
              : <>Le paiement de <strong>{amountLabel}</strong> n’a pas été confirmé par l’opérateur.</>}
          </p>
          {simulation ? (
            <div className="sendflow-linkflow-outcome-note" role="status">
              <CircleAlert size={18} />
              <span>Écran de démonstration uniquement.</span>
            </div>
          ) : !succeeded ? (
            <div className="sendflow-linkflow-outcome-note" role="status">
              <CircleAlert size={18} />
              <span>Aucun crédit n’a été ajouté au portefeuille du marchand. Vous pouvez réessayer.</span>
            </div>
          ) : null}
          <button className="sendflow-linkflow-outcome-button" type="button" onClick={onFinish}>
            {succeeded ? 'Terminer' : 'Réessayer'}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>
    </main>
  );
}
