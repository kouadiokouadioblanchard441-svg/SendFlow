import { ArrowRight, Check, CircleAlert, ShieldCheck, X } from "lucide-react";
import "./_group.css";

function LinkFlowSecureFooter() {
  return (
    <footer className="sendflow-linkflow-secure-footer" aria-label="Paiement sécurisé par SendFlow">
      <span>Paiement sécurisé par</span>
      <a
        className="sendflow-linkflow-secure-brand-link"
        href="https://sendflow.africa"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Visiter le site officiel SendFlow"
      >
        <img
          className="sendflow-linkflow-secure-wordmark"
          src="/__mockup/images/linkflow-sendflow-wordmark.png"
          alt=""
          aria-hidden="true"
        />
        <img
          className="sendflow-linkflow-secure-mark"
          src="/__mockup/images/linkflow-secure-mark.png"
          alt=""
          aria-hidden="true"
        />
      </a>
    </footer>
  );
}

interface LinkFlowPaymentOutcomeProps {
  outcome: "succeeded" | "failed";
  merchantName: string;
  amountLabel: string;
  onFinish: () => void;
  simulation?: boolean;
}

function LinkFlowPaymentOutcome({
  outcome,
  merchantName,
  amountLabel,
  onFinish,
  simulation = false,
}: LinkFlowPaymentOutcomeProps) {
  const succeeded = outcome === "succeeded";
  const shellClassName = succeeded
    ? "sendflow-linkflow-success-shell"
    : "sendflow-linkflow-failure-shell";
  const cardClassName = succeeded
    ? "sendflow-linkflow-success-card"
    : "sendflow-linkflow-failure-card";

  return (
    <main className={shellClassName}>
      <section className={cardClassName} aria-labelledby="linkflow-outcome-title">
        <header className={succeeded ? "sendflow-linkflow-success-brand" : "sendflow-linkflow-failure-merchant"}>
          {succeeded
            ? <img src="/__mockup/images/linkflow-sendflow-wordmark.png" alt="SendFlow" />
            : <strong>{merchantName}</strong>}
        </header>

        <div className={succeeded ? "sendflow-linkflow-success-banner" : "sendflow-linkflow-failure-banner"}>
          <div className={succeeded ? "sendflow-linkflow-success-mark" : "sendflow-linkflow-failure-mark"} aria-hidden="true">
            {succeeded ? <Check size={48} strokeWidth={3} /> : <X size={44} strokeWidth={2.8} />}
          </div>
          {succeeded && <p className="sendflow-linkflow-success-kicker">{simulation ? "SIMULATION" : "PAIEMENT CONFIRMÉ"}</p>}
          <h1 id="linkflow-outcome-title">
            {simulation && succeeded ? "Simulation réussie" : succeeded ? "Paiement réussi !" : "Paiement non confirmé"}
          </h1>
          {succeeded && <p className="sendflow-linkflow-success-merchant">{merchantName}</p>}
        </div>

        <div className={succeeded ? "sendflow-linkflow-success-content" : "sendflow-linkflow-outcome-content"}>
          <p className={succeeded ? "sendflow-linkflow-success-copy" : undefined}>
            {succeeded
              ? simulation
                ? <>Le parcours de paiement pour <strong>{amountLabel}</strong> s’est terminé en simulation.</>
                : <>Votre paiement de <strong>{amountLabel}</strong> a été confirmé.</>
              : <>Le paiement de <strong>{amountLabel}</strong> n’a pas été confirmé par l’opérateur.</>}
          </p>
          {succeeded ? (
            <div className="sendflow-linkflow-success-verified" role="status">
              <ShieldCheck size={19} strokeWidth={2.2} aria-hidden="true" />
              <span>{simulation ? "Aucun paiement réel n’a été effectué" : "Confirmation vérifiée par SendFlow"}</span>
            </div>
          ) : (
            <div className="sendflow-linkflow-outcome-note" role="status">
              <CircleAlert size={18} />
              <span>
                {simulation
                  ? "Écran de démonstration uniquement."
                  : "Aucun crédit n’a été ajouté au portefeuille du marchand. Vous pouvez réessayer."}
              </span>
            </div>
          )}
          <button
            className={succeeded ? "sendflow-linkflow-success-finish" : "sendflow-linkflow-outcome-button"}
            type="button"
            onClick={onFinish}
          >
            {succeeded ? "Terminer" : <>Réessayer <ArrowRight size={18} aria-hidden="true" /></>}
          </button>
        </div>
        <LinkFlowSecureFooter />
      </section>
    </main>
  );
}

export function Current() {
  return (
    <LinkFlowPaymentOutcome
      outcome="failed"
      merchantName="Flow Digital SARL U"
      amountLabel="2 000 XOF"
      onFinish={() => undefined}
    />
  );
}
