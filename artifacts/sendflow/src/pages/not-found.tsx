import { Home, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import sendflowMark from '@/assets/sendflow-mark-original.png';
import sendflowWordmark from '@/assets/sendflow-wordmark-original.png';
import { getNotFoundHomeHref } from '@/lib/not-found-route';
import { useSeo } from '@/lib/seo';

export default function NotFound() {
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
  const homeHref = getNotFoundHomeHref(hostname);

  useSeo({
    path: '/404',
    locale: 'fr',
    title: 'Page introuvable · SendFlow',
    description: 'La page demandée est introuvable.',
    robots: 'noindex,nofollow',
  });

  return (
    <main className="sf-not-found-page">
      <div className="sf-not-found-glow sf-not-found-glow-top" aria-hidden="true" />
      <div className="sf-not-found-glow sf-not-found-glow-bottom" aria-hidden="true" />
      <section className="sf-not-found-card" aria-labelledby="sf-not-found-title">
        <div className="sf-not-found-brand" aria-label="SendFlow">
          <img className="sf-not-found-mark" src={sendflowMark} alt="" />
          <img className="sf-not-found-wordmark" src={sendflowWordmark} alt="SendFlow" />
        </div>

        <div className="sf-not-found-icon" aria-hidden="true">
          <SearchX size={29} strokeWidth={1.8} />
        </div>
        <p className="sf-not-found-code">ERREUR 404</p>
        <h1 id="sf-not-found-title">Cette page n’existe pas</h1>
        <p className="sf-not-found-description">
          L’adresse demandée est introuvable ou n’est plus disponible. Vérifie le lien ou retourne sur SendFlow.
        </p>
        <Button asChild className="sf-not-found-home">
          <a href={homeHref}>
            <Home size={17} aria-hidden="true" />
            Retour à SendFlow
          </a>
        </Button>
      </section>
      <p className="sf-not-found-footer">SendFlow · Votre argent, en mouvement</p>
    </main>
  );
}
