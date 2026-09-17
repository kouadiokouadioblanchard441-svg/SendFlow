import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export type CountryOption = {
  name: string;
  dialCode: string;
  flag: string;
};

const countries: CountryOption[] = [
  { name: 'Afrique du Sud', dialCode: '+27', flag: '🇿🇦' },
  { name: 'Albanie', dialCode: '+355', flag: '🇦🇱' },
  { name: 'Algérie', dialCode: '+213', flag: '🇩🇿' },
  { name: 'Allemagne', dialCode: '+49', flag: '🇩🇪' },
  { name: 'Andorre', dialCode: '+376', flag: '🇦🇩' },
  { name: 'Angola', dialCode: '+244', flag: '🇦🇴' },
  { name: 'Antigua-et-Barbuda', dialCode: '+1268', flag: '🇦🇬' },
  { name: 'Arabie Saoudite', dialCode: '+966', flag: '🇸🇦' },
  { name: 'Argentine', dialCode: '+54', flag: '🇦🇷' },
  { name: 'Arménie', dialCode: '+374', flag: '🇦🇲' },
  { name: 'Australie', dialCode: '+61', flag: '🇦🇺' },
  { name: 'Autriche', dialCode: '+43', flag: '🇦🇹' },
  { name: 'Azerbaïdjan', dialCode: '+994', flag: '🇦🇿' },
  { name: 'Bahamas', dialCode: '+1242', flag: '🇧🇸' },
  { name: 'Bahreïn', dialCode: '+973', flag: '🇧🇭' },
  { name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩' },
  { name: 'Barbade', dialCode: '+1246', flag: '🇧🇧' },
  { name: 'Belgique', dialCode: '+32', flag: '🇧🇪' },
  { name: 'Bénin', dialCode: '+229', flag: '🇧🇯' },
  { name: 'Bolivie', dialCode: '+591', flag: '🇧🇴' },
  { name: 'Bosnie-Herzégovine', dialCode: '+387', flag: '🇧🇦' },
  { name: 'Botswana', dialCode: '+267', flag: '🇧🇼' },
  { name: 'Brésil', dialCode: '+55', flag: '🇧🇷' },
  { name: 'Burkina Faso', dialCode: '+226', flag: '🇧🇫' },
  { name: 'Burundi', dialCode: '+257', flag: '🇧🇮' },
  { name: 'Cameroun', dialCode: '+237', flag: '🇨🇲' },
  { name: 'Canada', dialCode: '+1', flag: '🇨🇦' },
  { name: 'Cap-Vert', dialCode: '+238', flag: '🇨🇻' },
  { name: 'Chili', dialCode: '+56', flag: '🇨🇱' },
  { name: 'Chine', dialCode: '+86', flag: '🇨🇳' },
  { name: 'Colombie', dialCode: '+57', flag: '🇨🇴' },
  { name: 'Comores', dialCode: '+269', flag: '🇰🇲' },
  { name: 'Congo', dialCode: '+242', flag: '🇨🇬' },
  { name: 'Côte d’Ivoire', dialCode: '+225', flag: '🇨🇮' },
  { name: 'Croatie', dialCode: '+385', flag: '🇭🇷' },
  { name: 'Cuba', dialCode: '+53', flag: '🇨🇺' },
  { name: 'Danemark', dialCode: '+45', flag: '🇩🇰' },
  { name: 'Djibouti', dialCode: '+253', flag: '🇩🇯' },
  { name: 'Égypte', dialCode: '+20', flag: '🇪🇬' },
  { name: 'Émirats arabes unis', dialCode: '+971', flag: '🇦🇪' },
  { name: 'Espagne', dialCode: '+34', flag: '🇪🇸' },
  { name: 'États-Unis', dialCode: '+1', flag: '🇺🇸' },
  { name: 'Finlande', dialCode: '+358', flag: '🇫🇮' },
  { name: 'France', dialCode: '+33', flag: '🇫🇷' },
  { name: 'Gabon', dialCode: '+241', flag: '🇬🇦' },
  { name: 'Ghana', dialCode: '+233', flag: '🇬🇭' },
  { name: 'Grèce', dialCode: '+30', flag: '🇬🇷' },
  { name: 'Guinée', dialCode: '+224', flag: '🇬🇳' },
  { name: 'Guinée-Bissau', dialCode: '+245', flag: '🇬🇼' },
  { name: 'Guinée équatoriale', dialCode: '+240', flag: '🇬🇶' },
  { name: 'Haïti', dialCode: '+509', flag: '🇭🇹' },
  { name: 'Inde', dialCode: '+91', flag: '🇮🇳' },
  { name: 'Indonésie', dialCode: '+62', flag: '🇮🇩' },
  { name: 'Irlande', dialCode: '+353', flag: '🇮🇪' },
  { name: 'Islande', dialCode: '+354', flag: '🇮🇸' },
  { name: 'Israël', dialCode: '+972', flag: '🇮🇱' },
  { name: 'Italie', dialCode: '+39', flag: '🇮🇹' },
  { name: 'Japon', dialCode: '+81', flag: '🇯🇵' },
  { name: 'Jordanie', dialCode: '+962', flag: '🇯🇴' },
  { name: 'Kenya', dialCode: '+254', flag: '🇰🇪' },
  { name: 'Liban', dialCode: '+961', flag: '🇱🇧' },
  { name: 'Luxembourg', dialCode: '+352', flag: '🇱🇺' },
  { name: 'Madagascar', dialCode: '+261', flag: '🇲🇬' },
  { name: 'Mali', dialCode: '+223', flag: '🇲🇱' },
  { name: 'Maroc', dialCode: '+212', flag: '🇲🇦' },
  { name: 'Maurice', dialCode: '+230', flag: '🇲🇺' },
  { name: 'Mauritanie', dialCode: '+222', flag: '🇲🇷' },
  { name: 'Mexique', dialCode: '+52', flag: '🇲🇽' },
  { name: 'Monaco', dialCode: '+377', flag: '🇲🇨' },
  { name: 'Niger', dialCode: '+227', flag: '🇳🇪' },
  { name: 'Nigeria', dialCode: '+234', flag: '🇳🇬' },
  { name: 'Norvège', dialCode: '+47', flag: '🇳🇴' },
  { name: 'Nouvelle-Zélande', dialCode: '+64', flag: '🇳🇿' },
  { name: 'Ouganda', dialCode: '+256', flag: '🇺🇬' },
  { name: 'Pakistan', dialCode: '+92', flag: '🇵🇰' },
  { name: 'Pays-Bas', dialCode: '+31', flag: '🇳🇱' },
  { name: 'Pologne', dialCode: '+48', flag: '🇵🇱' },
  { name: 'Portugal', dialCode: '+351', flag: '🇵🇹' },
  { name: 'République démocratique du Congo', dialCode: '+243', flag: '🇨🇩' },
  { name: 'Royaume-Uni', dialCode: '+44', flag: '🇬🇧' },
  { name: 'Rwanda', dialCode: '+250', flag: '🇷🇼' },
  { name: 'Sénégal', dialCode: '+221', flag: '🇸🇳' },
  { name: 'Seychelles', dialCode: '+248', flag: '🇸🇨' },
  { name: 'Sierra Leone', dialCode: '+232', flag: '🇸🇱' },
  { name: 'Somalie', dialCode: '+252', flag: '🇸🇴' },
  { name: 'Suisse', dialCode: '+41', flag: '🇨🇭' },
  { name: 'Tanzanie', dialCode: '+255', flag: '🇹🇿' },
  { name: 'Tchad', dialCode: '+235', flag: '🇹🇩' },
  { name: 'Togo', dialCode: '+228', flag: '🇹🇬' },
  { name: 'Tunisie', dialCode: '+216', flag: '🇹🇳' },
  { name: 'Turquie', dialCode: '+90', flag: '🇹🇷' },
  { name: 'Ukraine', dialCode: '+380', flag: '🇺🇦' },
  { name: 'Uruguay', dialCode: '+598', flag: '🇺🇾' },
  { name: 'Venezuela', dialCode: '+58', flag: '🇻🇪' },
  { name: 'Vietnam', dialCode: '+84', flag: '🇻🇳' },
  { name: 'Zambie', dialCode: '+260', flag: '🇿🇲' },
  { name: 'Zimbabwe', dialCode: '+263', flag: '🇿🇼' },
];

const defaultCountry = countries.find((country) => country.dialCode === '+229') ?? countries[0];

type CountryPhoneFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function CountryPhoneField({ value, onChange }: CountryPhoneFieldProps) {
  const [selectedCountry, setSelectedCountry] = useState(defaultCountry);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const filteredCountries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr-FR');
    if (!normalizedQuery) return countries;
    return countries.filter((country) =>
      `${country.name} ${country.dialCode}`.toLocaleLowerCase('fr-FR').includes(normalizedQuery),
    );
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';
    searchRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const openPicker = () => {
    setQuery('');
    setIsOpen(true);
  };

  const selectCountry = (country: CountryOption) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <>
      <div className="sendflow-signup-phone">
        <label className="sr-only" htmlFor={inputId}>Numéro de téléphone</label>
        <button
          type="button"
          className="sendflow-signup-country"
          onClick={openPicker}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <span aria-hidden="true">{selectedCountry.flag}</span>
          <span>{selectedCountry.dialCode}</span>
        </button>
        <input
          id={inputId}
          type="tel"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d\s()-]/g, ''))}
          placeholder="Numéro de téléphone"
          autoComplete="tel"
          inputMode="tel"
          required
        />
      </div>

      {isOpen && (
        <div className="sendflow-country-picker" role="presentation">
          <button
            type="button"
            className="sendflow-country-picker-backdrop"
            aria-label="Fermer le sélectionneur de pays"
            onClick={() => setIsOpen(false)}
          />
          <section className="sendflow-country-sheet" role="dialog" aria-modal="true" aria-label="Sélectionner un pays">
            <div className="sendflow-country-search">
              <Search size={28} strokeWidth={1.8} aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un pays..."
                aria-label="Rechercher un pays"
              />
            </div>

            <div className="sendflow-country-list">
              {filteredCountries.length > 0 ? (
                filteredCountries.map((country) => (
                  <button
                    type="button"
                    className={`sendflow-country-option${country.dialCode === selectedCountry.dialCode && country.name === selectedCountry.name ? ' is-selected' : ''}`}
                    key={`${country.name}-${country.dialCode}`}
                    onClick={() => selectCountry(country)}
                  >
                    <span className="sendflow-country-option-flag" aria-hidden="true">{country.flag}</span>
                    <span className="sendflow-country-option-name">{country.name}</span>
                    <span className="sendflow-country-option-code">({country.dialCode})</span>
                  </button>
                ))
              ) : (
                <p className="sendflow-country-empty">Aucun pays trouvé</p>
              )}
            </div>

            <button
              type="button"
              className="sendflow-country-close"
              onClick={() => setIsOpen(false)}
              aria-label="Fermer le sélectionneur de pays"
            >
              <X size={26} strokeWidth={1.7} />
            </button>
          </section>
        </div>
      )}
    </>
  );
}