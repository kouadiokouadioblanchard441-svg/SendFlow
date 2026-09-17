import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useSeo } from '@/lib/seo';
import { CountryPhoneField } from '@/components/country-phone-field';
import { savePin } from '@/lib/pin-storage';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';

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
  const [otp, setOtp] = useState(['', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [secretError, setSecretError] = useState('');
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

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

  const handlePhoneSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 10) {
      setPhoneError('Saisissez un numéro valide de 8 à 10 chiffres.');
      return;
    }
    setPhoneError('');
    setStep('verify');
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

  const handleVerify = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (otp.join('').length !== 4) {
      setOtpError('Saisissez le code de vérification à 4 chiffres.');
      return;
    }
    setOtpError('');
    if (!isPassword) {
      setLocation('/create-pin');
      return;
    }
    setStep('secret');
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
    if (!isPassword) await savePin(newSecret);
    window.sessionStorage.setItem('sendflow.reset-complete', mode);
    setLocation('/sign-in');
  };

  return (
    <main className="sendflow-reset-shell">
      <section className="sendflow-reset-card" aria-labelledby="reset-title">
        <div className="sendflow-reset-brand" aria-label="SendFlow">
          <img src={sendflowMark} alt="" className="sendflow-reset-mark" />
          <img src={sendflowWordmark} alt="SendFlow" className="sendflow-reset-wordmark" />
        </div>

        {step === 'phone' && (
          <>
            <header className="sendflow-reset-heading">
              <h1 id="reset-title">{isPassword ? 'Mot de passe oublié ?' : 'Code secret oublié ?'} 🥹</h1>
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
              <div className="sendflow-reset-otp" aria-label="Code de vérification à quatre chiffres">
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
                    aria-label={`Chiffre ${index + 1} sur 4`}
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