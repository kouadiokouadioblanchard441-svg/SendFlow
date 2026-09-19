import { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useSeo } from '@/lib/seo';
import { CountryPhoneField } from '@/components/country-phone-field';
import { normalizePhone, validateSignIn, type SignInField } from '@/lib/auth-validation';
import { DEMO_ACCOUNT, DEMO_SESSION_KEY } from '@/lib/demo-account';
import { hasPin } from '@/lib/pin-storage';
import { AVATAR_USER_KEY } from '@/lib/avatar-bank';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import signinIllustration from '@assets/generated_images/sendflow-signin-security-3d-clean.png';
import signinPaymentsIllustration from '@assets/generated_images/sendflow-signin-payments-3d-clean.png';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitted(true);

    const isDemoAccount =
      normalizePhone(form.phone) === DEMO_ACCOUNT.phone &&
      form.password === DEMO_ACCOUNT.password;

    if (isDemoAccount) {
      window.sessionStorage.setItem(DEMO_SESSION_KEY, 'true');
      window.sessionStorage.setItem(AVATAR_USER_KEY, `phone:${normalizePhone(form.phone)}`);
      setLocation('/pin');
      return;
    }

    window.sessionStorage.removeItem(DEMO_SESSION_KEY);
    window.sessionStorage.setItem(AVATAR_USER_KEY, `phone:${normalizePhone(form.phone)}`);
    setLocation(hasPin() ? '/pin' : '/create-pin');
  };

  return (
    <main className="sendflow-signup-shell sendflow-auth-shell is-signin">
      <section className="sendflow-signup-card" aria-labelledby="signin-title">
        <div className="sendflow-auth-art is-signin-primary" aria-hidden="true">
          <span className="sendflow-auth-art-glow" />
          <img src={signinIllustration} alt="" loading="eager" decoding="async" />
        </div>
        <div className="sendflow-auth-art is-signin-secondary" aria-hidden="true">
          <span className="sendflow-auth-art-glow" />
          <img src={signinPaymentsIllustration} alt="" loading="eager" decoding="async" />
        </div>

        <div className="sendflow-signup-content">
          <Link href="/sign-in" className="sendflow-signup-brand" aria-label="SendFlow">
            <img src={sendflowMark} alt="" className="sendflow-signup-mark" />
            <img src={sendflowWordmark} alt="SendFlow" className="sendflow-signup-wordmark" />
          </Link>

          <header className="sendflow-signup-heading">
            <h1 id="signin-title">Bon retour sur SendFlow 😏</h1>
            <p>Connectez-vous à votre compte</p>
          </header>

          <form className="sendflow-signup-form" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
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

            <button type="submit" className="sendflow-signup-submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Connexion…' : 'Se connecter'}
            </button>

            {submitted && <p className="sendflow-signup-feedback" role="status" aria-live="polite">Connexion en cours…</p>}
          </form>

          <p className="sendflow-signup-login">
            Vous n’avez pas encore de compte ? <Link href="/sign-up">Créez-en un</Link>
          </p>
          <p className="sendflow-auth-legal">
            <Link href="/confidentialite">Confidentialité</Link>
          </p>
        </div>
      </section>
    </main>
  );
}