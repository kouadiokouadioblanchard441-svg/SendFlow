import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Delete } from 'lucide-react';
import { Redirect, useLocation } from 'wouter';
import { useSeo } from '@/lib/seo';
import { DEMO_ACCOUNT, DEMO_SESSION_KEY } from '@/lib/demo-account';
import { savePin, verifyPin } from '@/lib/pin-storage';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import pinCharacterPrimary from '@assets/generated_images/sendflow-how-person-3d-transparent.png';
import pinCharacterSecondary from '@assets/generated_images/sendflow-network-person-3d-transparent.png';

type PinMode = 'create' | 'enter';

const PIN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
type PinKey = (typeof PIN_DIGITS)[number] | '' | 'backspace';
const PIN_LENGTH = 4;
const PIN_CHANGE_SUCCESS_KEY = 'sendflow.pin.change-success';

function createShuffledKeypad(): PinKey[] {
  const digits = [...PIN_DIGITS];

  for (let index = digits.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [digits[index], digits[swapIndex]] = [digits[swapIndex], digits[index]];
  }

  // Keep the empty slot and delete action stable so the keypad stays easy to scan.
  return [...digits.slice(0, 9), '', digits[9], 'backspace'];
}

function getPinCopy(mode: PinMode, confirming: boolean) {
  if (mode === 'create' && confirming) {
    return {
      title: 'Confirmez votre code',
      subtitle: 'Veuillez entrer à nouveau votre code PIN',
    };
  }

  if (mode === 'create') {
    return {
      title: 'Bienvenue',
      subtitle: 'Créez votre code PIN',
    };
  }

  return {
    title: 'Bienvenue',
    subtitle: 'Veuillez entrer votre code PIN',
  };
}

function usePinKeyboard(appendDigit: (digit: string) => void, removeDigit: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        appendDigit(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        removeDigit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appendDigit, removeDigit]);
}

function PinDots({ entry }: { entry: string }) {
  const digits = useMemo(() => Array.from({ length: PIN_LENGTH }, (_, index) => index < entry.length), [entry.length]);

  return (
    <div className="sendflow-pin-dots" aria-label={`${entry.length} chiffre sur ${PIN_LENGTH}`}>
      {digits.map((filled, index) => (
        <span key={index} className={filled ? 'is-filled' : ''} />
      ))}
    </div>
  );
}

function PinKeypad({
  keys,
  processing,
  onDigit,
  onDelete,
}: {
  keys: PinKey[];
  processing: boolean;
  onDigit: (digit: string) => void;
  onDelete: () => void;
}) {
  const keyRefs = useRef(new Map<string, HTMLElement>());
  const previousPositions = useRef(new Map<string, { left: number; top: number }>());
  const activeAnimations = useRef<Animation[]>([]);

  useLayoutEffect(() => {
    activeAnimations.current.forEach((animation) => animation.cancel());
    activeAnimations.current = [];

    const nextPositions = new Map<string, { left: number; top: number }>();

    keys.forEach((key, index) => {
      const keyId = key === '' ? `empty-${index}` : key;
      const node = keyRefs.current.get(keyId);
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const currentPosition = { left: rect.left, top: rect.top };
      const previousPosition = previousPositions.current.get(keyId);
      nextPositions.set(keyId, currentPosition);

      if (!previousPosition || typeof node.animate !== 'function') return;

      const deltaX = previousPosition.left - currentPosition.left;
      const deltaY = previousPosition.top - currentPosition.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

      activeAnimations.current.push(node.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' },
        ],
        {
          duration: 145,
          easing: 'cubic-bezier(.22, .8, .32, 1)',
          fill: 'none',
        },
      ));
    });

    previousPositions.current = nextPositions;
  }, [keys]);

  return (
    <div className="sendflow-pin-keypad" aria-label="Pavé numérique">
      {keys.map((key, index) => {
        const keyId = key === '' ? `empty-${index}` : key;
        if (key === '') {
          return (
            <span
              key={keyId}
              ref={(node) => {
                if (node) keyRefs.current.set(keyId, node);
                else keyRefs.current.delete(keyId);
              }}
              aria-hidden="true"
            />
          );
        }

        if (key === 'backspace') {
          return (
            <button
              key={key}
              ref={(node) => {
                if (node) keyRefs.current.set(keyId, node);
                else keyRefs.current.delete(keyId);
              }}
              type="button"
              className="sendflow-pin-key sendflow-pin-delete"
              onClick={onDelete}
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
            ref={(node) => {
              if (node) keyRefs.current.set(keyId, node);
              else keyRefs.current.delete(keyId);
            }}
            type="button"
            className="sendflow-pin-key"
            onClick={() => onDigit(key)}
            disabled={processing}
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}

function PinBackgroundArt() {
  return (
    <>
      <div className="sendflow-pin-top-art" aria-hidden="true">
        <img className="sendflow-pin-top-character is-primary" src={pinCharacterPrimary} alt="" />
        <img className="sendflow-pin-top-character is-secondary" src={pinCharacterSecondary} alt="" />
      </div>
      <div className="sendflow-pin-background-art" aria-hidden="true">
        <span className="sendflow-pin-background-glow" />
        <img className="sendflow-pin-character is-primary" src={pinCharacterPrimary} alt="" />
        <img className="sendflow-pin-character is-secondary" src={pinCharacterSecondary} alt="" />
      </div>
    </>
  );
}

export default function PinPage({ mode }: { mode: PinMode }) {
  const [, setLocation] = useLocation();
  const [entry, setEntry] = useState('');
  const [keypad, setKeypad] = useState<PinKey[]>(createShuffledKeypad);
  const [createdPin, setCreatedPin] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const isDemoSession = window.sessionStorage.getItem(DEMO_SESSION_KEY) === 'true';

  useSeo({
    path: mode === 'create' ? '/create-pin' : '/pin',
    locale: 'fr',
    title: mode === 'create' ? 'Créer votre code PIN · SendFlow' : 'Code PIN · SendFlow',
    description: 'Protégez votre compte SendFlow avec un code PIN.',
    robots: 'noindex,nofollow',
  });

  const copy = getPinCopy(mode, confirming);
  const completeEntry = useCallback(async (nextEntry: string) => {
    setProcessing(true);

    try {
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
          setError('Les deux codes PIN ne correspondent pas.');
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
        setError('Code PIN incorrect. Veuillez réessayer.');
        setProcessing(false);
        return;
      }

      window.sessionStorage.setItem('sendflow.pin.unlocked', 'true');
      setLocation('/account');
    } catch {
      setEntry('');
      setError('Une erreur est survenue. Veuillez réessayer.');
      setProcessing(false);
    }
  }, [confirming, createdPin, isDemoSession, mode, setLocation]);

  const appendDigit = useCallback((digit: string) => {
    if (processing || entry.length >= PIN_LENGTH) return;
    setError('');
    const nextEntry = `${entry}${digit}`;
    setEntry(nextEntry);
    setKeypad(createShuffledKeypad());

    if (nextEntry.length === PIN_LENGTH) {
      void completeEntry(nextEntry);
    }
  }, [completeEntry, entry, processing]);

  const removeDigit = useCallback(() => {
    if (processing) return;
    setError('');
    setEntry((current) => current.slice(0, -1));
  }, [processing]);

  usePinKeyboard(appendDigit, removeDigit);

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
        <PinBackgroundArt />
        <button type="button" className="sendflow-pin-back" onClick={handleBack} aria-label="Retour">
          <ArrowLeft size={25} strokeWidth={1.9} />
          <span>Autre compte</span>
        </button>

        <div className="sendflow-pin-brand" aria-label="SendFlow">
          <img src={sendflowMark} alt="" className="sendflow-pin-mark" />
          <img src={sendflowWordmark} alt="SendFlow" className="sendflow-pin-wordmark" />
        </div>

        <header className="sendflow-pin-heading is-change-pin">
          <h1 id="pin-title">{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </header>

        <PinDots entry={entry} />
        <PinKeypad keys={keypad} processing={processing} onDigit={appendDigit} onDelete={removeDigit} />

        {error && <p className="sendflow-pin-error" role="alert">{error}</p>}

        <button type="button" className="sendflow-pin-forgot" onClick={() => setLocation('/forgot-pin')}>
          J’ai oublié mon code PIN
        </button>
      </section>
    </main>
  );
}

type ChangePinStep = 'current' | 'new' | 'confirm';

function getChangePinCopy(step: ChangePinStep) {
  if (step === 'current') {
    return {
      title: 'Entrez votre code PIN actuel',
      subtitle: 'Vérifiez votre code PIN pour continuer.',
    };
  }

  if (step === 'new') {
    return {
      title: 'Créez un nouveau code PIN',
      subtitle: 'Choisissez un code PIN pour protéger votre compte.',
    };
  }

  return {
    title: 'Répétez votre nouveau code PIN',
    subtitle: 'Saisissez-le une seconde fois pour confirmer.',
  };
}

export function ChangePinPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<ChangePinStep>('current');
  const [entry, setEntry] = useState('');
  const [keypad, setKeypad] = useState<PinKey[]>(createShuffledKeypad);
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const isDemoSession = window.sessionStorage.getItem(DEMO_SESSION_KEY) === 'true';
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';

  useSeo({
    path: '/change-pin',
    locale: 'fr',
    title: 'Modifier le code PIN · SendFlow',
    description: 'Modifiez le code PIN de votre compte SendFlow.',
    robots: 'noindex,nofollow',
  });

  const copy = getChangePinCopy(step);

  const completeEntry = useCallback(async (nextEntry: string) => {
    setProcessing(true);

    try {
      if (step === 'current') {
        const isCorrect = isDemoSession && nextEntry === DEMO_ACCOUNT.pin
          ? true
          : await verifyPin(nextEntry);

        if (!isCorrect) {
          setEntry('');
          setError('Code PIN incorrect. Veuillez réessayer.');
          setProcessing(false);
          return;
        }

        setStep('new');
        setEntry('');
        setError('');
        setProcessing(false);
        return;
      }

      if (step === 'new') {
        setNewPin(nextEntry);
        setStep('confirm');
        setEntry('');
        setError('');
        setProcessing(false);
        return;
      }

      if (nextEntry !== newPin) {
        setEntry('');
        setError('Les deux codes PIN ne correspondent pas.');
        setProcessing(false);
        return;
      }

      await savePin(nextEntry);
      window.sessionStorage.setItem(PIN_CHANGE_SUCCESS_KEY, 'true');
      setLocation('/change-pin-success');
    } catch {
      setEntry('');
      setError('Une erreur est survenue. Veuillez réessayer.');
      setProcessing(false);
    }
  }, [isDemoSession, newPin, setLocation, step]);

  const appendDigit = useCallback((digit: string) => {
    if (processing || entry.length >= PIN_LENGTH) return;
    setError('');
    const nextEntry = `${entry}${digit}`;
    setEntry(nextEntry);
    setKeypad(createShuffledKeypad());

    if (nextEntry.length === PIN_LENGTH) {
      void completeEntry(nextEntry);
    }
  }, [completeEntry, entry, processing]);

  const removeDigit = useCallback(() => {
    if (processing) return;
    setError('');
    setEntry((current) => current.slice(0, -1));
  }, [processing]);

  usePinKeyboard(appendDigit, removeDigit);

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('new');
      setEntry('');
      setError('');
      return;
    }

    if (step === 'new') {
      setStep('current');
      setEntry('');
      setError('');
      return;
    }

    setLocation('/account');
  };

  if (!isUnlocked) return <Redirect to="/sign-in" />;

  return (
    <main className="sendflow-pin-shell">
      <section className="sendflow-pin-card" aria-labelledby="change-pin-title">
        <PinBackgroundArt />
        <button type="button" className="sendflow-pin-back" onClick={handleBack} aria-label="Retour">
          <ArrowLeft size={25} strokeWidth={1.9} />
          <span>Retour</span>
        </button>

        <div className="sendflow-pin-brand" aria-label="SendFlow">
          <img src={sendflowMark} alt="" className="sendflow-pin-mark" />
          <img src={sendflowWordmark} alt="SendFlow" className="sendflow-pin-wordmark" />
        </div>

        <header className="sendflow-pin-heading">
          <h1 id="change-pin-title">{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </header>

        <PinDots entry={entry} />
        <PinKeypad keys={keypad} processing={processing} onDigit={appendDigit} onDelete={removeDigit} />

        <p className="sendflow-pin-error" role="alert" aria-live="polite">
          {error}
        </p>
      </section>
    </main>
  );
}