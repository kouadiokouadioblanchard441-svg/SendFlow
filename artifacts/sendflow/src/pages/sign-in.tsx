import { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from 'wouter';
import { useSeo } from '@/lib/seo';
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
  const [form, setForm] = useState<SignInForm>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useSeo({
    path: '/sign-in',
    locale: 'fr',
    title: 'Connexion · SendFlow',
    description: 'Connectez-vous à votre compte SendFlow.',
    robots: 'noindex,nofollow',
  });

  const canSubmit = useMemo(
    () => form.phone.trim().length >= 6 && form.password.length >= 4,
    [form],
  );

  const update = <K extends keyof SignInForm>(key: K, value: SignInForm[K]) => {
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
      <section className="sendflow-signup-card" aria-labelledby="signin-title">
        <div className="sendflow-signup-content">
          <Link href="/" className="sendflow-signup-brand" aria-label="Retour à l’accueil SendFlow">
            <img src={sendflowMark} alt="" className="sendflow-signup-mark" />
            <img src={sendflowWordmark} alt="SendFlow" className="sendflow-signup-wordmark" />
          </Link>

          <header className="sendflow-signup-heading">
            <h1 id="signin-title">Bon retour sur SendFlow</h1>
            <p>Connectez-vous à votre compte</p>
          </header>

          <form className="sendflow-signup-form" onSubmit={handleSubmit}>
            <label className="sendflow-signup-phone">
              <span className="sendflow-signup-country">
                <span aria-hidden="true">🇧🇯</span>
                <span>+229</span>
              </span>
              <span className="sr-only">Numéro de téléphone</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => update('phone', event.target.value.replace(/[^\d\s()-]/g, ''))}
                placeholder="Numéro de téléphone"
                autoComplete="tel"
                inputMode="tel"
                required
              />
            </label>

            <label className="sendflow-signup-field">
              <span className="sr-only">Code secret</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
                placeholder="Code secret"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="sendflow-signup-password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Masquer le code secret' : 'Afficher le code secret'}
              >
                {showPassword ? <EyeOff size={22} strokeWidth={1.65} /> : <Eye size={22} strokeWidth={1.65} />}
              </button>
            </label>

            <button type="submit" className="sendflow-signup-submit" disabled={!canSubmit}>
              Se connecter
            </button>

            {submitted && (
              <p className="sendflow-signup-feedback" role="status">
                Votre formulaire est prêt. La connexion sera activée avec le parcours d’authentification SendFlow.
              </p>
            )}
          </form>

          <p className="sendflow-signup-login">
            Vous n’avez pas encore de compte ? <Link href="/sign-up">Créez-en un</Link>
          </p>
        </div>
      </section>
    </main>
  );
}