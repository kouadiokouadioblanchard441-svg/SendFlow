import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'wouter';
import { Check, Clock3, ShieldCheck } from 'lucide-react';
import {
  getGetPublicPaymentLinkQueryKey,
  getQuotePublicPaymentLinkQueryKey,
  useGetPublicPaymentLink,
  useQuotePublicPaymentLink,
  useSimulateCustomerPaymentLink,
} from '@workspace/api-client-react';
import type { SimulatedPaymentLinkSuccess } from '@workspace/api-client-react';
import { useSeo } from '@/lib/seo';
import linkflowIllustration from '@assets/generated_images/sendflow-linkflow-payment-3d.webp';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import LinkFlowPaymentSuccess from '@/components/linkflow-payment-success';

function formatMoney(minor: number, currency: string, decimals: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(minor / (10 ** decimals));
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function PublicPaymentLinkPage() {
  const { token = '' } = useParams<{ token: string }>();
  const linkQuery = useGetPublicPaymentLink(token, {
    query: { queryKey: getGetPublicPaymentLinkQueryKey(token), retry: false },
  });
  const [countryCode, setCountryCode] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [simulationConfirmation, setSimulationConfirmation] = useState<SimulatedPaymentLinkSuccess | null>(null);
  const simulateMutation = useSimulateCustomerPaymentLink();

  const link = linkQuery.data;
  const country = link?.countries.find((item) => item.code === countryCode);
  const quoteQuery = useQuotePublicPaymentLink(token, countryCode, operatorId, {
    query: {
      enabled: Boolean(token && countryCode && operatorId),
      queryKey: getQuotePublicPaymentLinkQueryKey(token, countryCode, operatorId),
      retry: false,
    },
  });
  const expiry = formatDate(link?.expiresAt ?? null);
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

  if (simulationConfirmation) {
    return (
      <LinkFlowPaymentSuccess
        confirmation={simulationConfirmation}
        onFinish={() => setSimulationConfirmation(null)}
      />
    );
  }

  if (linkQuery.isLoading) {
    return (
      <>
        {backgroundArt}
        <main className="sendflow-public-pay-shell">
          <section className="sendflow-public-pay-card" aria-label="Chargement du lien de paiement">
            <div className="sendflow-pay-skeleton-brand" />
            <div className="sendflow-pay-skeleton-line" />
            <div className="sendflow-pay-skeleton-line is-short" />
            <div className="sendflow-pay-skeleton-panel" />
            <div className="sendflow-pay-skeleton-panel" />
          </section>
        </main>
      </>
    );
  }

  if (linkQuery.isError || !link) {
    return (
      <>
        {backgroundArt}
        <main className="sendflow-public-pay-shell">
          <section className="sendflow-public-pay-card sendflow-public-pay-unavailable" role="alert">
            <div className="sendflow-pay-brand"><img className="sendflow-pay-wordmark" src={sendflowWordmark} alt="SendFlow" /></div>
            <span className="sendflow-pay-state-mark"><Clock3 size={22} /></span>
            <p className="sendflow-pay-overline">LIEN DE PAIEMENT</p>
            <h1>Ce lien n’est pas disponible</h1>
            <p>Il a peut-être expiré ou n’existe plus. Demandez au commerçant de vérifier son lien.</p>
            <button type="button" className="sendflow-pay-retry" onClick={() => linkQuery.refetch()}>Réessayer</button>
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
            {quoteQuery.data ? (
              <p className="sendflow-pay-fee-intro">
                {quoteQuery.data.feeMinor > 0
                  ? `${formatMoney(quoteQuery.data.feeMinor, quoteQuery.data.currency, link.currencyDecimals)} de frais supplémentaires seront inclus. Montant total : ${formatMoney(quoteQuery.data.totalMinor, quoteQuery.data.currency, link.currencyDecimals)}.`
                  : `Aucun frais supplémentaire. Montant total : ${formatMoney(quoteQuery.data.totalMinor, quoteQuery.data.currency, link.currencyDecimals)}.`}
              </p>
            ) : (
              <p className="sendflow-pay-fee-intro" role={quoteQuery.isFetching ? 'status' : undefined}>
                {quoteQuery.isFetching ? 'Calcul des frais…' : 'Les frais exacts seront affichés après le choix du réseau.'}
              </p>
            )}
            <strong>{amountLabel}</strong>
            {expiry && <small><Clock3 size={13} /> Valable jusqu’au {expiry}</small>}
            {link.remainingUses !== null && (
              <small>{link.remainingUses > 0 ? `${link.remainingUses} utilisation${link.remainingUses > 1 ? 's' : ''} restante${link.remainingUses > 1 ? 's' : ''}` : 'Ce lien a atteint sa limite d’utilisations'}</small>
            )}
          </div>

          <div className="sendflow-pay-form">
            <label className="sendflow-pay-field">
              <span>Moyens de paiement</span>
              <select
                defaultValue={link.simulationAvailable ? 'simulation' : link.countries.length ? 'mobile-money' : 'unavailable'}
                disabled={!link.simulationAvailable && link.countries.length === 0}
                className="sendflow-pay-method-select"
                data-testid="select-pay-method"
              >
                {link.simulationAvailable && <option value="simulation">Simulation de test (aucun paiement réel)</option>}
                {link.countries.length > 0 && <option value="mobile-money">Mobile Money</option>}
                {!link.simulationAvailable && link.countries.length === 0 && <option value="unavailable">Aucun moyen disponible</option>}
              </select>
            </label>

            <div className="sendflow-pay-field-pair">
              <label className="sendflow-pay-field">
                <span>Nom<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
                <input type="text" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Votre nom" data-testid="input-pay-last-name" />
              </label>
              <label className="sendflow-pay-field">
                <span>Prénom(s)<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
                <input type="text" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Votre prénom" data-testid="input-pay-first-name" />
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
                onChange={(event) => setOperatorId(event.target.value)}
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
                <span aria-hidden="true">{country?.phonePrefix ?? '+—'}</span>
                <input
                  type="tel"
                  autoComplete="tel-national"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/[^\d\s-]/g, ''))}
                  placeholder={country ? 'Votre numéro' : 'Choisissez votre pays'}
                  disabled={!country}
                  data-testid="input-pay-phone"
                />
              </div>
              {country && <small>{country.minPhoneDigits} à {country.maxPhoneDigits} chiffres, sans indicatif</small>}
            </label>

          </div>

          {quoteQuery.isError && (
            <div className="sendflow-pay-quote-error" role="alert">
              <span>Les frais ne peuvent pas être calculés pour ce choix.</span>
              <button type="button" onClick={() => quoteQuery.refetch()} data-testid="button-pay-quote-retry">Réessayer</button>
            </div>
          )}

          {link.simulationAvailable ? (
            <>
              <div className="sendflow-pay-simulation-note" role="status" data-testid="status-payment-simulation">
                <ShieldCheck size={15} />
                <span>Compte de visualisation · simulation sans paiement réel</span>
              </div>
              {simulateMutation.isError && (
                <div className="sendflow-pay-quote-error" role="alert">
                  <span>La simulation n’a pas pu être préparée.</span>
                  <button type="button" onClick={() => simulateMutation.mutate({ token }, {
                    onSuccess: setSimulationConfirmation,
                  })}>Réessayer</button>
                </div>
              )}
              <button
                type="button"
                className="sendflow-pay-submit is-simulation"
                disabled={simulateMutation.isPending}
                onClick={() => simulateMutation.mutate({ token }, {
                  onSuccess: setSimulationConfirmation,
                })}
                data-testid="button-pay-simulate"
              >
                {simulateMutation.isPending ? 'Préparation…' : 'Voir le résultat de test'}
              </button>
            </>
          ) : (
            <>
              <div className="sendflow-pay-unavailable-note" role="status" data-testid="status-payment-unavailable">
                <span><ShieldCheck size={18} /></span>
                <p>
                  <strong>{link.paymentAvailable ? 'La confirmation de paiement n’est pas encore activée.' : 'Le paiement en ligne est momentanément indisponible.'}</strong>
                  Vos informations restent sur cet appareil et ne sont pas envoyées.
                </p>
              </div>
              <button type="button" className="sendflow-pay-submit" disabled aria-disabled="true" data-testid="button-pay-unavailable">
                Paiement indisponible
              </button>
            </>
          )}
          <footer className="sendflow-pay-footer"><Check size={14} /> Les tarifs affichés sont calculés par SendFlow selon le réseau sélectionné.</footer>
        </section>
        <p className="sendflow-pay-legal">Les informations saisies restent sur cet appareil et ne sont pas transmises.</p>
      </div>
    </main>
  );
}
