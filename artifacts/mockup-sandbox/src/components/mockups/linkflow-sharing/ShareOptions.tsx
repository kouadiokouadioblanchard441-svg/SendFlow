import { useState } from 'react';
import { ArrowLeft, Clock3, Copy, Globe, Link2, MessageCircle, Plus, Send, Share2, X } from 'lucide-react';
import './_group.css';
import './ShareOptions.css';
import backgroundArt from '@/assets/linkflow-sharing/sendflow-linkflow-history-3d.webp';

export function ShareOptions() {
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).get('share') === '1');
  const [notice, setNotice] = useState('');

  return (
    <main className="share-preview">
      <img className="share-preview-art" src={backgroundArt} alt="" aria-hidden="true" />
      <section className="share-preview-page" aria-labelledby="share-preview-title">
        <header className="share-preview-header">
          <button type="button" className="share-preview-back" aria-label="Retour"><ArrowLeft size={22} /></button>
          <div>
            <h1 id="share-preview-title">Liens de paiement</h1>
            <p>Liens de paiement partageables</p>
          </div>
          <button type="button" className="share-preview-add" aria-label="Créer un nouveau lien"><Plus size={22} /></button>
        </header>

        <article className="share-preview-card">
          <span className="share-preview-link-icon"><Link2 size={19} /></span>
          <div className="share-preview-copy">
            <h2>Paiement en espèces</h2>
            <p>#41-UGCKR · Tous les moyens</p>
            <small>Créé le 25 oct. 2026</small>
          </div>
          <div className="share-preview-right">
            <strong>20 000 XAF</strong>
            <span>0 / illimité</span>
            <span className="share-preview-status">Actif</span>
            <small><Clock3 size={12} /> 26 oct. 2026, 13:22</small>
            <button type="button" className="share-preview-button" onClick={() => { setNotice(''); setOpen(true); }}>
              <Share2 size={16} /> Partager
            </button>
          </div>
        </article>
      </section>

      {open && (
        <div className="share-preview-overlay" role="presentation" onClick={() => setOpen(false)}>
          <section className="share-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="share-preview-close" onClick={() => setOpen(false)} aria-label="Fermer"><X size={19} /></button>
            <h2 id="share-dialog-title">Partager ce lien</h2>
            <p>Choisissez un réseau ou copiez l’adresse du lien.</p>
            <div className="share-preview-url">
              <span>sendflow.africa/pay/••••••••</span>
              <button type="button" onClick={() => setNotice('Lien copié.')}><Copy size={16} /> Copier</button>
            </div>
            <div className="share-preview-options">
              <button type="button" onClick={() => setNotice('WhatsApp sélectionné.')}><MessageCircle size={19} /> WhatsApp</button>
              <button type="button" onClick={() => setNotice('Telegram sélectionné.')}><Send size={18} /> Telegram</button>
              <button type="button" onClick={() => setNotice('Facebook sélectionné.')}><Globe size={18} /> Facebook</button>
              <button type="button" className="share-preview-native" onClick={() => setNotice('Autres applications disponibles sur votre téléphone.')}><Share2 size={18} /> Autres applications</button>
            </div>
            {notice && <p className="share-preview-notice" role="status">{notice}</p>}
          </section>
        </div>
      )}
    </main>
  );
}
