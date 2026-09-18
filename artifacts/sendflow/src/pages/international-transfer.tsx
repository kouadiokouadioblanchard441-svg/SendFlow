import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  History,
  WalletCards,
  X,
} from 'lucide-react';
import { Link, Redirect, useLocation } from 'wouter';
import { useSeo } from '@/lib/seo';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import waveLogo from '@assets/generated_images/sendflow-wave-logo.png';

type TransferCountry = {
  id: string;
  name: string;
  dialCode: string;
  flag: string;
};

type InternationalOperator = {
  id: string;
  name: string;
  shortName: string;
  brand: 'orange' | 'wave' | 'mtn' | 'moov' | 'generic';
};

const transferCountries: TransferCountry[] = [
  { id: 'ci', name: 'Côte d’Ivoire', dialCode: '+225', flag: '🇨🇮' },
  { id: 'sn', name: 'Sénégal', dialCode: '+221', flag: '🇸🇳' },
  { id: 'bf', name: 'Burkina Faso', dialCode: '+226', flag: '🇧🇫' },
  { id: 'bj', name: 'Bénin', dialCode: '+229', flag: '🇧🇯' },
  { id: 'ml', name: 'Mali', dialCode: '+223', flag: '🇲🇱' },
  { id: 'ne', name: 'Niger', dialCode: '+227', flag: '🇳🇪' },
  { id: 'tg', name: 'Togo', dialCode: '+228', flag: '🇹🇬' },
  { id: 'cm', name: 'Cameroun', dialCode: '+237', flag: '🇨🇲' },
  { id: 'cg', name: 'Congo-Brazzaville', dialCode: '+242', flag: '🇨🇬' },
];

const operatorsByCountry: Record<string, InternationalOperator[]> = {
  ci: [
    { id: 'orange-ci', name: 'Orange Money', shortName: 'Orange', brand: 'orange' },
    { id: 'wave-ci', name: 'Wave', shortName: 'Wave', brand: 'wave' },
    { id: 'mtn-ci', name: 'MTN Mobile Money', shortName: 'MTN', brand: 'mtn' },
    { id: 'moov-ci', name: 'Moov Money', shortName: 'Moov', brand: 'moov' },
  ],
  sn: [
    { id: 'orange-sn', name: 'Orange Money', shortName: 'Orange', brand: 'orange' },
    { id: 'wave-sn', name: 'Wave', shortName: 'Wave', brand: 'wave' },
    { id: 'free-sn', name: 'Free Money', shortName: 'Free', brand: 'generic' },
  ],
  bf: [
    { id: 'orange-bf', name: 'Orange Money', shortName: 'Orange', brand: 'orange' },
    { id: 'moov-bf', name: 'Moov Money', shortName: 'Moov', brand: 'moov' },
    { id: 'telecel-bf', name: 'Telecel Money', shortName: 'Telecel', brand: 'generic' },
  ],
  bj: [
    { id: 'mtn-bj', name: 'MTN Mobile Money', shortName: 'MTN', brand: 'mtn' },
    { id: 'moov-bj', name: 'Moov Money', shortName: 'Moov', brand: 'moov' },
  ],
  ml: [
    { id: 'orange-ml', name: 'Orange Money', shortName: 'Orange', brand: 'orange' },
    { id: 'moov-ml', name: 'Moov Money', shortName: 'Moov', brand: 'moov' },
  ],
  ne: [
    { id: 'airtel-ne', name: 'Airtel Money', shortName: 'Airtel', brand: 'generic' },
    { id: 'moov-ne', name: 'Moov Money', shortName: 'Moov', brand: 'moov' },
  ],
  tg: [
    { id: 'tmoney-tg', name: 'TMoney', shortName: 'TMoney', brand: 'generic' },
    { id: 'flooz-tg', name: 'Flooz', shortName: 'Flooz', brand: 'generic' },
  ],
  cm: [
    { id: 'orange-cm', name: 'Orange Money', shortName: 'Orange', brand: 'orange' },
    { id: 'mtn-cm', name: 'MTN Mobile Money', shortName: 'MTN', brand: 'mtn' },
  ],
  cg: [
    { id: 'airtel-cg', name: 'Airtel Money', shortName: 'Airtel', brand: 'generic' },
    { id: 'mtn-cg', name: 'MTN Mobile Money', shortName: 'MTN', brand: 'mtn' },
  ],
};

const INTERNATIONAL_FEE_RATE = 0.03;
const initialCountry = transferCountries[0];
const initialOperator = operatorsByCountry[initialCountry.id][0];

function OperatorMark({ operator }: { operator: InternationalOperator }) {
  if (operator.brand === 'wave') return <img src={waveLogo} alt="" />;

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

export default function InternationalTransferPage() {
  const [, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const [amount, setAmount] = useState('');
  const [recipientNumber, setRecipientNumber] = useState('');
  const [country, setCountry] = useState(initialCountry);
  const [operator, setOperator] = useState<InternationalOperator | null>(initialOperator);
  const [payFees, setPayFees] = useState(true);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [operatorPickerOpen, setOperatorPickerOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useSeo({
    path: '/international-transfer',
    locale: 'fr',
    title: 'Transfert international · SendFlow',
    description: 'Envoyez de l’argent vers un autre pays depuis votre wallet SendFlow.',
    robots: 'noindex,nofollow',
  });

  useEffect(() => {
    if (!isUnlocked) setLocation('/sign-in');
  }, [isUnlocked, setLocation]);

  useEffect(() => {
    if (!countryPickerOpen && !operatorPickerOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCountryPickerOpen(false);
        setOperatorPickerOpen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [countryPickerOpen, operatorPickerOpen]);

  if (!isUnlocked) return <Redirect to="/sign-in" />;

  const enteredAmount = Number(amount.replace(/\s/g, '')) || 0;
  const feeAmount = enteredAmount > 0 ? Math.ceil(enteredAmount * INTERNATIONAL_FEE_RATE) : 0;
  const recipientAmount = payFees ? enteredAmount : Math.max(enteredAmount - feeAmount, 0);
  const walletDebit = payFees ? enteredAmount + feeAmount : enteredAmount;
  const recipientDigits = recipientNumber.replace(/\D/g, '');
  const hasValidRecipient = /^\d{7,15}$/.test(recipientDigits);
  const canSubmit = Boolean(operator) && enteredAmount > 0 && recipientAmount > 0 && hasValidRecipient;

  const selectCountry = (nextCountry: TransferCountry) => {
    setCountry(nextCountry);
    setOperator(operatorsByCountry[nextCountry.id]?.[0] ?? null);
    setRecipientNumber('');
    setSubmitted(false);
    setSubmitAttempted(false);
    setCountryPickerOpen(false);
  };

  const selectOperator = (nextOperator: InternationalOperator) => {
    setOperator(nextOperator);
    setSubmitted(false);
    setSubmitAttempted(false);
    setOperatorPickerOpen(false);
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
              data-testid="button-international-back-dashboard"
            >
              <ArrowLeft size={22} strokeWidth={2.1} />
            </button>
            <Link href="/account" className="sendflow-transfer-brand" aria-label="Retour au compte">
              <img className="sendflow-transfer-mark" src={sendflowMark} alt="" />
              <img className="sendflow-transfer-wordmark" src={sendflowWordmark} alt="SendFlow" />
            </Link>
          </div>
          <div className="sendflow-transfer-header-actions">
            <button type="button" className="sendflow-transfer-header-button" onClick={() => setLocation('/history')} aria-label="Voir l’historique des transactions" data-testid="button-international-history">
              <History size={22} strokeWidth={2.1} />
            </button>
            <button type="button" className="sendflow-transfer-header-button has-notification" onClick={() => setLocation('/notifications')} aria-label="Voir les notifications" data-testid="button-international-notifications">
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
            setSubmitAttempted(true);
            if (canSubmit) setSubmitted(true);
          }}
        >
          <section className="sendflow-transfer-section" aria-labelledby="international-from-title">
            <h2 id="international-from-title">Retrait du wallet</h2>
            <label className="sendflow-transfer-money-field">
              <span className="sr-only">Montant du transfert international</span>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value.replace(/[^\d ]/g, ''));
                  setSubmitted(false);
                  setSubmitAttempted(false);
                }}
                placeholder="Montant du transfert"
                aria-label="Montant du transfert international"
                maxLength={12}
              />
              <strong>FCFA</strong>
            </label>
            <div className="sendflow-international-wallet-source">
              <span className="sendflow-international-wallet-icon" aria-hidden="true"><WalletCards size={22} strokeWidth={2} /></span>
              <span>
                <strong>Wallet interne</strong>
                <small>Le montant sera débité après confirmation</small>
              </span>
            </div>
          </section>

          <div className="sendflow-transfer-divider" />

          <section className="sendflow-transfer-section sendflow-transfer-destination" aria-labelledby="international-to-title">
            <h2 id="international-to-title">Vers</h2>
            <button
              type="button"
              className="sendflow-international-country-button"
              onClick={() => setCountryPickerOpen(true)}
              aria-haspopup="dialog"
              aria-label={`Sélectionner le pays destinataire, actuellement ${country.name}`}
              data-testid="button-select-international-country"
            >
              <span className="sendflow-international-country-flag" aria-hidden="true">{country.flag}</span>
              <span>
                <small>Pays destinataire</small>
                <strong>{country.name}</strong>
              </span>
              <ChevronDown size={20} aria-hidden="true" />
            </button>
            {operator ? (
              <div className="sendflow-transfer-phone-row sendflow-international-phone-row">
                <button
                  type="button"
                  className={`sendflow-transfer-operator-box is-${operator.brand}`}
                  onClick={() => setOperatorPickerOpen(true)}
                  aria-haspopup="dialog"
                  aria-label={`Sélectionner l’opérateur destinataire, actuellement ${operator.name}`}
                  data-testid="button-select-international-operator"
                >
                  <OperatorMark operator={operator} />
                </button>
                <span className="sendflow-transfer-prefix">{country.dialCode}</span>
                <input
                  type="tel"
                  value={recipientNumber}
                  onChange={(event) => {
                    setRecipientNumber(event.target.value);
                    setSubmitted(false);
                    setSubmitAttempted(false);
                  }}
                  placeholder="Numéro du bénéficiaire"
                  aria-label={`Numéro du bénéficiaire au ${country.name}`}
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={18}
                  aria-invalid={submitAttempted && !hasValidRecipient}
                />
                <span className="sendflow-transfer-flag" aria-label={country.name}>{country.flag}</span>
              </div>
            ) : (
              <div className="sendflow-deposit-unavailable" role="status">
                Aucun opérateur n’est encore disponible pour ce pays.
              </div>
            )}
            {submitAttempted && !hasValidRecipient && (
              <p className="sendflow-international-field-error" role="alert">
                Entrez un numéro valide pour {country.name}.
              </p>
            )}

            <label className="sendflow-transfer-checkbox">
              <input
                type="checkbox"
                checked={payFees}
                onChange={(event) => {
                  setPayFees(event.target.checked);
                  setSubmitted(false);
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
                <span>Le bénéficiaire reçoit</span>
                <strong>{recipientAmount.toLocaleString('fr-FR')} Fcfa</strong>
              </div>
              <div>
                <span>Wallet débité</span>
                <strong>{walletDebit.toLocaleString('fr-FR')} Fcfa</strong>
              </div>
            </div>

            {submitted && (
              <div className="sendflow-transfer-success" role="status">
                <Check size={18} />
                Transfert international préparé.
              </div>
            )}

            <button type="submit" className="sendflow-transfer-submit" disabled={!canSubmit || submitted}>
              {submitted ? 'Transfert préparé' : `Envoyer ${recipientAmount.toLocaleString('fr-FR')} FCFA`}
            </button>
          </section>
        </form>

        {countryPickerOpen && (
          <div className="sendflow-transfer-operator-picker" role="presentation" onClick={() => setCountryPickerOpen(false)}>
            <section className="sendflow-transfer-operator-sheet" role="dialog" aria-modal="true" aria-labelledby="international-country-title" onClick={(event) => event.stopPropagation()}>
              <div className="sendflow-transfer-operator-sheet-header">
                <div>
                  <span>Choisir le pays</span>
                  <h2 id="international-country-title">Pays destinataire</h2>
                </div>
                <button type="button" className="sendflow-transfer-operator-close" onClick={() => setCountryPickerOpen(false)} aria-label="Fermer la sélection du pays">
                  <X size={20} />
                </button>
              </div>
              <div className="sendflow-international-country-list">
                {transferCountries.map((nextCountry) => (
                  <button
                    type="button"
                    key={nextCountry.id}
                    className={`sendflow-international-country-option${country.id === nextCountry.id ? ' is-selected' : ''}`}
                    onClick={() => selectCountry(nextCountry)}
                  >
                    <span className="sendflow-international-country-option-flag" aria-hidden="true">{nextCountry.flag}</span>
                    <span>
                      <strong>{nextCountry.name}</strong>
                      <small>{nextCountry.dialCode}</small>
                    </span>
                    {country.id === nextCountry.id && <Check size={18} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {operatorPickerOpen && operator && (
          <div className="sendflow-transfer-operator-picker" role="presentation" onClick={() => setOperatorPickerOpen(false)}>
            <section className="sendflow-transfer-operator-sheet" role="dialog" aria-modal="true" aria-labelledby="international-operator-title" onClick={(event) => event.stopPropagation()}>
              <div className="sendflow-transfer-operator-sheet-header">
                <div>
                  <span>Choisir l’opérateur</span>
                  <h2 id="international-operator-title">{country.name}</h2>
                </div>
                <button type="button" className="sendflow-transfer-operator-close" onClick={() => setOperatorPickerOpen(false)} aria-label="Fermer la sélection de l’opérateur">
                  <X size={20} />
                </button>
              </div>
              <div className="sendflow-transfer-operator-list">
                {(operatorsByCountry[country.id] ?? []).map((nextOperator) => (
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
                      <small>Moyen de réception disponible</small>
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