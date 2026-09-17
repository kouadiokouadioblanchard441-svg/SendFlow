import { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useSeo } from '@/lib/seo';
import { CountryPhoneField } from '@/components/country-phone-field';
import { validateSignIn, type SignInField } from '@/lib/auth-validation';
import { hasPin } from '@/lib/pin-storage';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';

type SignInForm = {
  phone: string;
  password: string;
};

const initialForm: SignInForm = {
  phone: '',
  password: '',
};

export default function SigninPage() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<SignInForm>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<SignInField, boolean>>>({});

  useSeo({
    path: '/sign-in',
    locale: 'fr',
    title: 'Connexion · SendFlow',
    description: 'Connectez-vous à votre compte SendFlow.',
    robots: 'noindex,nofollow',
  });

  const errors = useMemo(() => validateSignIn(form), [form]);
  const canSubmit = Object.keys(errors).length === 0;

  const update = <K extends keyof SignInForm>(key: K, value: SignInForm[K]) => {
    setSubmitted(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const markTouched = (field: SignInField) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const visibleError = (field: SignInField) =>
    (submitAttempted || touched[field]) ? errors[field] : undefined;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    if (!canSubmit) return;
    setLocation(hasPin() ? '/pin' : '/create-pin');
  };

  return (
    <main className="sendflow-signup-shell">
      <section className="sendflow-signup-card" aria-labelledby="signin-title">
        <div className="sendflow-signup-content">
          <Link href="/sign-in" className="sendflow-signup-brand" aria-label="SendFlow">
            <img src={sendflowMark} alt="" className="sendflow-signup-mark" />
            <img src={sendflowWordmark} alt="SendFlow" className="sendflow-signup-wordmark" />
          </Link>

          <header className="sendflow-signup-heading">
            <h1 id="signin-title">Bon retour sur SendFlow</h1>
            <p>Connectez-vous à votre compte</p>
          </header>

          <form className="sendflow-signup-form" onSubmit={handleSubmit} noValidate>
            <CountryPhoneField
              value={form.phone}
              onChange={(value) => update('phone', value)}
              error={visibleError('phone')}
              onBlur={() => markTouched('phone')}
            />

            <div className="sendflow-signup-control">
              <label className={`sendflow-signup-field${visibleError('password') ? ' has-error' : ''}`}>
                <span className="sr-only">Code secret</span>
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => update('password', event.target.value)}
                  onBlur={() => markTouched('password')}
                  placeholder="Code secret"
                  autoComplete="current-password"
                  maxLength={64}
                  aria-invalid={Boolean(visibleError('password'))}
                  aria-describedby={visibleError('password') ? 'signin-password-error' : undefined}
                  required
                />
                <button
                  type="button"
                  className="sendflow-signup-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Masquer le code secret' : 'Afficher le code secret'}
                >
                  {showPassword ? <Eye size={22} strokeWidth={1.65} /> : <EyeOff size={22} strokeWidth={1.65} />}
                </button>
              </label>
              {visibleError('password') && (
                <p id="signin-password-error" className="sendflow-signup-error" role="alert">
                  {visibleError('password')}
                </p>
              )}
            </div>

            <Link href="/forgot-password" className="sendflow-signup-forgot">
              Mot de passe oublié ?
            </Link>

            <button type="submit" className="sendflow-signup-submit" disabled={!canSubmit}>
              Se connecter
            </button>

            {submitted && <p className="sendflow-signup-feedback" role="status">Connexion en cours…</p>}
          </form>

          <p className="sendflow-signup-login">
            Vous n’avez pas encore de compte ? <Link href="/sign-up">Créez-en un</Link>
          </p>
        </div>
      </section>
    </main>
  );
}