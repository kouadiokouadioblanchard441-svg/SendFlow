import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'wouter';
import { ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  getPublicPaymentLinkAttemptStatus,
  getGetPublicPaymentLinkQueryKey,
  useGetPublicPaymentLink,
  useStartPublicPaymentLinkAttempt,
  useSimulateCustomerPaymentLink,
} from '@workspace/api-client-react';
import type {
  PublicPaymentLinkAttemptCreated,
  SimulatedPaymentLinkSuccess,
} from '@workspace/api-client-react';
import { useSeo } from '@/lib/seo';
import linkflowIllustration from '@assets/generated_images/sendflow-linkflow-payment-3d.webp';
import linkUnavailableIllustration from '@assets/generated_images/sendflow-link-unavailable-3d-final.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import securePaymentMark from '@assets/generated_images/sendflow-secure-payment-mark-3d-clean.png';
import waveOperatorLogo from '@/assets/wave-logo-reference.png';
import { OperatorMark } from '@/components/operator-mark';
import { parseStoredLinkFlowAttempt, parseStoredLinkFlowIdempotencyKey } from '@/lib/linkflow-attempt-storage';
import LinkFlowPaymentOutcome from '@/components/linkflow-payment-outcome';
import LinkFlowSecureFooter from '@/components/linkflow-secure-footer';
import LinkFlowPaymentWaiting from '@/components/linkflow-payment-waiting';

function formatMoney(minor: number, currency: string, decimals: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(minor / (10 ** decimals));
}

function parseAmountInputMinor(value: string, decimals: number): number | null {
  const match = /^([0-9]+)(?:\.([0-9]+))?$/.exec(value.trim());
  if (!match || (match[2]?.length ?? 0) > decimals) return null;
  try {
    const scale = 10n ** BigInt(decimals);
    const whole = BigInt(match[1]);
    const fraction = decimals === 0
      ? 0n
      : BigInt(((match[2] ?? '') + '0'.repeat(decimals)).slice(0, decimals));
    const amountMinor = whole * scale + fraction;
    if (amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(amountMinor);
  } catch {
    return null;
  }
}

function formatAmountInput(minor: number, decimals: number) {
  if (decimals === 0) return String(minor);
  const digits = String(minor).padStart(decimals + 1, '0');
  return `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
}

function paymentStorageKey(token: string, suffix: string) {
  return `sendflow:linkflow:${token}:${suffix}`;
}

function PaymentSelectIndicator() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="sendflow-pay-select-indicator">
      <path d="M3.5 6.5 8 2l4.5 4.5h-9Z" />
      <path d="M3.5 9.5 8 14l4.5-4.5h-9Z" />
    </svg>
  );
}

const MIN_LINK_LOADING_MS = 1000;

type ActivePaymentAttempt = Pick<PublicPaymentLinkAttemptCreated, 'attemptId' | 'pollToken'>
  & Partial<Pick<PublicPaymentLinkAttemptCreated, 'merchantName' | 'amountMinor' | 'currency' | 'currencyDecimals' | 'ussdCode'>>
  & { token: string };

export default function PublicPaymentLinkPage() {
  const { token = '' } = useParams<{ token: string }>();
  const linkQuery = useGetPublicPaymentLink(token, {
    query: {
      queryKey: getGetPublicPaymentLinkQueryKey(token),
      retry: false,
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
    },
  });
  const [linkLoadCycle, setLinkLoadCycle] = useState(0);
  const [minimumLoadTimeElapsed, setMinimumLoadTimeElapsed] = useState(false);
  const [loadedPageAssetsKey, setLoadedPageAssetsKey] = useState('');

  useEffect(() => {
    setMinimumLoadTimeElapsed(false);
    const timer = window.setTimeout(() => setMinimumLoadTimeElapsed(true), MIN_LINK_LOADING_MS);
    return () => window.clearTimeout(timer);
  }, [token, linkLoadCycle]);

  const refreshPublicLink = () => {
    setMinimumLoadTimeElapsed(false);
    setLinkLoadCycle((cycle) => cycle + 1);
    void linkQuery.refetch();
  };

  const [countryCode, setCountryCode] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [payerAmount, setPayerAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('mobile-money');
  const [simulationConfirmation, setSimulationConfirmation] = useState<SimulatedPaymentLinkSuccess | null>(null);
  const [simulationOutcome, setSimulationOutcome] = useState<'succeeded' | 'failed' | null>(null);
  const [simulationPhase, setSimulationPhase] = useState<'waiting' | 'result' | null>(null);
  const [realAttempt, setRealAttempt] = useState<ActivePaymentAttempt | null>(null);
  const [paymentRequestKey, setPaymentRequestKey] = useState('');
  const [storageHydratedToken, setStorageHydratedToken] = useState('');
  const [paymentRecoveryAvailable, setPaymentRecoveryAvailable] = useState(true);
  const simulateMutation = useSimulateCustomerPaymentLink();
  const startPaymentMutation = useStartPublicPaymentLinkAttempt();
  const activeTokenRef = useRef(token);
  activeTokenRef.current = token;

  const link = linkQuery.data;
  const pageAssetsKey = JSON.stringify([token, linkLoadCycle, link?.imagePath ?? null, linkQuery.isError]);

  useEffect(() => {
    let cancelled = false;
    const sources = [
      sendflowWordmark,
      linkflowIllustration,
      securePaymentMark,
      ...(link?.imagePath ? [link.imagePath] : []),
      ...(linkQuery.isError ? [linkUnavailableIllustration] : []),
    ];

    void Promise.all(Array.from(new Set(sources)).map((src) => {
      const image = new Image();
      image.src = src;
      return Promise.race([
        image.decode().catch(() => undefined),
        new Promise<void>((resolve) => window.setTimeout(resolve, 1000)),
      ]);
    })).then(() => {
      if (!cancelled) setLoadedPageAssetsKey(pageAssetsKey);
    });

    return () => {
      cancelled = true;
    };
  }, [token, linkLoadCycle, link?.imagePath, linkQuery.isError, pageAssetsKey]);

  const previewSimulationAvailable = import.meta.env.DEV && Boolean(link?.simulationAvailable);
  const country = link?.countries.find((item) => item.code === countryCode);
  const operator = country?.operators.find((item) => item.id === operatorId);
  const nationalPhone = phone.replace(/\D/g, '');
  const variableAmount = link?.amountMinor === 0;
  const requestedAmountMinor = variableAmount
    ? parseAmountInputMinor(payerAmount, link?.currencyDecimals ?? 0)
    : link?.amountMinor ?? null;
  const requestedAmountValid = variableAmount
    ? Boolean(link?.currency === 'XOF' && requestedAmountMinor !== null && requestedAmountMinor >= 100 && requestedAmountMinor <= 2_000_000)
    : requestedAmountMinor !== null && requestedAmountMinor > 0;
  const payerFormValid = Boolean(
    requestedAmountValid &&
    country &&
    operator &&
    firstName.trim() &&
    lastName.trim() &&
    nationalPhone.length >= (country?.minPhoneDigits ?? 99) &&
    nationalPhone.length <= (country?.maxPhoneDigits ?? 0),
  );
  const activeRealAttempt = storageHydratedToken === token && realAttempt?.token === token
    ? realAttempt
    : null;
  const paymentStatusQuery = useQuery({
    queryKey: ['public-linkflow-attempt-status', activeRealAttempt?.attemptId],
    queryFn: ({ signal }) => getPublicPaymentLinkAttemptStatus(activeRealAttempt!.attemptId, {
      signal,
      headers: { 'X-LinkFlow-Attempt-Token': activeRealAttempt!.pollToken },
    }),
    enabled: Boolean(activeRealAttempt),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === 'succeeded' || state === 'failed' ? false : 4_000;
    },
  });
  useEffect(() => {
    startPaymentMutation.reset();
    simulateMutation.reset();
    setRealAttempt(null);
    setPaymentRequestKey('');
    setCountryCode('');
    setOperatorId('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setPayerAmount('');
    setSelectedPaymentMethod('mobile-money');
    setSimulationConfirmation(null);
    setSimulationOutcome(null);
    setSimulationPhase(null);
    setStorageHydratedToken('');
    try {
      const storageProbeKey = paymentStorageKey(token, 'storage-check');
      window.sessionStorage.setItem(storageProbeKey, 'ready');
      const storageProbeWorked = window.sessionStorage.getItem(storageProbeKey) === 'ready';
      window.sessionStorage.removeItem(storageProbeKey);
      if (!storageProbeWorked) throw new Error('Session storage is unavailable');

      const attemptStorageKey = paymentStorageKey(token, 'attempt');
      const savedAttempt = window.sessionStorage.getItem(attemptStorageKey);
      const parsedAttempt = parseStoredLinkFlowAttempt(savedAttempt);
      if (parsedAttempt) setRealAttempt({ ...parsedAttempt, token });
      else if (savedAttempt) window.sessionStorage.removeItem(attemptStorageKey);

      const requestStorageKey = paymentStorageKey(token, 'idempotency');
      const savedRequestKey = window.sessionStorage.getItem(requestStorageKey);
      const parsedRequestKey = parseStoredLinkFlowIdempotencyKey(savedRequestKey);
      if (parsedRequestKey) setPaymentRequestKey(parsedRequestKey);
      else if (savedRequestKey) window.sessionStorage.removeItem(requestStorageKey);
      setPaymentRecoveryAvailable(true);
    } catch {
      setPaymentRecoveryAvailable(false);
    } finally {
      setStorageHydratedToken(token);
    }
  }, [token]);
  const backgroundArt = typeof document !== 'undefined' ? createPortal(
    <img className="sendflow-public-pay-art" src={linkflowIllustration} alt="" aria-hidden="true" draggable={false} />,
    document.body,
  ) : null;

  useSeo({
    path: `/pay/${token}`,
    locale: 'fr',
    title: link ? `Paiement à ${link.merchantName} · SendFlow` : 'Lien de paiement · SendFlow',
    description: 'Consultez les détails de cette demande de paiement SendFlow.',
    robots: 'noindex,nofollow',
  });

  useEffect(() => {
    if (simulationPhase !== 'waiting' || !simulationOutcome) return;
    const timer = window.setTimeout(() => setSimulationPhase('result'), 1_100);
    return () => window.clearTimeout(timer);
  }, [simulationPhase, simulationOutcome]);

  const confirmedStatus = paymentStatusQuery.data;

  const resetPaymentRequestKey = () => {
    setPaymentRequestKey('');
    try {
      window.sessionStorage.removeItem(paymentStorageKey(token, 'idempotency'));
    } catch { /* session storage is optional; idempotency remains enforced by the server */ }
  };
  const selectCountry = (nextCountryCode: string) => {
    setCountryCode(nextCountryCode);
    setOperatorId('');
    setPhone('');
    resetPaymentRequestKey();
  };
  const beginSimulation = (outcome: 'succeeded' | 'failed') => {
    if (!import.meta.env.DEV || !link?.simulationAvailable || !requestedAmountValid) return;
    simulateMutation.mutate({
      token,
      data: variableAmount ? { amount: payerAmount.trim() } : {},
    }, {
      onSuccess: (confirmation) => {
        if (activeTokenRef.current !== token) return;
        setSimulationConfirmation(confirmation);
        setSimulationOutcome(outcome);
        setSimulationPhase('waiting');
      },
    });
  };
  const startRealPayment = () => {
    if (!link || !country || !operator || !payerFormValid || !link.paymentAvailable || !paymentRecoveryAvailable || !requestedAmountValid) return;
    const idempotencyKey = paymentRequestKey || window.crypto.randomUUID();
    try {
      const requestStorageKey = paymentStorageKey(token, 'idempotency');
      window.sessionStorage.setItem(requestStorageKey, idempotencyKey);
      if (window.sessionStorage.getItem(requestStorageKey) !== idempotencyKey) {
        throw new Error('Could not persist the payment request key');
      }
      setPaymentRecoveryAvailable(true);
    } catch {
      setPaymentRecoveryAvailable(false);
      return;
    }
    setPaymentRequestKey(idempotencyKey);
    startPaymentMutation.mutate({
      token,
      data: {
        ...(variableAmount ? { amount: payerAmount.trim() } : {}),
        countryCode: country.code.toLowerCase(),
        operatorId: operator.id,
        phoneNumber: `${country.phonePrefix}${nationalPhone}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        idempotencyKey,
      },
    }, {
      onSuccess: (attempt) => {
        const activeAttempt = {
          attemptId: attempt.attemptId,
          pollToken: attempt.pollToken,
          token,
          merchantName: attempt.merchantName,
          amountMinor: attempt.amountMinor,
          currency: attempt.currency,
          currencyDecimals: attempt.currencyDecimals,
          ussdCode: attempt.ussdCode,
        };
        try {
          const attemptStorageKey = paymentStorageKey(token, 'attempt');
          const serializedAttempt = JSON.stringify({
            attemptId: attempt.attemptId,
            pollToken: attempt.pollToken,
          });
          window.sessionStorage.setItem(attemptStorageKey, serializedAttempt);
          if (window.sessionStorage.getItem(attemptStorageKey) !== serializedAttempt) {
            throw new Error('Could not persist the payment attempt');
          }
        } catch {
          if (activeTokenRef.current === token) setPaymentRecoveryAvailable(false);
        }
        if (activeTokenRef.current !== token) return;
        setRealAttempt(activeAttempt);
      },
    });
  };

  if (simulationPhase === 'waiting' && link) {
    return (
      <>
        {backgroundArt}
        <LinkFlowPaymentWaiting
          merchantName={simulationConfirmation?.merchantName ?? link.merchantName}
          amountLabel={formatMoney(
            simulationConfirmation?.amountMinor ?? link.amountMinor,
            simulationConfirmation?.currency ?? link.currency,
            simulationConfirmation?.currencyDecimals ?? link.currencyDecimals,
          )}
          ussdCode={null}
          state="waiting"
          simulation
        />
      </>
    );
  }
  if (simulationPhase === 'result' && simulationConfirmation && simulationOutcome) {
    return (
      <>
        {backgroundArt}
        <LinkFlowPaymentOutcome
          outcome={simulationOutcome}
          merchantName={simulationConfirmation.merchantName}
          amountLabel={formatMoney(
            simulationConfirmation.amountMinor,
            simulationConfirmation.currency,
            simulationConfirmation.currencyDecimals,
          )}
          simulation
          onFinish={() => {
            setSimulationConfirmation(null);
            setSimulationOutcome(null);
            setSimulationPhase(null);
          }}
        />
      </>
    );
  }
  if (activeRealAttempt) {
    if (confirmedStatus?.state === 'succeeded' || confirmedStatus?.state === 'failed') {
      return (
        <>
          {backgroundArt}
          <LinkFlowPaymentOutcome
            outcome={confirmedStatus.state}
            merchantName={confirmedStatus.merchantName}
            amountLabel={formatMoney(
              confirmedStatus.amountMinor,
              confirmedStatus.currency,
              confirmedStatus.currencyDecimals,
            )}
            onFinish={() => {
              if (confirmedStatus.state === 'succeeded') {
                window.location.assign(confirmedStatus.returnUrl ?? 'https://sendflow.africa');
                return;
              }
              setRealAttempt(null);
              setPaymentRequestKey('');
              try {
                window.sessionStorage.removeItem(paymentStorageKey(token, 'attempt'));
                window.sessionStorage.removeItem(paymentStorageKey(token, 'idempotency'));
              } catch { /* session storage is optional */ }
              refreshPublicLink();
            }}
          />
        </>
      );
    }
    const waitingDisplay = confirmedStatus ?? activeRealAttempt;
    return (
      <>
        {backgroundArt}
        <LinkFlowPaymentWaiting
          merchantName={waitingDisplay.merchantName ?? link?.merchantName ?? 'SendFlow'}
          amountLabel={waitingDisplay.amountMinor && waitingDisplay.currency && waitingDisplay.currencyDecimals !== undefined
            ? formatMoney(waitingDisplay.amountMinor, waitingDisplay.currency, waitingDisplay.currencyDecimals)
            : link ? formatMoney(link.amountMinor, link.currency, link.currencyDecimals) : '—'}
          ussdCode={waitingDisplay.ussdCode ?? null}
          state={paymentStatusQuery.isError || !paymentRecoveryAvailable || confirmedStatus?.state === 'uncertain' ? 'uncertain' : 'waiting'}
          onRefresh={() => void paymentStatusQuery.refetch()}
          refreshing={paymentStatusQuery.isFetching}
        />
      </>
    );
  }

  if (storageHydratedToken !== token || linkQuery.isLoading || linkQuery.isFetching ||
    !minimumLoadTimeElapsed || loadedPageAssetsKey !== pageAssetsKey) {
    return (
      <main
        className="sendflow-public-link-loading"
        role="status"
        aria-live="polite"
        aria-label="Chargement du lien de paiement"
      >
        <span className="sendflow-public-link-loader" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
      </main>
    );
  }

  if (linkQuery.isError || !link) {
    return (
      <>
        {backgroundArt}
        <main className="sendflow-public-pay-shell">
          <section className="sendflow-public-pay-card sendflow-public-pay-unavailable" role="alert">
            <div className="sendflow-pay-brand"><img className="sendflow-pay-wordmark" src={sendflowWordmark} alt="SendFlow" /></div>
            <img
              className="sendflow-pay-expired-illustration"
              src={linkUnavailableIllustration}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
            <p className="sendflow-pay-overline">LIEN DE PAIEMENT</p>
            <h1>Ce lien n’est pas disponible</h1>
            <p>Il a peut-être expiré ou n’existe plus. Demandez au commerçant de vérifier son lien.</p>
            <button type="button" className="sendflow-pay-retry" onClick={refreshPublicLink}>Réessayer</button>
            <LinkFlowSecureFooter />
          </section>
        </main>
      </>
    );
  }

  const amountLabel = formatMoney(requestedAmountMinor ?? 0, link.currency, link.currencyDecimals);

  return (
    <main className="sendflow-public-pay-shell">
      <div className="sendflow-public-pay-layout">
        <header className="sendflow-pay-brand">
          <img className="sendflow-pay-wordmark" src={sendflowWordmark} alt="SendFlow" />
        </header>

        <h1 className="sendflow-pay-merchant-title" id="public-pay-title">{link.merchantName}</h1>

        <section className="sendflow-public-pay-card" aria-label={`Demande de paiement de ${link.merchantName}`}>
          {link.imagePath && (
            <div className="sendflow-pay-hero-image-wrap">
              <img
                className="sendflow-pay-hero-image"
                src={link.imagePath}
                alt={`Image de paiement pour ${link.merchantName}`}
                loading="eager"
              />
            </div>
          )}

          <div className="sendflow-pay-merchant">
            <div>
              <p className="sendflow-pay-payment-title">Paiement</p>
              {link.description && <p className="sendflow-pay-description">{link.description}</p>}
            </div>
          </div>

          <div className="sendflow-pay-amount-panel" data-testid="public-pay-amount">
            <strong>{amountLabel}</strong>
          </div>

          <div className="sendflow-pay-form">
            {variableAmount && (
              <label className="sendflow-pay-field">
                <span>Montant à payer<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
                <div className="sendflow-pay-payer-amount">
                  <input
                    type="text"
                    inputMode={link.currencyDecimals === 0 ? 'numeric' : 'decimal'}
                    autoComplete="off"
                    value={payerAmount}
                    onChange={(event) => {
                      setPayerAmount(event.target.value);
                      resetPaymentRequestKey();
                    }}
                    placeholder="Saisissez votre montant"
                    aria-invalid={Boolean(payerAmount && !requestedAmountValid)}
                    aria-describedby="public-pay-amount-help"
                    data-testid="input-public-pay-amount"
                  />
                  <b>{link.currency}</b>
                </div>
                <small id="public-pay-amount-help">
                  {payerAmount && !requestedAmountValid
                    ? 'Pour ce paiement, saisissez un montant compris entre 100 et 2 000 000 XOF.'
                    : 'Montant libre : entrez le montant que vous souhaitez payer.'}
                </small>
              </label>
            )}
            <label className="sendflow-pay-field">
              <span>Moyens de paiement</span>
              <select
                value={link.countries.length > 0 ? selectedPaymentMethod : 'unavailable'}
                onChange={(event) => setSelectedPaymentMethod(event.target.value)}
                disabled={link.countries.length === 0}
                className="sendflow-pay-method-select"
                data-testid="select-pay-method"
              >
                {link.countries.length > 0 && <option value="mobile-money">Mobile Money</option>}
                {link.countries.length === 0 && <option value="unavailable">Aucun moyen disponible</option>}
              </select>
            </label>

            {selectedPaymentMethod === 'mobile-money' && link.countries.length > 0 && (
              <>
                <div className="sendflow-pay-field-pair">
                  <label className="sendflow-pay-field">
                    <span>Nom<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
                    <input
                      type="text"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(event) => {
                        setLastName(event.target.value);
                        resetPaymentRequestKey();
                      }}
                      placeholder="Votre nom"
                      data-testid="input-pay-last-name"
                    />
                  </label>
                  <label className="sendflow-pay-field">
                    <span>Prénom(s)<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
                    <input
                      type="text"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(event) => {
                        setFirstName(event.target.value);
                        resetPaymentRequestKey();
                      }}
                      placeholder="Votre prénom"
                      data-testid="input-pay-first-name"
                    />
                  </label>
                </div>

                <label className="sendflow-pay-field">
                  <span>Pays<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
                  <select
                    value={countryCode}
                    onChange={(event) => selectCountry(event.target.value)}
                    data-testid="select-pay-country"
                  >
                    <option value="">Sélectionnez votre pays</option>
                    {link.countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                  </select>
                </label>

                <label className="sendflow-pay-field sendflow-pay-field--reference-centered">
                  <span>Réseau<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
                  <div className="sendflow-pay-select-wrap">
                    <select
                      className={`sendflow-pay-operator-select${operatorId ? ' is-selected' : ''}`}
                      value={operatorId}
                      onChange={(event) => {
                        setOperatorId(event.target.value);
                        resetPaymentRequestKey();
                      }}
                      disabled={!country || country.operators.length === 0}
                      data-testid="select-pay-operator"
                    >
                      <option value="">{country ? 'Choisissez un réseau mobile' : 'Choisissez d’abord un pays'}</option>
                      {country?.operators.map((item) => <option key={item.id} value={item.id}>{item.name.toLocaleUpperCase('fr-FR')}</option>)}
                    </select>
                    <PaymentSelectIndicator />
                  </div>
                </label>

                <label className="sendflow-pay-field sendflow-pay-field--reference-centered">
                  <span>Numéro de téléphone<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
                  <div className="sendflow-pay-phone-input">
                    {country && (
                      <span className="sendflow-pay-phone-flag" role="img" aria-label={country.name} data-testid="pay-country-flag">
                        {country.flag}
                      </span>
                    )}
                    <div className="sendflow-pay-phone-prefix-wrap">
                      <select
                        className="sendflow-pay-phone-prefix"
                        value={countryCode}
                        onChange={(event) => selectCountry(event.target.value)}
                        disabled={!country}
                        aria-label={country ? `Indicatif téléphonique, ${country.name}` : 'Indicatif téléphonique'}
                        data-testid="select-pay-phone-prefix"
                      >
                        {!country && <option value="">+—</option>}
                        {link.countries.map((item) => <option key={item.code} value={item.code}>{item.phonePrefix}</option>)}
                      </select>
                      <PaymentSelectIndicator />
                    </div>
                    <input
                      type="tel"
                      autoComplete="tel-national"
                      inputMode="tel"
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value.replace(/[^\d\s-]/g, ''));
                        resetPaymentRequestKey();
                      }}
                      placeholder={country ? '0500000092' : 'Choisissez votre pays'}
                      disabled={!country}
                      data-testid="input-pay-phone"
                    />
                    {operator && (
                      <span className="sendflow-pay-phone-operator" role="img" aria-label={`Logo ${operator.name}`} data-testid="pay-operator-logo">
                        <OperatorMark
                          key={operator.id}
                          operator={operator}
                          imageClassName="sendflow-pay-operator-logo"
                          fallbackClassName="sendflow-pay-operator-fallback"
                          fallbackLabel={operator.name}
                          fallbackImageUrl={/wave/i.test(operator.name) ? waveOperatorLogo : undefined}
                        />
                      </span>
                    )}
                  </div>
                </label>
              </>
            )}

          </div>

          {previewSimulationAvailable ? (
            <>
              {simulateMutation.isError && (
                <div className="sendflow-pay-inline-error" role="alert">
                  <span>La simulation n’a pas pu être préparée.</span>
                  <button type="button" onClick={() => beginSimulation('succeeded')}>Réessayer</button>
                </div>
              )}
              <button
                type="button"
                className="sendflow-pay-submit is-simulation"
                disabled={simulateMutation.isPending || !payerFormValid}
                onClick={() => beginSimulation('succeeded')}
                data-testid="button-pay-simulate"
              >
                {simulateMutation.isPending ? 'Préparation…' : 'Tester le parcours de paiement'}
              </button>
            </>
          ) : link.paymentAvailable ? (
            <>
              {startPaymentMutation.isError && (
                <div className="sendflow-pay-inline-error" role="alert">
                  <span>
                    {startPaymentMutation.error instanceof Error
                      ? startPaymentMutation.error.message
                      : 'Le paiement n’a pas pu démarrer. Ne recommencez pas si une demande est déjà affichée.'}
                  </span>
                </div>
              )}
              {!paymentRecoveryAvailable && (
                <div className="sendflow-pay-inline-error" role="alert">
                  <span>Le navigateur ne permet pas de sécuriser la reprise. Autorisez le stockage de session puis rechargez cette page.</span>
                </div>
              )}
              <button
                type="button"
                className="sendflow-pay-submit is-live"
                disabled={startPaymentMutation.isPending || !payerFormValid || !paymentRecoveryAvailable}
                onClick={startRealPayment}
                data-testid="button-pay-live"
              >
                {startPaymentMutation.isPending ? 'Connexion au réseau…' : 'Payer'}
              </button>
            </>
          ) : (
            <>
              <div className="sendflow-pay-unavailable-note" role="status" data-testid="status-payment-unavailable">
                <span><ShieldCheck size={18} /></span>
                <p>
                  <strong>{link.paymentAvailable ? 'La confirmation de paiement n’est pas encore activée.' : 'Le paiement en ligne est momentanément indisponible.'}</strong>
                </p>
              </div>
              <button type="button" className="sendflow-pay-submit" disabled aria-disabled="true" data-testid="button-pay-unavailable">
                Paiement indisponible
              </button>
            </>
          )}
          <LinkFlowSecureFooter />
        </section>
      </div>
    </main>
  );
}
