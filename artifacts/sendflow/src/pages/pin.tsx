import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Delete } from 'lucide-react';
import { Redirect, useLocation } from 'wouter';
import { useSeo } from '@/lib/seo';
import { markPinUnlocked } from '@/lib/pin-unlock';
import { useQueryClient } from '@tanstack/react-query';
import { useSetCustomerPin, useUnlockCustomerSession } from '@workspace/api-client-react';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import pinCharacterPrimary from '@assets/generated_images/sendflow-how-person-3d-transparent.png';
import pinCharacterSecondary from '@assets/generated_images/sendflow-network-person-3d-transparent.png';

type PinMode = 'create' | 'enter';

const PIN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
type PinKey = (typeof PIN_DIGITS)[number] | '' | 'backspace';
const PIN_LENGTH = 4;
const PIN_CHANGE_SUCCESS_KEY = 'sendflow.pin.change-success';

function createShuffledKeypad(previous?: readonly PinKey[]): PinKey[] {
  const digits = [...PIN_DIGITS];
  const previousDigits = previous?.filter((key) => key !== '' && key !== 'backspace').join('');
  const randomValue = new Uint32Array(1);

  for (let index = digits.length - 1; index > 0; index -= 1) {
    const choices = index + 1;
    const ceiling = Math.floor(0x1_0000_0000 / choices) * choices;
    do {
      crypto.getRandomValues(randomValue);
    } while (randomValue[0]! >= ceiling);
    const swapIndex = randomValue[0]! % choices;
    [digits[index], digits[swapIndex]] = [digits[swapIndex], digits[index]];
  }
  if (digits.join('') === previousDigits) {
    [digits[0], digits[1]] = [digits[1], digits[0]];
  }

  // Keep the empty slot and delete action stable so the keypad stays easy to scan.
  return [...digits.slice(0, 9), '', digits[9], 'backspace'];
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    && (target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement);
}

function usePinKeyboard(appendDigit: (digit: string) => void, removeDigit: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

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
  return (
    <div className="sendflow-pin-keypad" aria-label="Pavé numérique">
      {keys.map((key, index) => {
        const keyId = key === '' ? `empty-${index}` : key;
        if (key === '') {
          return (
            <span
              key={keyId}
              aria-hidden="true"
            />
          );
        }

        if (key === 'backspace') {
          return (
            <button
              key={key}
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
  const queryClient = useQueryClient();
  const [entry, setEntry] = useState('');
  const entryRef = useRef('');
  const processingRef = useRef(false);
  const [keypad, setKeypad] = useState<PinKey[]>(createShuffledKeypad);
  const [createdPin, setCreatedPin] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const setCustomerPin = useSetCustomerPin();
  const unlockCustomerSession = useUnlockCustomerSession();

  useSeo({
    path: mode === 'create' ? '/create-pin' : '/pin',
    locale: 'fr',
    title: mode === 'create' ? 'Créer votre code PIN · SendFlow' : 'Code PIN · SendFlow',
    description: 'Protégez votre compte SendFlow avec un code PIN.',
    robots: 'noindex,nofollow',
  });

  const copy = getPinCopy(mode, confirming);
  const clearEntry = useCallback(() => {
    entryRef.current = '';
    setEntry('');
  }, []);
  const completeEntry = useCallback(async (nextEntry: string) => {
    setProcessing(true);

    try {
      if (mode === 'create' && !confirming) {
        setCreatedPin(nextEntry);
        clearEntry();
        setConfirming(true);
        setProcessing(false);
        processingRef.current = false;
        return;
      }

      if (mode === 'create') {
        if (nextEntry !== createdPin) {
          clearEntry();
          setError('Les deux codes PIN ne correspondent pas.');
          setProcessing(false);
          processingRef.current = false;
          return;
        }

        await setCustomerPin.mutateAsync({ data: { newPin: nextEntry } });
        queryClient.clear();
        markPinUnlocked();
        setLocation('/account');
        return;
      }

      await unlockCustomerSession.mutateAsync({ data: { pin: nextEntry } });
      queryClient.clear();
      markPinUnlocked();
      setLocation('/account');
    } catch (error) {
      clearEntry();
      const candidate = error as { status?: number; data?: { error?: string } };
      if (
        candidate.status === 401
        && mode === 'enter'
        && (
          candidate.data?.error === 'Authentication required'
          || candidate.data?.error === 'Session expirée. Connectez-vous à nouveau.'
        )
      ) {
        queryClient.clear();
        setLocation('/sign-in');
        return;
      }
      setError(candidate.data?.error ?? 'Code PIN incorrect. Veuillez réessayer.');
      setProcessing(false);
      processingRef.current = false;
    }
  }, [clearEntry, confirming, createdPin, mode, queryClient, setCustomerPin, unlockCustomerSession, setLocation]);

  const appendDigit = useCallback((digit: string) => {
    if (processing || processingRef.current || entryRef.current.length >= PIN_LENGTH || !/^\d$/.test(digit)) return;
    setError('');
    const nextEntry = `${entryRef.current}${digit}`;
    entryRef.current = nextEntry;
    setEntry(nextEntry);
    setKeypad((previous) => createShuffledKeypad(previous));

    if (nextEntry.length === PIN_LENGTH) {
      processingRef.current = true;
      void completeEntry(nextEntry);
    }
  }, [completeEntry, processing]);

  const removeDigit = useCallback(() => {
    if (processing || processingRef.current) return;
    setError('');
    const nextEntry = entryRef.current.slice(0, -1);
    entryRef.current = nextEntry;
    setEntry(nextEntry);
  }, [processing]);

  usePinKeyboard(appendDigit, removeDigit);

  const handleBack = () => {
    if (processing || processingRef.current) return;

    if (mode === 'create' && confirming) {
      setConfirming(false);
      setCreatedPin('');
      clearEntry();
      setError('');
      return;
    }
    setLocation('/sign-in');
  };

  return (
    <main className="sendflow-pin-shell">
      <section className="sendflow-pin-card" aria-labelledby="pin-title" aria-busy={processing}>
        <PinBackgroundArt />
        <button type="button" className="sendflow-pin-back" onClick={handleBack} aria-label="Retour" disabled={processing}>
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

        <button type="button" className="sendflow-pin-forgot" onClick={() => setLocation('/forgot-pin')} disabled={processing}>
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
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ChangePinStep>('current');
  const [entry, setEntry] = useState('');
  const entryRef = useRef('');
  const processingRef = useRef(false);
  const [keypad, setKeypad] = useState<PinKey[]>(createShuffledKeypad);
  const [newPin, setNewPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const setCustomerPin = useSetCustomerPin();
  const unlockCustomerSession = useUnlockCustomerSession();

  useSeo({
    path: '/change-pin',
    locale: 'fr',
    title: 'Modifier le code PIN · SendFlow',
    description: 'Modifiez le code PIN de votre compte SendFlow.',
    robots: 'noindex,nofollow',
  });

  const copy = getChangePinCopy(step);
  const clearEntry = useCallback(() => {
    entryRef.current = '';
    setEntry('');
  }, []);

  const completeEntry = useCallback(async (nextEntry: string) => {
    setProcessing(true);

    try {
      if (step === 'current') {
        await unlockCustomerSession.mutateAsync({ data: { pin: nextEntry } });

        setCurrentPin(nextEntry);
        setStep('new');
        clearEntry();
        setError('');
        setProcessing(false);
        processingRef.current = false;
        return;
      }

      if (step === 'new') {
        setNewPin(nextEntry);
        setStep('confirm');
        clearEntry();
        setError('');
        setProcessing(false);
        processingRef.current = false;
        return;
      }

      if (nextEntry !== newPin) {
        clearEntry();
        setError('Les deux codes PIN ne correspondent pas.');
        setProcessing(false);
        processingRef.current = false;
        return;
      }

      await setCustomerPin.mutateAsync({ data: { newPin: nextEntry, currentPin } });
      queryClient.clear();
      markPinUnlocked();
      window.sessionStorage.setItem(PIN_CHANGE_SUCCESS_KEY, 'true');
      setLocation('/change-pin-success');
    } catch (error) {
      clearEntry();
    const candidate = error as { data?: { error?: string } };
      setError(candidate.data?.error ?? 'Code PIN incorrect. Veuillez réessayer.');
      setProcessing(false);
      processingRef.current = false;
    }
  }, [clearEntry, currentPin, newPin, queryClient, setCustomerPin, setLocation, step, unlockCustomerSession]);

  const appendDigit = useCallback((digit: string) => {
    if (processing || processingRef.current || entryRef.current.length >= PIN_LENGTH || !/^\d$/.test(digit)) return;
    setError('');
    const nextEntry = `${entryRef.current}${digit}`;
    entryRef.current = nextEntry;
    setEntry(nextEntry);
    setKeypad((previous) => createShuffledKeypad(previous));

    if (nextEntry.length === PIN_LENGTH) {
      processingRef.current = true;
      void completeEntry(nextEntry);
    }
  }, [completeEntry, processing]);

  const removeDigit = useCallback(() => {
    if (processing || processingRef.current) return;
    setError('');
    const nextEntry = entryRef.current.slice(0, -1);
    entryRef.current = nextEntry;
    setEntry(nextEntry);
  }, [processing]);

  usePinKeyboard(appendDigit, removeDigit);

  const handleBack = () => {
    if (processing || processingRef.current) return;

    if (step === 'confirm') {
      setStep('new');
      clearEntry();
      setError('');
      return;
    }

    if (step === 'new') {
      setStep('current');
      clearEntry();
      setError('');
      return;
    }

    setLocation('/account');
  };

  if (!isUnlocked) return <Redirect to="/sign-in" />;

  return (
    <main className="sendflow-pin-shell">
      <section className="sendflow-pin-card" aria-labelledby="change-pin-title" aria-busy={processing}>
        <PinBackgroundArt />
        <button type="button" className="sendflow-pin-back" onClick={handleBack} aria-label="Retour" disabled={processing}>
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