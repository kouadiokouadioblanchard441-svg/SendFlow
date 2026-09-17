import { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from 'wouter';
import { useSeo } from '@/lib/seo';
import { CountryPhoneField } from '@/components/country-phone-field';
import { validateSignUp, type SignUpField } from '@/lib/auth-validation';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';

type SignUpForm = {
  fullName: string;
  phone: string;
  password: string;
  confirmation: string;
  acceptedTerms: boolean;
};

const initialForm: SignUpForm = {
  fullName: '',
  phone: '',
  password: '',
  confirmation: '',
  acceptedTerms: false,
};

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  id,
  error,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  id: string;
  error?: string;
  onBlur: () => void;
}) {
  return (
    <div className="sendflow-signup-control">
      <label className={`sendflow-signup-field${error ? ' has-error' : ''}`}>
        <span className="sr-only">{label}</span>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={label}
          autoComplete="new-password"
          maxLength={64}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          required
        />
        <button
          type="button"
          className="sendflow-signup-password-toggle"
          onClick={onToggle}
          aria-label={show ? `Masquer ${label.toLowerCase()}` : `Afficher ${label.toLowerCase()}`}
        >
          {show ? <Eye size={22} strokeWidth={1.65} /> : <EyeOff size={22} strokeWidth={1.65} />}
        </button>
      </label>
      {error && <p id={`${id}-error`} className="sendflow-signup-error" role="alert">{error}</p>}
    </div>
  );
}

export default function SignupPage() {
  const [form, setForm] = useState<SignUpForm>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<SignUpField, boolean>>>({});

  useSeo({
    path: '/sign-up',
    locale: 'fr',
    title: 'Créer un compte · SendFlow',
    description: 'Créez votre compte SendFlow.',
    robots: 'noindex,nofollow',
  });

  const errors = useMemo(() => validateSignUp(form), [form]);
  const canSubmit = Object.keys(errors).length === 0;

  const update = <K extends keyof SignUpForm>(key: K, value: SignUpForm[K]) => {
    setSubmitted(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const markTouched = (field: SignUpField) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const visibleError = (field: SignUpField) =>
    (submitAttempted || touched[field]) ? errors[field] : undefined;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    if (!canSubmit) return;
    setSubmitted(true);
  };

  return (
    <main className="sendflow-signup-shell">
      <section className="sendflow-signup-card" aria-labelledby="signup-title">
        <div className="sendflow-signup-content">
          <Link href="/" className="sendflow-signup-brand" aria-label="Retour à l’accueil SendFlow">
            <img src={sendflowMark} alt="" className="sendflow-signup-mark" />
            <img src={sendflowWordmark} alt="SendFlow" className="sendflow-signup-wordmark" />
          </Link>

          <header className="sendflow-signup-heading">
            <h1 id="signup-title">Bienvenue sur SendFlow</h1>
            <p>Créons votre compte</p>
          </header>

          <form className="sendflow-signup-form" onSubmit={handleSubmit} noValidate>
            <div className="sendflow-signup-control">
              <label className={`sendflow-signup-field${visibleError('fullName') ? ' has-error' : ''}`}>
                <span className="sr-only">Nom et prénom</span>
                <input
                  id="signup-full-name"
                  type="text"
                  value={form.fullName}
                  onChange={(event) => update('fullName', event.target.value)}
                  onBlur={() => markTouched('fullName')}
                  placeholder="Nom et prénom"
                  autoComplete="name"
                  maxLength={80}
                  aria-invalid={Boolean(visibleError('fullName'))}
                  aria-describedby={visibleError('fullName') ? 'signup-full-name-error' : undefined}
                  required
                />
              </label>
              {visibleError('fullName') && (
                <p id="signup-full-name-error" className="sendflow-signup-error" role="alert">
                  {visibleError('fullName')}
                </p>
              )}
            </div>

            <CountryPhoneField
              value={form.phone}
              onChange={(value) => update('phone', value)}
              error={visibleError('phone')}
              onBlur={() => markTouched('phone')}
            />

            <PasswordField
              label="Code secret"
              id="signup-password"
              value={form.password}
              onChange={(value) => update('password', value)}
              show={showPassword}
              onToggle={() => setShowPassword((current) => !current)}
              error={visibleError('password')}
              onBlur={() => markTouched('password')}
            />

            <PasswordField
              label="Confirmer code secret"
              id="signup-confirmation"
              value={form.confirmation}
              onChange={(value) => update('confirmation', value)}
              show={showConfirmation}
              onToggle={() => setShowConfirmation((current) => !current)}
              error={visibleError('confirmation')}
              onBlur={() => markTouched('confirmation')}
            />

            <div className="sendflow-signup-control">
              <label className="sendflow-signup-terms">
                <input
                  type="checkbox"
                  checked={form.acceptedTerms}
                  onChange={(event) => update('acceptedTerms', event.target.checked)}
                  onBlur={() => markTouched('acceptedTerms')}
                  aria-invalid={Boolean(visibleError('acceptedTerms'))}
                  aria-describedby={visibleError('acceptedTerms') ? 'signup-terms-error' : undefined}
                  required
                />
                <span>
                  J’accepte les{' '}
                  <Link href="/conditions-utilisation">conditions générales d’utilisation</Link>
                </span>
              </label>
              {visibleError('acceptedTerms') && (
                <p id="signup-terms-error" className="sendflow-signup-error" role="alert">
                  {visibleError('acceptedTerms')}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="sendflow-signup-submit"
              disabled={!canSubmit}
            >
              Créer
            </button>

            {submitted && (
              <p className="sendflow-signup-feedback" role="status">
                Votre formulaire est prêt. La création de compte sera activée avec le parcours d’authentification SendFlow.
              </p>
            )}
          </form>

          <p className="sendflow-signup-login">
            Vous avez déjà un compte ? <Link href="/sign-in">Connectez-vous</Link>
          </p>
        </div>
      </section>
    </main>
  );
}