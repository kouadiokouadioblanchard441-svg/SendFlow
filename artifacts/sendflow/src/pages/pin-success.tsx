import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { Redirect, useLocation } from 'wouter';
import { useSeo } from '@/lib/seo';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import successIllustration from '@assets/generated_images/sendflow-pin-change-success-3d-clean.png';

const PIN_CHANGE_SUCCESS_KEY = 'sendflow.pin.change-success';

export default function PinChangeSuccessPage() {
  const [, setLocation] = useLocation();
  const canView = window.sessionStorage.getItem(PIN_CHANGE_SUCCESS_KEY) === 'true';

  useSeo({
    path: '/change-pin-success',
    locale: 'fr',
    title: 'Code PIN modifié · SendFlow',
    description: 'Votre code PIN SendFlow a été modifié avec succès.',
    robots: 'noindex,nofollow',
  });

  useEffect(() => {
    if (canView) {
      window.sessionStorage.removeItem(PIN_CHANGE_SUCCESS_KEY);
    }
  }, [canView]);

  if (!canView) return <Redirect to="/account" />;

  return (
    <main className="sendflow-pin-success-shell">
      <section className="sendflow-pin-success-card" aria-labelledby="pin-success-title">
        <div className="sendflow-pin-success-brand" aria-label="SendFlow">
          <img src={sendflowMark} alt="" />
          <img src={sendflowWordmark} alt="SendFlow" />
        </div>

        <div className="sendflow-pin-success-art" aria-hidden="true">
          <span className="sendflow-pin-success-art-glow" />
          <img src={successIllustration} alt="" />
        </div>

        <div className="sendflow-pin-success-copy">
          <h1 id="pin-success-title">Code PIN modifié avec succès</h1>
          <p>Votre nouveau code PIN est maintenant actif et protège votre compte.</p>
        </div>

        <button
          type="button"
          className="sendflow-pin-success-action"
          onClick={() => setLocation('/account')}
          data-testid="button-pin-success-dashboard"
        >
          <span>Retour aux transactions</span>
          <ArrowRight size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </section>
    </main>
  );
}