import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowLeft, Camera, CalendarDays, Check, ChevronDown, IdCard, LockKeyhole, Sun } from 'lucide-react';
import { Redirect, useLocation } from 'wouter';
import {
  getGetCustomerProfileQueryKey,
  useGetCustomerProfile,
} from '@workspace/api-client-react';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getAdultBirthDateLimit, MIN_BIRTH_DATE } from '@/lib/auth-validation';
import { useSeo } from '@/lib/seo';
import identityCardFrontIllustration from '@assets/generated_images/sendflow-identity-card-front-3d.webp';
import identityCardBackIllustration from '@assets/generated_images/sendflow-identity-card-back-3d.webp';
import identitySelfieIllustration from '@assets/generated_images/sendflow-identity-selfie-3d.webp';

const DOCUMENT_TYPES = [
  "Carte nationale d’identité (CNI, CIP)",
  'Passeport',
  'Carte CEDEAO ou carte consulaire',
  'Permis de conduire',
] as const;

type VerificationForm = {
  lastName: string;
  firstName: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  documentExpiryDate: string;
};

type VerificationField = keyof VerificationForm;
type VerificationErrors = Partial<Record<VerificationField, string>>;
type PhotoStep = 2 | 3 | 4;
type IdentityPhoto = { file: File; previewUrl: string };

const EMPTY_FORM: VerificationForm = {
  lastName: '',
  firstName: '',
  documentType: '',
  documentNumber: '',
  birthDate: '',
  documentExpiryDate: '',
};

function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day;
}

function getTodayDate(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function validateForm(form: VerificationForm): VerificationErrors {
  const errors: VerificationErrors = {};
  const lastName = form.lastName.trim().replace(/\s+/g, ' ');
  const firstName = form.firstName.trim().replace(/\s+/g, ' ');
  const documentNumber = form.documentNumber.trim();

  if (!lastName) errors.lastName = 'Le nom est requis.';
  else if (lastName.length < 2 || !/\p{L}/u.test(lastName)) errors.lastName = 'Saisissez un nom valide.';

  if (!firstName) errors.firstName = 'Le prénom est requis.';
  else if (firstName.length < 2 || !/\p{L}/u.test(firstName)) errors.firstName = 'Saisissez un prénom valide.';

  if (!form.documentType) errors.documentType = 'Choisissez un type de document.';
  if (!documentNumber) errors.documentNumber = 'Le numéro du document est requis.';
  else if (documentNumber.length > 80) errors.documentNumber = 'Le numéro du document est trop long.';

  if (!form.birthDate || !isValidCalendarDate(form.birthDate) || form.birthDate < MIN_BIRTH_DATE) {
    errors.birthDate = 'Saisissez une date de naissance valide.';
  } else if (form.birthDate > getAdultBirthDateLimit()) {
    errors.birthDate = 'La date de naissance indiquée n’est pas valide.';
  }

  if (!form.documentExpiryDate || !isValidCalendarDate(form.documentExpiryDate)) {
    errors.documentExpiryDate = 'Saisissez une date d’expiration valide.';
  } else if (form.documentExpiryDate < getTodayDate()) {
    errors.documentExpiryDate = 'La pièce doit être en cours de validité.';
  }

  return errors;
}

export default function IdentityVerificationPage() {
  const [, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const profileQuery = useGetCustomerProfile({
    query: {
      queryKey: getGetCustomerProfileQueryKey(),
      enabled: isUnlocked,
      retry: false,
      refetchOnMount: 'always',
    },
  });
  const [form, setForm] = useState<VerificationForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<VerificationErrors>({});
  const [documentTypeOpen, setDocumentTypeOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [step, setStep] = useState<1 | PhotoStep>(1);
  const [photos, setPhotos] = useState<Partial<Record<PhotoStep, IdentityPhoto>>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoUrls = useRef(new Set<string>());
  const hasEditedForm = useRef(false);

  useSeo({
    path: '/identity-verification',
    locale: 'fr',
    title: 'Vérification d’identité · SendFlow',
    description: 'Préparez les informations nécessaires à la vérification de votre compte SendFlow.',
    robots: 'noindex,nofollow',
  });

  useEffect(() => {
    if (!profileQuery.data || hasEditedForm.current) return;
    setForm((current) => ({
      ...current,
      firstName: profileQuery.data.firstName,
      lastName: profileQuery.data.lastName,
      birthDate: profileQuery.data.birthDate ?? '',
    }));
  }, [profileQuery.data]);

  useEffect(() => () => {
    photoUrls.current.forEach((url) => URL.revokeObjectURL(url));
    photoUrls.current.clear();
  }, []);

  if (!isUnlocked) return <Redirect to="/sign-in" />;

  const updateField = <K extends VerificationField>(field: K, value: VerificationForm[K]) => {
    hasEditedForm.current = true;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice('');
  };

  const handlePhotoSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || step === 1) return;

    if (!file.type.startsWith('image/')) {
      setNotice('Choisissez une image pour continuer.');
      return;
    }

    const previousPhoto = photos[step];
    if (previousPhoto) {
      URL.revokeObjectURL(previousPhoto.previewUrl);
      photoUrls.current.delete(previousPhoto.previewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    photoUrls.current.add(previewUrl);
    setPhotos((current) => ({ ...current, [step]: { file, previewUrl } }));
    setNotice('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setStep(2);
    }
    setNotice('');
  };

  const today = getTodayDate();
  const activePhoto = step === 1 ? undefined : photos[step];
  const photoTitle = step === 2
    ? 'Photo recto de votre pièce d’identité'
    : step === 3
      ? 'Photo verso de votre pièce d’identité'
      : 'Selfie avec votre pièce d’identité';
  const photoIllustration = step === 2
    ? identityCardFrontIllustration
    : step === 3
      ? identityCardBackIllustration
      : identitySelfieIllustration;

  return (
    <main className="sendflow-identity-shell">
      <section className="sendflow-identity-page" aria-labelledby="identity-title">
        <header className="sendflow-identity-header">
          <button
            type="button"
            className="sendflow-identity-back"
            onClick={() => (step === 1 ? setLocation('/account-limit') : setStep((current) => (current - 1) as 1 | PhotoStep))}
            aria-label={step === 1 ? 'Revenir au plafond du compte' : 'Revenir à l’étape précédente'}
            data-testid="button-identity-verification-back"
          >
            <ArrowLeft size={22} strokeWidth={2} aria-hidden="true" />
          </button>
          <div className="sendflow-identity-heading">
            <h1 id="identity-title">Vérification d’identité</h1>
            <p>Suivez les instructions demandées</p>
          </div>
          <span className="sendflow-identity-header-spacer" aria-hidden="true" />
        </header>

        <div className="sendflow-identity-content">
          <ol className="sendflow-identity-progress" aria-label={`Étape ${step} sur 5`}>
            {Array.from({ length: 5 }, (_, index) => (
              <li
                key={index}
                className={index < step ? 'is-complete' : ''}
                aria-current={index === step - 1 ? 'step' : undefined}
                data-testid={`identity-progress-step-${index + 1}`}
              >
                {index < step ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}
              </li>
            ))}
          </ol>

          {step === 1 ? (
            <>
              <h2>Informations personnelles</h2>

              {profileQuery.isError && (
                <p className="sendflow-identity-profile-note" role="status">
                  Vos informations de compte ne sont pas disponibles pour le préremplissage. Vous pouvez les saisir ici.
                </p>
              )}

              <form className="sendflow-identity-form" onSubmit={handleSubmit} noValidate>
            <div className="sendflow-identity-field">
              <label htmlFor="identity-last-name">Nom</label>
              <input
                id="identity-last-name"
                name="lastName"
                type="text"
                autoComplete="family-name"
                maxLength={80}
                value={form.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
                aria-invalid={Boolean(errors.lastName)}
                aria-describedby={errors.lastName ? 'identity-last-name-error' : undefined}
                data-testid="input-identity-last-name"
                required
              />
              {errors.lastName && <p id="identity-last-name-error" className="sendflow-identity-error" role="alert">{errors.lastName}</p>}
            </div>

            <div className="sendflow-identity-field">
              <label htmlFor="identity-first-name">Prénom</label>
              <input
                id="identity-first-name"
                name="firstName"
                type="text"
                autoComplete="given-name"
                maxLength={80}
                value={form.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
                aria-invalid={Boolean(errors.firstName)}
                aria-describedby={errors.firstName ? 'identity-first-name-error' : undefined}
                data-testid="input-identity-first-name"
                required
              />
              {errors.firstName && <p id="identity-first-name-error" className="sendflow-identity-error" role="alert">{errors.firstName}</p>}
            </div>

            <div className="sendflow-identity-field">
              <label id="identity-document-type-label">Type de document</label>
              <Popover open={documentTypeOpen} onOpenChange={setDocumentTypeOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    aria-labelledby="identity-document-type-label"
                    aria-expanded={documentTypeOpen}
                    aria-haspopup="listbox"
                    aria-invalid={Boolean(errors.documentType)}
                    aria-describedby={errors.documentType ? 'identity-document-type-error' : undefined}
                    className={`sendflow-identity-select${errors.documentType ? ' has-error' : ''}`}
                    data-testid="button-identity-document-type"
                  >
                    <span>{form.documentType || 'Sélectionner un document'}</span>
                    <ChevronDown size={19} aria-hidden="true" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={5}
                  className="sendflow-identity-document-popover"
                  data-testid="popover-identity-document-type"
                >
                  <Command>
                    <CommandInput placeholder="Rechercher..." aria-label="Rechercher un type de document" />
                    <CommandList>
                      <CommandEmpty>Aucun type de document trouvé.</CommandEmpty>
                      {DOCUMENT_TYPES.map((documentType) => (
                        <CommandItem
                          key={documentType}
                          value={documentType}
                          onSelect={() => {
                            updateField('documentType', documentType);
                            setDocumentTypeOpen(false);
                          }}
                          data-testid={`option-identity-document-${DOCUMENT_TYPES.indexOf(documentType) + 1}`}
                        >
                          <span>{documentType}</span>
                          {form.documentType === documentType && <Check size={17} aria-hidden="true" />}
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.documentType && <p id="identity-document-type-error" className="sendflow-identity-error" role="alert">{errors.documentType}</p>}
            </div>

            <div className="sendflow-identity-field">
              <label htmlFor="identity-document-number">Numéro de la pièce d’identité</label>
              <input
                id="identity-document-number"
                name="documentNumber"
                type="text"
                autoComplete="off"
                maxLength={80}
                value={form.documentNumber}
                onChange={(event) => updateField('documentNumber', event.target.value)}
                aria-invalid={Boolean(errors.documentNumber)}
                aria-describedby={errors.documentNumber ? 'identity-document-number-error' : undefined}
                data-testid="input-identity-document-number"
                required
              />
              {errors.documentNumber && <p id="identity-document-number-error" className="sendflow-identity-error" role="alert">{errors.documentNumber}</p>}
            </div>

            <div className="sendflow-identity-field">
              <label htmlFor="identity-birth-date">Date de naissance</label>
              <div className={`sendflow-identity-date${errors.birthDate ? ' has-error' : ''}`}>
                <input
                  id="identity-birth-date"
                  name="birthDate"
                  type="date"
                  autoComplete="bday"
                  min={MIN_BIRTH_DATE}
                  max={getAdultBirthDateLimit()}
                  value={form.birthDate}
                  onChange={(event) => updateField('birthDate', event.target.value)}
                  aria-invalid={Boolean(errors.birthDate)}
                  aria-describedby={errors.birthDate ? 'identity-birth-date-error' : undefined}
                  data-testid="input-identity-birth-date"
                  required
                />
                <CalendarDays size={19} aria-hidden="true" />
              </div>
              {errors.birthDate && <p id="identity-birth-date-error" className="sendflow-identity-error" role="alert">{errors.birthDate}</p>}
            </div>

            <div className="sendflow-identity-field">
              <label htmlFor="identity-document-expiry">Date d’expiration de votre pièce d’identité</label>
              <div className={`sendflow-identity-date${errors.documentExpiryDate ? ' has-error' : ''}`}>
                <input
                  id="identity-document-expiry"
                  name="documentExpiryDate"
                  type="date"
                  min={today}
                  value={form.documentExpiryDate}
                  onChange={(event) => updateField('documentExpiryDate', event.target.value)}
                  aria-invalid={Boolean(errors.documentExpiryDate)}
                  aria-describedby={errors.documentExpiryDate ? 'identity-document-expiry-error' : undefined}
                  data-testid="input-identity-document-expiry"
                  required
                />
                <CalendarDays size={19} aria-hidden="true" />
              </div>
              {errors.documentExpiryDate && <p id="identity-document-expiry-error" className="sendflow-identity-error" role="alert">{errors.documentExpiryDate}</p>}
            </div>

            {notice && <p className="sendflow-identity-notice" role="status" aria-live="polite" data-testid="status-identity-verification">{notice}</p>}

                <button
                  type="submit"
                  className="sendflow-identity-submit"
                  data-testid="button-identity-verification-next"
                >
                  Suivant
                </button>
              </form>
            </>
          ) : (
            <section className="sendflow-identity-photo-flow" aria-labelledby="identity-photo-title">
              <h2 className="sendflow-identity-visually-hidden" id="identity-photo-title">{photoTitle}</h2>

              <figure className={`sendflow-identity-photo-stage${step === 4 ? ' is-selfie' : ''}${activePhoto ? ' has-photo' : ''}`}>
                <img
                  src={activePhoto?.previewUrl ?? photoIllustration}
                  alt={activePhoto ? `Aperçu de la photo sélectionnée : ${photoTitle.toLowerCase()}` : ''}
                  data-testid="img-identity-photo-preview"
                />
                {activePhoto && (
                  <figcaption className="sendflow-identity-photo-ready" data-testid="status-identity-photo-selected">
                    <Check size={15} aria-hidden="true" />
                    Photo sélectionnée
                  </figcaption>
                )}
              </figure>

              <p className="sendflow-identity-photo-caption">{photoTitle}</p>

              {step !== 4 ? (
                <section className="sendflow-identity-documents" aria-label="Pièces autorisées">
                  <p>Les pièces autorisées sont</p>
                  <ul>
                    {DOCUMENT_TYPES.map((documentType) => <li key={documentType}>{documentType}</li>)}
                  </ul>
                </section>
              ) : (
                <div className="sendflow-identity-selfie-tips">
                  <div className="sendflow-identity-tip">
                    <IdCard size={22} aria-hidden="true" />
                    <div>
                      <strong>Tenez votre pièce près de votre visage</strong>
                      <span>Toutes les informations doivent rester visibles.</span>
                    </div>
                  </div>
                  <div className="sendflow-identity-tip">
                    <Camera size={22} aria-hidden="true" />
                    <div>
                      <strong>Regardez la caméra</strong>
                      <span>Gardez votre visage centré et bien visible.</span>
                    </div>
                  </div>
                  <div className="sendflow-identity-tip">
                    <Sun size={22} aria-hidden="true" />
                    <div>
                      <strong>Choisissez une bonne luminosité</strong>
                      <span>La photo doit être nette et claire.</span>
                    </div>
                  </div>
                </div>
              )}

              <input
                ref={photoInputRef}
                className="sendflow-identity-file-input"
                type="file"
                accept="image/*"
                capture={step === 4 ? 'user' : 'environment'}
                onChange={handlePhotoSelected}
                aria-label={step === 4 ? 'Prendre un selfie' : 'Prendre une photo de la pièce'}
                data-testid="input-identity-photo"
              />

              <div className="sendflow-identity-photo-actions">
                <button
                  type="button"
                  className="sendflow-identity-submit sendflow-identity-capture"
                  onClick={() => photoInputRef.current?.click()}
                  data-testid="button-identity-photo-capture"
                >
                  <Camera size={27} strokeWidth={2.5} aria-hidden="true" />
                  {activePhoto
                    ? (step === 4 ? 'Reprendre le selfie' : 'Reprendre la photo')
                    : (step === 4 ? 'Prendre un selfie' : 'Prendre une photo')}
                </button>

                {(step === 2 || step === 3) && activePhoto && (
                  <button
                    type="button"
                    className="sendflow-identity-continue"
                    onClick={() => {
                      setStep(step === 2 ? 3 : 4);
                      setNotice('');
                    }}
                    data-testid="button-identity-photo-continue"
                  >
                    Continuer
                  </button>
                )}
              </div>

              {notice && <p className="sendflow-identity-error" role="alert" data-testid="status-identity-photo-error">{notice}</p>}
              {step === 4 && activePhoto && (
                <p className="sendflow-identity-next-step-note" role="status" data-testid="status-identity-next-step">
                  Votre selfie reste sur cet écran. La suite de la démarche sera ajoutée avec les prochaines instructions.
                </p>
              )}
            </section>
          )}

          <p className="sendflow-identity-privacy-note" role="note" data-testid="text-identity-verification-privacy">
            <LockKeyhole size={14} aria-hidden="true" />
            <span>Les éléments saisis ne sont pas transmis ni sauvegardés à cette étape</span>
          </p>
        </div>
      </section>
    </main>
  );
}
