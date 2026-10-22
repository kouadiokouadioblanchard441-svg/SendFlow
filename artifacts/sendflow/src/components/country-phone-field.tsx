import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { getGetAuthCountriesQueryKey, useGetAuthCountries } from '@workspace/api-client-react';
import { DEFAULT_ACCOUNT_COUNTRY } from '@/lib/account-country';
import { normalizePhoneDigits } from '@/lib/phone-rules';

export type CountryOption = {
  countryCode: string;
  name: string;
  dialCode: string;
  flag: string;
  minPhoneDigits: number;
  maxPhoneDigits: number;
};

type CountryPhoneFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onCountryChange?: (country: CountryOption) => void;
  error?: string;
  onBlur?: () => void;
  defaultCountryName?: string;
  registrationOnly?: boolean;
};

export function CountryPhoneField({
  value, onChange, onCountryChange, error, onBlur,
  defaultCountryName = DEFAULT_ACCOUNT_COUNTRY.name, registrationOnly = false,
}: CountryPhoneFieldProps) {
  const catalog = useGetAuthCountries({
    query: {
      queryKey: getGetAuthCountriesQueryKey(),
      staleTime: 0, refetchInterval: 30_000, refetchOnWindowFocus: true,
    },
  });
  const countries = useMemo<CountryOption[]>(() => (catalog.data?.countries ?? [])
    .filter((country) => !registrationOnly || country.enabled)
    .map((country) => ({
      countryCode: country.countryCode, name: country.countryName,
      dialCode: country.phonePrefix, flag: country.flag,
      minPhoneDigits: country.minPhoneDigits, maxPhoneDigits: country.maxPhoneDigits,
    })), [catalog.data, registrationOnly]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const selectedCountry = countries.find((country) => country.countryCode === selectedCode)
    ?? countries.find((country) => country.name === defaultCountryName)
    ?? countries[0];
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);
  const callbackRef = useRef(onCountryChange);
  callbackRef.current = onCountryChange;
  const inputId = useId();
  const selectedIdentity = selectedCountry ? `${selectedCountry.countryCode}:${selectedCountry.dialCode}` : '';
  useEffect(() => {
    if (selectedCountry) callbackRef.current?.(selectedCountry);
  }, [selectedIdentity]);

  const filteredCountries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr-FR');
    return countries.filter((country) =>
      `${country.name} ${country.dialCode}`.toLocaleLowerCase('fr-FR').includes(normalizedQuery));
  }, [countries, query]);

  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    const pageScrollY = window.scrollY;
    const previous = {
      bodyOverflow: document.body.style.overflow,
      bodyOverscroll: document.body.style.overscrollBehavior,
      bodyPosition: document.body.style.position, bodyTop: document.body.style.top,
      bodyLeft: document.body.style.left, bodyRight: document.body.style.right,
      bodyWidth: document.body.style.width, rootOverflow: root.style.overflow,
      rootOverscroll: root.style.overscrollBehavior,
    };
    const signupShell = document.querySelector<HTMLElement>('.sendflow-signup-shell');
    const shellPrevious = signupShell ? {
      overflow: signupShell.style.overflow, overscroll: signupShell.style.overscrollBehavior,
      touchAction: signupShell.style.touchAction, scrollTop: signupShell.scrollTop,
    } : undefined;
    root.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';
    Object.assign(document.body.style, {
      position: 'fixed', top: `-${pageScrollY}px`, left: '0', right: '0', width: '100%',
      overflow: 'hidden', overscrollBehavior: 'none',
    });
    if (signupShell) Object.assign(signupShell.style, {
      overflow: 'hidden', overscrollBehavior: 'none', touchAction: 'none',
    });
    if (!window.matchMedia?.('(pointer: coarse)').matches) {
      requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
    }
    const preventBackgroundScroll = (event: TouchEvent | WheelEvent) => {
      if (event.target instanceof Element && event.target.closest('.sendflow-country-list')) return;
      event.preventDefault();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('touchmove', preventBackgroundScroll, { passive: false });
    document.addEventListener('wheel', preventBackgroundScroll, { passive: false });
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      Object.assign(document.body.style, {
        overflow: previous.bodyOverflow, overscrollBehavior: previous.bodyOverscroll,
        position: previous.bodyPosition, top: previous.bodyTop, left: previous.bodyLeft,
        right: previous.bodyRight, width: previous.bodyWidth,
      });
      root.style.overflow = previous.rootOverflow;
      root.style.overscrollBehavior = previous.rootOverscroll;
      if (signupShell && shellPrevious) {
        Object.assign(signupShell.style, {
          overflow: shellPrevious.overflow, overscrollBehavior: shellPrevious.overscroll,
          touchAction: shellPrevious.touchAction,
        });
        signupShell.scrollTop = shellPrevious.scrollTop;
      }
      document.removeEventListener('touchmove', preventBackgroundScroll);
      document.removeEventListener('wheel', preventBackgroundScroll);
      window.removeEventListener('keydown', closeOnEscape);
      window.scrollTo(0, pageScrollY);
    };
  }, [isOpen]);

  const selectCountry = (country: CountryOption) => {
    setSelectedCode(country.countryCode);
    onChange(normalizePhoneDigits(value).slice(0, country.maxPhoneDigits));
    setIsOpen(false);
    setQuery('');
    requestAnimationFrame(() => pickerTriggerRef.current?.focus());
  };
  const maxPhoneDigits = selectedCountry?.maxPhoneDigits ?? 15;
  const displayedCountry = selectedCountry ?? DEFAULT_ACCOUNT_COUNTRY;
  const displayedError = error || (catalog.isError
    ? 'La liste des pays est temporairement indisponible.'
    : !catalog.isLoading && !selectedCountry ? 'Aucun pays n’est disponible pour le moment.' : undefined);

  return (
    <>
      <div className="sendflow-signup-control">
        <div className={`sendflow-signup-phone${displayedError ? ' has-error' : ''}`}>
          <label className="sr-only" htmlFor={inputId}>Numéro de téléphone</label>
          <button type="button" className="sendflow-signup-country" ref={pickerTriggerRef}
            onClick={() => { setQuery(''); setIsOpen(true); }} disabled={!selectedCountry}
            aria-haspopup="dialog" aria-expanded={isOpen}
            aria-label={`Pays sélectionné : ${displayedCountry.name}, ${displayedCountry.dialCode}. Ouvrir la liste`}>
            <span aria-hidden="true">{displayedCountry.flag}</span>
            <span>{displayedCountry.dialCode}</span>
          </button>
          <input id={inputId} type="tel" value={value}
            onChange={(event) => onChange(normalizePhoneDigits(event.target.value).slice(0, maxPhoneDigits))}
            onBlur={onBlur} placeholder="Numéro de téléphone" autoComplete="tel" inputMode="tel"
            maxLength={maxPhoneDigits} minLength={selectedCountry?.minPhoneDigits}
            disabled={!selectedCountry} aria-invalid={Boolean(displayedError)}
            aria-describedby={displayedError ? `${inputId}-error` : undefined} required />
        </div>
        {displayedError && <p id={`${inputId}-error`} className="sendflow-signup-error" role="alert">{displayedError}</p>}
      </div>
      {isOpen && createPortal(
        <div className="sendflow-country-picker" role="presentation">
          <button type="button" className="sendflow-country-picker-backdrop"
            aria-label="Fermer le sélectionneur de pays" onClick={() => setIsOpen(false)} />
          <section className="sendflow-country-sheet" role="dialog" aria-modal="true" aria-label="Sélectionner un pays">
            <div className="sendflow-country-search">
              <Search size={28} strokeWidth={1.8} aria-hidden="true" />
              <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un pays..." aria-label="Rechercher un pays" />
            </div>
            <div className="sendflow-country-list">
              {filteredCountries.length > 0 ? filteredCountries.map((country) => (
                <button type="button" key={country.countryCode}
                  className={`sendflow-country-option${country.countryCode === selectedCountry?.countryCode ? ' is-selected' : ''}`}
                  onClick={() => selectCountry(country)}>
                  <span className="sendflow-country-option-flag" aria-hidden="true">{country.flag}</span>
                  <span className="sendflow-country-option-name">{country.name}</span>
                  <span className="sendflow-country-option-code">({country.dialCode})</span>
                </button>
              )) : <p className="sendflow-country-empty">Aucun pays trouvé</p>}
            </div>
            <div className="sendflow-country-actions">
              <button type="button" className="sendflow-country-close" onClick={() => setIsOpen(false)}
                aria-label="Fermer le sélectionneur de pays"><X size={26} strokeWidth={1.7} /></button>
            </div>
          </section>
        </div>, document.body,
      )}
    </>
  );
}
