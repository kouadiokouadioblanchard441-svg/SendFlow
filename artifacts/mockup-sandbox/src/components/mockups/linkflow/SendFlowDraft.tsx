import { useEffect, useState, type ChangeEvent } from 'react';
import { ArrowLeft, Check, ImagePlus, Link2, ShieldCheck, X } from 'lucide-react';
import './_group.css';
import './SendFlowDraft.css';

type PaymentMethod = 'Mobile Money' | 'Carte' | 'Tous';
type LinkExpiry = '1 heure' | '1 jour' | '1 semaine' | 'Illimité';

const paymentMethods: PaymentMethod[] = ['Mobile Money', 'Carte', 'Tous'];
const expiryOptions: LinkExpiry[] = ['1 heure', '1 jour', '1 semaine', 'Illimité'];

export function SendFlowDraft() {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tous');
  const [expiry, setExpiry] = useState<LinkExpiry>('1 jour');
  const [usesLimited, setUsesLimited] = useState(false);
  const [maximumUses, setMaximumUses] = useState('1');
  const [returnUrl, setReturnUrl] = useState('');
  const [suffix, setSuffix] = useState('');
  const [noImage, setNoImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');

  useEffect(() => {
    if (!selectedImage || noImage) {
      setImageUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedImage);
    setImageUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImage, noImage]);

  const normalizedSuffix = suffix.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');

  const onImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImageError('');
    if (!file) {
      setSelectedImage(null);
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      setImageError('Choisissez une image PNG, JPG, GIF ou WebP.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('L’image doit peser 5 Mo maximum.');
      event.target.value = '';
      return;
    }
    setSelectedImage(file);
  };

  const toggleNoImage = (checked: boolean) => {
    setNoImage(checked);
    if (checked) {
      setSelectedImage(null);
      setImageError('');
    }
  };

  return (
    <main className="sendflow-linkflow-shell">
      <section className="sendflow-linkflow-page" aria-labelledby="linkflow-title">
        <div className="sendflow-linkflow-illustration" aria-hidden="true">
          <img src="/__mockup/images/sendflow-linkflow-payment-3d-clean.png" alt="" />
        </div>

        <header className="sendflow-linkflow-header">
          <button type="button" className="sendflow-linkflow-back" aria-label="Retour">
            <ArrowLeft size={22} />
          </button>
          <h1 id="linkflow-title">Nouveau lien de paiement</h1>
          <span className="sendflow-linkflow-header-spacer" aria-hidden="true" />
        </header>

        <form className="sendflow-linkflow-form" onSubmit={(event) => event.preventDefault()}>
          <span className="sendflow-linkflow-currency">XOF</span>

          <label className="sendflow-linkflow-field">
            <span>Montant (XOF)</span>
            <input type="text" inputMode="decimal" minLength={1} placeholder="Minimum 10" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>

          <label className="sendflow-linkflow-field">
            <span>Description</span>
            <textarea rows={3} maxLength={240} placeholder="Ex. Paiement facture" value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>

          <fieldset className="sendflow-linkflow-choice-group">
            <legend>Méthode de paiement</legend>
            <div className="sendflow-linkflow-pills" role="radiogroup" aria-label="Méthode de paiement">
              {paymentMethods.map((method) => (
                <button key={method} type="button" role="radio" aria-checked={paymentMethod === method} className={`sendflow-linkflow-pill${paymentMethod === method ? ' is-selected' : ''}`} onClick={() => setPaymentMethod(method)}>
                  {method}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="sendflow-linkflow-choice-group">
            <legend>Validité du lien</legend>
            <div className="sendflow-linkflow-pills sendflow-linkflow-expiries" role="radiogroup" aria-label="Validité du lien">
              {expiryOptions.map((option) => (
                <button key={option} type="button" role="radio" aria-checked={expiry === option} className={`sendflow-linkflow-pill${expiry === option ? ' is-selected' : ''}`} onClick={() => setExpiry(option)}>
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="sendflow-linkflow-choice-group">
            <legend>Nombre d’utilisations</legend>
            <div className="sendflow-linkflow-pills" role="radiogroup" aria-label="Nombre d’utilisations">
              <button type="button" role="radio" aria-checked={!usesLimited} className={`sendflow-linkflow-pill${!usesLimited ? ' is-outlined' : ''}`} onClick={() => setUsesLimited(false)}>Illimité</button>
              <button type="button" role="radio" aria-checked={usesLimited} className={`sendflow-linkflow-pill${usesLimited ? ' is-outlined' : ''}`} onClick={() => setUsesLimited(true)}>Limité</button>
            </div>
            {usesLimited ? (
              <label className="sendflow-linkflow-field sendflow-linkflow-maximum">
                <span>Nombre maximal d’utilisations</span>
                <input type="number" min="1" max="999999" inputMode="numeric" placeholder="Ex. 10" value={maximumUses} onChange={(event) => setMaximumUses(event.target.value)} />
              </label>
            ) : (
              <p className="sendflow-linkflow-helper">Le lien peut être payé autant de fois que nécessaire.</p>
            )}
          </fieldset>

          <label className="sendflow-linkflow-field">
            <span>Lien de retour <small>Facultatif</small></span>
            <input type="url" autoComplete="url" placeholder="https://..." value={returnUrl} onChange={(event) => setReturnUrl(event.target.value)} />
          </label>

          <label className="sendflow-linkflow-field">
            <span>Suffixe du lien <small>Facultatif</small></span>
            <input type="text" maxLength={32} autoCapitalize="none" placeholder="Ex. promo-ete" value={suffix} onChange={(event) => setSuffix(event.target.value)} />
            <span className="sendflow-linkflow-url-preview" aria-live="polite">Lien SendFlow · <strong>/{normalizedSuffix || 'votre-suffixe'}</strong></span>
          </label>

          <fieldset className="sendflow-linkflow-image-section">
            <legend>Image</legend>
            <label className="sendflow-linkflow-no-image">
              <input type="checkbox" checked={noImage} onChange={(event) => toggleNoImage(event.currentTarget.checked)} />
              <span className="sendflow-linkflow-checkbox-mark" aria-hidden="true">{noImage && <Check size={14} />}</span>
              <span>Pas d’image</span>
            </label>
            {!noImage && (
              <div className={`sendflow-linkflow-upload${imageUrl ? ' has-image' : ''}`}>
                {imageUrl ? (
                  <>
                    <img className="sendflow-linkflow-image-preview" src={imageUrl} alt="Aperçu de l’image sélectionnée" />
                    <span className="sendflow-linkflow-image-name">{selectedImage?.name}</span>
                    <button type="button" className="sendflow-linkflow-remove-image" onClick={() => setSelectedImage(null)} aria-label="Retirer l’image">
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <label className="sendflow-linkflow-upload-label" htmlFor="linkflow-image">
                    <ImagePlus size={22} aria-hidden="true" />
                    <strong>Choisissez une image</strong>
                    <small>PNG, JPG, GIF ou WEBP jusqu’à 5 Mo</small>
                  </label>
                )}
                <input id="linkflow-image" className="sendflow-linkflow-file-input" type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={onImageChange} />
              </div>
            )}
            {imageError && <p className="sendflow-linkflow-image-error" role="alert">{imageError}</p>}
          </fieldset>

          <div className="sendflow-linkflow-submit-area">
            <button type="button" className="sendflow-linkflow-submit" disabled><Link2 size={18} />Créer le lien</button>
            <p className="sendflow-linkflow-notice" role="note">
              <ShieldCheck size={16} aria-hidden="true" />
              Cette maquette ne crée pas de lien et ne déclenche aucun paiement.
            </p>
          </div>
        </form>
      </section>
    </main>
  );
}
