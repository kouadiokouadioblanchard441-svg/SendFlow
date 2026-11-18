import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import TurnstileWidget, { type TurnstileWidgetHandle } from '@/components/turnstile-widget';
import { useSeo } from '@/lib/seo';
import { customerAuthRoutes } from '@/lib/customer-auth-routes';
import { validateSignIn, type SignInField } from '@/lib/auth-validation';
import { useSignInCustomer, useVerifyEmailOtp } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { clearPinUnlock } from '@/lib/pin-unlock';
import { clearLegacyAccountProfile } from '@/lib/account-profile';
import { ErrorDialog } from '@/components/error-dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import sendflowMark from '@/assets/sendflow-mark-original.png';
import sendflowWordmark from '@/assets/sendflow-wordmark-original.png';
import signinIllustration from '@assets/generated_images/sendflow-signin-security-3d-clean.png';
import signinPaymentsIllustration from '@assets/generated_images/sendflow-signin-payments-3d-clean.png';

type SignInForm = {
  email: string;
  password: string;
};

type LoginOtpChallenge = {
  challengeId: string;
  expiresAt: string;
  resendAfterSeconds: number;
};

const initialForm: SignInForm = {
  email: '',
  password: '',
};

export default function SigninPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SignInForm>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<SignInField, boolean>>>({});
  const [formError, setFormError] = useState('');
  const [otpChallenge, setOtpChallenge] = useState<LoginOtpChallenge | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpTurnstileToken, setOtpTurnstileToken] = useState<string | null>(null);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const submissionLock = useRef(false);
  const signInCustomer = useSignInCustomer();
  const verifyEmailOtp = useVerifyEmailOtp();

  useSeo({
    path: '/sign-in',
    locale: 'fr',
    title: 'Connexion · SendFlow',
    description: 'Connectez-vous à votre compte SendFlow.',
    robots: 'noindex,nofollow',
  });

  const errors = useMemo(() => validateSignIn(form), [form]);
  const canSubmit = Object.keys(errors).length === 0;

  useEffect(() => {
    if (!otpChallenge) return;
    const updateCountdown = () => {
      const now = Date.now();
      setOtpSecondsLeft(Math.max(0, Math.ceil((Date.parse(otpChallenge.expiresAt) - now) / 1000)));
      setResendSecondsLeft(Math.max(0, otpChallenge.resendAfterSeconds));
    };
    updateCountdown();
    const timer = window.setInterval(() => {
      setResendSecondsLeft((remaining) => Math.max(0, remaining - 1));
      setOtpSecondsLeft((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpChallenge]);

  const update = <K extends keyof SignInForm>(key: K, value: SignInForm[K]) => {
    setSubmitted(false);
    setFormError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const markTouched = (field: SignInField) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const visibleError = (field: SignInField) =>
    (submitAttempted || touched[field]) ? errors[field] : undefined;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    if (!canSubmit) {
      setFormError(Object.values(errors).filter(Boolean).join(' '));
      return;
    }
    if (!turnstileToken) {
      setFormError('Validez le contrôle de sécurité avant de continuer.');
      return;
    }
    if (isSubmitting || submissionLock.current) return;
    const oneTimeToken = turnstileToken;
    submissionLock.current = true;
    setTurnstileToken(null);
    turnstileRef.current?.reset();
    setIsSubmitting(true);
    setSubmitted(false);
    try {
      await submitPassword(oneTimeToken);
    } catch {
      // The global API error dialog displays a sanitized, status-specific message.
    } finally {
      setIsSubmitting(false);
      submissionLock.current = false;
    }
  };

  const submitPassword = async (token: string) => {
    const response = await signInCustomer.mutateAsync({
      data: {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        turnstileToken: token,
      },
    });
    if (!('pinConfigured' in response)) {
      clearLegacyAccountProfile();
      queryClient.clear();
      clearPinUnlock();
      setOtpCode('');
      setOtpChallenge({
        challengeId: response.challengeId,
        expiresAt: response.expiresAt,
        resendAfterSeconds: response.resendAfterSeconds,
      });
      setOtpTurnstileToken(null);
      setTurnstileToken(null);
      turnstileRef.current?.reset();
      return;
    }
    clearLegacyAccountProfile();
    queryClient.clear();
    clearPinUnlock();
    setSubmitted(true);
    setForm(initialForm);
    setLocation(response.pinConfigured ? '/pin' : '/create-pin');
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    if (!otpChallenge || !/^\d{6}$/.test(otpCode)) {
      setFormError('Saisissez le code à 6 chiffres reçu par e-mail.');
      return;
    }
    if (otpSecondsLeft <= 0) {
      setFormError('Ce code a expiré. Demandez un nouveau code.');
      return;
    }
    if (!otpTurnstileToken) {
      setFormError('Validez le contrôle de sécurité avant de continuer.');
      return;
    }
    if (isSubmitting || submissionLock.current) return;
    const oneTimeToken = otpTurnstileToken;
    submissionLock.current = true;
    setOtpTurnstileToken(null);
    turnstileRef.current?.reset();
    setIsSubmitting(true);
    try {
      await verifyEmailOtp.mutateAsync({
        data: {
          challengeId: otpChallenge.challengeId,
          purpose: 'customer_login',
          code: otpCode,
          turnstileToken: oneTimeToken,
        },
      });
      clearLegacyAccountProfile();
      queryClient.clear();
      clearPinUnlock();
      setForm(initialForm);
      setOtpChallenge(null);
      setOtpCode('');
      setLocation('/pin');
    } catch {
      // The global API error dialog displays a sanitized, status-specific message.
    } finally {
      setIsSubmitting(false);
      submissionLock.current = false;
    }
  };

  const handleResendOtp = async () => {
    if (!otpChallenge || resendSecondsLeft > 0 || !canSubmit) return;
    if (!turnstileToken) {
      setFormError('Validez le contrôle de sécurité pour renvoyer le code.');
      return;
    }
    if (isSubmitting || submissionLock.current) return;
    const oneTimeToken = turnstileToken;
    submissionLock.current = true;
    setTurnstileToken(null);
    turnstileRef.current?.reset();
    setIsSubmitting(true);
    try {
      await submitPassword(oneTimeToken);
    } catch {
      // The global API error dialog displays a sanitized, status-specific message.
    } finally {
      setIsSubmitting(false);
      submissionLock.current = false;
    }
  };

  const resetOtpStep = () => {
    if (isSubmitting) return;
    setOtpChallenge(null);
    setOtpCode('');
    setOtpTurnstileToken(null);
    setTurnstileToken(null);
    setForm(initialForm);
    turnstileRef.current?.reset();
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
          <Link href={customerAuthRoutes.signIn} className="sendflow-signup-brand" aria-label="SendFlow">
            <img src={sendflowMark} alt="" className="sendflow-signup-mark" />
            <img src={sendflowWordmark} alt="SendFlow" className="sendflow-signup-wordmark" />
          </Link>

          <header className="sendflow-signup-heading">
            <h1 id="signin-title">{otpChallenge ? 'Vérifiez votre connexion' : 'Bon retour sur SendFlow 😏'}</h1>
            <p>{otpChallenge ? 'Saisissez le code envoyé à votre adresse e-mail avant de continuer vers votre PIN.' : 'Connectez-vous à votre compte'}</p>
          </header>

          {!otpChallenge ? (
          <form className="sendflow-signup-form" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
            <div className="sendflow-signup-control">
              <label className={`sendflow-signup-field${visibleError('email') ? ' has-error' : ''}`}>
                <span className="sr-only">Adresse e-mail</span>
                <input
                  id="signin-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => update('email', event.target.value)}
                  onBlur={() => markTouched('email')}
                  placeholder="Adresse e-mail"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  maxLength={254}
                  aria-invalid={Boolean(visibleError('email'))}
                  required
                />
              </label>
            </div>

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
            </div>

            <Link href={customerAuthRoutes.passwordReset} className="sendflow-signup-forgot">
              Mot de passe oublié ?
            </Link>

            <TurnstileWidget
              ref={turnstileRef}
              action="login"
              onTokenChange={setTurnstileToken}
              onErrorMessage={setFormError}
            />

            <button type="submit" className="sendflow-signup-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Connexion…' : 'Se connecter'}
            </button>

            {submitted && <p className="sendflow-signup-feedback" role="status" aria-live="polite">Connexion en cours…</p>}
          </form>
          ) : (
            <form className="sendflow-signup-verification" onSubmit={handleOtpSubmit} noValidate aria-busy={isSubmitting}>
              <p className="sendflow-signup-verification-heading">Code envoyé à {form.email.trim().toLowerCase()}</p>
              <div className="sendflow-signup-otp-wrap">
                <InputOTP
                  id="login-email-otp"
                  maxLength={6}
                  value={otpCode}
                  onChange={(value) => setOtpCode(value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoFocus
                  aria-label="Code de vérification à 6 chiffres"
                  containerClassName="sendflow-signup-otp"
                  data-testid="input-login-email-otp"
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }, (_, index) => (
                      <InputOTPSlot key={index} index={index} className="sendflow-signup-otp-slot" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className={`sendflow-signup-verification-timing${otpSecondsLeft === 0 ? ' is-expired' : ''}`} role="status" aria-live="polite">
                {otpSecondsLeft > 0 ? `Le code expire dans ${otpSecondsLeft}s.` : 'Le code a expiré. Renvoyez-en un pour continuer.'}
              </p>
              <TurnstileWidget
                ref={turnstileRef}
                action="login"
                onTokenChange={setOtpTurnstileToken}
                onErrorMessage={setFormError}
              />
              <div className="sendflow-signup-verification-actions">
                <button type="submit" className="sendflow-signup-submit sendflow-signup-check" disabled={isSubmitting || otpSecondsLeft <= 0} data-testid="button-verify-login-otp">
                  {isSubmitting ? 'Vérification…' : 'Vérifier le code'}
                </button>
                <button type="button" className="sendflow-signup-secondary-action" onClick={() => void handleResendOtp()} disabled={isSubmitting || resendSecondsLeft > 0}>
                  {isSubmitting ? 'Envoi…' : resendSecondsLeft > 0 ? `Renvoyer dans ${resendSecondsLeft}s` : 'Renvoyer le code'}
                </button>
                <button type="button" className="sendflow-signup-secondary-action" onClick={resetOtpStep} disabled={isSubmitting}>
                  Recommencer la connexion
                </button>
              </div>
            </form>
          )}

          <p className="sendflow-signup-login">
            {!otpChallenge && <>Vous n’avez pas encore de compte ? <Link href={customerAuthRoutes.signUp}>Créez-en un</Link></>}
          </p>
          <p className="sendflow-auth-legal">
            <Link href="/confidentialite">Confidentialité</Link>
          </p>
        </div>
      </section>
      <ErrorDialog
        open={Boolean(formError)}
        title="Connexion impossible"
        message={formError}
        onClose={() => setFormError('')}
      />
    </main>
  );
}