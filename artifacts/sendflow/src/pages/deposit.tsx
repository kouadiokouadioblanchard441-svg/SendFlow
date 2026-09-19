import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  Clipboard,
  History,
  X,
} from 'lucide-react';
import { Link, Redirect, useLocation } from 'wouter';
import { readAccountCountry } from '@/lib/account-country';
import { useSeo } from '@/lib/seo';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import waveLogo from '@assets/generated_images/sendflow-wave-logo.png';
import depositSuccessIllustration from '@assets/generated_images/sendflow-deposit-success-3d-alpha.png';
import depositFailureIllustration from '@assets/generated_images/sendflow-deposit-failure-3d-alpha.png';
import depositPendingIllustration from '@assets/generated_images/sendflow-deposit-pending-3d-alpha.png';

type OperatorBrand = 'orange' | 'wave' | 'mtn' | 'moov';

type DepositOperator = {
  id: string;
  name: string;
  shortName: string;
  brand: OperatorBrand;
  requiresOtp: boolean;
  otpCommand?: string;
};

const ivoryCoastDepositOperators: DepositOperator[] = [
  { id: 'orange-ci', name: 'Orange Money', shortName: 'Orange', brand: 'orange', requiresOtp: true, otpCommand: '#144*82# option 2' },
  { id: 'wave-ci', name: 'Wave', shortName: 'Wave', brand: 'wave', requiresOtp: false },
  { id: 'mtn-ci', name: 'MTN Mobile Money', shortName: 'MTN', brand: 'mtn', requiresOtp: false },
  { id: 'moov-ci', name: 'Moov Money', shortName: 'Moov', brand: 'moov', requiresOtp: false },
];

const DEPOSIT_FEE_RATE = 0.03;
type DepositRequestState = 'idle' | 'pending' | 'success' | 'failure';

function OperatorMark({ operator }: { operator: DepositOperator }) {
  if (operator.brand === 'wave') {
    return <img src={waveLogo} alt="" />;
  }

  if (operator.brand === 'orange') {
    return (
      <>
        <strong>Orange</strong>
        <small>Money</small>
      </>
    );
  }

  return <strong>{operator.shortName}</strong>;
}

export default function DepositPage() {
  const [, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const accountCountry = readAccountCountry();
  const depositOperators = accountCountry.dialCode === '+225' ? ivoryCoastDepositOperators : [];
  const [amount, setAmount] = useState('');
  const [sourceNumber, setSourceNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [payFees, setPayFees] = useState(true);
  const [operator, setOperator] = useState<DepositOperator | null>(depositOperators[0] ?? null);
  const [operatorPickerOpen, setOperatorPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [requestState, setRequestState] = useState<DepositRequestState>('idle');

  useSeo({
    path: '/deposit',
    locale: 'fr',
    title: 'Dépôt · SendFlow',
    description: 'Rechargez votre wallet interne SendFlow.',
    robots: 'noindex,nofollow',
  });

  useEffect(() => {
    if (!isUnlocked) setLocation('/sign-in');
  }, [isUnlocked, setLocation]);

  useEffect(() => {
    if (requestState !== 'pending') return;

    const timeout = window.setTimeout(() => setRequestState('success'), 2200);
    return () => window.clearTimeout(timeout);
  }, [requestState]);

  if (!isUnlocked) return <Redirect to="/sign-in" />;

  const copyOtpCode = async () => {
    if (!operator?.otpCommand) return;

    try {
      await navigator.clipboard.writeText(operator.otpCommand);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const enteredAmount = Number(amount.replace(/\s/g, '')) || 0;
  const feeAmount = enteredAmount > 0 ? Math.ceil(enteredAmount * DEPOSIT_FEE_RATE) : 0;
  const walletAmount = payFees ? enteredAmount : Math.max(enteredAmount - feeAmount, 0);
  const totalDebited = payFees ? enteredAmount + feeAmount : enteredAmount;
  const canSubmit = Boolean(
    operator &&
    walletAmount > 0 &&
    sourceNumber.trim().length > 0 &&
    (!operator.requiresOtp || otp.trim().length > 0),
  );

  const selectOperator = (nextOperator: DepositOperator) => {
    setOperator(nextOperator);
    if (!nextOperator.requiresOtp) setOtp('');
    setRequestState('idle');
    setOperatorPickerOpen(false);
  };

  const cancelDepositRequest = () => {
    setRequestState('idle');
  };

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
              data-testid="button-deposit-back-dashboard"
            >
              <ArrowLeft size={22} strokeWidth={2.1} />
            </button>
            <Link href="/account" className="sendflow-transfer-brand" aria-label="Retour au compte">
              <img className="sendflow-transfer-mark" src={sendflowMark} alt="" />
              <img className="sendflow-transfer-wordmark" src={sendflowWordmark} alt="SendFlow" />
            </Link>
          </div>
          <div className="sendflow-transfer-header-actions">
            <button type="button" className="sendflow-transfer-header-button" onClick={() => setLocation('/history')} aria-label="Voir l’historique des transactions" data-testid="button-deposit-history">
              <History size={22} strokeWidth={2.1} />
            </button>
            <button type="button" className="sendflow-transfer-header-button has-notification" onClick={() => setLocation('/notifications')} aria-label="Voir les notifications" data-testid="button-deposit-notifications">
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
            if (canSubmit) {
              setRequestState('pending');
            }
          }}
        >
          <section className="sendflow-transfer-section" aria-labelledby="deposit-from-title">
            <h2 id="deposit-from-title">Dépôt</h2>
            <label className="sendflow-transfer-money-field">
              <span className="sr-only">Montant du dépôt</span>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d ]/g, ''))}
                placeholder="Montant du dépôt"
                aria-label="Montant du dépôt"
              />
              <strong>FCFA</strong>
            </label>

            {operator ? (
              <>
                <div className="sendflow-transfer-phone-row">
                  <button
                    type="button"
                    className={`sendflow-transfer-operator-box is-${operator.brand}`}
                    onClick={() => setOperatorPickerOpen(true)}
                    aria-label={`Sélectionner le moyen de dépôt, actuellement ${operator.name}`}
                    data-testid="button-select-deposit-operator"
                  >
                    <OperatorMark operator={operator} />
                  </button>
                  <span className="sendflow-transfer-prefix">{accountCountry.dialCode}</span>
                  <input
                    type="tel"
                    value={sourceNumber}
                    onChange={(event) => setSourceNumber(event.target.value)}
                    aria-label="Numéro source du dépôt"
                    placeholder="Numéro source"
                  />
                  <span className="sendflow-transfer-flag" aria-label={accountCountry.name}>{accountCountry.flag}</span>
                </div>

                {operator.requiresOtp && (
                  <>
                    <div className="sendflow-transfer-otp-help">
                      <span>Obtenir le code otp avec</span>
                      <button type="button" onClick={copyOtpCode} className="sendflow-transfer-otp-link">
                        {operator.otpCommand}
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
                  </>
                )}
              </>
            ) : (
              <div className="sendflow-deposit-unavailable" role="status">
                Aucun moyen de dépôt n’est encore disponible pour votre pays d’inscription.
              </div>
            )}

            <label className="sendflow-transfer-checkbox">
              <input
                type="checkbox"
                checked={payFees}
                onChange={(event) => {
                  setPayFees(event.target.checked);
                  setRequestState('idle');
                }}
              />
              <span aria-hidden="true">{payFees ? <Check size={13} strokeWidth={3} /> : null}</span>
              <strong>Je paie les frais</strong>
            </label>
            <div className="sendflow-deposit-summary" aria-live="polite">
              <div>
                <span>Frais (3%)</span>
                <strong className="sendflow-deposit-fee-amount">
                  {feeAmount > 0 ? `- ${feeAmount.toLocaleString('fr-FR')} Fcfa` : '—'}
                </strong>
              </div>
              <div>
                <span>Le wallet reçoit</span>
                <strong>{walletAmount.toLocaleString('fr-FR')} Fcfa</strong>
              </div>
              {payFees && (
                <div>
                  <span>Total débité</span>
                  <strong>{totalDebited.toLocaleString('fr-FR')} Fcfa</strong>
                </div>
              )}
            </div>

            <button type="submit" className="sendflow-transfer-submit" disabled={!canSubmit || requestState !== 'idle'}>
              Déposer {walletAmount.toLocaleString('fr-FR')} FCFA
            </button>
          </section>
        </form>

        {requestState !== 'idle' && operator && (
          <div className="sendflow-deposit-request-layer">
            <section
              className={`sendflow-deposit-request-card is-${requestState}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="deposit-request-title"
              aria-live="polite"
            >
              {requestState === 'pending' && (
                <div className="sendflow-deposit-request-state">
                  <div className="sendflow-deposit-pending-art">
                    <img src={depositPendingIllustration} alt="" />
                  </div>
                  <div className="sendflow-deposit-pending-dots" aria-label="Validation en cours">
                    <span />
                    <span />
                    <span />
                  </div>
                  <header className="sendflow-deposit-request-header">
                    <span>Requête de transaction</span>
                    <h2 id="deposit-request-title">Dépôt</h2>
                  </header>
                  <div className="sendflow-deposit-request-amount">
                    <span>Montant à créditer</span>
                    <strong>{walletAmount.toLocaleString('fr-FR')} <small>FCFA</small></strong>
                  </div>
                  <div className="sendflow-deposit-request-meta">
                    <span>{operator.name}</span>
                    <strong>{accountCountry.dialCode} {sourceNumber}</strong>
                  </div>
                  <p className="sendflow-deposit-request-copy">
                    Composez le code USSD de votre opérateur sur votre téléphone pour confirmer ce dépôt.
                  </p>
                  <button type="button" className="sendflow-deposit-request-cancel" onClick={cancelDepositRequest}>
                    Annuler
                  </button>
                </div>
              )}

              {requestState === 'success' && (
                <div className="sendflow-deposit-request-state is-success">
                  <div className="sendflow-deposit-success-art">
                    <img src={depositSuccessIllustration} alt="" />
                  </div>
                  <h2 id="deposit-request-title">Votre dépôt a été crédité avec succès</h2>
                  <p>{walletAmount.toLocaleString('fr-FR')} FCFA sont maintenant disponibles dans votre wallet.</p>
                  <button type="button" className="sendflow-deposit-request-confirm" onClick={cancelDepositRequest}>
                    Terminé
                  </button>
                </div>
              )}

              {requestState === 'failure' && (
                <div className="sendflow-deposit-request-state is-failure">
                  <div className="sendflow-deposit-failure-art">
                    <img src={depositFailureIllustration} alt="" />
                  </div>
                  <h2 id="deposit-request-title">Votre dépôt n’a pas pu être confirmé</h2>
                  <p>Aucun montant n’a été crédité. Vérifiez votre opération USSD puis réessayez.</p>
                  <button type="button" className="sendflow-deposit-request-confirm" onClick={cancelDepositRequest}>
                    Réessayer
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {operatorPickerOpen && operator && (
          <div className="sendflow-transfer-operator-picker" role="presentation" onClick={() => setOperatorPickerOpen(false)}>
            <section className="sendflow-transfer-operator-sheet" role="dialog" aria-modal="true" aria-labelledby="deposit-operator-title" onClick={(event) => event.stopPropagation()}>
              <div className="sendflow-transfer-operator-sheet-header">
                <div>
                  <span>Choisir l’opérateur</span>
                  <h2 id="deposit-operator-title">Source du dépôt</h2>
                </div>
                <button type="button" className="sendflow-transfer-operator-close" onClick={() => setOperatorPickerOpen(false)} aria-label="Fermer la sélection d’opérateur">
                  <X size={20} />
                </button>
              </div>
              <div className="sendflow-transfer-operator-list">
                {depositOperators.map((nextOperator) => (
                  <button
                    type="button"
                    key={nextOperator.id}
                    className={`sendflow-transfer-operator-option${operator.id === nextOperator.id ? ' is-selected' : ''}`}
                    onClick={() => selectOperator(nextOperator)}
                  >
                    <span className={`sendflow-transfer-operator-choice is-${nextOperator.brand}`}>
                      <OperatorMark operator={nextOperator} />
                    </span>
                    <span className="sendflow-transfer-operator-option-copy">
                      <strong>{nextOperator.name}</strong>
                      <small>{nextOperator.requiresOtp ? 'Code OTP requis' : 'Aucun code OTP requis'}</small>
                    </span>
                    <span className="sendflow-transfer-operator-option-check" aria-hidden="true">
                      {operator.id === nextOperator.id ? <Check size={18} /> : null}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}