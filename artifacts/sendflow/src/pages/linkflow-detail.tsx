import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft, ArrowUpRight, BarChart3, Check, CircleHelp, Copy, Link2,
  LockKeyhole, RefreshCw, SlidersHorizontal, Trash2,
} from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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

const formatMinorInput = (minor: number, decimals: number) => {
  const digits = String(minor);
  if (decimals === 0) return digits;
  const padded = digits.padStart(decimals + 1, '0');
  return `${padded.slice(0, -decimals)}.${padded.slice(-decimals)}`;
};

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

const statusLabel = (status: string) => ({
  draft: 'Brouillon',
  active: 'Actif',
  paused: 'En pause',
  expired: 'Expiré',
  exhausted: 'Utilisations atteintes',
}[status] ?? status);

type LimitFormValues = { maximumUses: string };

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
  const [amountDraft, setAmountDraft] = useState<string | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const limitForm = useForm<LimitFormValues>({ defaultValues: { maximumUses: '' } });
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
    limitForm.reset({ maximumUses: link.maximumUses === null ? '' : String(link.maximumUses) });
    setFormError('');
    setEditing(true);
  };

  const saveChanges = limitForm.handleSubmit((values) => {
    const link = linkQuery.data;
    if (!link) return;
    const maxText = values.maximumUses.trim();
    const maxValue = maxText === '' ? null : Number(maxText);
    if (maxValue !== null && (!Number.isInteger(maxValue) || maxValue < 1 || maxValue > 999999)) {
      setFormError('Indiquez une limite entière comprise entre 1 et 999 999, ou laissez-la vide.');
      return;
    }
    if (maxValue !== null && maxValue < link.usageCount) {
      setFormError(`La limite ne peut pas être inférieure aux ${link.usageCount} utilisations déjà enregistrées.`);
      return;
    }
    if (maxValue === link.maximumUses) {
      setEditing(false);
      return;
    }
    setFormError('');
    updateMutation.mutate({ linkId, data: { maximumUses: maxValue } }, {
      onSuccess: () => setEditing(false),
      onError: () => setFormError('Les modifications n’ont pas été enregistrées. Vérifiez votre connexion puis réessayez.'),
    });
  });

  const saveAmount = () => {
    const link = linkQuery.data;
    if (!link || link.usageCount > 0 || amountDraft === null) return;
    const nextAmount = amountDraft.trim();
    const nextAmountMinor = amountToMinor(nextAmount, link.currencyDecimals);
    if (nextAmountMinor === null || nextAmountMinor <= 0n || nextAmount.length > 24) {
      setAmountError(`Saisissez un montant valide avec au maximum ${link.currencyDecimals} décimales.`);
      return;
    }
    if (nextAmountMinor === BigInt(link.amountMinor)) {
      setAmountDraft(null);
      setAmountError('');
      return;
    }
    setAmountError('');
    updateMutation.mutate({ linkId, data: { amount: nextAmount } }, {
      onSuccess: () => setAmountDraft(null),
      onError: () => setAmountError('Le montant n’a pas été enregistré. Réessayez.'),
    });
  };

  const saveDescription = () => {
    const link = linkQuery.data;
    if (!link || link.usageCount > 0 || descriptionDraft === null) return;
    const nextDescription = descriptionDraft.trim();
    if (nextDescription.length < 2 || nextDescription.length > 240) {
      setDescriptionError('La description doit contenir entre 2 et 240 caractères.');
      return;
    }
    if (nextDescription === link.description) {
      setDescriptionDraft(null);
      setDescriptionError('');
      return;
    }
    setDescriptionError('');
    updateMutation.mutate({ linkId, data: { description: nextDescription } }, {
      onSuccess: () => setDescriptionDraft(null),
      onError: () => setDescriptionError('La description n’a pas été enregistrée. Réessayez.'),
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
  const savedAmount = formatMinorInput(link.amountMinor, link.currencyDecimals);
  const shownAmount = amountDraft ?? savedAmount;
  const shownDescription = descriptionDraft ?? link.description;
  const amountDirty = amountDraft !== null
    && amountToMinor(amountDraft.trim(), link.currencyDecimals) !== BigInt(link.amountMinor);
  const descriptionDirty = descriptionDraft !== null
    && descriptionDraft.trim() !== link.description;
  let publicUrl = link.sharePath;
  try {
    if (typeof window !== 'undefined') {
      publicUrl = buildLinkFlowShareTargets({
        origin: window.location.origin,
        basePath: import.meta.env.BASE_URL,
        sharePath: link.sharePath,
        title: link.linkName?.trim() || link.description,
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
          <span className="sendflow-detail-header-spacer" aria-hidden="true" />
        </header>

        <div className="sendflow-detail-body">
          <div className="sendflow-detail-eyebrow">
            <strong className="sendflow-detail-link-name" data-testid="text-linkflow-detail-name">{link.linkName?.trim() || link.code}</strong>
            <span className={`sendflow-detail-status is-${link.status}`} data-testid="status-linkflow-detail"><i />{statusLabel(link.status)}</span>
          </div>

          <div className="sendflow-detail-switch" role="tablist" aria-label="Informations du lien">
            <button type="button" role="tab" data-testid="tab-linkflow-information" aria-selected={view === 'information'} className={view === 'information' ? 'is-selected' : ''} onClick={() => setView('information')}>Informations</button>
            <button type="button" role="tab" data-testid="tab-linkflow-statistics" aria-selected={view === 'statistics'} className={view === 'statistics' ? 'is-selected' : ''} onClick={() => setView('statistics')}>Statistiques</button>
          </div>

          {view === 'information' ? (
            <div className="sendflow-detail-panel" role="tabpanel">
              <section className="sendflow-detail-public-link" aria-label="Lien public de paiement">
                <div className="sendflow-detail-public-control">
                  <input type="text" readOnly value={publicUrl} aria-label="Adresse publique du lien de paiement" data-testid="input-linkflow-detail-url" onFocus={(event) => event.currentTarget.select()} />
                  <button type="button" onClick={() => void copyPublicUrl()} aria-label="Copier l’adresse publique" data-testid="button-linkflow-detail-copy">
                    {copyState === 'copied' ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                {copyState === 'error' && <p className="sendflow-detail-copy-error" role="status">Copie indisponible. Touchez l’adresse pour la sélectionner.</p>}
              </section>
              <section className="sendflow-detail-usage" aria-label="Utilisations et limite">
                <div className="sendflow-detail-usage-copy">
                  <p><span>Utilisations</span><strong data-testid="text-linkflow-detail-usage">{link.usageCount} / {link.maximumUses === null ? 'Illimité' : link.maximumUses}</strong></p>
                </div>
                <button type="button" className="sendflow-detail-usage-limit" onClick={startEditing} aria-label="Modifier la limite d’utilisations" data-testid="button-linkflow-detail-limit"><SlidersHorizontal size={15} /> Limite d’utilisations</button>
              </section>
              <label className="sendflow-detail-inline-field">
                <span>Montant ({link.currency})</span>
                <div className="sendflow-detail-inline-control">
                  <input
                    value={shownAmount}
                    onChange={(event) => { setAmountDraft(event.target.value); setAmountError(''); }}
                    aria-label={`Montant en ${link.currency}`}
                    inputMode="decimal"
                    data-testid="input-linkflow-detail-amount"
                    disabled={link.usageCount > 0 || updateMutation.isPending}
                  />
                  <button type="button" onClick={saveAmount} disabled={!amountDirty || updateMutation.isPending || link.usageCount > 0} aria-label="Enregistrer le montant" data-testid="button-linkflow-detail-save-amount">
                    {updateMutation.isPending && amountDirty ? <RefreshCw size={17} className="sendflow-detail-saving-icon" /> : <Check size={19} />}
                  </button>
                </div>
                {amountError && <small className="sendflow-detail-inline-error" role="alert">{amountError}</small>}
              </label>
              <label className="sendflow-detail-inline-field">
                <span>Description</span>
                <div className="sendflow-detail-inline-control">
                  <input
                    value={shownDescription}
                    onChange={(event) => { setDescriptionDraft(event.target.value); setDescriptionError(''); }}
                    aria-label="Description du lien"
                    maxLength={240}
                    data-testid="input-linkflow-detail-description"
                    disabled={link.usageCount > 0 || updateMutation.isPending}
                  />
                  <button type="button" onClick={saveDescription} disabled={!descriptionDirty || updateMutation.isPending || link.usageCount > 0} aria-label="Enregistrer la description" data-testid="button-linkflow-detail-save-description">
                    {updateMutation.isPending && descriptionDirty ? <RefreshCw size={17} className="sendflow-detail-saving-icon" /> : <Check size={19} />}
                  </button>
                </div>
                {descriptionError && <small className="sendflow-detail-inline-error" role="alert">{descriptionError}</small>}
                {link.usageCount > 0 && <small className="sendflow-detail-inline-hint"><LockKeyhole size={12} /> Montant et description verrouillés après une utilisation.</small>}
              </label>
            </div>
          ) : (
            <div className="sendflow-detail-panel sendflow-detail-stats" role="tabpanel">
              <span className="sendflow-detail-stats-icon"><BarChart3 size={22} /></span>
              <span className="sendflow-detail-kicker">ANALYSE DU LIEN</span>
              <h2>Statistiques</h2>
              <p>Les indicateurs apparaîtront ici après l’activation des paiements réels et la réception de données confirmées par le serveur.</p>
              <div className="sendflow-detail-stats-note"><CircleHelp size={16} />Aucune vue, tentative ou transaction de simulation n’est présentée comme une donnée réelle.</div>
            </div>
          )}

          <button type="button" className="sendflow-detail-delete" onClick={() => setConfirmDelete(true)} data-testid="button-linkflow-detail-delete"><Trash2 size={16} /> Supprimer le lien</button>
        </div>
      </section>

      {editing && (
        <div className="sendflow-detail-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !updateMutation.isPending) setEditing(false); }}>
          <section className="sendflow-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="sendflow-edit-title">
            <div className="sendflow-detail-sheet-grip" />
            <header className="sendflow-detail-sheet-heading"><div><span className="sendflow-detail-kicker">GESTION DU LIEN</span><h2 id="sendflow-edit-title">Limite d’utilisations</h2></div><button type="button" className="sendflow-detail-sheet-close" onClick={() => setEditing(false)} aria-label="Fermer" disabled={updateMutation.isPending}>×</button></header>
            <Form {...limitForm}>
            <form className="sendflow-detail-form" onSubmit={saveChanges}>
              <FormField
                control={limitForm.control}
                name="maximumUses"
                render={({ field }) => (
                  <FormItem className="sendflow-detail-form-item">
                    <FormLabel>Nombre maximum d’utilisations <span>(facultatif)</span></FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="numeric" type="number" min={link.usageCount || 1} max={999999} placeholder="Illimité" data-testid="input-linkflow-detail-maximum-uses" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="sendflow-detail-form-hint">La limite ne peut pas être inférieure aux utilisations déjà enregistrées ({link.usageCount}).</p>
              {formError && <p className="sendflow-detail-form-error" role="alert">{formError}</p>}
              <button type="submit" className="sendflow-detail-primary sendflow-detail-save" disabled={updateMutation.isPending} data-testid="button-linkflow-detail-save-limit">{updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer la limite'} <ArrowUpRight size={17} /></button>
            </form>
            </Form>
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
