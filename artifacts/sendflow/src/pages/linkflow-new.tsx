import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ImagePlus, RefreshCw, X } from 'lucide-react';
import {
  getGetCustomerPaymentLinksQueryKey,
  uploadCustomerPaymentLinkImage,
  useCreateCustomerPaymentLink,
  useGetCustomerPaymentLinks,
} from '@workspace/api-client-react';
import type {
  CustomerPaymentLinkInputCurrency,
  CustomerPaymentLinkInputPaymentMethod,
  CustomerPaymentLinkInputValidity,
} from '@workspace/api-client-react';
import { useSeo } from '@/lib/seo';
import linkflowIllustration from '@assets/generated_images/sendflow-linkflow-payment-3d.webp';

const methods: { value: CustomerPaymentLinkInputPaymentMethod; label: string }[] = [
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'card', label: 'Carte' },
  { value: 'all', label: 'Tous' },
];
const validities: { value: CustomerPaymentLinkInputValidity; label: string }[] = [
  { value: 'hour', label: '1 heure' },
  { value: 'day', label: '1 jour' },
  { value: 'week', label: '1 semaine' },
  { value: 'unlimited', label: 'Illimité' },
];
const currencyNames: Record<CustomerPaymentLinkInputCurrency, string> = {
  XOF: 'Franc CFA (BCEAO)', XAF: 'Franc CFA (BEAC)', USD: 'Dollar américain',
};
const imageMaxBytes = 5 * 1024 * 1024;
const imageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

function newRequestId() {
  if (typeof crypto === 'undefined') throw new Error('La création sécurisée de la demande est indisponible sur cet appareil.');
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  if (typeof crypto.getRandomValues !== 'function') throw new Error('La création sécurisée de la demande est indisponible sur cet appareil.');
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function LinkFlowNewPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createMutation = useCreateCustomerPaymentLink();
  const paymentLinksQuery = useGetCustomerPaymentLinks({ limit: 20 });
  const requestIdRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const [currency, setCurrency] = useState<CustomerPaymentLinkInputCurrency>('XOF');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState<CustomerPaymentLinkInputPaymentMethod>('all');
  const [validity, setValidity] = useState<CustomerPaymentLinkInputValidity>('day');
  const [limited, setLimited] = useState(false);
  const [maximumUses, setMaximumUses] = useState('1');
  const [returnUrl, setReturnUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestIdError, setRequestIdError] = useState('');
  const [noImage, setNoImage] = useState(true);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');
  const [imageUploadError, setImageUploadError] = useState('');
  const [imageUploadPending, setImageUploadPending] = useState(false);
  const [createdLinkId, setCreatedLinkId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const currencyOptions = paymentLinksQuery.data?.currencyOptions;
  const selectedCurrencyOption = currencyOptions?.find((option) => option.code === currency);

  useEffect(() => {
    if (!selectedImage) {
      setImagePreviewUrl(null);
      return;
    }
    const preview = URL.createObjectURL(selectedImage);
    setImagePreviewUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [selectedImage]);

  useEffect(() => {
    if (!currencyOptions?.length || currencyOptions.some((option) => option.code === currency)) return;
    setCurrency(currencyOptions[0].code);
  }, [currencyOptions, currency]);

  useSeo({
    path: '/linkflow/new',
    locale: 'fr',
    title: 'Nouveau lien de paiement · SendFlow',
    description: 'Préparez un brouillon de demande de paiement SendFlow.',
    robots: 'noindex,nofollow',
  });

  const finishCreation = async () => {
    requestIdRef.current = null;
    await queryClient.invalidateQueries({ queryKey: getGetCustomerPaymentLinksQueryKey() });
    setLocation('/linkflow');
  };

  const uploadImage = async (linkId: string, file: File) => {
    await uploadCustomerPaymentLinkImage(linkId, file, {
      headers: { 'Content-Type': file.type },
    });
  };

  const retryImageUpload = async () => {
    if (!createdLinkId || !selectedImage) return;
    setImageUploadPending(true);
    setImageUploadError('');
    try {
      await uploadImage(createdLinkId, selectedImage);
      await finishCreation();
    } catch (error) {
      setImageUploadError(error instanceof Error ? error.message : 'Réessayez l’envoi de l’image.');
    } finally {
      setImageUploadPending(false);
    }
  };

  const selectImage = (file: File | undefined) => {
    setImageError('');
    if (!file) return;
    if (!imageMimeTypes.has(file.type)) {
      setImageError('Choisissez un fichier PNG, JPEG, GIF ou WebP.');
      return;
    }
    if (file.size < 1 || file.size > imageMaxBytes) {
      setImageError('L’image doit peser au maximum 5 Mo.');
      return;
    }
    setNoImage(false);
    setSelectedImage(file);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (paymentLinksQuery.isLoading || paymentLinksQuery.isError || !selectedCurrencyOption) return;
    if (createdLinkId) {
      void retryImageUpload();
      return;
    }
    const nextErrors: Record<string, string> = {};
    const trimmedAmount = amount.trim();
    const amountMatch = /^([0-9]+)(?:\.([0-9]+))?$/.exec(trimmedAmount);
    const decimalPlaces = selectedCurrencyOption.decimals;
    if (!amountMatch || !Number.isFinite(Number(trimmedAmount)) || Number(trimmedAmount) < 10) {
      nextErrors.amount = 'Le montant minimum est de 10.';
    } else if ((amountMatch[2]?.length ?? 0) > decimalPlaces) {
      nextErrors.amount = decimalPlaces === 0
        ? `${currency} ne prend pas de décimales.`
        : `Utilisez au maximum ${decimalPlaces} décimales pour ${currency}.`;
    } else if (trimmedAmount.length > 24) {
      nextErrors.amount = 'Le montant ne peut pas dépasser 24 caractères.';
    }
    if (description.trim().length < 2) nextErrors.description = 'La description doit comporter au moins 2 caractères.';
    if (description.trim().length > 240) nextErrors.description = 'La description ne peut pas dépasser 240 caractères.';
    if (limited && (!/^\d+$/.test(maximumUses) || Number(maximumUses) < 1 || Number(maximumUses) > 999999)) {
      nextErrors.maximumUses = 'Indiquez un nombre entre 1 et 999 999.';
    }
    if (returnUrl.trim()) {
      try {
        const parsed = new URL(returnUrl.trim());
        if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) throw new Error();
      } catch {
        nextErrors.returnUrl = 'Saisissez une URL HTTPS valide.';
      }
      if (returnUrl.trim().length > 2048) nextErrors.returnUrl = 'L’URL ne peut pas dépasser 2 048 caractères.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const payload = {
      currency,
      amount: trimmedAmount,
      description: description.trim(),
      paymentMethod: method,
      validity,
      maximumUses: limited ? Number(maximumUses) : null,
      returnUrl: returnUrl.trim() || null,
      suffix: null,
    };
    const fingerprint = JSON.stringify(payload);
    let requestId: string;
    try {
      if (requestIdRef.current?.fingerprint === fingerprint) {
        requestId = requestIdRef.current.id;
      } else {
        requestId = newRequestId();
        requestIdRef.current = { fingerprint, id: requestId };
      }
      setRequestIdError('');
    } catch (error) {
      setRequestIdError(error instanceof Error ? error.message : 'Impossible de créer une demande sécurisée.');
      return;
    }

    createMutation.mutate({
      data: { ...payload, requestId },
    }, {
      onSuccess: async (created) => {
        if (!selectedImage) {
          await finishCreation();
          return;
        }
        setCreatedLinkId(created.id);
        setImageUploadPending(true);
        setImageUploadError('');
        try {
          await uploadImage(created.id, selectedImage);
          await finishCreation();
        } catch (error) {
          setImageUploadError(error instanceof Error ? error.message : 'Réessayez l’envoi de l’image.');
        } finally {
          setImageUploadPending(false);
        }
      },
    });
  };

  return (
    <>
      {typeof document !== 'undefined' && createPortal(
        <img
          className="sendflow-linkflow-art is-create"
          src={linkflowIllustration}
          alt=""
          aria-hidden="true"
          draggable={false}
        />,
        document.body,
      )}
      <main className="sendflow-linkflow-shell">
      <section className="sendflow-linkflow-page sendflow-linkflow-create-page" aria-labelledby="linkflow-title">
        <header className="sendflow-linkflow-header">
          <button type="button" className="sendflow-linkflow-back" onClick={() => setLocation('/linkflow')} aria-label="Revenir à mes liens" data-testid="button-linkflow-back">
            <ArrowLeft size={21} />
          </button>
          <div className="sendflow-linkflow-head-copy">
            <p className="sendflow-linkflow-eyebrow">NOUVELLE DEMANDE</p>
            <h1 id="linkflow-title">Préparer un lien</h1>
          </div>
          <span className="sendflow-linkflow-header-spacer" />
        </header>

        <form className="sendflow-linkflow-form" onSubmit={submit} noValidate>
          <fieldset className="sendflow-linkflow-choice-group">
            <legend>Devise</legend>
            <div className="sendflow-linkflow-pills sendflow-linkflow-currency-pills" role="radiogroup" aria-label="Devise">
              {paymentLinksQuery.isLoading && <span className="sendflow-linkflow-currency-loading" role="status">Chargement…</span>}
              {paymentLinksQuery.isError && (
                <span className="sendflow-linkflow-helper" role="alert">
                  <button className="sendflow-linkflow-secondary" type="button" onClick={() => paymentLinksQuery.refetch()} aria-label="Réessayer le chargement des devises">
                    <RefreshCw size={15} /> Réessayer
                  </button>
                </span>
              )}
              {currencyOptions?.map((option) => (
                <button type="button" key={option.code} role="radio" aria-checked={currency === option.code}
                  className={`sendflow-linkflow-pill${currency === option.code ? ' is-selected' : ''}`}
                  onClick={() => setCurrency(option.code as CustomerPaymentLinkInputCurrency)} data-testid={`button-linkflow-currency-${option.code}`}>
                  {option.code}
                </button>
              ))}
            </div>
            {selectedCurrencyOption && <p className="sendflow-linkflow-helper">{currencyNames[currency]}</p>}
          </fieldset>

          <label className={`sendflow-linkflow-field${errors.amount ? ' has-error' : ''}`}>
            <span>Montant <small>en {currency}</small></span>
            <div className="sendflow-linkflow-amount-input"><input aria-label={`Montant en ${currency}`} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? 'linkflow-amount-error' : 'linkflow-amount-help'} value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0" data-testid="input-linkflow-amount" /><b>{currency}</b></div>
            {errors.amount ? <small className="sendflow-linkflow-error" id="linkflow-amount-error">{errors.amount}</small> : <small id="linkflow-amount-help">Saisissez le montant demandé.</small>}
          </label>

          <label className={`sendflow-linkflow-field${errors.description ? ' has-error' : ''}`}>
            <span>Description</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} rows={3} placeholder="Ex. Règlement de la facture n°..." aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'linkflow-description-error' : undefined} data-testid="input-linkflow-description" />
            {errors.description && <small className="sendflow-linkflow-error" id="linkflow-description-error">{errors.description}</small>}
          </label>

          <fieldset className="sendflow-linkflow-choice-group">
            <legend>Méthode de paiement</legend>
            <div className="sendflow-linkflow-pills" role="radiogroup" aria-label="Méthode de paiement">
              {methods.map((option) => <button key={option.value} type="button" role="radio" aria-checked={method === option.value} className={`sendflow-linkflow-pill${method === option.value ? ' is-selected' : ''}`} onClick={() => setMethod(option.value)} data-testid={`button-linkflow-method-${option.value}`}>{option.label}</button>)}
            </div>
          </fieldset>

          <fieldset className="sendflow-linkflow-choice-group">
            <legend>Validité du lien</legend>
            <div className="sendflow-linkflow-pills" role="radiogroup" aria-label="Validité">
              {validities.map((option) => <button key={option.value} type="button" role="radio" aria-checked={validity === option.value} className={`sendflow-linkflow-pill${validity === option.value ? ' is-selected' : ''}`} onClick={() => setValidity(option.value)} data-testid={`button-linkflow-expiry-${option.value}`}>{option.label}</button>)}
            </div>
          </fieldset>

          <fieldset className="sendflow-linkflow-choice-group">
            <legend>Nombre d’utilisations</legend>
            <div className="sendflow-linkflow-pills" role="radiogroup" aria-label="Nombre d’utilisations">
              <button type="button" role="radio" aria-checked={!limited} className={`sendflow-linkflow-pill${!limited ? ' is-selected' : ''}`} onClick={() => setLimited(false)} data-testid="button-linkflow-uses-unlimited">Illimité</button>
              <button type="button" role="radio" aria-checked={limited} className={`sendflow-linkflow-pill${limited ? ' is-selected' : ''}`} onClick={() => setLimited(true)} data-testid="button-linkflow-uses-limited">Limité</button>
            </div>
            {limited ? (
              <label className={`sendflow-linkflow-field sendflow-linkflow-maximum${errors.maximumUses ? ' has-error' : ''}`}><span>Maximum d’utilisations</span><input type="number" min="1" max="999999" step="1" value={maximumUses} onChange={(event) => setMaximumUses(event.target.value)} aria-invalid={Boolean(errors.maximumUses)} aria-describedby={errors.maximumUses ? 'linkflow-uses-error' : undefined} placeholder="Ex. 10" data-testid="input-linkflow-maximum-uses" />{errors.maximumUses && <small className="sendflow-linkflow-error" id="linkflow-uses-error">{errors.maximumUses}</small>}</label>
            ) : <p className="sendflow-linkflow-helper">Aucune limite d’utilisation demandée.</p>}
          </fieldset>

          <label className={`sendflow-linkflow-field${errors.returnUrl ? ' has-error' : ''}`}>
            <span>Lien de retour <small>optionnel</small></span>
            <input type="url" value={returnUrl} onChange={(event) => setReturnUrl(event.target.value)} autoComplete="url" placeholder="https://votre-site.com/merci" aria-invalid={Boolean(errors.returnUrl)} aria-describedby={errors.returnUrl ? 'linkflow-return-error' : undefined} data-testid="input-linkflow-return-url" />
            {errors.returnUrl && <small className="sendflow-linkflow-error" id="linkflow-return-error">{errors.returnUrl}</small>}
          </label>

          <fieldset className="sendflow-linkflow-image-section">
            <legend>Image <small>optionnelle</small></legend>
            <label className="sendflow-linkflow-no-image">
              <input
                type="checkbox"
                checked={noImage}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setNoImage(checked);
                  setImageError('');
                  if (checked) {
                    setSelectedImage(null);
                    if (imageInputRef.current) imageInputRef.current.value = '';
                  }
                }}
                data-testid="checkbox-linkflow-no-image"
              />
              <span className="sendflow-linkflow-checkbox-mark" aria-hidden="true">{noImage ? '✓' : ''}</span>
              Pas d’image
            </label>
            {!noImage && (
              <div className="sendflow-linkflow-upload">
                {imagePreviewUrl ? (
                  <>
                    <img className="sendflow-linkflow-image-preview" src={imagePreviewUrl} alt="Aperçu de l’image du lien" />
                    <span className="sendflow-linkflow-image-name">Image sélectionnée · {Math.ceil((selectedImage?.size ?? 0) / 1024)} Ko</span>
                    <button
                      type="button"
                      className="sendflow-linkflow-remove-image"
                      onClick={() => {
                        setSelectedImage(null);
                        setNoImage(true);
                        if (imageInputRef.current) imageInputRef.current.value = '';
                      }}
                      aria-label="Retirer l’image"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <label className="sendflow-linkflow-upload-label">
                    <input
                      ref={imageInputRef}
                      className="sendflow-linkflow-file-input"
                      type="file"
                      accept=".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp"
                      onChange={(event) => selectImage(event.target.files?.[0])}
                      data-testid="input-linkflow-image"
                    />
                    <ImagePlus size={22} aria-hidden="true" />
                    <strong>Choisissez une image</strong>
                    <small>PNG, JPG, GIF ou WebP · 5 Mo maximum</small>
                  </label>
                )}
              </div>
            )}
            {imageError && <small className="sendflow-linkflow-image-error" role="alert">{imageError}</small>}
          </fieldset>

          {(requestIdError || createMutation.isError) && <div className="sendflow-linkflow-server-error" role="alert"><strong>Le brouillon n’a pas été enregistré.</strong><span>{requestIdError || 'Le serveur n’a pas confirmé la création. Vérifiez les informations ou réessayez.'}</span></div>}
          {imageUploadError && <div className="sendflow-linkflow-server-error" role="alert"><strong>Le brouillon est enregistré, mais l’image a échoué.</strong><span>{imageUploadError}</span></div>}
          <div className="sendflow-linkflow-submit-area">
            <button type="submit" className="sendflow-linkflow-primary sendflow-linkflow-submit" disabled={paymentLinksQuery.isLoading || paymentLinksQuery.isError || !selectedCurrencyOption || createMutation.isPending || imageUploadPending || (createdLinkId !== null && selectedImage === null)} data-testid="button-linkflow-create">
              {imageUploadPending || createMutation.isPending ? 'Enregistrement…' : createdLinkId ? 'Réessayer l’image' : 'Enregistrer le brouillon'} {!imageUploadPending && !createMutation.isPending && <ArrowRight size={17} />}
            </button>
          </div>
        </form>
      </section>
      </main>
    </>
  );
}
