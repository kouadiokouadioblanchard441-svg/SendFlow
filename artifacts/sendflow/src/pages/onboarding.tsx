import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useSeo } from '@/lib/seo';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import networkIllustration from '@assets/generated_images/sendflow-network-person-3d-transparent.png';
import howIllustration from '@assets/generated_images/sendflow-how-person-3d-transparent.png';
import coverageIllustration from '@assets/generated_images/sendflow-coverage-person-3d-transparent.png';

const ONBOARDING_STEP_KEY = 'sendflow.onboarding-step';

const slides = [
  {
    eyebrow: 'Votre argent, en mouvement',
    title: 'Le lien qui rapproche vos proches.',
    description: 'Envoyez, recevez et gardez votre argent à portée de main, simplement.',
    image: networkIllustration,
    imageAlt: 'Femme tenant un téléphone entourée de connexions financières',
    accent: 'network',
  },
  {
    eyebrow: 'Pensé pour votre quotidien',
    title: 'Un wallet clair. Des transferts sereins.',
    description: 'Chaque étape est visible, de votre solde jusqu’à la confirmation.',
    image: howIllustration,
    imageAlt: 'Homme présentant les gestes simples d’un transfert mobile',
    accent: 'how',
  },
  {
    eyebrow: 'L’Afrique de l’Ouest, connectée',
    title: 'Plus loin, sans complication.',
    description: 'Retrouvez vos habitudes de paiement dans une expérience conçue pour vous.',
    image: coverageIllustration,
    imageAlt: 'Femme tenant un téléphone devant une carte connectée de l’Afrique',
    accent: 'coverage',
  },
] as const;

function getInitialStep() {
  if (typeof window === 'undefined') return 0;
  const savedStep = Number.parseInt(window.sessionStorage.getItem(ONBOARDING_STEP_KEY) ?? '', 10);
  return Number.isFinite(savedStep) ? Math.min(Math.max(savedStep, 0), slides.length - 1) : 0;
}

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const [activeStep, setActiveStep] = useState(getInitialStep);
  const [reducedMotion, setReducedMotion] = useState(false);

  useSeo({
    path: '/',
    locale: 'fr',
    title: 'Bienvenue sur SendFlow',
    description: 'Découvrez une façon simple et fiable de gérer vos transferts et votre wallet.',
    robots: 'noindex,nofollow',
  });

  const slide = slides[activeStep];
  const isLastStep = activeStep === slides.length - 1;

  useEffect(() => {
    window.sessionStorage.setItem(ONBOARDING_STEP_KEY, String(activeStep));
  }, [activeStep]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveStep((current) => Math.max(current - 1, 0));
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (isLastStep) setLocation('/sign-up');
        else setActiveStep((current) => Math.min(current + 1, slides.length - 1));
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setActiveStep(0);
      }
      if (event.key === 'End') {
        event.preventDefault();
        setActiveStep(slides.length - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLastStep, setLocation]);

  const goNext = () => {
    if (isLastStep) {
      setLocation('/sign-up');
      return;
    }
    setActiveStep((current) => Math.min(current + 1, slides.length - 1));
  };

  return (
    <main className={`sendflow-onboarding${reducedMotion ? ' is-reduced-motion' : ''}`} data-accent={slide.accent}>
      <div className="sendflow-onboarding-orbit sendflow-onboarding-orbit-one" aria-hidden="true" />
      <div className="sendflow-onboarding-orbit sendflow-onboarding-orbit-two" aria-hidden="true" />

      <section className="sendflow-onboarding-frame" aria-labelledby="onboarding-title">
        <header className="sendflow-onboarding-header">
          <Link href="/" className="sendflow-onboarding-brand" aria-label="SendFlow, accueil">
            <img src={sendflowMark} alt="" />
            <img src={sendflowWordmark} alt="SendFlow" />
          </Link>
        </header>

        <nav className="sendflow-onboarding-progress" aria-label="Progression de la découverte">
          {slides.map((item, index) => (
            <button
              key={item.accent}
              type="button"
              className={`sendflow-onboarding-progress-step${index === activeStep ? ' is-active' : ''}${index < activeStep ? ' is-complete' : ''}`}
              onClick={() => setActiveStep(index)}
              aria-label={`Aller à l’étape ${index + 1} : ${item.eyebrow}`}
              aria-current={index === activeStep ? 'step' : undefined}
            >
              <span className="sendflow-onboarding-progress-dot" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="sendflow-onboarding-progress-label">{item.eyebrow}</span>
            </button>
          ))}
        </nav>

        <div className="sendflow-onboarding-content" key={slide.accent}>
          <div className="sendflow-onboarding-copy">
            <p className="sendflow-onboarding-eyebrow">{slide.eyebrow}</p>
            <h1 id="onboarding-title" aria-live="polite">{slide.title}</h1>
            <p className="sendflow-onboarding-description">{slide.description}</p>
          </div>

          <div className={`sendflow-onboarding-visual is-${slide.accent}`}>
            <div className="sendflow-onboarding-visual-backdrop" aria-hidden="true" />
            <img src={slide.image} alt={slide.imageAlt} />
          </div>
        </div>

        <div className="sendflow-onboarding-controls" aria-label="Navigation entre les étapes">
          <button
            type="button"
            className="sendflow-onboarding-arrow is-back"
            onClick={() => setActiveStep((current) => Math.max(current - 1, 0))}
            disabled={activeStep === 0}
            aria-label="Étape précédente"
          >
            <ArrowLeft size={19} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <span className="sendflow-onboarding-counter" aria-live="polite">
            <strong>{String(activeStep + 1).padStart(2, '0')}</strong>
            <span>/ {String(slides.length).padStart(2, '0')}</span>
          </span>
          <button type="button" className="sendflow-onboarding-next" onClick={goNext}>
            {isLastStep ? 'Commencer' : 'Suivant'}
            <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <footer className="sendflow-onboarding-actions">
          <Link href="/sign-in" className="sendflow-onboarding-action is-secondary">
            Se connecter
          </Link>
          <Link href="/sign-up" className="sendflow-onboarding-action is-primary">
            Créer un compte
          </Link>
        </footer>
      </section>
    </main>
  );
}