import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, Clock3, Link2, Plus, RefreshCw } from 'lucide-react';
import { useGetCustomerPaymentLinks } from '@workspace/api-client-react';
import type { CustomerPaymentLink } from '@workspace/api-client-react';
import { useSeo } from '@/lib/seo';
import linkflowListIllustration from '@assets/generated_images/sendflow-linkflow-history-3d.webp';

const money = (minor: number, currency: string, decimals: number) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals,
}).format(minor / (10 ** decimals));

const linkAmount = (
  link: CustomerPaymentLink,
  currencyOptions: readonly { code: string; decimals: number }[] | undefined,
) => {
  const decimals = currencyOptions?.find((option) => option.code === link.currency)?.decimals;
  return decimals === undefined ? '—' : money(link.amountMinor, link.currency, decimals);
};

const paymentLabel = (method: CustomerPaymentLink['paymentMethod']) => ({
  all: 'Tous les moyens',
  card: 'Carte',
  mobile_money: 'Mobile Money',
}[method] ?? method);

const dateLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Sans échéance';

const statusLabel = (status: CustomerPaymentLink['status']) => ({
  draft: 'Brouillon',
  active: 'Actif',
  paused: 'En pause',
  expired: 'Expiré',
  exhausted: 'Utilisations atteintes',
}[status] ?? status);

export default function LinkFlowPage() {
  const [, setLocation] = useLocation();
  const [cursor, setCursor] = useState<string | undefined>();
  const linksQuery = useGetCustomerPaymentLinks(cursor ? { cursor, limit: 20 } : { limit: 20 });
  const items = linksQuery.data?.items ?? [];

  useSeo({
    path: '/linkflow',
    locale: 'fr',
    title: 'Mes liens de paiement · SendFlow',
    description: 'Consultez vos demandes de paiement SendFlow.',
    robots: 'noindex,nofollow',
  });

  return (
    <main className="sendflow-linkflow-shell">
      <div className="sendflow-linkflow-art is-list" style={{ backgroundImage: `url(${linkflowListIllustration})` }} aria-hidden="true" />
      <section className="sendflow-linkflow-page sendflow-linkflow-list" aria-labelledby="linkflow-title">
        <header className="sendflow-linkflow-header">
          <button type="button" className="sendflow-linkflow-back" onClick={() => setLocation('/account')} aria-label="Revenir à mon compte" data-testid="button-linkflow-back">
            <ArrowLeft size={21} />
          </button>
          <div className="sendflow-linkflow-head-copy">
            <h1 id="linkflow-title">Liens de paiement</h1>
            <p className="sendflow-linkflow-subtitle">Brouillons de demande</p>
          </div>
          <button type="button" className="sendflow-linkflow-create-link" onClick={() => setLocation('/linkflow/new')} aria-label="Créer un nouveau lien" data-testid="button-linkflow-new">
            <Plus size={21} />
          </button>
        </header>

        {linksQuery.isLoading ? (
          <div className="sendflow-linkflow-skeletons" role="status" aria-label="Chargement des liens">
            {[1, 2, 3].map((item) => <div className="sendflow-linkflow-skeleton" key={item} />)}
          </div>
        ) : linksQuery.isError ? (
          <div className="sendflow-linkflow-message is-error" role="alert">
            <strong>Vos liens ne sont pas disponibles.</strong>
            <p>La demande au serveur a échoué. Vérifiez votre connexion puis réessayez.</p>
            <button type="button" className="sendflow-linkflow-secondary" onClick={() => linksQuery.refetch()} data-testid="button-linkflow-retry"><RefreshCw size={16} /> Réessayer</button>
          </div>
        ) : items.length === 0 ? (
          <div className="sendflow-linkflow-empty">
            <span className="sendflow-linkflow-empty-icon"><Link2 size={24} /></span>
            <h3>Aucun brouillon pour le moment</h3>
            <p>Les demandes que vous préparez apparaîtront ici.</p>
            <button type="button" className="sendflow-linkflow-primary" onClick={() => setLocation('/linkflow/new')} data-testid="button-linkflow-empty-create">Créer un brouillon <ArrowRight size={17} /></button>
          </div>
        ) : (
          <div className="sendflow-linkflow-records" aria-label="Liens de paiement enregistrés">
            {items.map((link) => (
              <article className="sendflow-linkflow-record" key={link.id} data-testid={`card-linkflow-${link.id}`}>
                <span className="sendflow-linkflow-record-icon"><Link2 size={18} /></span>
                <div className="sendflow-linkflow-row-copy">
                  <h3>{link.description}</h3>
                  <p>#{link.code} · {paymentLabel(link.paymentMethod)}</p>
                  <span className="sendflow-linkflow-row-date">Créé le {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(link.createdAt))}</span>
                </div>
                <div className="sendflow-linkflow-row-right">
                  <strong className="sendflow-linkflow-amount">{linkAmount(link, linksQuery.data?.currencyOptions)}</strong>
                  <span>{link.usageCount}{link.maximumUses === null ? ' / illimité' : ` / ${link.maximumUses}`}</span>
                  <span className="sendflow-linkflow-status">{statusLabel(link.status)}</span>
                  <small><Clock3 size={12} /> {dateLabel(link.expiresAt)}</small>
                </div>
              </article>
            ))}
          </div>
        )}

        {linksQuery.data?.nextCursor && !linksQuery.isLoading && (
          <button type="button" className="sendflow-linkflow-load-more" onClick={() => setCursor(linksQuery.data?.nextCursor ?? undefined)} data-testid="button-linkflow-next">
            Voir les demandes suivantes <ArrowRight size={16} />
          </button>
        )}
      </section>
    </main>
  );
}
