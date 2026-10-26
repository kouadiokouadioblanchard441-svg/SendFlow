import { useEffect, useState } from "react";
import {
  Clock3,
  LoaderCircle,
  PhoneCall,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import "./_group.css";

const countdownStartSeconds = 4 * 60 + 22;

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

function PaymentWaiting({
  merchantName,
  amountLabel,
  ussdCode,
  countdownSeconds,
}: {
  merchantName: string;
  amountLabel: string;
  ussdCode: string;
  countdownSeconds: number;
}) {
  const countdownProgress = Math.min(100, Math.max(0, (countdownSeconds / 600) * 100));
  const countdownLabel = `${String(Math.floor(countdownSeconds / 60)).padStart(2, "0")}:${String(countdownSeconds % 60).padStart(2, "0")}`;

  return (
    <main className="sendflow-linkflow-waiting-shell">
      <section className="sendflow-linkflow-flow-card sendflow-linkflow-waiting-card" aria-labelledby="linkflow-waiting-title">
        <div className="sendflow-linkflow-flow-merchant">
          <span className="sendflow-linkflow-flow-merchant-mark" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <strong>{merchantName}</strong>
        </div>

        <div className="sendflow-linkflow-flow-icon" aria-hidden="true">
          <Smartphone size={30} strokeWidth={1.8} />
        </div>
        <p className="sendflow-linkflow-flow-status" role="status" aria-live="polite">
          <LoaderCircle className="sendflow-linkflow-flow-spinner" size={15} />
          En attente de confirmation…
        </p>
        <h1 id="linkflow-waiting-title">Confirmez sur votre téléphone</h1>
        <p className="sendflow-linkflow-flow-copy">
          Autorisez le paiement depuis votre téléphone, puis suivez les instructions de votre opérateur.
        </p>

        <p className="sendflow-linkflow-flow-amount">
          Montant demandé <strong>{amountLabel}</strong>
        </p>

        <a
          className="sendflow-linkflow-ussd-code"
          href={`tel:${encodeURIComponent(ussdCode)}`}
          aria-label={`Composer le code USSD ${ussdCode}`}
        >
          <span className="sendflow-linkflow-ussd-call"><PhoneCall size={20} /></span>
          <strong>{ussdCode}</strong>
          <span className="sendflow-linkflow-ussd-arrow" aria-hidden="true">→</span>
        </a>
        <p className="sendflow-linkflow-ussd-hint">Touchez le code pour l’ouvrir dans le composeur de votre téléphone.</p>

        <ol className="sendflow-linkflow-steps">
          <li><span>1</span><p>Composez {ussdCode}.</p></li>
          <li><span>2</span><p>Suivez les instructions affichées par votre opérateur.</p></li>
          <li><span>3</span><p>Vérifiez le montant, puis confirmez sur votre téléphone.</p></li>
          <li><span>4</span><p>Gardez cette page ouverte pendant la vérification.</p></li>
        </ol>

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

        <button className="sendflow-linkflow-flow-refresh" type="button">
          Vérifier à nouveau
        </button>
        <LinkFlowSecureFooter />
      </section>
    </main>
  );
}

export function Current() {
  const [countdownSeconds, setCountdownSeconds] = useState(countdownStartSeconds);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCountdownSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <PaymentWaiting
      merchantName="Flow Digital SARL U"
      amountLabel="2 000 XOF"
      ussdCode="*133#"
      countdownSeconds={countdownSeconds}
    />
  );
}
