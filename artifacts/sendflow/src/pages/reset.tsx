import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import TurnstileWidget, { type TurnstileWidgetHandle } from '@/components/turnstile-widget';
import { useSeo } from '@/lib/seo';
import { CountryPhoneField } from '@/components/country-phone-field';
import { useResetCustomerPassword, useResetCustomerPin, useSendEmailOtp, useVerifyEmailOtp } from '@workspace/api-client-react';
import { clearPinUnlock } from '@/lib/pin-unlock';
import { NEW_CUSTOMER_PASSWORD_MIN_LENGTH } from '@/lib/customer-password-validation';
import { getPhoneLengthMessage, isValidPhoneForCountry } from '@/lib/phone-rules';
import { getSafeApiErrorCopy } from '@/lib/safe-api-error';
import sendflowMark from '@/assets/sendflow-mark-original.png';
import sendflowWordmark from '@/assets/sendflow-wordmark-original.png';
import resetPasswordIllustration from '@assets/generated_images/sendflow-reset-password-3d-alpha.png';
import resetPinIllustration from '@assets/generated_images/sendflow-reset-pin-3d-alpha.png';

type ResetMode = 'password' | 'pin';
type ResetStep = 'identifier' | 'verify' | 'secret';

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '05******98';
  return `${digits.slice(0, 2)}******${digits.slice(-2)}`;
}

function SecretInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="sendflow-reset-control">
      <label className={`sendflow-reset-field${error ? ' has-error' : ''}`}>
        <span className="sr-only">{label}</span>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={label}
          autoComplete="new-password"
          maxLength={64}
          required
        />
        <button
          type="button"
          className="sendflow-reset-password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Masquer ${label.toLowerCase()}` : `Afficher ${label.toLowerCase()}`}
        >
          {visible ? <Eye size={21} strokeWidth={1.7} /> : <EyeOff size={21} strokeWidth={1.7} />}
        </button>
      </label>
      {error && <p className="sendflow-reset-error" role="alert">{error}</p>}
    </div>
  );
}

export default function ResetPage({ mode }: { mode: ResetMode }) {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<ResetStep>('identifier');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneDialCode, setPhoneDialCode] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [secretError, setSecretError] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const submissionLock = useRef(false);
  const sendOtp = useSendEmailOtp();
  const verifyOtp = useVerifyEmailOtp();
  const resetPassword = useResetCustomerPassword();
  const resetPin = useResetCustomerPin();

  const isPassword = mode === 'password';
  const secretLabel = isPassword ? 'Nouveau mot de passe' : 'Nouveau code secret';
  const maskedPhone = useMemo(() => maskPhone(phone), [phone]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useSeo({
    path: isPassword ? '/forgot-password' : '/forgot-pin',
    locale: 'fr',
    title: `${isPassword ? 'Mot de passe' : 'Code PIN'} oublié · SendFlow`,
    description: `Réinitialisez votre ${isPassword ? 'mot de passe' : 'code PIN'} SendFlow.`,
    robots: 'noindex,nofollow',
  });

  useEffect(() => {
    if (step === 'verify') otpRefs.current[0]?.focus();
  }, [step]);

  const handleIdentifierSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPassword && !turnstileToken) return;
    await requestCode();
  };

  const requestCode = async () => {
    if (sendOtp.isPending || submissionLock.current) return;
    const normalizedEmail = email.trim().toLowerCase();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      && normalizedEmail.length <= 254;

    if (isPassword) {
      if (!validEmail) {
        setEmailError('Saisissez une adresse e-mail valide.');
        return;
      }
      setEmailError('');
      setOtpError('');
    } else {
      if (!phoneDialCode) {
        setPhoneError('Sélectionnez un pays dans la liste.');
        return;
      }
      if (!isValidPhoneForCountry(phone, phoneDialCode)) {
        setPhoneError(getPhoneLengthMessage(phoneDialCode));
        return;
      }
      setPhoneError('');
    }

    const token = isPassword ? turnstileToken : null;
    if (isPassword && !token) return;
    if (isPassword) {
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    }
    submissionLock.current = true;
    try {
      const response = await sendOtp.mutateAsync({
        data: isPassword
          ? { email: normalizedEmail, purpose: 'password_reset', turnstileToken: token! }
          : { phone: `${phoneDialCode}${phone.replace(/\D/g, '')}`, purpose: 'pin_reset' },
      });
      setChallengeId(response.challengeId);
      setResendAt(Date.now() + response.resendAfterSeconds * 1000);
      setOtp(['', '', '', '', '', '']);
      setStep('verify');
    } catch (error) {
      const safeMessage = getSafeApiErrorCopy(error).message;
      if (isPassword) {
        if (step === 'verify') setOtpError(safeMessage);
        else setEmailError(safeMessage);
      } else {
        setPhoneError(safeMessage);
      }
    } finally {
      submissionLock.current = false;
    }
  };

  const updateOtp = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setOtpError('');
    setOtp((current) => current.map((item, itemIndex) => (itemIndex === index ? digit : item)));
    if (digit && index < otpRefs.current.length - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (otp.join('').length !== 6) {
      setOtpError('Saisissez le code de vérification à 6 chiffres.');
      return;
    }
    if (submissionLock.current || !turnstileToken) return;
    setOtpError('');
    const token = turnstileToken;
    setTurnstileToken(null);
    turnstileRef.current?.reset();
    submissionLock.current = true;
    try {
      const response = await verifyOtp.mutateAsync({
        data: {
          challengeId,
          purpose: isPassword ? 'password_reset' : 'pin_reset',
          code: otp.join(''),
          turnstileToken: token,
        },
      });
      if (!response.emailVerified) throw new Error('L’adresse e-mail n’a pas pu être vérifiée.');
      setStep('secret');
    } catch (error) {
      setOtpError(getSafeApiErrorCopy(error).message);
    } finally {
      submissionLock.current = false;
    }
  };

  const handleSecretSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submissionLock.current) return;
    const minimumLength = isPassword ? NEW_CUSTOMER_PASSWORD_MIN_LENGTH : 4;
    if (newSecret.length < minimumLength) {
      setSecretError(`${secretLabel} doit contenir au moins ${minimumLength} caractères.`);
      return;
    }
    if (newSecret !== confirmation) {
      setSecretError('Les deux valeurs doivent être identiques.');
      return;
    }

    setSecretError('');
    const token = isPassword ? turnstileToken : null;
    if (isPassword && !token) return;
    if (isPassword) {
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    }
    submissionLock.current = true;
    try {
      if (isPassword) {
        await resetPassword.mutateAsync({
          data: {
            challengeId,
            email: email.trim().toLowerCase(),
            newPassword: newSecret,
            turnstileToken: token!,
          },
        });
      } else {
        const fullPhone = `${phoneDialCode}${phone.replace(/\D/g, '')}`;
        if (!/^\d{4}$/.test(newSecret)) {
          setSecretError('Le code PIN doit contenir 4 chiffres.');
          return;
        }
        await resetPin.mutateAsync({ data: { challengeId, phone: fullPhone, newPin: newSecret } });
      }
      clearPinUnlock();
      setLocation('/sign-in');
    } catch (error) {
      setSecretError(getSafeApiErrorCopy(error).message);
    } finally {
      submissionLock.current = false;
    }
  };

  return (
    <main className="sendflow-reset-shell">
      <section className="sendflow-reset-card" aria-labelledby="reset-title">
        <div className={`sendflow-reset-art${isPassword ? ' is-password' : ' is-pin'}`} aria-hidden="true">
          <img
            src={isPassword ? resetPasswordIllustration : resetPinIllustration}
            alt=""
            loading="eager"
            decoding="async"
          />
        </div>
        <div className="sendflow-reset-brand" aria-label="SendFlow">
          <img src={sendflowMark} alt="" className="sendflow-reset-mark" />
          <img src={sendflowWordmark} alt="SendFlow" className="sendflow-reset-wordmark" />
        </div>

        {step === 'identifier' && (
          <>
            <header className="sendflow-reset-heading">
              <h1 id="reset-title">{isPassword ? 'Mot de passe oublié ? 😭' : 'Code secret oublié ? 🥹'}</h1>
              <p>
                {isPassword
                  ? 'Nous sommes là pour vous aider ! Saisissez l’adresse e-mail associée à votre compte.'
                  : 'Nous sommes là pour vous aider ! Saisissez le numéro de téléphone associé à votre compte.'}
              </p>
            </header>

            <form className="sendflow-reset-form" onSubmit={handleIdentifierSubmit} noValidate>
              {isPassword ? (
                <div className="sendflow-reset-control">
                  <label className={`sendflow-reset-field${emailError ? ' has-error' : ''}`}>
                    <span className="sr-only">Adresse e-mail</span>
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => {
                        setEmailError('');
                        setEmail(event.target.value);
                      }}
                      placeholder="Adresse e-mail"
                      maxLength={254}
                      required
                    />
                  </label>
                  {emailError && <p className="sendflow-reset-error" role="alert">{emailError}</p>}
                </div>
              ) : (
                <CountryPhoneField
                  value={phone}
                  onChange={(value) => {
                    setPhoneError('');
                    setPhone(value);
                  }}
                  onCountryChange={(country) => setPhoneDialCode(country.dialCode)}
                  error={phoneError}
                />
              )}
              {isPassword && (
                <TurnstileWidget
                  ref={turnstileRef}
                  action="password_reset"
                  onTokenChange={setTurnstileToken}
                />
              )}
              <button
                type="submit"
                className="sendflow-reset-submit"
                disabled={sendOtp.isPending || (isPassword && !turnstileToken)}
              >
                {sendOtp.isPending ? 'Envoi…' : 'Suivant'}
              </button>
            </form>

            <p className="sendflow-reset-login">
              Vous vous en souvenez ? <Link href="/sign-in">Connectez-vous</Link>
            </p>
          </>
        )}

        {step === 'verify' && (
          <>
            <header className="sendflow-reset-heading sendflow-reset-heading-verify">
              <h1 id="reset-title">Vérification par e-mail</h1>
              {!isPassword && (
                <p>
                  Saisissez le code envoyé à l’adresse e-mail associée au compte identifié par <strong>{maskedPhone}</strong>.
                </p>
              )}
            </header>
            {isPassword && (
              <aside className="sendflow-reset-availability" role="status" aria-live="polite">
                <strong>Vérifiez votre e-mail</strong>
                <span>
                  Si un code peut être envoyé, vous le recevrez par e-mail. Pensez aux courriers indésirables.
                </span>
              </aside>
            )}

            <form className="sendflow-reset-form sendflow-reset-verify-form" onSubmit={handleVerify} noValidate>
              <div className="sendflow-reset-otp" aria-label="Code de vérification à six chiffres">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      otpRefs.current[index] = element;
                    }}
                    value={digit}
                    onChange={(event) => updateOtp(index, event.target.value)}
                    onKeyDown={(event) => handleOtpKeyDown(index, event)}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    aria-label={`Chiffre ${index + 1} sur 6`}
                  />
                ))}
              </div>
              {otpError && <p className="sendflow-reset-error" role="alert">{otpError}</p>}
              <TurnstileWidget
                ref={turnstileRef}
                action={isPassword ? 'password_reset' : 'pin_reset'}
                onTokenChange={setTurnstileToken}
              />
              <p className="sendflow-reset-resend">
                Vous n&apos;avez pas reçu le code ?{' '}
                <button
                  type="button"
                  disabled={sendOtp.isPending || now < resendAt || (isPassword && !turnstileToken)}
                  onClick={() => void requestCode()}
                >
                  {now < resendAt
                    ? `Renvoyer dans ${Math.ceil((resendAt - now) / 1000)} s`
                    : sendOtp.isPending ? 'Envoi…' : 'Renvoyer'}
                </button>
              </p>
              <button type="submit" className="sendflow-reset-submit" disabled={verifyOtp.isPending || !turnstileToken}>
                {verifyOtp.isPending ? 'Vérification…' : 'Vérifier'}
              </button>
            </form>

            {isPassword && (
              <p className="sendflow-reset-login">
                Adresse incorrecte ?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setOtpError('');
                    setStep('identifier');
                  }}
                >
                  Modifier l’adresse e-mail
                </button>
              </p>
            )}
            <p className="sendflow-reset-login">
              Vous vous en souvenez ? <Link href="/sign-in">Connectez-vous</Link>
            </p>
          </>
        )}

        {step === 'secret' && (
          <>
            <header className="sendflow-reset-heading sendflow-reset-heading-secret">
              <h1 id="reset-title">{secretLabel}</h1>
              <p>Choisissez un nouveau secret pour sécuriser votre compte.</p>
            </header>

            <form className="sendflow-reset-form sendflow-reset-secret-form" onSubmit={handleSecretSubmit} noValidate>
              <SecretInput label={secretLabel} value={newSecret} onChange={setNewSecret} error={secretError} />
              <SecretInput label={`Confirmer ${secretLabel.toLowerCase()}`} value={confirmation} onChange={setConfirmation} />
              {isPassword && (
                <TurnstileWidget
                  ref={turnstileRef}
                  action="password_reset"
                  onTokenChange={setTurnstileToken}
                />
              )}
              <button
                type="submit"
                className="sendflow-reset-submit"
                disabled={resetPassword.isPending || resetPin.isPending || (isPassword && !turnstileToken)}
              >
                {resetPassword.isPending || resetPin.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}