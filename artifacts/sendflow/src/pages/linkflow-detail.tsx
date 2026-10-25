import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowUpRight, BarChart3, Check, CircleHelp, Clock3, Copy, CreditCard,
  Link2, LockKeyhole, Pencil, RefreshCw, ShieldCheck, Trash2,
} from 'lucide-react';
import {
  getGetCustomerPaymentLinkQueryKey,
  getGetCustomerPaymentLinksQueryKey,
  useDeleteCustomerPaymentLink,
  useGetCustomerPaymentLink,
  useUpdateCustomerPaymentLink,
} from '@workspace/api-client-react';
import { buildLinkFlowShareTargets } from '@/lib/linkflow-share';
import { useSeo } from '@/lib/seo';
import linkflowListIllustration from '@assets/generated_images/sendflow-linkflow-history-3d.webp';

const formatMoney = (minor: number, currency: string, decimals: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(minor / (10 ** decimals));

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));

const amountToMinor = (value: string, decimals: number): bigint | null => {
  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) return null;
  try {
    return BigInt(`${whole}${fraction.padEnd(decimals, '0')}`);
  } catch {
    return null;
  }
};

const paymentLabel = (method: string) => ({
  all: 'Tous les moyens de paiement',
  card: 'Carte bancaire',
  mobile_money: 'Mobile Money',
}[method] ?? method);

const statusLabel = (status: string) => ({
  draft: 'Brouillon',
  active: 'Actif',
  paused: 'En pause',
  expired: 'Expiré',
  exhausted: 'Utilisations atteintes',
}[status] ?? status);

function LinkFlowDetailBackdrop() {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <img
      className="sendflow-linkflow-art is-detail"
      src={linkflowListIllustration}
      alt=""
      aria-hidden="true"
      draggable={false}
    />,
    document.body,
  );
}

export default function LinkFlowDetailPage() {
  const { linkId = '' } = useParams<{ linkId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'information' | 'statistics'>('information');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [maximumUses, setMaximumUses] = useState('');
  const [formError, setFormError] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const linkQuery = useGetCustomerPaymentLink(linkId, {
    query: { queryKey: getGetCustomerPaymentLinkQueryKey(linkId) },
  });

  const invalidateLinkFlow = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetCustomerPaymentLinkQueryKey(linkId) }),
      queryClient.invalidateQueries({ queryKey: getGetCustomerPaymentLinksQueryKey() }),
    ]);
  };
  const updateMutation = useUpdateCustomerPaymentLink({
    mutation: { onSuccess: invalidateLinkFlow },
  });
  const deleteMutation = useDeleteCustomerPaymentLink({
    mutation: {
      onSuccess: async () => {
        await invalidateLinkFlow();
        queryClient.removeQueries({ queryKey: getGetCustomerPaymentLinkQueryKey(linkId), exact: true });
        setLocation('/linkflow');
      },
    },
  });

  useSeo({
    path: `/linkflow/${linkId}`,
    locale: 'fr',
    title: 'Détail du lien de paiement · SendFlow',
    description: 'Consultez et gérez votre lien de paiement SendFlow.',
    robots: 'noindex,nofollow',
  });

  const startEditing = () => {
    const link = linkQuery.data;
    if (!link) return;
    setAmount((link.amountMinor / (10 ** link.currencyDecimals)).toFixed(link.currencyDecimals));
    setDescription(link.description);
    setMaximumUses(link.maximumUses === null ? '' : String(link.maximumUses));
    setFormError('');
    setEditing(true);
  };

  const saveChanges = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const link = linkQuery.data;
    if (!link) return;
    const used = link.usageCount > 0;
    const nextAmount = amount.trim();
    const nextDescription = description.trim();
    const maxText = maximumUses.trim();
    const maxValue = maxText === '' ? null : Number(maxText);
    const nextAmountMinor = amountToMinor(nextAmount, link.currencyDecimals);

    if (used && (nextAmountMinor !== BigInt(link.amountMinor)
      || nextDescription !== link.description)) {
      setFormError('Le montant et la description ne peuvent plus être modifiés après une utilisation.');
      return;
    }
    if (maxValue !== null && (!Number.isInteger(maxValue) || maxValue < 1 || maxValue > 999999)) {
      setFormError('Indiquez une limite entière comprise entre 1 et 999 999, ou laissez-la vide.');
      return;
    }
    if (maxValue !== null && maxValue < link.usageCount) {
      setFormError(`La limite ne peut pas être inférieure aux ${link.usageCount} utilisations déjà enregistrées.`);
      return;
    }
    if (!nextDescription || nextDescription.length < 2 || nextDescription.length > 240) {
      setFormError('La description doit contenir entre 2 et 240 caractères.');
      return;
    }
    if (nextAmountMinor === null || nextAmountMinor <= 0n || nextAmount.length > 24) {
      setFormError(`Saisissez un montant valide avec au maximum ${link.currencyDecimals} décimales.`);
      return;
    }

    const data: { amount?: string; description?: string; maximumUses?: number | null } = {};
    if (nextAmountMinor !== BigInt(link.amountMinor)) data.amount = nextAmount;
    if (nextDescription !== link.description) data.description = nextDescription;
    if (maxValue !== link.maximumUses) data.maximumUses = maxValue;
    if (Object.keys(data).length === 0) {
      setEditing(false);
      return;
    }
    setFormError('');
    updateMutation.mutate({ linkId, data }, {
      onSuccess: () => setEditing(false),
      onError: () => setFormError('Les modifications n’ont pas été enregistrées. Vérifiez votre connexion puis réessayez.'),
    });
  };

  if (linkQuery.isLoading) {
    return (
      <main className="sendflow-linkflow-shell">
        <section className="sendflow-linkflow-page sendflow-detail-page" aria-label="Chargement du lien">
          <div className="sendflow-detail-skeleton-bar" />
          <div className="sendflow-detail-skeleton-hero" />
          <div className="sendflow-detail-skeleton-card" />
          <div className="sendflow-detail-skeleton-card" />
        </section>
      </main>
    );
  }
  if (linkQuery.isError || !linkQuery.data) {
    return (
      <main className="sendflow-linkflow-shell">
        <section className="sendflow-linkflow-page sendflow-detail-page">
          <header className="sendflow-detail-header">
            <button type="button" className="sendflow-linkflow-back" onClick={() => setLocation('/linkflow')} aria-label="Retour aux liens"><ArrowLeft size={21} /></button>
            <h1>Détail du lien</h1><span />
          </header>
          <div className="sendflow-detail-state">
            <span className="sendflow-detail-state-icon"><Link2 size={24} /></span>
            <h2>Ce lien n’est pas disponible</h2>
            <p>Il a peut-être été supprimé ou vous n’y avez pas accès. Seuls les liens de votre compte sont visibles ici.</p>
            <button type="button" className="sendflow-detail-primary" onClick={() => linkQuery.refetch()}><RefreshCw size={16} /> Réessayer</button>
            <button type="button" className="sendflow-detail-text-button" onClick={() => setLocation('/linkflow')}>Retour à mes liens</button>
          </div>
        </section>
      </main>
    );
  }

  const link = linkQuery.data;
  const amountLabel = formatMoney(link.amountMinor, link.currency, link.currencyDecimals);
  let publicUrl = link.sharePath;
  try {
    if (typeof window !== 'undefined') {
      publicUrl = buildLinkFlowShareTargets({
        origin: window.location.origin,
        basePath: import.meta.env.BASE_URL,
        sharePath: link.sharePath,
        title: link.description,
      }).url;
    }
  } catch {
    publicUrl = link.sharePath;
  }

  const copyPublicUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <>
      <LinkFlowDetailBackdrop />
      <main className="sendflow-linkflow-shell">
      <section className="sendflow-linkflow-page sendflow-detail-page" aria-labelledby="sendflow-detail-title">
        <header className="sendflow-detail-header">
          <button type="button" className="sendflow-linkflow-back" onClick={() => setLocation('/linkflow')} aria-label="Retour aux liens" data-testid="button-linkflow-detail-back"><ArrowLeft size={21} /></button>
          <h1 id="sendflow-detail-title">Détail du lien</h1>
          <button type="button" className="sendflow-detail-icon-button" onClick={startEditing} aria-label="Modifier le lien" data-testid="button-linkflow-edit"><Pencil size={18} /></button>
        </header>

        <div className="sendflow-detail-body">
          <div className="sendflow-detail-eyebrow"><span className={`sendflow-detail-status is-${link.status}`}><i />{statusLabel(link.status)}</span><span>#{link.code}</span></div>
          <section className="sendflow-detail-hero">
            <span className="sendflow-detail-hero-mark"><Link2 size={22} /></span>
            <p>Montant demandé</p>
            <strong>{amountLabel}</strong>
            <span className="sendflow-detail-hero-caption">{link.description}</span>
          </section>

          <div className="sendflow-detail-switch" role="tablist" aria-label="Informations du lien">
            <button type="button" role="tab" aria-selected={view === 'information'} className={view === 'information' ? 'is-selected' : ''} onClick={() => setView('information')}><Link2 size={16} /> Informations</button>
            <button type="button" role="tab" aria-selected={view === 'statistics'} className={view === 'statistics' ? 'is-selected' : ''} onClick={() => setView('statistics')}><BarChart3 size={16} /> Statistiques</button>
          </div>

          {view === 'information' ? (
            <div className="sendflow-detail-panel" role="tabpanel">
              <div className="sendflow-detail-section-heading"><div><span className="sendflow-detail-kicker">VOTRE LIEN</span><h2>Informations</h2></div><button type="button" className="sendflow-detail-edit-link" onClick={startEditing}><Pencil size={14} /> Modifier</button></div>
              <section className="sendflow-detail-public-link" aria-label="Lien public de paiement">
                <div className="sendflow-detail-public-heading"><span><Link2 size={15} /> Adresse publique</span><span className="sendflow-detail-public-safe"><LockKeyhole size={12} /> Accès sécurisé</span></div>
                <div className="sendflow-detail-public-control">
                  <input type="text" readOnly value={publicUrl} aria-label="Adresse publique du lien de paiement" onFocus={(event) => event.currentTarget.select()} />
                  <button type="button" onClick={() => void copyPublicUrl()} aria-label="Copier l’adresse publique" data-testid="button-linkflow-detail-copy">
                    {copyState === 'copied' ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copyState === 'copied' ? 'Copié' : 'Copier'}</span>
                  </button>
                </div>
                {copyState === 'error' && <p className="sendflow-detail-copy-error" role="status">Copie indisponible. Touchez l’adresse pour la sélectionner.</p>}
              </section>
              <dl className="sendflow-detail-facts">
                <div><dt>Description</dt><dd>{link.description}</dd></div>
                <div><dt>Moyens de paiement</dt><dd><span className="sendflow-detail-fact-icon"><CreditCard size={15} /></span>{paymentLabel(link.paymentMethod)}</dd></div>
                <div><dt>Échéance</dt><dd><span className="sendflow-detail-fact-icon"><Clock3 size={15} /></span>{link.expiresAt ? formatDate(link.expiresAt) : 'Sans échéance'}</dd></div>
                <div><dt>Créé le</dt><dd>{formatDate(link.createdAt)}</dd></div>
              </dl>
              <section className="sendflow-detail-usage" aria-label="Utilisations et limite">
                <div className="sendflow-detail-usage-copy">
                  <span className="sendflow-detail-usage-icon"><BarChart3 size={16} /></span>
                  <p><strong>Utilisations</strong><span>{link.usageCount} {link.usageCount === 1 ? 'utilisation enregistrée' : 'utilisations enregistrées'}</span></p>
                </div>
                <div className="sendflow-detail-usage-limit">
                  <span><small>Limite d’utilisations</small><strong>{link.maximumUses === null ? 'Illimitée' : `Maximum ${link.maximumUses}`}</strong></span>
                  <button type="button" onClick={startEditing} aria-label="Modifier la limite d’utilisations"><Pencil size={13} /> Modifier</button>
                </div>
              </section>
              <div className="sendflow-detail-security"><ShieldCheck size={18} /><p><strong>Géré en toute sécurité</strong><span>Ce lien est rattaché à votre compte SendFlow.</span></p><LockKeyhole size={15} /></div>
            </div>
          ) : (
            <div className="sendflow-detail-panel sendflow-detail-stats" role="tabpanel">
              <span className="sendflow-detail-stats-icon"><BarChart3 size={22} /></span>
              <span className="sendflow-detail-kicker">ANALYSE DU LIEN</span>
              <h2>Statistiques indisponibles</h2>
              <p>Les statistiques seront accessibles lorsque les paiements réels seront activés. Aucun chiffre de paiement n’est disponible pour le moment.</p>
              <div className="sendflow-detail-stats-note"><CircleHelp size={16} />Seules les utilisations enregistrées par le serveur sont affichées dans les informations.</div>
            </div>
          )}

          <div className="sendflow-detail-created-note"><span><Check size={14} /></span>Les informations affichées proviennent de votre espace sécurisé.</div>
          <button type="button" className="sendflow-detail-delete" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /> Supprimer ce lien</button>
        </div>
      </section>

      {editing && (
        <div className="sendflow-detail-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !updateMutation.isPending) setEditing(false); }}>
          <section className="sendflow-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="sendflow-edit-title">
            <div className="sendflow-detail-sheet-grip" />
            <header className="sendflow-detail-sheet-heading"><div><span className="sendflow-detail-kicker">GESTION DU LIEN</span><h2 id="sendflow-edit-title">Modifier les informations</h2></div><button type="button" className="sendflow-detail-sheet-close" onClick={() => setEditing(false)} aria-label="Fermer" disabled={updateMutation.isPending}>×</button></header>
            {link.usageCount > 0 && <p className="sendflow-detail-edit-lock"><LockKeyhole size={16} />Ce lien a déjà été utilisé. Son montant et sa description sont verrouillés.</p>}
            <form className="sendflow-detail-form" onSubmit={saveChanges}>
              <label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} minLength={2} disabled={link.usageCount > 0} required /></label>
              <label>Montant <span>({link.currency})</span><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" disabled={link.usageCount > 0} required /></label>
              <label>Nombre maximum d’utilisations <span>(facultatif)</span><input value={maximumUses} onChange={(event) => setMaximumUses(event.target.value)} inputMode="numeric" type="number" min={link.usageCount || 1} max={999999} placeholder="Illimité" /></label>
              <p className="sendflow-detail-form-hint">La limite ne peut pas être inférieure aux utilisations déjà enregistrées ({link.usageCount}).</p>
              {formError && <p className="sendflow-detail-form-error" role="alert">{formError}</p>}
              <button type="submit" className="sendflow-detail-primary sendflow-detail-save" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer les modifications'} <ArrowUpRight size={17} /></button>
            </form>
          </section>
        </div>
      )}

      {confirmDelete && (
        <div className="sendflow-detail-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleteMutation.isPending) setConfirmDelete(false); }}>
          <section className="sendflow-detail-confirm" role="alertdialog" aria-modal="true" aria-labelledby="sendflow-delete-title" aria-describedby="sendflow-delete-copy">
            <span className="sendflow-detail-confirm-icon"><Trash2 size={20} /></span>
            <h2 id="sendflow-delete-title">Supprimer ce lien ?</h2>
            <p id="sendflow-delete-copy">Le lien public sera invalidé et masqué. Son historique sera conservé dans votre compte.</p>
            {deleteMutation.isError && <p className="sendflow-detail-form-error" role="alert">La suppression a échoué. Réessayez.</p>}
            <div className="sendflow-detail-confirm-actions">
              <button type="button" className="sendflow-detail-cancel" onClick={() => setConfirmDelete(false)} disabled={deleteMutation.isPending}>Garder le lien</button>
              <button type="button" className="sendflow-detail-danger" onClick={() => deleteMutation.mutate({ linkId })} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? 'Suppression…' : 'Supprimer le lien'}</button>
            </div>
          </section>
        </div>
      )}
      </main>
    </>
  );
}
