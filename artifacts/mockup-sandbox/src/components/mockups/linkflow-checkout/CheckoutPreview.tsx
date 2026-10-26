import { useState } from 'react';
import { Clock3, ShieldCheck } from 'lucide-react';
import logo from './assets/sendflow-wordmark-original.png';
import illustration from './assets/sendflow-linkflow-payment-3d.webp';
import waveOperatorLogo from './assets/wave-logo-reference.png';
import './_group.css';

function CheckoutPreview({ highContrast = false, phoneReference = false }: { highContrast?: boolean; phoneReference?: boolean }) {
  const [countryCode, setCountryCode] = useState(phoneReference ? 'bf' : '');
  const [operatorId, setOperatorId] = useState(phoneReference ? 'wave' : '');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const country = countryCode === 'ci'
    ? { name: 'Côte d’Ivoire', code: 'ci', phonePrefix: '+225', flag: '🇨🇮' }
    : countryCode === 'bf'
      ? { name: 'Burkina Faso', code: 'bf', phonePrefix: '+226', flag: '🇧🇫' }
      : null;

  return (
    <main className={`sendflow-public-pay-shell${highContrast ? ' checkout-preview--contrast' : ''}${phoneReference ? ' checkout-preview--phone-reference' : ''}`}>
      <img className="sendflow-public-pay-art" src={illustration} alt="" aria-hidden="true" draggable={false} />
      <div className="sendflow-public-pay-layout">
        <header className="sendflow-pay-brand">
          <img className="sendflow-pay-wordmark" src={logo} alt="SendFlow" />
        </header>
        <h1 className="sendflow-pay-merchant-title">Flow digital SARL</h1>
        <section className="sendflow-public-pay-card" aria-label="Demande de paiement de Flow digital SARL">
          <div className="sendflow-pay-merchant">
            <p className="sendflow-pay-payment-title">Paiement</p>
          </div>
          <div className="sendflow-pay-amount-panel">
            <strong>20 000 XOF</strong>
            {!phoneReference && <small><Clock3 size={13} /> Valable jusqu’au 26 oct. 2026, 13:22</small>}
          </div>
          <div className="sendflow-pay-form">
            <label className="sendflow-pay-field">
              <span>Moyens de paiement</span>
              <select className="sendflow-pay-method-select" defaultValue="unavailable" disabled>
                <option value="unavailable">Aucun moyen disponible</option>
              </select>
            </label>
            <div className="sendflow-pay-field-pair">
              <label className="sendflow-pay-field">
                <span>Nom<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
                <input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Votre nom" autoComplete="family-name" />
              </label>
              <label className="sendflow-pay-field">
                <span>Prénom(s)<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
                <input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Votre prénom" autoComplete="given-name" />
              </label>
            </div>
            <label className="sendflow-pay-field">
              <span>Pays<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
              <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>
                <option value="">Sélectionnez votre pays</option>
                <option value="ci">Côte d’Ivoire</option>
                <option value="bf">Burkina Faso</option>
              </select>
            </label>
            <label className={`sendflow-pay-field${phoneReference ? ' sendflow-pay-field--reference-centered' : ''}`}>
              <span>Réseau<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
              {phoneReference ? (
                <div className="sendflow-pay-select-wrap">
                  <select
                    className={`sendflow-pay-operator-select${operatorId ? ' is-selected' : ''}`}
                    value={operatorId}
                    onChange={(event) => setOperatorId(event.target.value)}
                    disabled={!country}
                  >
                    <option value="">Choisissez d’abord un pays</option>
                    <option value="wave">WAVE</option>
                  </select>
                  <PaymentSelectIndicator />
                </div>
              ) : (
                <select disabled defaultValue="">
                  <option value="">Choisissez d’abord un pays</option>
                </select>
              )}
            </label>
            <label className={`sendflow-pay-field${phoneReference ? ' sendflow-pay-field--reference-centered' : ''}`}>
              <span>Numéro de téléphone<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
              <div className="sendflow-pay-phone-input">
                {phoneReference ? (
                  <>
                    {country && <span className="sendflow-pay-phone-flag" role="img" aria-label={country.name}>{country.flag}</span>}
                    <div className="sendflow-pay-phone-prefix-wrap">
                      <select
                        className="sendflow-pay-phone-prefix"
                        value={countryCode}
                        onChange={(event) => setCountryCode(event.target.value)}
                        disabled={!country}
                        aria-label={country ? `Indicatif téléphonique, ${country.name}` : 'Indicatif téléphonique'}
                      >
                        {!country && <option value="">+—</option>}
                        <option value="bf">+226</option>
                        <option value="ci">+225</option>
                      </select>
                      <PaymentSelectIndicator />
                    </div>
                  </>
                ) : (
                  <span aria-hidden="true">+—</span>
                )}
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/[^\d\s-]/g, ''))}
                  placeholder={phoneReference && country ? '0166000000' : 'Choisissez votre pays'}
                  autoComplete="tel-national"
                  inputMode="tel"
                  disabled={!country}
                />
                {phoneReference && operatorId === 'wave' && (
                  <span className="sendflow-pay-phone-operator" role="img" aria-label="Logo Wave">
                    <img className="sendflow-pay-operator-logo" src={waveOperatorLogo} alt="" />
                  </span>
                )}
              </div>
            </label>
          </div>
          <div className="sendflow-pay-unavailable-note" role="status">
            <span><ShieldCheck size={18} /></span>
            <p><strong>Le paiement en ligne est momentanément indisponible.</strong></p>
          </div>
          <button type="button" className="sendflow-pay-submit" disabled aria-disabled="true">
            Paiement indisponible
          </button>
        </section>
      </div>
    </main>
  );
}

function PaymentSelectIndicator() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="sendflow-pay-select-indicator">
      <path d="M3.5 6.5 8 2l4.5 4.5h-9Z" />
      <path d="M3.5 9.5 8 14l4.5-4.5h-9Z" />
    </svg>
  );
}

export default CheckoutPreview;
