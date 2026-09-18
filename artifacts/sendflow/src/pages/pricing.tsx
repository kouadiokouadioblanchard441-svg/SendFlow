import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronRight,
  Globe2,
  Store,
  X,
} from 'lucide-react';
import { Redirect, useLocation } from 'wouter';
import { useSeo } from '@/lib/seo';
import {
  pricingFeeRate,
  pricingProvider,
  type PricingCategoryId,
  type PricingCountry,
  type PricingOperator,
} from '@/lib/pricing';
import waveLogo from '@assets/generated_images/sendflow-wave-logo.png';

function OperatorMark({ operator }: { operator: PricingOperator }) {
  if (operator.brand === 'wave') return <img src={waveLogo} alt="" />;
  return <strong>{operator.initials}</strong>;
}

function CategoryIcon({ categoryId }: { categoryId: PricingCategoryId }) {
  if (categoryId === 'deposit') return <Store size={19} strokeWidth={2.1} />;
  if (categoryId === 'inter-network') return <ArrowLeftRight size={19} strokeWidth={2.1} />;
  return <Globe2 size={19} strokeWidth={2.1} />;
}

export default function PricingPage() {
  const [, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const { categories, countries } = pricingProvider.getCatalog();
  const [categoryId, setCategoryId] = useState<PricingCategoryId>('deposit');
  const [countryId, setCountryId] = useState('ci');
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  const country = countries.find((item) => item.id === countryId) ?? countries[0];
  const category = categories.find((item) => item.id === categoryId) ?? categories[0];
  const listedOperators = useMemo(
    () => pricingProvider.getOperators(country.id, category.id),
    [country.id, category.id],
  );

  useSeo({
    path: '/pricing',
    locale: 'fr',
    title: 'Tarification · SendFlow',
    description: 'Consultez les frais SendFlow par pays, catégorie et opérateur.',
    robots: 'noindex,nofollow',
  });

  useEffect(() => {
    if (!isUnlocked) setLocation('/sign-in');
  }, [isUnlocked, setLocation]);

  useEffect(() => {
    if (!countryPickerOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCountryPickerOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [countryPickerOpen]);

  if (!isUnlocked) return <Redirect to="/sign-in" />;

  const selectCountry = (nextCountry: PricingCountry) => {
    setCountryId(nextCountry.id);
    setCountryPickerOpen(false);
  };

  return (
    <main className="sendflow-pricing-shell">
      <header className="sendflow-pricing-header">
        <button
          type="button"
          className="sendflow-pricing-back"
          onClick={() => setLocation('/account')}
          aria-label="Retour au compte"
          data-testid="button-pricing-back"
        >
          <ArrowLeft size={22} strokeWidth={2.15} />
        </button>
        <h1 data-testid="text-pricing-title">Tarification</h1>
        <span className="sendflow-pricing-header-spacer" aria-hidden="true" />
      </header>

      <div className="sendflow-pricing-content">
        <section className="sendflow-pricing-tabs-wrap" aria-label="Catégorie de tarification">
          <div className="sendflow-pricing-tabs" role="tablist">
            {categories.map((item) => (
              <button
                type="button"
                role="tab"
                key={item.id}
                aria-selected={categoryId === item.id}
                className={`sendflow-pricing-tab${categoryId === item.id ? ' is-active' : ''}`}
                onClick={() => setCategoryId(item.id)}
                data-testid={`button-pricing-category-${item.id}`}
              >
                <span className="sendflow-pricing-tab-icon" aria-hidden="true">
                  <CategoryIcon categoryId={item.id} />
                </span>
                <span>{item.shortLabel}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="sendflow-pricing-country-section" aria-labelledby="pricing-country-label">
          <span id="pricing-country-label" className="sendflow-pricing-eyebrow">Pays</span>
          <button
            type="button"
            className="sendflow-pricing-country-button"
            onClick={() => setCountryPickerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={countryPickerOpen}
            data-testid="button-pricing-country"
          >
            <span className="sendflow-pricing-country-badge" aria-hidden="true">
              <span className="sendflow-pricing-country-flag">{country.flag}</span>
            </span>
            <span className="sendflow-pricing-country-copy">
              <strong data-testid="text-pricing-country">{country.name}</strong>
              <small>{category.description}</small>
            </span>
            <ChevronDown size={20} aria-hidden="true" />
          </button>
        </section>

        <section className="sendflow-pricing-list-section" aria-labelledby="pricing-operators-title">
          <div className="sendflow-pricing-section-heading">
            <div>
              <span className="sendflow-pricing-eyebrow">Frais SendFlow</span>
              <h2 id="pricing-operators-title" data-testid="text-pricing-list-title">{category.label}</h2>
            </div>
            <span className="sendflow-pricing-rate-note">{Math.round(pricingFeeRate * 100)} % temporaire</span>
          </div>
          <div className="sendflow-pricing-operator-list">
            {listedOperators.length > 0 ? listedOperators.map((operator) => (
              <article className="sendflow-pricing-operator-row" key={operator.id} data-testid={`row-pricing-operator-${operator.id}`}>
                <span className={`sendflow-pricing-operator-mark is-${operator.brand}`} aria-hidden="true">
                  <OperatorMark operator={operator} />
                </span>
                <span className="sendflow-pricing-operator-name">
                  <strong>{operator.name}</strong>
                  <span className="sendflow-pricing-fee">
                    <strong data-testid={`text-pricing-fee-${operator.id}`}>{operator.feeLabel}</strong>
                    <small>par opération</small>
                  </span>
                </span>
              </article>
            )) : (
              <div className="sendflow-pricing-empty" role="status" data-testid="status-pricing-empty">
                Aucun opérateur n’est encore disponible pour cette sélection.
              </div>
            )}
          </div>
        </section>

        <p className="sendflow-pricing-footnote" data-testid="text-pricing-footnote">
          Les frais affichés sont temporaires et sont présentés avant chaque confirmation.
        </p>
      </div>

      {countryPickerOpen && (
        <div className="sendflow-pricing-picker" role="presentation" onClick={() => setCountryPickerOpen(false)}>
          <section
            className="sendflow-pricing-country-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-country-sheet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sendflow-pricing-sheet-header">
              <div>
                <span className="sendflow-pricing-eyebrow">SendFlow</span>
                <h2 id="pricing-country-sheet-title">Choisir un pays</h2>
              </div>
              <button
                type="button"
                className="sendflow-pricing-close"
                onClick={() => setCountryPickerOpen(false)}
                aria-label="Fermer la sélection du pays"
                data-testid="button-close-pricing-country"
              >
                <X size={20} />
              </button>
            </div>
            <div className="sendflow-pricing-country-list">
              {countries.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`sendflow-pricing-country-option${item.id === country.id ? ' is-selected' : ''}`}
                  onClick={() => selectCountry(item)}
                  data-testid={`button-pricing-country-${item.id}`}
                >
                  <span className="sendflow-pricing-country-badge" aria-hidden="true">
                    <span className="sendflow-pricing-country-flag">{item.flag}</span>
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.dialCode}</small>
                  </span>
                  {item.id === country.id && <Check size={19} aria-hidden="true" />}
                  {item.id !== country.id && <ChevronRight size={18} aria-hidden="true" />}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}