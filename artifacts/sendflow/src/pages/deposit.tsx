import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  Clipboard,
  History,
  X,
} from 'lucide-react';
import { Link, Redirect, useLocation } from 'wouter';
import { TransferRequestDialog, type TransferRequestState } from '@/components/transfer-request-dialog';
import { OperatorMark } from '@/components/operator-mark';
import { getGetPublicPricingQueryKey, useGetPublicPricing } from '@workspace/api-client-react';
import { transactionSubmissionAvailable, transactionUnavailableReason } from '@/lib/transaction-readiness';
import { readAccountCountry } from '@/lib/account-country';
import { useServerTransferQuote } from '@/hooks/use-server-transfer-quote';
import { formatServerFeePercent as formatPricingFeeRate, formatQuoteAmount, serverQuoteAmounts } from '@/lib/server-transfer-quote';
import { useSeo } from '@/lib/seo';
import {
  isValidIvoryCoastPhone,
  isValidTransactionAmount,
  MAX_TRANSACTION_AMOUNT,
  parseWholeAmount,
} from '@/lib/transfer-validation';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';

type OperatorBrand = 'orange' | 'wave' | 'mtn' | 'moov' | 'generic';

type DepositOperator = {
  id: string;
  name: string;
  shortName: string;
  initials: string;
  logoUrl: string | null;
  brand: OperatorBrand;
  requiresOtp: boolean;
  otpCommand: string | null;
};

export default function DepositPage() {
  const [, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const accountCountry = readAccountCountry();
  const pricingQuery = useGetPublicPricing({ query: { enabled: isUnlocked, queryKey: getGetPublicPricingQueryKey() } });
  const pricingCountry = pricingQuery.data?.countries.find((country) => country.dialCode === accountCountry.dialCode);
  const depositOperators = useMemo(() => {
    if (accountCountry.dialCode !== '+225' || !pricingCountry) return [];
    return (pricingQuery.data?.operators ?? [])
      .filter((item) => item.countryId === pricingCountry.id)
      .map((item) => ({
        id: item.id,
        name: item.name,
        shortName: item.shortName,
        initials: item.initials,
        logoUrl: item.logoUrl,
        brand: item.brand,
        requiresOtp: item.requiresOtp,
        otpCommand: item.otpCommand,
      }));
  }, [accountCountry.dialCode, pricingCountry?.id, pricingQuery.data?.operators]);
  const [amount, setAmount] = useState('');
  const [sourceNumber, setSourceNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [payFees, setPayFees] = useState(true);
  const [operatorId, setOperatorId] = useState<string | null>('orange-ci');
  const operator = depositOperators.find((item) => item.id === operatorId)
    ?? depositOperators.find((item) => item.id === 'orange-ci')
    ?? depositOperators[0]
    ?? null;
  const [operatorPickerOpen, setOperatorPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [requestState, setRequestState] = useState<TransferRequestState>('idle');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const enteredAmount = parseWholeAmount(amount);
  const hasValidSourceNumber = isValidIvoryCoastPhone(sourceNumber);
  const quoteInput = operator && isValidTransactionAmount(enteredAmount) && hasValidSourceNumber
    ? {
      kind: 'deposit' as const, sourceOperatorId: operator.id,
      senderPhone: `${accountCountry.dialCode}${sourceNumber}`,
      amountMinor: enteredAmount, senderPaysFees: payFees,
    } : null;
  const transferQuote = useServerTransferQuote(quoteInput, isUnlocked);
  const feeRate = transferQuote.data?.feePercent;
  const amountBreakdown = serverQuoteAmounts(transferQuote.data);
  const feeAmount = amountBreakdown.feeAmount;
  const walletAmount = amountBreakdown.recipientAmount;

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
    const nextOperatorId = operator?.id ?? null;
    if (nextOperatorId !== operatorId) setOperatorId(nextOperatorId);
  }, [operator?.id, operatorId]);

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

  const canSubmit = Boolean(
    operator &&
    transferQuote.data &&
    isValidTransactionAmount(enteredAmount) &&
    walletAmount !== null &&
    hasValidSourceNumber &&
    (!operator.requiresOtp || otp.trim().length > 0),
  );

  const selectOperator = (nextOperator: DepositOperator) => {
    setOperatorId(nextOperator.id);
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
            <button type="button" className="sendflow-transfer-header-button" onClick={() => setLocation('/notifications')} aria-label="Voir les notifications" data-testid="button-deposit-notifications">
              <Bell size={23} strokeWidth={2.1} />
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
            if (canSubmit && transactionSubmissionAvailable) {
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
                onChange={(event) => {
                  setAmount(event.target.value.replace(/[^\d ]/g, '').slice(0, 10));
                  setSubmitAttempted(false);
                }}
                placeholder="Montant du dépôt"
                aria-label="Montant du dépôt"
                maxLength={10}
              />
              <strong>FCFA</strong>
            </label>
            {submitAttempted && !isValidTransactionAmount(enteredAmount) && (
              <p className="sendflow-international-field-error" role="alert">
                Saisissez un montant compris entre 1 et {MAX_TRANSACTION_AMOUNT.toLocaleString('fr-FR')} FCFA.
              </p>
            )}

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
                    onChange={(event) => {
                      setSourceNumber(event.target.value.replace(/\D/g, '').slice(0, 10));
                      setSubmitAttempted(false);
                    }}
                    aria-label="Numéro source du dépôt"
                    placeholder="Numéro source"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={10}
                    aria-invalid={submitAttempted && !hasValidSourceNumber}
                  />
                  <span className="sendflow-transfer-flag" aria-label={accountCountry.name}>{accountCountry.flag}</span>
                </div>
                {submitAttempted && !hasValidSourceNumber && (
                  <p className="sendflow-international-field-error" role="alert">
                    Entrez un numéro ivoirien valide de 10 chiffres.
                  </p>
                )}

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
                      aria-invalid={submitAttempted && !otp.trim()}
                    />
                    {submitAttempted && !otp.trim() && (
                      <p className="sendflow-international-field-error" role="alert">Saisissez le code OTP demandé par l’opérateur.</p>
                    )}
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
                <span>{feeRate === undefined ? 'Frais à confirmer' : `Frais (${formatPricingFeeRate(feeRate)})`}</span>
                <strong className="sendflow-deposit-fee-amount">
                  {amountBreakdown.feeAmount === null
                    ? 'À confirmer'
                    : `${feeAmount === 0 ? '' : '- '}${formatQuoteAmount(feeAmount)} Fcfa`}
                </strong>
              </div>
              <div>
                <span>Le wallet reçoit</span>
                <strong>{amountBreakdown.recipientAmount === null ? 'À confirmer' : `${formatQuoteAmount(walletAmount)} Fcfa`}</strong>
              </div>
              <div>
                <span>Total débité</span>
                <strong>{amountBreakdown.totalDebit === null ? 'À confirmer' : `${amountBreakdown.totalDebit.toLocaleString('fr-FR')} Fcfa`}</strong>
              </div>
            </div>
            {submitAttempted && !transferQuote.isPending && feeRate === undefined && (
              <p className="sendflow-international-field-error" role="alert">Les frais de cet opérateur ne sont pas disponibles. Le dépôt ne peut pas être préparé.</p>
            )}

            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="status" data-testid="notice-transfer-provider-unavailable">
              {transactionUnavailableReason}
            </p>
            <button type="submit" className="sendflow-transfer-submit" disabled={!transactionSubmissionAvailable || requestState !== 'idle'}>
              {transactionSubmissionAvailable ? `Déposer ${formatQuoteAmount(walletAmount)} FCFA` : 'Opérations indisponibles'}
            </button>
          </section>
        </form>

        <TransferRequestDialog
          state={requestState}
          operation="Dépôt"
          pendingLabel="Demande de dépôt"
          amountLabel="Montant à créditer"
          amount={formatQuoteAmount(walletAmount)}
          metaLabel={operator?.name ?? 'Opérateur'}
          metaValue={operator ? `${accountCountry.dialCode} ${sourceNumber}` : '—'}
          pendingCopy="Composez le code USSD sur votre téléphone pour confirmer le dépôt."
          successTitle="Votre dépôt a été crédité avec succès"
          successCopy={`${formatQuoteAmount(walletAmount)} FCFA sont maintenant disponibles dans votre wallet.`}
          failureTitle="Votre dépôt n’a pas pu être confirmé"
          failureCopy="Aucun montant n’a été crédité. Vérifiez votre opération USSD puis réessayez."
          cancelLabel="Annuler le dépôt"
          successButtonLabel="Fermer le dépôt"
          failureButtonLabel="Réessayer le dépôt"
          onClose={cancelDepositRequest}
        />

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