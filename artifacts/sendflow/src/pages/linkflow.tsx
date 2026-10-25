import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, Clock3, Copy, Link2, Plus, RefreshCw, Share2 } from 'lucide-react';
import { SiFacebook, SiTelegram, SiWhatsapp } from 'react-icons/si';
import { getGetCustomerPaymentLinksQueryKey, useGetCustomerPaymentLinks } from '@workspace/api-client-react';
import type { CustomerPaymentLink } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildLinkFlowShareTargets, type LinkFlowShareTargets } from '@/lib/linkflow-share';
import { useSeo } from '@/lib/seo';
import linkflowListIllustration from '@assets/generated_images/sendflow-linkflow-history-3d.webp';

const money = (minor: number, currency: string, decimals: number) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals,
}).format(minor / (10 ** decimals));

const linkAmount = (link: CustomerPaymentLink) =>
  money(link.amountMinor, link.currency, link.currencyDecimals);

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
  const [shareDialog, setShareDialog] = useState<{
    id: string;
    title: string;
    targets: LinkFlowShareTargets;
  } | null>(null);
  const [shareNotice, setShareNotice] = useState<{ message: string; error?: boolean } | null>(null);
  const params = cursor ? { cursor, limit: 20 } : { limit: 20 };
  const linksQuery = useGetCustomerPaymentLinks(params, {
    query: { queryKey: getGetCustomerPaymentLinksQueryKey(params) },
  });
  const items = linksQuery.data?.items ?? [];

  const openShareDialog = (link: CustomerPaymentLink) => {
    try {
      const targets = buildLinkFlowShareTargets({
        origin: window.location.origin,
        basePath: import.meta.env.BASE_URL,
        sharePath: link.sharePath,
        title: link.description,
      });
      setShareNotice(null);
      setShareDialog({ id: link.id, title: link.description, targets });
    } catch {
      setShareDialog(null);
      setShareNotice({ message: 'Ce lien ne peut pas être partagé pour le moment.', error: true });
    }
  };

  const copyShareLink = async () => {
    if (!shareDialog) return;
    try {
      await navigator.clipboard.writeText(shareDialog.targets.url);
      setShareNotice({ message: 'Lien copié.' });
    } catch {
      setShareNotice({ message: 'Copie automatique indisponible. Sélectionnez le lien affiché pour le copier.', error: true });
    }
  };

  const shareWithOtherApps = async () => {
    if (!shareDialog || typeof navigator.share !== 'function') return;
    try {
      await navigator.share({
        title: shareDialog.title || 'Lien de paiement SendFlow',
        text: `Lien de paiement : ${shareDialog.title}`,
        url: shareDialog.targets.url,
      });
      setShareNotice({ message: 'Lien partagé.' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareNotice({ message: 'Le partage a échoué. Réessayez ou copiez le lien.', error: true });
    }
  };

  useSeo({
    path: '/linkflow',
    locale: 'fr',
    title: 'Mes liens de paiement · SendFlow',
    description: 'Consultez vos demandes de paiement SendFlow.',
    robots: 'noindex,nofollow',
  });

  return (
    <>
      {typeof document !== 'undefined' && createPortal(
        <img
          className="sendflow-linkflow-art is-list"
          src={linkflowListIllustration}
          alt=""
          aria-hidden="true"
          draggable={false}
        />,
        document.body,
      )}
      <main className="sendflow-linkflow-shell">
      <section className="sendflow-linkflow-page sendflow-linkflow-list" aria-labelledby="linkflow-title">
        <header className="sendflow-linkflow-header">
          <button type="button" className="sendflow-linkflow-back" onClick={() => setLocation('/account')} aria-label="Revenir à mon compte" data-testid="button-linkflow-back">
            <ArrowLeft size={23} strokeWidth={2} aria-hidden="true" />
          </button>
          <div className="sendflow-linkflow-head-copy">
            <h1 id="linkflow-title">Liens de paiement</h1>
            <p className="sendflow-linkflow-subtitle">Liens de paiement partageables</p>
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
            <h3>Aucun lien pour le moment</h3>
            <p>Vos demandes de paiement partageables apparaîtront ici.</p>
            <button type="button" className="sendflow-linkflow-primary" onClick={() => setLocation('/linkflow/new')} data-testid="button-linkflow-empty-create">Créer un lien <ArrowRight size={17} /></button>
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
                  <strong className="sendflow-linkflow-amount">{linkAmount(link)}</strong>
                  <span>{link.usageCount}{link.maximumUses === null ? ' / illimité' : ` / ${link.maximumUses}`}</span>
                  <span className={`sendflow-linkflow-status is-${link.status}`}>{statusLabel(link.status)}</span>
                  <small><Clock3 size={12} /> {dateLabel(link.expiresAt)}</small>
                  <button
                    type="button"
                    className="sendflow-linkflow-share"
                    onClick={() => openShareDialog(link)}
                    aria-label={`Partager le lien de paiement ${link.description}`}
                    aria-haspopup="dialog"
                    data-testid={`button-linkflow-share-${link.id}`}
                  >
                    <Share2 size={16} />
                    Partager
                  </button>
                  {shareNotice?.error && !shareDialog && (
                    <span className="sendflow-linkflow-share-error" role="alert">{shareNotice.message}</span>
                  )}
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

      <Dialog
        open={!!shareDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShareDialog(null);
            setShareNotice(null);
          }
        }}
      >
        <DialogContent className="sendflow-linkflow-share-dialog" data-testid="dialog-linkflow-share">
          <DialogHeader className="sendflow-linkflow-share-dialog-header">
            <DialogTitle>Partager ce lien</DialogTitle>
            <DialogDescription>
              {shareDialog?.title ? `Choisissez une application pour « ${shareDialog.title} » ou copiez son adresse.` : 'Choisissez une application ou copiez l’adresse du lien.'}
            </DialogDescription>
          </DialogHeader>

          {shareDialog && (
            <>
              <div className="sendflow-linkflow-share-url-row">
                <input
                  type="text"
                  readOnly
                  value={shareDialog.targets.url}
                  aria-label="Adresse publique du lien de paiement"
                  onFocus={(event) => event.currentTarget.select()}
                  data-testid="input-linkflow-share-url"
                />
                <button type="button" onClick={() => void copyShareLink()} data-testid="button-linkflow-copy">
                  <Copy size={17} />
                  Copier
                </button>
              </div>

              <div className="sendflow-linkflow-share-options" aria-label="Applications de partage">
                <a
                  href={shareDialog.targets.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sendflow-linkflow-share-option is-whatsapp"
                  data-testid="link-share-whatsapp"
                >
                  <SiWhatsapp size={20} aria-hidden="true" />
                  WhatsApp
                </a>
                <a
                  href={shareDialog.targets.telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sendflow-linkflow-share-option is-telegram"
                  data-testid="link-share-telegram"
                >
                  <SiTelegram size={20} aria-hidden="true" />
                  Telegram
                </a>
                <a
                  href={shareDialog.targets.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sendflow-linkflow-share-option is-facebook"
                  data-testid="link-share-facebook"
                >
                  <SiFacebook size={20} aria-hidden="true" />
                  Facebook
                </a>
                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                  <button
                    type="button"
                    className="sendflow-linkflow-share-option is-native"
                    onClick={() => void shareWithOtherApps()}
                    data-testid="button-share-other-apps"
                  >
                    <Share2 size={18} />
                    Autres applications
                  </button>
                )}
              </div>

              {shareNotice && (
                <p className={`sendflow-linkflow-share-notice${shareNotice.error ? ' is-error' : ''}`} role={shareNotice.error ? 'alert' : 'status'}>
                  {shareNotice.message}
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
