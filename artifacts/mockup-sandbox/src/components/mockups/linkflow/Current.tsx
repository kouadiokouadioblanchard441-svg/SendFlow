import { ArrowLeft, ArrowUpRight, Link2, ShieldCheck } from 'lucide-react';
import './_group.css';

export function Current() {
  return (
    <main className="sendflow-linkflow-shell">
      <section className="sendflow-linkflow-page" aria-labelledby="linkflow-title">
        <header className="sendflow-linkflow-header">
          <button type="button" className="sendflow-linkflow-back" aria-label="Revenir au compte">
            <ArrowLeft size={22} strokeWidth={2} />
          </button>
          <div><p>SendFlow</p><h1 id="linkflow-title">LinkFlow</h1></div>
        </header>
        <section className="sendflow-linkflow-intro" aria-labelledby="linkflow-intro-title">
          <span className="sendflow-linkflow-icon" aria-hidden="true"><Link2 size={22} /></span>
          <div>
            <p className="sendflow-linkflow-kicker">Paiement à distance</p>
            <h2 id="linkflow-intro-title">Un lien pour recevoir un paiement</h2>
            <p>Préparez un lien à partager avec la personne qui doit vous payer.</p>
          </div>
          <span className="sendflow-linkflow-spark" aria-hidden="true"><ArrowUpRight size={21} /></span>
        </section>
        <section className="sendflow-linkflow-form-card" aria-labelledby="linkflow-form-title">
          <div className="sendflow-linkflow-form-heading">
            <div><p className="sendflow-linkflow-kicker">Nouveau lien</p><h2 id="linkflow-form-title">Détails du paiement</h2></div>
            <span className="sendflow-linkflow-draft">Aperçu</span>
          </div>
          <form onSubmit={(event) => event.preventDefault()}>
            <label className="sendflow-linkflow-field">
              <span>Montant du paiement</span>
              <input type="text" inputMode="decimal" placeholder="Saisir un montant" aria-label="Montant du paiement" />
            </label>
            <label className="sendflow-linkflow-field">
              <span>Motif du paiement <small>Facultatif</small></span>
              <input type="text" maxLength={120} placeholder="Ex. Achat ou prestation" aria-label="Motif du paiement, facultatif" />
            </label>
            <button type="button" className="sendflow-linkflow-submit" disabled><Link2 size={19} />Créer le lien de paiement</button>
          </form>
          <p className="sendflow-linkflow-notice" role="note">
            <ShieldCheck size={17} aria-hidden="true" />
            Cette maquette ne crée pas encore de lien et ne déclenche aucun paiement.
          </p>
        </section>
      </section>
    </main>
  );
}
