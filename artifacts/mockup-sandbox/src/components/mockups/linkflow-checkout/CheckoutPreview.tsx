import { useState } from 'react';
import { Clock3, ShieldCheck } from 'lucide-react';
import logo from './assets/sendflow-wordmark-original.png';
import illustration from './assets/sendflow-linkflow-payment-3d.webp';
import './_group.css';

function CheckoutPreview({ highContrast = false }: { highContrast?: boolean }) {
  const [countryCode, setCountryCode] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');

  return (
    <main className={`sendflow-public-pay-shell${highContrast ? ' checkout-preview--contrast' : ''}`}>
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
            <small><Clock3 size={13} /> Valable jusqu’au 26 oct. 2026, 13:22</small>
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
              </select>
            </label>
            <label className="sendflow-pay-field">
              <span>Réseau<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
              <select disabled defaultValue="">
                <option value="">Choisissez d’abord un pays</option>
              </select>
            </label>
            <label className="sendflow-pay-field">
              <span>Numéro de téléphone<span className="sendflow-pay-required" aria-hidden="true">*</span></span>
              <div className="sendflow-pay-phone-input">
                <span aria-hidden="true">+—</span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/[^\d\s-]/g, ''))}
                  placeholder="Choisissez votre pays"
                  autoComplete="tel-national"
                  inputMode="tel"
                  disabled
                />
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

export default CheckoutPreview;
