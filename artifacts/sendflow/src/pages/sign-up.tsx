import { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from 'wouter';
import { useSeo } from '@/lib/seo';
import { CountryPhoneField } from '@/components/country-phone-field';
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="sendflow-signup-field">
      <span className="sr-only">{label}</span>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        autoComplete={label === 'Code secret' ? 'new-password' : 'new-password'}
        required
      />
      <button
        type="button"
        className="sendflow-signup-password-toggle"
        onClick={onToggle}
        aria-label={show ? `Masquer ${label.toLowerCase()}` : `Afficher ${label.toLowerCase()}`}
      >
        {show ? <EyeOff size={22} strokeWidth={1.65} /> : <Eye size={22} strokeWidth={1.65} />}
      </button>
    </label>
  );
}

export default function SignupPage() {
  const [form, setForm] = useState<SignUpForm>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useSeo({
    path: '/sign-up',
    locale: 'fr',
    title: 'Créer un compte · SendFlow',
    description: 'Créez votre compte SendFlow.',
    robots: 'noindex,nofollow',
  });

  const canSubmit = useMemo(
    () =>
      form.fullName.trim().length > 1 &&
      form.phone.trim().length >= 6 &&
      form.password.length >= 4 &&
      form.password === form.confirmation &&
      form.acceptedTerms,
    [form],
  );

  const update = <K extends keyof SignUpForm>(key: K, value: SignUpForm[K]) => {
    setSubmitted(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

          <form className="sendflow-signup-form" onSubmit={handleSubmit}>
            <label className="sendflow-signup-field">
              <span className="sr-only">Nom et prénom</span>
              <input
                type="text"
                value={form.fullName}
                onChange={(event) => update('fullName', event.target.value)}
                placeholder="Nom et prénom"
                autoComplete="name"
                required
              />
            </label>

            <CountryPhoneField value={form.phone} onChange={(value) => update('phone', value)} />

            <PasswordField
              label="Code secret"
              value={form.password}
              onChange={(value) => update('password', value)}
              show={showPassword}
              onToggle={() => setShowPassword((current) => !current)}
            />

            <PasswordField
              label="Confirmer code secret"
              value={form.confirmation}
              onChange={(value) => update('confirmation', value)}
              show={showConfirmation}
              onToggle={() => setShowConfirmation((current) => !current)}
            />

            <label className="sendflow-signup-terms">
              <input
                type="checkbox"
                checked={form.acceptedTerms}
                onChange={(event) => update('acceptedTerms', event.target.checked)}
              />
              <span>
                J’accepte les{' '}
                <Link href="/conditions-utilisation">conditions générales d’utilisation</Link>
              </span>
            </label>

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