import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useSeo } from '@/lib/seo';
import { CountryPhoneField } from '@/components/country-phone-field';
import { useResetCustomerPassword, useResetCustomerPin, useSendPhoneOtp, useVerifyPhoneOtp } from '@workspace/api-client-react';
import { clearPinUnlock } from '@/lib/pin-unlock';
import { DEFAULT_ACCOUNT_COUNTRY } from '@/lib/account-country';
import { getPhoneLengthMessage, isValidPhoneForCountry } from '@/lib/phone-rules';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import resetPasswordIllustration from '@assets/generated_images/sendflow-reset-password-3d-alpha.png';
import resetPinIllustration from '@assets/generated_images/sendflow-reset-pin-3d-alpha.png';

type ResetMode = 'password' | 'pin';
type ResetStep = 'phone' | 'verify' | 'secret';

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
  const [step, setStep] = useState<ResetStep>('phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneDialCode, setPhoneDialCode] = useState(DEFAULT_ACCOUNT_COUNTRY.dialCode);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [secretError, setSecretError] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const sendOtp = useSendPhoneOtp();
  const verifyOtp = useVerifyPhoneOtp();
  const resetPassword = useResetCustomerPassword();
  const resetPin = useResetCustomerPin();

  const isPassword = mode === 'password';
  const secretLabel = isPassword ? 'Nouveau mot de passe' : 'Nouveau code secret';
  const maskedPhone = useMemo(() => maskPhone(phone), [phone]);

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

  const handlePhoneSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidPhoneForCountry(phone, phoneDialCode, { min: 8, max: 10 })) {
      setPhoneError(getPhoneLengthMessage(phoneDialCode));
      return;
    }
    setPhoneError('');
    try {
      const response = await sendOtp.mutateAsync({
        data: { phone: `${phoneDialCode}${phone.replace(/\D/g, '')}`, purpose: isPassword ? 'password_reset' : 'pin_reset' },
      });
      setChallengeId(response.challengeId);
      setStep('verify');
    } catch (error) {
      const candidate = error as { data?: { error?: string } };
      setPhoneError(candidate.data?.error ?? 'Impossible d’envoyer le code. Réessayez.');
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
    setOtpError('');
    try {
      const response = await verifyOtp.mutateAsync({
        data: { challengeId, purpose: isPassword ? 'password_reset' : 'pin_reset', code: otp.join('') },
      });
      if (!response.phoneVerified) throw new Error('Le numéro n’a pas pu être vérifié.');
      setStep('secret');
    } catch (error) {
      const candidate = error as { data?: { error?: string } };
      setOtpError(candidate.data?.error ?? 'Code incorrect ou expiré.');
    }
  };

  const handleSecretSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newSecret.length < 4) {
      setSecretError(`${secretLabel} doit contenir au moins 4 caractères.`);
      return;
    }
    if (newSecret !== confirmation) {
      setSecretError('Les deux valeurs doivent être identiques.');
      return;
    }

    setSecretError('');
    try {
      const fullPhone = `${phoneDialCode}${phone.replace(/\D/g, '')}`;
      if (isPassword) {
        await resetPassword.mutateAsync({ data: { challengeId, phone: fullPhone, newPassword: newSecret } });
      } else {
        if (!/^\d{4}$/.test(newSecret)) {
          setSecretError('Le code PIN doit contenir 4 chiffres.');
          return;
        }
        await resetPin.mutateAsync({ data: { challengeId, phone: fullPhone, newPin: newSecret } });
      }
      clearPinUnlock();
      setLocation('/sign-in');
    } catch (error) {
      const candidate = error as { data?: { error?: string } };
      setSecretError(candidate.data?.error ?? 'Impossible de réinitialiser ce secret.');
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

        {step === 'phone' && (
          <>
            <header className="sendflow-reset-heading">
              <h1 id="reset-title">{isPassword ? 'Mot de passe oublié ? 😭' : 'Code secret oublié ? 🥹'}</h1>
              <p>
                Nous sommes là pour vous aider ! Veuillez entrer le numéro de téléphone associé à votre compte.
              </p>
            </header>

            <form className="sendflow-reset-form" onSubmit={handlePhoneSubmit} noValidate>
              <CountryPhoneField
                value={phone}
                onChange={(value) => {
                  setPhoneError('');
                  setPhone(value);
                }}
                onCountryChange={(country) => setPhoneDialCode(country.dialCode)}
                error={phoneError}
                defaultCountryName="Côte d’Ivoire"
              />
              <button type="submit" className="sendflow-reset-submit">Suivant</button>
            </form>

            <p className="sendflow-reset-login">
              Vous vous en souvenez ? <Link href="/sign-in">Connectez-vous</Link>
            </p>
          </>
        )}

        {step === 'verify' && (
          <>
            <header className="sendflow-reset-heading sendflow-reset-heading-verify">
              <h1 id="reset-title">Vérification du numéro</h1>
              <p>
                Veuillez saisir le code OTP que nous vous avons envoyé au{' '}
                <strong>{maskedPhone}</strong>
              </p>
            </header>

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
              <p className="sendflow-reset-resend">
                Vous n&apos;avez pas reçu le code ? <button type="button">Renvoyer</button>
              </p>
              <button type="submit" className="sendflow-reset-submit">Vérifier</button>
            </form>

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
              <button type="submit" className="sendflow-reset-submit">Enregistrer</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}