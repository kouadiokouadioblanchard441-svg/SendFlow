import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Clipboard,
  ContactRound,
  History,
  X,
} from 'lucide-react';
import { Link, Redirect, useLocation } from 'wouter';
import { TransferRequestDialog, type TransferRequestState } from '@/components/transfer-request-dialog';
import {
  getGetPublicPricingQueryKey,
  useGetPublicPricing,
} from '@workspace/api-client-react';
import { transactionSubmissionAvailable, transactionUnavailableReason } from '@/lib/transaction-readiness';
import { useSeo } from '@/lib/seo';
import { useServerTransferQuote } from '@/hooks/use-server-transfer-quote';
import { formatServerFeePercent as formatPricingFeeRate, formatQuoteAmount, serverQuoteAmounts } from '@/lib/server-transfer-quote';
import {
  isValidIvoryCoastPhone,
  isValidTransactionAmount,
  MAX_TRANSACTION_AMOUNT,
  parseWholeAmount,
} from '@/lib/transfer-validation';
import waveLogo from '@assets/generated_images/sendflow-wave-logo.png';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';

type CountryCode = 'ci';
type TransferSide = 'source' | 'destination';
type OperatorBrand = 'orange' | 'wave' | 'mtn' | 'moov' | 'generic';

type TransferOperator = {
  id: string;
  name: string;
  shortName: string;
  brand: OperatorBrand;
  country: CountryCode;
  prefix: string;
  flag: string;
  requiresOtp: boolean;
  otpCommand: string | null;
};

type SavedContact = {
  id: string;
  name: string;
  phone: string;
  initials: string;
};

type DeviceContact = {
  name?: string[];
  tel?: string[];
};

type ContactsManager = {
  select: (
    properties: Array<'name' | 'tel'>,
    options?: { multiple?: boolean },
  ) => Promise<DeviceContact[]>;
};

type ContactsNavigator = Navigator & {
  contacts?: ContactsManager;
};

const savedContacts: SavedContact[] = [];

function OperatorMark({ operator }: { operator: TransferOperator }) {
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

export default function InterNetworkTransferPage() {
  const [, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const pricingQuery = useGetPublicPricing({ query: { enabled: isUnlocked, queryKey: getGetPublicPricingQueryKey() } });
  const pricingCountry = pricingQuery.data?.countries.find((item) => item.id === 'ci');
  const availableOperators = useMemo<TransferOperator[]>(
    () => (pricingQuery.data?.operators ?? [])
      .filter((item) => item.countryId === 'ci')
      .map((item) => ({
        id: item.id,
        name: item.name,
        shortName: item.shortName,
        brand: item.brand,
        country: 'ci',
        prefix: pricingCountry?.dialCode ?? '+225',
        flag: pricingCountry?.flag ?? '🇨🇮',
        requiresOtp: item.requiresOtp,
        otpCommand: item.otpCommand,
      })),
    [pricingCountry?.dialCode, pricingCountry?.flag, pricingQuery.data?.operators],
  );
  const [amount, setAmount] = useState('');
  const [sourceNumber, setSourceNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [recipientNumber, setRecipientNumber] = useState('');
  const [supportFees, setSupportFees] = useState(true);
  const [copied, setCopied] = useState(false);
  const [requestState, setRequestState] = useState<TransferRequestState>('idle');
  const [dialogFailureTitle, setDialogFailureTitle] = useState('Votre transfert inter réseau n’a pas pu être confirmé');
  const [dialogFailureCopy, setDialogFailureCopy] = useState('Aucun montant n’a été débité. Vérifiez les informations des deux opérateurs puis réessayez.');
  const [sourceOperatorId, setSourceOperatorId] = useState<string | null>(null);
  const [destinationOperatorId, setDestinationOperatorId] = useState<string | null>(null);
  const sourceOperator = availableOperators.find((item) => item.id === sourceOperatorId)
    ?? availableOperators[0]
    ?? null;
  const destinationOperator = availableOperators.find(
    (item) => item.id === destinationOperatorId && item.id !== sourceOperator?.id,
  ) ?? availableOperators.find((item) => item.id !== sourceOperator?.id) ?? null;
  const [operatorPicker, setOperatorPicker] = useState<TransferSide | null>(null);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contactsNotice, setContactsNotice] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const enteredAmount = parseWholeAmount(amount);
  const quoteInput = sourceOperator && destinationOperator
    && isValidTransactionAmount(enteredAmount)
    && isValidIvoryCoastPhone(sourceNumber) && isValidIvoryCoastPhone(recipientNumber)
    ? {
      kind: 'inter-network' as const,
      sourceOperatorId: sourceOperator.id, destinationOperatorId: destinationOperator.id,
      senderPhone: `${sourceOperator.prefix}${sourceNumber}`,
      recipientPhone: `${destinationOperator.prefix}${recipientNumber}`,
      amountMinor: enteredAmount, senderPaysFees: supportFees,
    } : null;
  const transferQuote = useServerTransferQuote(quoteInput, isUnlocked);
  const feeRate = transferQuote.data?.feePercent;
  const amountBreakdown = serverQuoteAmounts(transferQuote.data);
  const feeAmount = amountBreakdown.feeAmount;
  const recipientAmount = amountBreakdown.recipientAmount;

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

  useEffect(() => {
    const nextOperatorId = sourceOperator?.id ?? null;
    if (nextOperatorId !== sourceOperatorId) setSourceOperatorId(nextOperatorId);
  }, [sourceOperator?.id, sourceOperatorId]);

  useEffect(() => {
    const nextOperatorId = destinationOperator?.id ?? null;
    if (nextOperatorId !== destinationOperatorId) setDestinationOperatorId(nextOperatorId);
  }, [destinationOperator?.id, destinationOperatorId]);

  if (!isUnlocked) return <Redirect to="/sign-in" />;
  if (pricingQuery.isLoading) {
    return <main className="sendflow-transfer-shell"><p role="status">Chargement des opérateurs…</p></main>;
  }
  if (pricingQuery.isError || !pricingQuery.data) {
    return (
      <main className="sendflow-transfer-shell">
        <div className="sendflow-deposit-unavailable" role="alert">
          Les opérateurs ne sont pas disponibles pour le moment. Réessayez dans quelques instants.
        </div>
      </main>
    );
  }
  if (!sourceOperator || !destinationOperator) {
    return (
      <main className="sendflow-transfer-shell">
        <div className="sendflow-deposit-unavailable" role="status">
          Il faut au moins deux opérateurs actifs en Côte d’Ivoire pour proposer un transfert inter-réseau.
        </div>
      </main>
    );
  }

  const activeOperator = operatorPicker === 'source' ? sourceOperator : destinationOperator;

  const openOperatorPicker = (side: TransferSide) => {
    setOperatorPicker(side);
  };

  const selectOperator = (operator: TransferOperator) => {
    if (operatorPicker === 'source') {
      setSourceOperatorId(operator.id);
      if (!operator.requiresOtp) {
        setOtp('');
      }
    } else {
      setDestinationOperatorId(operator.id);
    }
    setRequestState('idle');
    setSubmitAttempted(false);
    setOperatorPicker(null);
  };

  const selectContact = (contact: SavedContact) => {
    setRecipientNumber(contact.phone);
    setRequestState('idle');
    setSubmitAttempted(false);
    setContactsOpen(false);
  };

  const normalizeIvoryCoastPhone = (value: string) => {
    const compact = value.replace(/[^\d+]/g, '');
    const localNumber = compact.startsWith('+225')
      ? compact.slice(4)
      : compact.startsWith('225')
        ? compact.slice(3)
        : compact;

    return /^0\d{9}$/.test(localNumber) ? localNumber : '';
  };

  const openDeviceContacts = async () => {
    setContactsNotice('');
    const contactsApi = (navigator as ContactsNavigator).contacts;

    if (!contactsApi) {
      setContactsNotice('Votre navigateur ne permet pas d’ouvrir les contacts du téléphone. Vous pouvez choisir un contact SendFlow enregistré ci-dessous.');
      setContactsOpen(true);
      return;
    }

    try {
      const [contact] = await contactsApi.select(['name', 'tel'], { multiple: false });
      const phone = contact?.tel?.map(normalizeIvoryCoastPhone).find(Boolean) ?? '';

      if (!phone) {
        setContactsNotice('Sélectionnez un contact avec un numéro de Côte d’Ivoire en +225.');
        setContactsOpen(true);
        return;
      }

      setRecipientNumber(phone);
      setRequestState('idle');
      setSubmitAttempted(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setContactsNotice('Les contacts du téléphone ne sont pas accessibles. Vous pouvez choisir un contact SendFlow enregistré ci-dessous.');
      setContactsOpen(true);
    }
  };

  const copyOtpCode = async () => {
    if (!sourceOperator.otpCommand) return;

    try {
      await navigator.clipboard.writeText(sourceOperator.otpCommand);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const canSubmit =
    quoteInput !== null &&
    (!sourceOperator.requiresOtp || otp.trim().length > 0) &&
    isValidIvoryCoastPhone(sourceNumber) &&
    isValidIvoryCoastPhone(recipientNumber);

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
              className="sendflow-transfer-header-button"
              onClick={() => setLocation('/notifications')}
              aria-label="Voir les notifications"
              data-testid="button-transfer-notifications"
            >
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
            if (!canSubmit || !sourceOperator || !destinationOperator || transferQuote.isPending) return;
            void transferQuote.mutateAsync({
              data: {
                kind: 'inter-network',
                sourceOperatorId: sourceOperator.id,
                destinationOperatorId: destinationOperator.id,
                senderPhone: `${sourceOperator.prefix}${sourceNumber}`,
                recipientPhone: `${destinationOperator.prefix}${recipientNumber}`,
                amountMinor: enteredAmount,
                senderPaysFees: supportFees,
              },
            }).then(() => {
              setDialogFailureTitle('Vérification terminée');
              setDialogFailureCopy('Ce montant respecte votre plafond mensuel. Les opérations des opérateurs ne sont pas encore disponibles : aucun transfert n’a été initié et aucun montant n’a été débité.');
              setRequestState('failure');
            }).catch((error: unknown) => {
              if (error instanceof Error && error.name === 'AbortError') return;
              const status = typeof error === 'object' && error !== null && 'status' in error
                ? (error as { status?: number }).status
                : undefined;
              if (status === 409) {
                setDialogFailureTitle('Plafond mensuel dépassé');
                setDialogFailureCopy('Le montant saisi dépasse le plafond encore disponible pour ce mois. Réduisez le montant ou consultez « Plafond du compte ». Votre transfert n’a pas été initié et aucun montant n’a été débité.');
              } else {
                setDialogFailureTitle('Vérification indisponible');
                setDialogFailureCopy('Nous ne pouvons pas vérifier ce montant pour le moment. Aucun transfert n’a été initié et aucun montant n’a été débité. Veuillez réessayer plus tard.');
              }
              setRequestState('failure');
            });
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
                onChange={(event) => {
                  setAmount(event.target.value.replace(/[^\d ]/g, '').slice(0, 10));
                  setRequestState('idle');
                  setSubmitAttempted(false);
                }}
                aria-label="Montant du transfert"
                maxLength={10}
              />
              <strong>FCFA</strong>
            </label>
            {submitAttempted && !isValidTransactionAmount(enteredAmount) && (
              <p className="sendflow-international-field-error" role="alert">
                Saisissez un montant compris entre 1 et {MAX_TRANSACTION_AMOUNT.toLocaleString('fr-FR')} FCFA.
              </p>
            )}

            <div className="sendflow-transfer-phone-row">
              <button
                type="button"
                className={`sendflow-transfer-operator-box is-${sourceOperator.brand}`}
                onClick={() => openOperatorPicker('source')}
                aria-label={`Sélectionner l’opérateur source, actuellement ${sourceOperator.name}`}
                data-testid="button-select-source-operator"
              >
                <OperatorMark operator={sourceOperator} />
              </button>
              <span className="sendflow-transfer-prefix">{sourceOperator.prefix}</span>
              <input
                type="tel"
                value={sourceNumber}
                onChange={(event) => {
                  setSourceNumber(event.target.value.replace(/\D/g, '').slice(0, 10));
                  setRequestState('idle');
                  setSubmitAttempted(false);
                }}
                aria-label="Numéro source"
                inputMode="tel"
                autoComplete="tel"
                maxLength={10}
                aria-invalid={submitAttempted && !isValidIvoryCoastPhone(sourceNumber)}
              />
              <span className="sendflow-transfer-flag" aria-label="Côte d’Ivoire">
                {sourceOperator.flag}
              </span>
            </div>
            {submitAttempted && !isValidIvoryCoastPhone(sourceNumber) && (
              <p className="sendflow-international-field-error" role="alert">
                Entrez un numéro source ivoirien valide de 10 chiffres.
              </p>
            )}

            {sourceOperator.requiresOtp && (
              <>
                <div className="sendflow-transfer-otp-help">
                  {sourceOperator.otpCommand ? (
                    <>
                      <span>Obtenir le code otp avec</span>
                      <button type="button" onClick={copyOtpCode} className="sendflow-transfer-otp-link">
                        {sourceOperator.otpCommand}
                      </button>
                      <button type="button" className="sendflow-transfer-copy" onClick={copyOtpCode} aria-label="Copier le code OTP">
                        {copied ? <Check size={18} /> : <Clipboard size={18} />}
                      </button>
                    </>
                  ) : (
                    <span>Générez votre code OTP dans Orange Money</span>
                  )}
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
                  <p className="sendflow-international-field-error" role="alert">Saisissez le code OTP demandé par l’opérateur source.</p>
                )}
              </>
            )}

            <label className="sendflow-transfer-checkbox">
              <input
                type="checkbox"
                checked={supportFees}
                onChange={(event) => {
                  setSupportFees(event.target.checked);
                  setRequestState('idle');
                }}
              />
              <span aria-hidden="true">{supportFees ? <Check size={13} strokeWidth={3} /> : null}</span>
              <strong>Je supporte les frais</strong>
            </label>
          </section>

          <div className="sendflow-transfer-divider" />

          <section className="sendflow-transfer-section sendflow-transfer-destination" aria-labelledby="transfer-to-title">
            <h2 id="transfer-to-title">Vers</h2>
            <div className="sendflow-transfer-phone-row">
              <button
                type="button"
                className={`sendflow-transfer-operator-box is-${destinationOperator.brand}`}
                onClick={() => openOperatorPicker('destination')}
                aria-label={`Sélectionner l’opérateur destinataire, actuellement ${destinationOperator.name}`}
                data-testid="button-select-destination-operator"
              >
                <OperatorMark operator={destinationOperator} />
              </button>
              <span className="sendflow-transfer-prefix">{destinationOperator.prefix}</span>
              <input
                type="tel"
                value={recipientNumber}
                onChange={(event) => {
                  setRecipientNumber(event.target.value.replace(/\D/g, '').slice(0, 10));
                  setRequestState('idle');
                  setSubmitAttempted(false);
                }}
                placeholder="Numéro"
                aria-label="Numéro du bénéficiaire"
                inputMode="tel"
                autoComplete="tel"
                maxLength={10}
                aria-invalid={submitAttempted && !isValidIvoryCoastPhone(recipientNumber)}
              />
              <span className="sendflow-transfer-flag" aria-label="Côte d’Ivoire">
                {destinationOperator.flag}
              </span>
              <button
                type="button"
                className="sendflow-transfer-contact"
                onClick={() => void openDeviceContacts()}
                aria-label="Ouvrir les contacts"
                data-testid="button-open-transfer-contacts"
              >
                <ContactRound size={27} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
            {submitAttempted && !isValidIvoryCoastPhone(recipientNumber) && (
              <p className="sendflow-international-field-error" role="alert">
                Entrez un numéro bénéficiaire ivoirien valide de 10 chiffres.
              </p>
            )}
            <div className="sendflow-deposit-summary" aria-live="polite">
              <div>
                <span>{feeRate === undefined ? 'Frais à confirmer' : `Frais (${formatPricingFeeRate(feeRate)})`}</span>
                <strong className="sendflow-deposit-fee-amount">
                  {amountBreakdown.feeAmount === null ? 'À confirmer' : `${formatQuoteAmount(feeAmount)} Fcfa`}
                </strong>
              </div>
              <div>
                <span>Le bénéficiaire reçoit</span>
                <strong>{amountBreakdown.recipientAmount === null ? 'À confirmer' : `${formatQuoteAmount(recipientAmount)} Fcfa`}</strong>
              </div>
              <div>
                <span>Total prélevé sur le numéro source</span>
                <strong>{amountBreakdown.totalDebit === null ? 'À confirmer' : `${amountBreakdown.totalDebit.toLocaleString('fr-FR')} Fcfa`}</strong>
              </div>
            </div>
            {submitAttempted && !transferQuote.isPending && feeRate === undefined && (
              <p className="sendflow-international-field-error" role="alert">Les frais de cet opérateur ne sont pas disponibles. Le transfert ne peut pas être préparé.</p>
            )}

            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="status" data-testid="notice-transfer-provider-unavailable">
              {transactionUnavailableReason}
            </p>
            <button type="submit" className="sendflow-transfer-submit" disabled={transferQuote.isPending || requestState !== 'idle'}>
              {transferQuote.isPending
                ? 'Vérification en cours'
                : !transactionSubmissionAvailable
                  ? 'Vérifier le plafond'
                : requestState === 'pending'
                ? 'Confirmation en cours'
                : requestState === 'success'
                  ? 'Transfert confirmé'
                  : requestState === 'failure'
                    ? 'Réessayer le transfert'
                    : `Envoyer ${formatQuoteAmount(recipientAmount)} FCFA`}
            </button>
          </section>
        </form>

        <TransferRequestDialog
          state={requestState}
          operation="Transfert inter réseau"
          pendingLabel="Préparation du transfert inter-réseau"
          amountLabel="Montant à envoyer"
          amount={formatQuoteAmount(recipientAmount)}
          metaLabel={`${sourceOperator.shortName} → ${destinationOperator.shortName}`}
          metaValue={recipientNumber || 'Bénéficiaire'}
          pendingCopy="Votre transfert inter-réseau est en attente. Veuillez patienter."
          successTitle="Votre transfert inter réseau est confirmé"
          successCopy={`Le transfert de ${formatQuoteAmount(recipientAmount)} FCFA vers ${recipientNumber} a été confirmé avec succès.`}
          failureTitle={dialogFailureTitle}
          failureCopy={dialogFailureCopy}
          cancelLabel="Annuler le transfert inter-réseau"
          successButtonLabel="Fermer le transfert inter-réseau"
          failureButtonLabel="Fermer"
          onClose={() => setRequestState('idle')}
        />

        {operatorPicker && (
          <div
            className="sendflow-transfer-operator-picker"
            role="presentation"
            onClick={() => setOperatorPicker(null)}
          >
            <section
              className="sendflow-transfer-operator-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="operator-picker-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sendflow-transfer-operator-sheet-header">
                <div>
                  <span>Choisir l’opérateur</span>
                  <h2 id="operator-picker-title">
                    {operatorPicker === 'source' ? 'Réseau source' : 'Réseau destinataire'}
                  </h2>
                </div>
                <button
                  type="button"
                  className="sendflow-transfer-operator-close"
                  onClick={() => setOperatorPicker(null)}
                  aria-label="Fermer la sélection d’opérateur"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="sendflow-transfer-operator-list">
                {availableOperators
                  .filter((operator) => operator.id !== (operatorPicker === 'source' ? destinationOperator.id : sourceOperator.id))
                  .map((operator) => {
                  const isSelected = activeOperator.id === operator.id;

                  return (
                    <button
                      type="button"
                      key={operator.id}
                      className={`sendflow-transfer-operator-option${isSelected ? ' is-selected' : ''}`}
                      onClick={() => selectOperator(operator)}
                    >
                      <span className={`sendflow-transfer-operator-choice is-${operator.brand}`}>
                        <OperatorMark operator={operator} />
                      </span>
                      <span className="sendflow-transfer-operator-option-copy">
                        <strong>{operator.name}</strong>
                        <small>{operator.requiresOtp ? 'Code OTP requis' : 'Aucun code OTP requis'}</small>
                      </span>
                      <span className="sendflow-transfer-operator-option-check" aria-hidden="true">
                        {isSelected ? <Check size={18} /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {contactsOpen && (
          <div
            className="sendflow-transfer-operator-picker"
            role="presentation"
            onClick={() => setContactsOpen(false)}
          >
            <section
              className="sendflow-transfer-operator-sheet sendflow-transfer-contact-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="transfer-contacts-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sendflow-transfer-operator-sheet-header">
                <div>
                  <span>Votre carnet SendFlow</span>
                  <h2 id="transfer-contacts-title">Choisir un contact</h2>
                </div>
                <button
                  type="button"
                  className="sendflow-transfer-operator-close"
                  onClick={() => setContactsOpen(false)}
                  aria-label="Fermer les contacts"
                >
                  <X size={20} />
                </button>
              </div>

              {contactsNotice && (
                <p className="sendflow-transfer-contact-notice" role="status">
                  {contactsNotice}
                </p>
              )}

              <div className="sendflow-transfer-contact-list">
                {savedContacts.length === 0 ? (
                  <p className="sendflow-transfer-contact-notice">Aucun contact enregistré pour le moment.</p>
                ) : savedContacts.map((contact) => (
                  <button
                    type="button"
                    className="sendflow-transfer-contact-option"
                    key={contact.id}
                    onClick={() => selectContact(contact)}
                    data-testid={`button-select-contact-${contact.id}`}
                  >
                    <span className="sendflow-transfer-contact-avatar" aria-hidden="true">
                      {contact.initials}
                    </span>
                    <span className="sendflow-transfer-contact-copy">
                      <strong>{contact.name}</strong>
                      <small>{destinationOperator.prefix} {contact.phone}</small>
                    </span>
                    <ChevronRight size={19} strokeWidth={2} aria-hidden="true" />
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