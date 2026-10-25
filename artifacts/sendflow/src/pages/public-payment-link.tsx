import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'wouter';
import { Check, Clock3, LockKeyhole, ShieldCheck, Smartphone } from 'lucide-react';
import {
  getGetPublicPaymentLinkQueryKey,
  getQuotePublicPaymentLinkQueryKey,
  useGetPublicPaymentLink,
  useQuotePublicPaymentLink,
} from '@workspace/api-client-react';
import { useSeo } from '@/lib/seo';
import linkflowIllustration from '@assets/generated_images/sendflow-linkflow-payment-3d.webp';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';

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
  const [email, setEmail] = useState('');

  const link = linkQuery.data;
  const country = link?.countries.find((item) => item.code === countryCode);
  const operator = country?.operators.find((item) => item.id === operatorId);
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
          <span className="sendflow-pay-secure"><LockKeyhole size={13} /> Lien SendFlow</span>
        </header>

        <section className="sendflow-public-pay-card" aria-labelledby="public-pay-title">
          <div className="sendflow-pay-merchant">
            {link.imagePath && <img className="sendflow-pay-merchant-image" src={link.imagePath} alt="" />}
            <div>
              <p className="sendflow-pay-overline">DEMANDE DE PAIEMENT</p>
              <h1 id="public-pay-title">{link.merchantName}</h1>
              {link.description && <p className="sendflow-pay-description">{link.description}</p>}
            </div>
          </div>

          <div className="sendflow-pay-amount-panel" data-testid="public-pay-amount">
            <span>Montant demandé</span>
            <strong>{amountLabel}</strong>
            {expiry && <small><Clock3 size={13} /> Valable jusqu’au {expiry}</small>}
            {link.remainingUses !== null && (
              <small>{link.remainingUses > 0 ? `${link.remainingUses} utilisation${link.remainingUses > 1 ? 's' : ''} restante${link.remainingUses > 1 ? 's' : ''}` : 'Ce lien a atteint sa limite d’utilisations'}</small>
            )}
          </div>

          <div className="sendflow-pay-method">
            <span className="sendflow-pay-method-icon"><Smartphone size={16} /></span>
            <span><small>Moyen de paiement</small><strong>{link.countries.length ? 'Mobile Money' : 'Aucun moyen disponible'}</strong></span>
            <span className="sendflow-pay-method-state">{link.countries.length ? 'Configuré' : 'Indisponible'}</span>
          </div>

          <div className="sendflow-pay-form-heading">
            <div>
              <p className="sendflow-pay-overline">VOS INFORMATIONS</p>
              <h2>Coordonnées du payeur</h2>
            </div>
            <span className="sendflow-pay-step">01 <i /> 02</span>
          </div>

          <div className="sendflow-pay-form">
            <div className="sendflow-pay-field-pair">
              <label className="sendflow-pay-field">
                <span>Prénom</span>
                <input type="text" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Votre prénom" data-testid="input-pay-first-name" />
              </label>
              <label className="sendflow-pay-field">
                <span>Nom</span>
                <input type="text" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Votre nom" data-testid="input-pay-last-name" />
              </label>
            </div>

            <label className="sendflow-pay-field">
              <span>Pays</span>
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
                {link.countries.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.phonePrefix})</option>)}
              </select>
            </label>

            <label className="sendflow-pay-field">
              <span>Réseau mobile</span>
              <select
                value={operatorId}
                onChange={(event) => setOperatorId(event.target.value)}
                disabled={!country || country.operators.length === 0}
                data-testid="select-pay-operator"
              >
                <option value="">{country ? 'Sélectionnez votre réseau' : 'Choisissez d’abord un pays'}</option>
                {country?.operators.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>

            <label className="sendflow-pay-field">
              <span>Téléphone mobile</span>
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

            <label className="sendflow-pay-field">
              <span>E-mail</span>
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nom@exemple.com" data-testid="input-pay-email" />
            </label>
          </div>

          <section className="sendflow-pay-costs" aria-labelledby="pay-cost-title">
            <div className="sendflow-pay-costs-title">
              <h2 id="pay-cost-title">Récapitulatif</h2>
              {quoteQuery.isFetching && <span className="sendflow-pay-quote-loading" role="status">Calcul des frais…</span>}
            </div>
            <div className="sendflow-pay-cost-row"><span>Montant</span><strong>{quoteQuery.data ? formatMoney(quoteQuery.data.amountMinor, quoteQuery.data.currency, link.currencyDecimals) : amountLabel}</strong></div>
            <div className="sendflow-pay-cost-row"><span>Frais de paiement{operator ? ` · ${operator.name}` : ''}</span><strong>{quoteQuery.data ? formatMoney(quoteQuery.data.feeMinor, quoteQuery.data.currency, link.currencyDecimals) : '—'}</strong></div>
            <div className="sendflow-pay-cost-row is-total"><span>Total à régler</span><strong>{quoteQuery.data ? formatMoney(quoteQuery.data.totalMinor, quoteQuery.data.currency, link.currencyDecimals) : '—'}</strong></div>
            {quoteQuery.isError && (
              <div className="sendflow-pay-quote-error" role="alert">
                <span>Les frais ne peuvent pas être calculés pour ce choix.</span>
                <button type="button" onClick={() => quoteQuery.refetch()} data-testid="button-pay-quote-retry">Réessayer</button>
              </div>
            )}
            {!countryCode || !operatorId ? <p className="sendflow-pay-quote-hint">Choisissez un pays et un réseau pour afficher les frais exacts.</p> : null}
          </section>

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
          <footer className="sendflow-pay-footer"><Check size={14} /> Les tarifs affichés sont calculés par SendFlow selon le réseau sélectionné.</footer>
        </section>
        <p className="sendflow-pay-legal">Les informations saisies restent sur cet appareil et ne sont pas transmises.</p>
      </div>
    </main>
  );
}
