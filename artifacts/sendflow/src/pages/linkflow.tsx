import { useEffect, useState, type ChangeEvent } from 'react';
import { ArrowLeft, Check, ImagePlus, Link2, ShieldCheck, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useLocation } from 'wouter';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { useSeo } from '@/lib/seo';
import linkflowIllustration from '@assets/generated_images/sendflow-linkflow-payment-3d-clean.png';

type LinkFlowFormValues = {
  amount: string;
  description: string;
  returnUrl: string;
  suffix: string;
  maximumUses: string;
};

type PaymentMethod = 'mobile-money' | 'card' | 'all';
type LinkExpiry = 'hour' | 'day' | 'week' | 'unlimited';

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'mobile-money', label: 'Mobile Money' },
  { value: 'card', label: 'Carte' },
  { value: 'all', label: 'Tous' },
];

const expiryOptions: { value: LinkExpiry; label: string }[] = [
  { value: 'hour', label: '1 heure' },
  { value: 'day', label: '1 jour' },
  { value: 'week', label: '1 semaine' },
  { value: 'unlimited', label: 'Illimité' },
];

export default function LinkFlowPage() {
  const [, setLocation] = useLocation();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('all');
  const [expiry, setExpiry] = useState<LinkExpiry>('day');
  const [usesLimited, setUsesLimited] = useState(false);
  const [noImage, setNoImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const form = useForm<LinkFlowFormValues>({
    defaultValues: { amount: '', description: '', returnUrl: '', suffix: '', maximumUses: '1' },
  });
  const suffix = form.watch('suffix');
  const safeSuffix = suffix.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');

  useSeo({
    path: '/linkflow',
    locale: 'fr',
    title: 'Nouveau lien de paiement · SendFlow',
    description: 'Préparez les paramètres de votre lien de paiement SendFlow.',
    robots: 'noindex,nofollow',
  });

  useEffect(() => {
    if (!selectedImage || noImage) {
      setImagePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedImage);
    setImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImage, noImage]);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0] ?? null;
    setImageError(null);
    if (!image) {
      setSelectedImage(null);
      return;
    }
    if (image.size > 5 * 1024 * 1024) {
      setSelectedImage(null);
      setImageError('L’image doit peser 5 Mo maximum.');
      event.target.value = '';
      return;
    }
    setSelectedImage(image);
    setNoImage(false);
  };

  const disableImage = (checked: boolean) => {
    setNoImage(checked);
    if (checked) {
      setSelectedImage(null);
      setImageError(null);
    }
  };

  return (
    <main className="sendflow-linkflow-shell">
      <section className="sendflow-linkflow-page" aria-labelledby="linkflow-title">
        <div className="sendflow-linkflow-illustration" aria-hidden="true">
          <img src={linkflowIllustration} alt="" />
        </div>

        <header className="sendflow-linkflow-header">
          <button
            type="button"
            className="sendflow-linkflow-back"
            onClick={() => setLocation('/account')}
            aria-label="Revenir à mon compte"
            data-testid="button-linkflow-back"
          >
            <ArrowLeft size={22} strokeWidth={2} />
          </button>
          <h1 id="linkflow-title">Nouveau lien de paiement</h1>
          <span className="sendflow-linkflow-header-spacer" aria-hidden="true" />
        </header>

        <Form {...form}>
          <form className="sendflow-linkflow-form" onSubmit={form.handleSubmit(() => undefined)} noValidate>
            <div className="sendflow-linkflow-currency" aria-label="Devise sélectionnée pour cette maquette">XOF</div>

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem className="sendflow-linkflow-field">
                  <FormLabel>Montant (XOF)</FormLabel>
                  <FormControl>
                    <input {...field} type="text" inputMode="decimal" placeholder="Minimum 10" data-testid="input-linkflow-amount" />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sendflow-linkflow-field">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <textarea {...field} maxLength={240} placeholder="Ex. Paiement facture" rows={3} data-testid="input-linkflow-description" />
                  </FormControl>
                </FormItem>
              )}
            />

            <fieldset className="sendflow-linkflow-choice-group">
              <legend>Méthode de paiement</legend>
              <div className="sendflow-linkflow-pills" role="radiogroup" aria-label="Méthode de paiement">
                {paymentMethods.map((method) => (
                  <button
                    key={method.value}
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === method.value}
                    className={`sendflow-linkflow-pill${paymentMethod === method.value ? ' is-selected' : ''}`}
                    onClick={() => setPaymentMethod(method.value)}
                    data-testid={`button-linkflow-method-${method.value}`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="sendflow-linkflow-choice-group">
              <legend>Validité du lien</legend>
              <div className="sendflow-linkflow-pills" role="radiogroup" aria-label="Validité du lien">
                {expiryOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={expiry === option.value}
                    className={`sendflow-linkflow-pill${expiry === option.value ? ' is-selected' : ''}`}
                    onClick={() => setExpiry(option.value)}
                    data-testid={`button-linkflow-expiry-${option.value}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="sendflow-linkflow-choice-group sendflow-linkflow-usage">
              <legend>Nombre d’utilisations</legend>
              <div className="sendflow-linkflow-pills" role="radiogroup" aria-label="Nombre d’utilisations">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!usesLimited}
                  className={`sendflow-linkflow-pill${!usesLimited ? ' is-outlined' : ''}`}
                  onClick={() => setUsesLimited(false)}
                  data-testid="button-linkflow-uses-unlimited"
                >
                  Illimité
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={usesLimited}
                  className={`sendflow-linkflow-pill${usesLimited ? ' is-outlined' : ''}`}
                  onClick={() => setUsesLimited(true)}
                  data-testid="button-linkflow-uses-limited"
                >
                  Limité
                </button>
              </div>
              {usesLimited ? (
                <FormField
                  control={form.control}
                  name="maximumUses"
                  render={({ field }) => (
                    <FormItem className="sendflow-linkflow-field sendflow-linkflow-maximum">
                      <FormLabel>Nombre maximal d’utilisations</FormLabel>
                      <FormControl>
                        <input {...field} type="number" min="1" max="999999" inputMode="numeric" placeholder="Ex. 10" data-testid="input-linkflow-maximum-uses" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ) : (
                <p className="sendflow-linkflow-helper">Le lien peut être payé autant de fois que nécessaire.</p>
              )}
            </fieldset>

            <FormField
              control={form.control}
              name="returnUrl"
              render={({ field }) => (
                <FormItem className="sendflow-linkflow-field">
                  <FormLabel>Lien de retour <small>Optionnel</small></FormLabel>
                  <FormControl>
                    <input {...field} type="url" placeholder="https://..." autoComplete="url" data-testid="input-linkflow-return-url" />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="suffix"
              render={({ field }) => (
                <FormItem className="sendflow-linkflow-field">
                  <FormLabel>Suffixe du lien <small>Optionnel</small></FormLabel>
                  <FormControl>
                    <input {...field} type="text" maxLength={32} placeholder="Ex. promo-ete" autoCapitalize="none" data-testid="input-linkflow-suffix" />
                  </FormControl>
                  <p className="sendflow-linkflow-url-preview" data-testid="text-linkflow-url-preview">
                    Lien SendFlow · <strong>/{safeSuffix || 'votre-suffixe'}</strong>
                  </p>
                </FormItem>
              )}
            />

            <fieldset className="sendflow-linkflow-image-section">
              <legend>Image</legend>
              <label className="sendflow-linkflow-no-image">
                <input
                  type="checkbox"
                  checked={noImage}
                  onChange={(event) => disableImage(event.currentTarget.checked)}
                  data-testid="checkbox-linkflow-no-image"
                />
                <span className="sendflow-linkflow-checkbox-mark" aria-hidden="true">{noImage && <Check size={14} />}</span>
                <span>Pas d’image</span>
              </label>

              {!noImage && (
                <div className={`sendflow-linkflow-upload${selectedImage ? ' has-image' : ''}`}>
                  {imagePreviewUrl ? (
                    <>
                      <img className="sendflow-linkflow-image-preview" src={imagePreviewUrl} alt="Aperçu de l’image sélectionnée" />
                      <span className="sendflow-linkflow-image-name">{selectedImage?.name}</span>
                      <button type="button" className="sendflow-linkflow-remove-image" onClick={() => setSelectedImage(null)} aria-label="Retirer l’image" data-testid="button-linkflow-remove-image">
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
                  <input id="linkflow-image" className="sendflow-linkflow-file-input" type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleImageChange} data-testid="input-linkflow-image" />
                </div>
              )}
              {imageError && <p className="sendflow-linkflow-image-error" role="alert">{imageError}</p>}
            </fieldset>

            <div className="sendflow-linkflow-submit-area">
              <button type="button" className="sendflow-linkflow-submit" disabled data-testid="button-linkflow-create">
                Créer le lien
              </button>
              <p className="sendflow-linkflow-notice" role="note">
                <ShieldCheck size={16} aria-hidden="true" />
                Aperçu uniquement : aucun lien n’est créé et aucun paiement n’est déclenché.
              </p>
            </div>
          </form>
        </Form>
      </section>
    </main>
  );
}
