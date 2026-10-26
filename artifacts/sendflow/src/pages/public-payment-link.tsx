import { useEffect, useState } from 'react';
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
import { OperatorMark } from '@/components/operator-mark';
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

function paymentStorageKey(token: string, suffix: string) {
  return `sendflow:linkflow:${token}:${suffix}`;
}

const MIN_LINK_LOADING_MS = 1000;

type ActivePaymentAttempt = Pick<PublicPaymentLinkAttemptCreated, 'attemptId' | 'pollToken'>
  & Partial<Pick<PublicPaymentLinkAttemptCreated, 'merchantName' | 'amountMinor' | 'currency' | 'currencyDecimals' | 'ussdCode'>>;

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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('mobile-money');
  const [simulationConfirmation, setSimulationConfirmation] = useState<SimulatedPaymentLinkSuccess | null>(null);
  const [simulationOutcome, setSimulationOutcome] = useState<'succeeded' | 'failed' | null>(null);
  const [simulationPhase, setSimulationPhase] = useState<'waiting' | 'result' | null>(null);
  const [realAttempt, setRealAttempt] = useState<ActivePaymentAttempt | null>(null);
  const [paymentRequestKey, setPaymentRequestKey] = useState('');
  const simulateMutation = useSimulateCustomerPaymentLink();
  const startPaymentMutation = useStartPublicPaymentLinkAttempt();

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
  const payerFormValid = Boolean(
    country &&
    operator &&
    firstName.trim() &&
    lastName.trim() &&
    nationalPhone.length >= (country?.minPhoneDigits ?? 99) &&
    nationalPhone.length <= (country?.maxPhoneDigits ?? 0),
  );
  const paymentStatusQuery = useQuery({
    queryKey: ['public-linkflow-attempt-status', realAttempt?.attemptId],
    queryFn: ({ signal }) => getPublicPaymentLinkAttemptStatus(realAttempt!.attemptId, {
      signal,
      headers: { 'X-LinkFlow-Attempt-Token': realAttempt!.pollToken },
    }),
    enabled: Boolean(realAttempt),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === 'succeeded' || state === 'failed' ? false : 4_000;
    },
  });
  useEffect(() => {
    setRealAttempt(null);
    try {
      const saved = window.sessionStorage.getItem(paymentStorageKey(token, 'attempt'));
      if (saved) {
        const parsed = JSON.parse(saved) as PublicPaymentLinkAttemptCreated;
        if (/^[0-9a-f-]{36}$/i.test(parsed.attemptId) && /^[a-f0-9]{64}$/.test(parsed.pollToken)) {
          setRealAttempt({ attemptId: parsed.attemptId, pollToken: parsed.pollToken });
        } else {
          window.sessionStorage.removeItem(paymentStorageKey(token, 'attempt'));
        }
      }
      const savedRequestKey = window.sessionStorage.getItem(paymentStorageKey(token, 'idempotency'));
      if (savedRequestKey && /^[0-9a-f-]{36}$/i.test(savedRequestKey)) setPaymentRequestKey(savedRequestKey);
    } catch {
      // Storage can be unavailable in private browsing; server idempotency still protects retries.
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
  const beginSimulation = (outcome: 'succeeded' | 'failed') => {
    if (!import.meta.env.DEV || !link?.simulationAvailable) return;
    simulateMutation.mutate({ token }, {
      onSuccess: (confirmation) => {
        setSimulationConfirmation(confirmation);
        setSimulationOutcome(outcome);
        setSimulationPhase('waiting');
      },
    });
  };
  const startRealPayment = () => {
    if (!link || !country || !operator || !payerFormValid || !link.paymentAvailable) return;
    const idempotencyKey = paymentRequestKey || window.crypto.randomUUID();
    setPaymentRequestKey(idempotencyKey);
    try {
      window.sessionStorage.setItem(paymentStorageKey(token, 'idempotency'), idempotencyKey);
    } catch { /* session storage is optional; the request key remains active in memory */ }
    startPaymentMutation.mutate({
      token,
      data: {
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
          merchantName: attempt.merchantName,
          amountMinor: attempt.amountMinor,
          currency: attempt.currency,
          currencyDecimals: attempt.currencyDecimals,
          ussdCode: attempt.ussdCode,
        };
        setRealAttempt(activeAttempt);
        try {
          window.sessionStorage.setItem(paymentStorageKey(token, 'attempt'), JSON.stringify({
            attemptId: attempt.attemptId,
            pollToken: attempt.pollToken,
          }));
        } catch { /* the attempt remains active for the current page session */ }
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
  if (realAttempt) {
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
    const waitingDisplay = confirmedStatus ?? realAttempt;
    return (
      <>
        {backgroundArt}
        <LinkFlowPaymentWaiting
          merchantName={waitingDisplay.merchantName ?? link?.merchantName ?? 'SendFlow'}
          amountLabel={waitingDisplay.amountMinor && waitingDisplay.currency && waitingDisplay.currencyDecimals !== undefined
            ? formatMoney(waitingDisplay.amountMinor, waitingDisplay.currency, waitingDisplay.currencyDecimals)
            : link ? formatMoney(link.amountMinor, link.currency, link.currencyDecimals) : '—'}
          ussdCode={waitingDisplay.ussdCode ?? null}
          state={paymentStatusQuery.isError || confirmedStatus?.state === 'uncertain' ? 'uncertain' : 'waiting'}
          onRefresh={() => void paymentStatusQuery.refetch()}
          refreshing={paymentStatusQuery.isFetching}
        />
      </>
    );
  }

  if (linkQuery.isLoading || linkQuery.isFetching || !minimumLoadTimeElapsed || loadedPageAssetsKey !== pageAssetsKey) {
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

  const amountLabel = formatMoney(link.amountMinor, link.currency, link.currencyDecimals);

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
                    onChange={(event) => {
                      setCountryCode(event.target.value);
                      setOperatorId('');
                      setPhone('');
                      resetPaymentRequestKey();
                    }}
                    data-testid="select-pay-country"
                  >
                    <option value="">Sélectionnez votre pays</option>
                    {link.countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                  </select>
                </label>

                <label className="sendflow-pay-field">
                  <span>Réseau<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
                  <select
                    value={operatorId}
                    onChange={(event) => {
                      setOperatorId(event.target.value);
                      resetPaymentRequestKey();
                    }}
                    disabled={!country || country.operators.length === 0}
                    data-testid="select-pay-operator"
                  >
                    <option value="">{country ? 'Choisissez un réseau mobile' : 'Choisissez d’abord un pays'}</option>
                    {country?.operators.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>

                <label className="sendflow-pay-field">
                  <span>Numéro de téléphone<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
                  <div className="sendflow-pay-phone-input">
                    {country && (
                      <span className="sendflow-pay-phone-flag" role="img" aria-label={country.name} data-testid="pay-country-flag">
                        {country.flag}
                      </span>
                    )}
                    <span className="sendflow-pay-phone-prefix" aria-hidden="true">{country?.phonePrefix ?? '+—'}</span>
                    <input
                      type="tel"
                      autoComplete="tel-national"
                      inputMode="tel"
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value.replace(/[^\d\s-]/g, ''));
                        resetPaymentRequestKey();
                      }}
                      placeholder={country ? 'Votre numéro' : 'Choisissez votre pays'}
                      disabled={!country}
                      data-testid="input-pay-phone"
                    />
                    {operator && (
                      <span className="sendflow-pay-phone-operator" role="img" aria-label={`Logo ${operator.name}`} data-testid="pay-operator-logo">
                        <OperatorMark
                          operator={operator}
                          imageClassName="sendflow-pay-operator-logo"
                          fallbackClassName="sendflow-pay-operator-fallback"
                          fallbackLabel={operator.name}
                        />
                      </span>
                    )}
                  </div>
                  {country && <small>{country.minPhoneDigits} à {country.maxPhoneDigits} chiffres, sans indicatif</small>}
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
              <button
                type="button"
                className="sendflow-pay-simulate-failure"
                disabled={simulateMutation.isPending || !payerFormValid}
                onClick={() => beginSimulation('failed')}
              >
                Tester l’écran « Paiement non confirmé »
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
              <button
                type="button"
                className="sendflow-pay-submit is-live"
                disabled={startPaymentMutation.isPending || !payerFormValid}
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
