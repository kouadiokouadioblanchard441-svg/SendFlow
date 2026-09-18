import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  Clipboard,
  ContactRound,
  History,
} from 'lucide-react';
import { Link, Redirect, useLocation } from 'wouter';
import { useSeo } from '@/lib/seo';
import waveLogo from '@assets/generated_images/sendflow-wave-logo.png';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';

export default function InterNetworkTransferPage() {
  const [, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const [amount, setAmount] = useState('20000');
  const [sourceNumber, setSourceNumber] = useState('0595857098');
  const [otp, setOtp] = useState('');
  const [recipientNumber, setRecipientNumber] = useState('');
  const [supportFees, setSupportFees] = useState(true);
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useSeo({
    path: '/inter-transfer',
    locale: 'fr',
    title: 'Transfert inter réseau · SendFlow',
    description: 'Envoyez de l’argent vers un autre réseau mobile.',
    robots: 'noindex,nofollow',
  });

  useEffect(() => {
    if (!isUnlocked) setLocation('/sign-in');
  }, [isUnlocked, setLocation]);

  if (!isUnlocked) return <Redirect to="/sign-in" />;

  const copyOtpCode = async () => {
    try {
      await navigator.clipboard.writeText('*144*82# option 2');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const canSubmit = amount.trim().length > 0 && otp.trim().length > 0 && recipientNumber.trim().length > 0;

  return (
    <main className="sendflow-transfer-shell">
      <header className="sendflow-transfer-header">
        <div className="sendflow-transfer-header-inner">
          <div className="sendflow-transfer-header-leading">
            <button
              type="button"
              className="sendflow-transfer-header-button"
              onClick={() => setLocation('/account')}
              aria-label="Retour au dashboard"
              data-testid="button-transfer-back-dashboard"
            >
              <ArrowLeft size={22} strokeWidth={2.1} />
            </button>
            <Link href="/account" className="sendflow-transfer-brand" aria-label="Retour au compte">
              <img className="sendflow-transfer-mark" src={sendflowMark} alt="" />
              <img className="sendflow-transfer-wordmark" src={sendflowWordmark} alt="SendFlow" />
            </Link>
          </div>
          <div className="sendflow-transfer-header-actions">
            <button
              type="button"
              className="sendflow-transfer-header-button"
              onClick={() => setLocation('/history')}
              aria-label="Voir l’historique des transactions"
              data-testid="button-transfer-history"
            >
              <History size={22} strokeWidth={2.1} />
            </button>
            <button
              type="button"
              className="sendflow-transfer-header-button has-notification"
              onClick={() => setLocation('/notifications')}
              aria-label="Voir les notifications"
              data-testid="button-transfer-notifications"
            >
              <Bell size={23} strokeWidth={2.1} />
              <span aria-hidden="true">8</span>
            </button>
          </div>
        </div>
      </header>

      <div className="sendflow-transfer-page">
        <form
          className="sendflow-transfer-card"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) setSubmitted(true);
          }}
        >
          <section className="sendflow-transfer-section" aria-labelledby="transfer-from-title">
            <h2 id="transfer-from-title">De</h2>
            <label className="sendflow-transfer-money-field">
              <span className="sr-only">Montant du transfert</span>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d ]/g, ''))}
                aria-label="Montant du transfert"
              />
              <strong>FCFA</strong>
            </label>

            <div className="sendflow-transfer-phone-row">
              <div className="sendflow-transfer-operator-box is-orange" aria-label="Orange Money">
                <strong>Orange</strong>
                <small>Money</small>
              </div>
              <span className="sendflow-transfer-prefix">+225</span>
              <input
                type="tel"
                value={sourceNumber}
                onChange={(event) => setSourceNumber(event.target.value)}
                aria-label="Numéro source"
              />
              <span className="sendflow-transfer-flag" aria-label="Côte d’Ivoire">🇨🇮</span>
            </div>

            <div className="sendflow-transfer-otp-help">
              <span>Obtenir le code otp avec</span>
              <button type="button" onClick={copyOtpCode} className="sendflow-transfer-otp-link">
                #144*82# option 2
              </button>
              <button type="button" className="sendflow-transfer-copy" onClick={copyOtpCode} aria-label="Copier le code OTP">
                {copied ? <Check size={18} /> : <Clipboard size={18} />}
              </button>
            </div>
            <input
              className="sendflow-transfer-otp-input"
              type="text"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              placeholder="Code OTP"
              aria-label="Code OTP"
            />

            <label className="sendflow-transfer-checkbox">
              <input type="checkbox" checked={supportFees} onChange={(event) => setSupportFees(event.target.checked)} />
              <span aria-hidden="true">{supportFees ? <Check size={13} strokeWidth={3} /> : null}</span>
              <strong>Je supporte les frais</strong>
            </label>
          </section>

          <div className="sendflow-transfer-divider" />

          <section className="sendflow-transfer-section sendflow-transfer-destination" aria-labelledby="transfer-to-title">
            <h2 id="transfer-to-title">Vers</h2>
            <div className="sendflow-transfer-phone-row">
              <button type="button" className="sendflow-transfer-operator-box is-wave" aria-label="Réseau destinataire Wave">
                <img src={waveLogo} alt="" />
              </button>
              <span className="sendflow-transfer-prefix">+225</span>
              <input
                type="tel"
                value={recipientNumber}
                onChange={(event) => setRecipientNumber(event.target.value)}
                placeholder="Numéro"
                aria-label="Numéro du bénéficiaire"
              />
              <span className="sendflow-transfer-flag" aria-label="Côte d’Ivoire">🇨🇮</span>
              <ContactRound className="sendflow-transfer-contact" size={27} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div className="sendflow-transfer-fees">
              Frais: <strong>{supportFees ? '907' : '0'} Fcfa</strong>
            </div>

            {submitted && (
              <div className="sendflow-transfer-success" role="status">
                <Check size={18} />
                Transfert prêt à être confirmé.
              </div>
            )}

            <button type="submit" className="sendflow-transfer-submit" disabled={!canSubmit || submitted}>
              {submitted ? 'Transfert préparé' : `Envoyer ${amount || '0'} FCFA`}
            </button>
          </section>
        </form>
      </div>
    </main>
  );
}