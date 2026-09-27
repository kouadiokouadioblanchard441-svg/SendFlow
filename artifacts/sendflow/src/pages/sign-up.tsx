import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useSendPhoneOtp, useVerifyPhoneOtp } from '@workspace/api-client-react';
import { useSeo } from '@/lib/seo';
import { CountryPhoneField } from '@/components/country-phone-field';
import { getAdultBirthDateLimit, MIN_BIRTH_DATE, validateSignUp, type SignUpField } from '@/lib/auth-validation';
import { DEFAULT_ACCOUNT_COUNTRY, saveAccountCountry, type AccountCountry } from '@/lib/account-country';
import { saveAccountProfile, splitFullName } from '@/lib/account-profile';
import { normalizePhoneDigits } from '@/lib/phone-rules';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import signupIllustration from '@assets/generated_images/sendflow-signup-welcome-3d-clean.png';
import signupProfileIllustration from '@assets/generated_images/sendflow-signup-profile-3d-clean.png';

type SignUpForm = {
  fullName: string;
  birthDate: string;
  phone: string;
  password: string;
  confirmation: string;
  acceptedPrivacy: boolean;
};

const initialForm: SignUpForm = {
  fullName: '',
  birthDate: '2000-01-01',
  phone: '',
  password: '',
  confirmation: '',
  acceptedPrivacy: false,
};

type SignupStep = 'form' | 'verification' | 'success';

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      error?: string;
      message?: string;
      data?: { error?: string; message?: string };
      response?: { data?: { error?: string; message?: string } };
    };
    return candidate.error
      ?? candidate.message
      ?? candidate.data?.error
      ?? candidate.data?.message
      ?? candidate.response?.data?.error
      ?? candidate.response?.data?.message
      ?? fallback;
  }
  return fallback;
}

function getRetryAfterSeconds(error: unknown) {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate = error as {
    retryAfterSeconds?: number;
    data?: { retryAfterSeconds?: number };
    response?: { data?: { retryAfterSeconds?: number } };
  };
  return candidate.retryAfterSeconds
    ?? candidate.data?.retryAfterSeconds
    ?? candidate.response?.data?.retryAfterSeconds;
}

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
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<SignUpForm>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<SignUpField, boolean>>>({});
  const [signupCountry, setSignupCountry] = useState<AccountCountry>(DEFAULT_ACCOUNT_COUNTRY);
  const [step, setStep] = useState<SignupStep>('form');
  const [challengeId, setChallengeId] = useState('');
  const [challengeExpiresAt, setChallengeExpiresAt] = useState('');
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [expiresInSeconds, setExpiresInSeconds] = useState(0);
  const [resendInSeconds, setResendInSeconds] = useState(0);
  const [otpCode, setOtpCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const sendPhoneOtp = useSendPhoneOtp();
  const verifyPhoneOtp = useVerifyPhoneOtp();

  useSeo({
    path: '/sign-up',
    locale: 'fr',
    title: 'Créer un compte · SendFlow',
    description: 'Créez votre compte SendFlow.',
    robots: 'noindex,nofollow',
  });

  const errors = useMemo(() => validateSignUp(form, signupCountry.dialCode), [form, signupCountry.dialCode]);
  const canSubmit = Object.keys(errors).length === 0;
  const normalizedPhone = normalizePhoneDigits(form.phone);
  const e164Phone = `${signupCountry.dialCode}${normalizedPhone}`;
  const isSending = sendPhoneOtp.isPending;
  const isChecking = verifyPhoneOtp.isPending;

  const update = <K extends keyof SignUpForm>(key: K, value: SignUpForm[K]) => {
    setSubmitted(false);
    if (key === 'phone' && value !== form.phone && challengeId) {
      setStep('form');
      setChallengeId('');
      setChallengeExpiresAt('');
      setResendAvailableAt(0);
      setOtpCode('');
      setVerificationError('');
    }
    setForm((current) => ({ ...current, [key]: value }));
  };

  const markTouched = (field: SignUpField) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const visibleError = (field: SignUpField) =>
    (submitAttempted || touched[field]) ? errors[field] : undefined;

  useEffect(() => {
    if (step !== 'verification' || !challengeExpiresAt) return;

    const updateTiming = () => {
      const now = Date.now();
      const expiry = new Date(challengeExpiresAt).getTime();
      setExpiresInSeconds(Number.isFinite(expiry) ? Math.max(0, Math.ceil((expiry - now) / 1000)) : 0);
      setResendInSeconds(Math.max(0, Math.ceil((resendAvailableAt - now) / 1000)));
    };

    updateTiming();
    const timer = window.setInterval(updateTiming, 1000);
    return () => window.clearInterval(timer);
  }, [challengeExpiresAt, resendAvailableAt, step]);

  useEffect(() => {
    if (step !== 'success') return;
    const timer = window.setTimeout(() => setLocation('/create-pin'), 700);
    return () => window.clearTimeout(timer);
  }, [setLocation, step]);

  const resetChallenge = () => {
    setStep('form');
    setChallengeId('');
    setChallengeExpiresAt('');
    setResendAvailableAt(0);
    setExpiresInSeconds(0);
    setResendInSeconds(0);
    setOtpCode('');
    setVerificationError('');
  };

  const savePendingSignup = () => {
    saveAccountCountry(signupCountry);
    saveAccountProfile({
      ...splitFullName(form.fullName),
      birthDate: form.birthDate,
    });
    window.sessionStorage.setItem('sendflow.pending-signup', 'true');
  };

  const sendCode = async () => {
    setVerificationError('');
    try {
      const response = await sendPhoneOtp.mutateAsync({ data: { phone: e164Phone } });
      setChallengeId(response.challengeId);
      setChallengeExpiresAt(response.expiresAt);
      setResendAvailableAt(Date.now() + response.resendAfterSeconds * 1000);
      setOtpCode('');
      setStep('verification');
    } catch (error) {
      const retryAfterSeconds = getRetryAfterSeconds(error);
      if (retryAfterSeconds !== undefined) {
        setResendAvailableAt(Date.now() + retryAfterSeconds * 1000);
      }
      setVerificationError(getRequestErrorMessage(error, 'Impossible d’envoyer le code. Vérifiez le numéro puis réessayez.'));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    if (!canSubmit || isSending) return;
    await sendCode();
  };

  const handleVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setVerificationError('');
    if (!challengeId || expiresInSeconds === 0) {
      setVerificationError('Ce code a expiré. Demandez un nouveau code pour continuer.');
      return;
    }
    if (!/^\d{6}$/.test(otpCode)) {
      setVerificationError('Saisissez les 6 chiffres reçus par SMS.');
      return;
    }

    try {
      const response = await verifyPhoneOtp.mutateAsync({ data: { challengeId, code: otpCode } });
      if (!response.phoneVerified) {
        setVerificationError('Le numéro n’a pas pu être vérifié. Vérifiez le code puis réessayez.');
        return;
      }
      savePendingSignup();
      setSubmitted(true);
      setStep('success');
    } catch (error) {
      setOtpCode('');
      setVerificationError(getRequestErrorMessage(error, 'Code incorrect ou expiré. Vérifiez les chiffres puis réessayez.'));
    }
  };

  return (
    <main className="sendflow-signup-shell sendflow-auth-shell is-signup">
      <section className="sendflow-signup-card" aria-labelledby="signup-title">
        <div className="sendflow-auth-art is-signup-primary" aria-hidden="true">
          <span className="sendflow-auth-art-glow" />
          <img src={signupIllustration} alt="" loading="eager" decoding="async" />
        </div>
        <div className="sendflow-auth-art is-signup-secondary" aria-hidden="true">
          <span className="sendflow-auth-art-glow" />
          <img src={signupProfileIllustration} alt="" loading="eager" decoding="async" />
        </div>

        <div className="sendflow-signup-content">
          <Link href="/sign-up" className="sendflow-signup-brand" aria-label="SendFlow">
            <img src={sendflowMark} alt="" className="sendflow-signup-mark" />
            <img src={sendflowWordmark} alt="SendFlow" className="sendflow-signup-wordmark" />
          </Link>

          <header className="sendflow-signup-heading">
            <h1 id="signup-title">
              {step === 'form' ? 'Bienvenue sur SendFlow' : step === 'verification' ? 'Vérifions votre numéro' : 'Numéro vérifié'}
            </h1>
            <p>
              {step === 'form' ? 'Créons votre compte' : step === 'verification' ? 'Une étape rapide avant de continuer' : 'Votre compte peut maintenant être sécurisé'}
            </p>
          </header>

          {step === 'form' && (
          <form className="sendflow-signup-form" onSubmit={handleSubmit} noValidate aria-busy={isSending}>
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

            <div className="sendflow-signup-control">
              <label className={`sendflow-signup-field sendflow-signup-date-field${visibleError('birthDate') ? ' has-error' : ''}`}>
                <span className="sr-only">Date de naissance</span>
                <input
                  id="signup-birth-date"
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => update('birthDate', event.target.value)}
                  onBlur={() => markTouched('birthDate')}
                  min={MIN_BIRTH_DATE}
                  max={getAdultBirthDateLimit()}
                  aria-label="Date de naissance"
                  autoComplete="bday"
                  title="Sélectionnez votre date de naissance"
                  aria-invalid={Boolean(visibleError('birthDate'))}
                  aria-describedby={visibleError('birthDate') ? 'signup-birth-date-error' : undefined}
                  required
                />
              </label>
              {visibleError('birthDate') && (
                <p id="signup-birth-date-error" className="sendflow-signup-error" role="alert">
                  {visibleError('birthDate')}
                </p>
              )}
            </div>

            <CountryPhoneField
              value={form.phone}
              onChange={(value) => update('phone', value)}
              onCountryChange={(country) => {
                if (challengeId) resetChallenge();
                setSignupCountry(country);
              }}
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
              <label className="sendflow-signup-privacy">
                <input
                  type="checkbox"
                  checked={form.acceptedPrivacy}
                  onChange={(event) => update('acceptedPrivacy', event.target.checked)}
                  onBlur={() => markTouched('acceptedPrivacy')}
                  aria-invalid={Boolean(visibleError('acceptedPrivacy'))}
                  aria-describedby={visibleError('acceptedPrivacy') ? 'signup-privacy-error' : undefined}
                  required
                />
                <span>
                  J’accepte la <Link href="/confidentialite">politique de confidentialité</Link>
                </span>
              </label>
              {visibleError('acceptedPrivacy') && (
                <p id="signup-privacy-error" className="sendflow-signup-error" role="alert">
                  {visibleError('acceptedPrivacy')}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="sendflow-signup-submit"
              disabled={!canSubmit || isSending}
            >
              {isSending ? 'Envoi du code…' : 'Continuer'}
            </button>

            {verificationError && (
              <p className="sendflow-signup-verification-error" role="alert" data-testid="error-send-phone-otp">
                {verificationError}
              </p>
            )}

            {submitted && <p className="sendflow-signup-feedback" role="status" aria-live="polite">Création de votre compte…</p>}
          </form>
          )}

          {step === 'verification' && (
            <form className="sendflow-signup-verification" onSubmit={handleVerification} noValidate aria-busy={isChecking}>
              <p className="sendflow-signup-verification-heading">Saisissez le code à 6 chiffres</p>
              <p className="sendflow-signup-verification-copy">
                Nous avons envoyé un code à <span className="sendflow-signup-verification-number">{e164Phone}</span>.
              </p>

              <div className="sendflow-signup-otp-wrap">
                <InputOTP
                  id="signup-phone-otp"
                  maxLength={6}
                  value={otpCode}
                  onChange={(value) => {
                    setVerificationError('');
                    setOtpCode(value.replace(/\D/g, '').slice(0, 6));
                  }}
                  inputMode="numeric"
                  autoFocus
                  aria-label="Code de vérification à 6 chiffres"
                  aria-describedby="signup-otp-help"
                  containerClassName="sendflow-signup-otp"
                  data-testid="input-phone-otp"
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }, (_, index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="sendflow-signup-otp-slot"
                        data-testid={`input-phone-otp-slot-${index + 1}`}
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <p
                id="signup-otp-help"
                className={`sendflow-signup-verification-timing${expiresInSeconds === 0 ? ' is-expired' : ''}`}
                role="status"
                aria-live="polite"
                data-testid="status-phone-otp-timing"
              >
                {expiresInSeconds > 0
                  ? `Le code expire dans ${expiresInSeconds}s.`
                  : 'Ce code a expiré. Demandez-en un nouveau.'}
              </p>

              {verificationError && (
                <p className="sendflow-signup-verification-error" role="alert" data-testid="error-phone-otp">
                  {verificationError}
                </p>
              )}

              <div className="sendflow-signup-verification-actions">
                <button
                  type="submit"
                  className="sendflow-signup-submit sendflow-signup-check"
                  disabled={otpCode.length !== 6 || isChecking || expiresInSeconds === 0}
                  data-testid="button-check-phone-otp"
                >
                  {isChecking ? 'Vérification…' : 'Vérifier le numéro'}
                </button>
                <button
                  type="button"
                  className="sendflow-signup-secondary-action"
                  onClick={sendCode}
                  disabled={isSending || resendInSeconds > 0}
                  data-testid="button-resend-phone-otp"
                >
                  {isSending
                    ? 'Nouvel envoi…'
                    : resendInSeconds > 0
                      ? `Renvoyer dans ${resendInSeconds}s`
                      : 'Renvoyer le code'}
                </button>
                <button
                  type="button"
                  className="sendflow-signup-secondary-action"
                  onClick={resetChallenge}
                  disabled={isChecking || isSending}
                  data-testid="button-edit-phone"
                >
                  Modifier le numéro
                </button>
              </div>
            </form>
          )}

          {step === 'success' && (
            <div className="sendflow-signup-verification-success" role="status" aria-live="polite" data-testid="status-phone-verified">
              <span className="sendflow-signup-verification-success-mark" aria-hidden="true">
                <Check size={25} strokeWidth={2.2} />
              </span>
              <strong>Votre numéro est vérifié</strong>
              <p>Préparation de la suite de votre inscription…</p>
            </div>
          )}

          <p className="sendflow-signup-login">
            Vous avez déjà un compte ? <Link href="/sign-in">Connectez-vous</Link>
          </p>
        </div>
      </section>
    </main>
  );
}