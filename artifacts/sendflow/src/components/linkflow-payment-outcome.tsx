import { ArrowRight, Check, CircleAlert, ShieldCheck, X } from 'lucide-react';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import LinkFlowSecureFooter from '@/components/linkflow-secure-footer';

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
  const shellClassName = succeeded
    ? 'sendflow-linkflow-success-shell'
    : 'sendflow-public-pay-shell sendflow-linkflow-flow-shell is-failure';
  const cardClassName = succeeded
    ? 'sendflow-linkflow-success-card'
    : 'sendflow-linkflow-flow-card sendflow-linkflow-outcome-card';

  return (
    <main className={shellClassName}>
      <section className={cardClassName} aria-labelledby="linkflow-outcome-title">
        <header className={succeeded ? 'sendflow-linkflow-success-brand' : 'sendflow-linkflow-flow-brand'}>
          <img src={sendflowWordmark} alt="SendFlow" />
        </header>

        <div className={succeeded ? 'sendflow-linkflow-success-banner' : 'sendflow-linkflow-outcome-banner'}>
          <div className={succeeded ? 'sendflow-linkflow-success-mark' : 'sendflow-linkflow-outcome-mark'} aria-hidden="true">
            {succeeded ? <Check size={48} strokeWidth={3} /> : <X size={44} strokeWidth={2.8} />}
          </div>
          <p className={succeeded ? 'sendflow-linkflow-success-kicker' : 'sendflow-linkflow-outcome-kicker'}>
            {simulation ? 'SIMULATION' : succeeded ? 'PAIEMENT CONFIRMÉ' : 'RÉSULTAT DU PAIEMENT'}
          </p>
          <h1 id="linkflow-outcome-title">
            {simulation && succeeded ? 'Simulation réussie' : succeeded ? 'Paiement réussi !' : 'Paiement non confirmé'}
          </h1>
          <p className={succeeded ? 'sendflow-linkflow-success-merchant' : 'sendflow-linkflow-outcome-merchant'}>{merchantName}</p>
        </div>

        <div className={succeeded ? 'sendflow-linkflow-success-content' : 'sendflow-linkflow-outcome-content'}>
          <p className={succeeded ? 'sendflow-linkflow-success-copy' : undefined}>
            {succeeded
              ? simulation
                ? <>Le parcours de paiement pour <strong>{amountLabel}</strong> s’est terminé en simulation.</>
                : <>Votre paiement de <strong>{amountLabel}</strong> a été confirmé.</>
              : <>Le paiement de <strong>{amountLabel}</strong> n’a pas été confirmé par l’opérateur.</>}
          </p>
          {succeeded ? (
            <div className="sendflow-linkflow-success-verified" role="status">
              <ShieldCheck size={19} strokeWidth={2.2} aria-hidden="true" />
              <span>{simulation ? 'Aucun paiement réel n’a été effectué' : 'Confirmation vérifiée par SendFlow'}</span>
            </div>
          ) : (
            <div className="sendflow-linkflow-outcome-note" role="status">
              <CircleAlert size={18} />
              <span>
                {simulation
                  ? 'Écran de démonstration uniquement.'
                  : 'Aucun crédit n’a été ajouté au portefeuille du marchand. Vous pouvez réessayer.'}
              </span>
            </div>
          )}
          <button
            className={succeeded ? 'sendflow-linkflow-success-finish' : 'sendflow-linkflow-outcome-button'}
            type="button"
            onClick={onFinish}
          >
            {succeeded ? 'Terminer' : <>Réessayer <ArrowRight size={18} aria-hidden="true" /></>}
          </button>
        </div>
        <LinkFlowSecureFooter />
      </section>
    </main>
  );
}
