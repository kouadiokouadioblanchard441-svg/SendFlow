import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Delete } from 'lucide-react';
import { useLocation } from 'wouter';
import { useSeo } from '@/lib/seo';
import { DEMO_ACCOUNT, DEMO_SESSION_KEY } from '@/lib/demo-account';
import { hasPin, savePin, verifyPin } from '@/lib/pin-storage';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';

type PinMode = 'create' | 'enter';

const KEYPAD = ['9', '8', '0', '6', '4', '1', '2', '7', '3', '', '5', 'backspace'] as const;
const PIN_LENGTH = 4;

function getPinCopy(mode: PinMode, confirming: boolean) {
  if (mode === 'create' && confirming) {
    return {
      title: 'Confirmez votre code',
      subtitle: 'Veuillez entrer à nouveau votre code secret',
    };
  }

  if (mode === 'create') {
    return {
      title: 'Bienvenue',
      subtitle: 'Créez votre code secret',
    };
  }

  return {
    title: 'Bienvenue',
    subtitle: 'Veuillez entrer votre code secret',
  };
}

export default function PinPage({ mode }: { mode: PinMode }) {
  const [, setLocation] = useLocation();
  const [entry, setEntry] = useState('');
  const [createdPin, setCreatedPin] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const isDemoSession = window.sessionStorage.getItem(DEMO_SESSION_KEY) === 'true';

  useSeo({
    path: mode === 'create' ? '/create-pin' : '/pin',
    locale: 'fr',
    title: mode === 'create' ? 'Créer votre code secret · SendFlow' : 'Code secret · SendFlow',
    description: 'Protégez votre compte SendFlow avec un code secret.',
    robots: 'noindex,nofollow',
  });

  const copy = getPinCopy(mode, confirming);
  const digits = useMemo(() => Array.from({ length: PIN_LENGTH }, (_, index) => index < entry.length), [entry.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) {
        appendDigit(event.key);
      } else if (event.key === 'Backspace') {
        removeDigit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const appendDigit = (digit: string) => {
    if (processing || entry.length >= PIN_LENGTH) return;
    setError('');
    const nextEntry = `${entry}${digit}`;
    setEntry(nextEntry);

    if (nextEntry.length === PIN_LENGTH) {
      void completeEntry(nextEntry);
    }
  };

  const removeDigit = () => {
    if (processing) return;
    setError('');
    setEntry((current) => current.slice(0, -1));
  };

  const completeEntry = async (nextEntry: string) => {
    setProcessing(true);

    if (mode === 'create' && !confirming) {
      setCreatedPin(nextEntry);
      setEntry('');
      setConfirming(true);
      setProcessing(false);
      return;
    }

    if (mode === 'create') {
      if (nextEntry !== createdPin) {
        setEntry('');
        setError('Les deux codes ne correspondent pas.');
        setProcessing(false);
        return;
      }

      await savePin(nextEntry);
      setLocation('/sign-in');
      return;
    }

    const isCorrect = isDemoSession && nextEntry === DEMO_ACCOUNT.pin
      ? true
      : await verifyPin(nextEntry);
    if (!isCorrect) {
      setEntry('');
      setError('Code secret incorrect. Veuillez réessayer.');
      setProcessing(false);
      return;
    }

    window.sessionStorage.setItem('sendflow.pin.unlocked', 'true');
    setLocation('/account');
  };

  const handleBack = () => {
    if (mode === 'create' && confirming) {
      setConfirming(false);
      setCreatedPin('');
      setEntry('');
      setError('');
      return;
    }
    setLocation('/sign-in');
  };

  return (
    <main className="sendflow-pin-shell">
      <section className="sendflow-pin-card" aria-labelledby="pin-title">
        <button type="button" className="sendflow-pin-back" onClick={handleBack} aria-label="Retour">
          <ArrowLeft size={25} strokeWidth={1.9} />
          <span>Autre compte</span>
        </button>

        <div className="sendflow-pin-brand" aria-label="SendFlow">
          <img src={sendflowMark} alt="" className="sendflow-pin-mark" />
          <img src={sendflowWordmark} alt="SendFlow" className="sendflow-pin-wordmark" />
        </div>

        <header className="sendflow-pin-heading">
          <h1 id="pin-title">{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </header>

        <div className="sendflow-pin-dots" aria-label={`${entry.length} chiffre sur ${PIN_LENGTH}`}>
          {digits.map((filled, index) => (
            <span key={index} className={filled ? 'is-filled' : ''} />
          ))}
        </div>

        <div className="sendflow-pin-keypad" aria-label="Pavé numérique">
          {KEYPAD.map((key, index) => {
            if (key === '') {
              return <span key={`empty-${index}`} aria-hidden="true" />;
            }

            if (key === 'backspace') {
              return (
                <button
                  key={key}
                  type="button"
                  className="sendflow-pin-key sendflow-pin-delete"
                  onClick={removeDigit}
                  aria-label="Effacer le dernier chiffre"
                  disabled={processing}
                >
                  <Delete size={27} strokeWidth={2.8} />
                </button>
              );
            }

            return (
              <button
                key={key}
                type="button"
                className="sendflow-pin-key"
                onClick={() => appendDigit(key)}
                disabled={processing}
              >
                {key}
              </button>
            );
          })}
        </div>

        {error && <p className="sendflow-pin-error" role="alert">{error}</p>}

        <button type="button" className="sendflow-pin-forgot" onClick={() => setLocation('/forgot-pin')}>
          J’ai oublié mon code PIN
        </button>
      </section>
    </main>
  );
}