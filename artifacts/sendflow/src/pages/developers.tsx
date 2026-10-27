import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleHelp,
  Code2,
  Copy,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  Webhook,
  X,
} from 'lucide-react';
import {
  getListDeveloperApiKeysQueryKey,
  getListDeveloperWebhooksQueryKey,
  getListDeveloperWebhookDeliveriesQueryKey,
  useCreateDeveloperApiKey,
  useCreateDeveloperWebhook,
  useListDeveloperApiKeys,
  useListDeveloperWebhooks,
  useListDeveloperWebhookDeliveries,
  useRevokeDeveloperApiKey,
  useRevokeDeveloperWebhook,
} from '@workspace/api-client-react';
import type {
  DeveloperApiKeyCreatedResponse,
  DeveloperWebhookCreatedResponse,
} from '@workspace/api-client-react';
import './developers.css';

type DialogState =
  | { kind: 'api-create' }
  | { kind: 'webhook-create' }
  | { kind: 'api-secret'; response: DeveloperApiKeyCreatedResponse }
  | { kind: 'webhook-secret'; response: DeveloperWebhookCreatedResponse }
  | { kind: 'revoke-api'; id: string; label: string }
  | { kind: 'revoke-webhook'; id: string; label: string }
  | null;

const EVENT_OPTIONS = [
  { value: 'payment.succeeded', label: 'Paiement réussi' },
  { value: 'payment.failed', label: 'Paiement échoué' },
] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return 'Jamais';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: 'Active',
    revoked: 'Révoquée',
    pending: 'En attente',
    delivering: 'En cours',
    delivered: 'Livrée',
    failed: 'Échec',
  };
  return labels[status] ?? status;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button className="dev-copy-button" type="button" onClick={() => void copy()} aria-label={`Copier ${label}`} data-testid={`button-copy-${label}`}>
      {copied ? <Check size={15} /> : <Copy size={15} />}
      <span>{copied ? 'Copié' : 'Copier'}</span>
    </button>
  );
}

function Dialog({ children, title, onClose }: { children: ReactNode; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return (
    <div className="dev-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dev-dialog" role="dialog" aria-modal="true" aria-labelledby="dev-dialog-title">
        <header className="dev-dialog-header">
          <div><span className="dev-eyebrow">ESPACE DÉVELOPPEUR</span><h2 id="dev-dialog-title">{title}</h2></div>
          <button className="dev-icon-button" type="button" onClick={onClose} aria-label="Fermer la fenêtre"><X size={19} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function DevelopersPage() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  const [apiLabel, setApiLabel] = useState('');
  const [webhookLabel, setWebhookLabel] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['payment.succeeded']);
  const [formError, setFormError] = useState('');

  const apiKeysQuery = useListDeveloperApiKeys({ query: { queryKey: getListDeveloperApiKeysQueryKey() } });
  const webhooksQuery = useListDeveloperWebhooks({ query: { queryKey: getListDeveloperWebhooksQueryKey() } });
  const apiKeys = apiKeysQuery.data?.items ?? [];
  const endpoints = webhooksQuery.data?.items ?? [];
  const selectedEndpoint = endpoints.find((endpoint) => endpoint.id === selectedEndpointId);
  const deliveriesQuery = useListDeveloperWebhookDeliveries(selectedEndpointId, {
    query: {
      queryKey: getListDeveloperWebhookDeliveriesQueryKey(selectedEndpointId),
      enabled: Boolean(selectedEndpointId),
    },
  });
  const deliveries = deliveriesQuery.data?.items ?? [];

  const createApiKey = useCreateDeveloperApiKey();
  const revokeApiKey = useRevokeDeveloperApiKey();
  const createWebhook = useCreateDeveloperWebhook();
  const revokeWebhook = useRevokeDeveloperWebhook();

  useEffect(() => {
    if (endpoints.length && !endpoints.some((endpoint) => endpoint.id === selectedEndpointId)) {
      setSelectedEndpointId(endpoints[0].id);
    }
    if (!endpoints.length) setSelectedEndpointId('');
  }, [endpoints, selectedEndpointId]);

  const closeDialog = () => {
    setDialog(null);
    setFormError('');
  };

  const submitApiKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    try {
      const response = await createApiKey.mutateAsync({ data: { label: apiLabel.trim() } });
      await queryClient.invalidateQueries({ queryKey: getListDeveloperApiKeysQueryKey() });
      setApiLabel('');
      setDialog({ kind: 'api-secret', response });
    } catch {
      setFormError('La création a échoué. Vérifiez votre connexion puis réessayez.');
    }
  };

  const submitWebhook = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    try {
      const response = await createWebhook.mutateAsync({
        data: {
          label: webhookLabel.trim(),
          url: webhookUrl.trim(),
          events: selectedEvents as ('payment.succeeded' | 'payment.failed')[],
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListDeveloperWebhooksQueryKey() });
      setSelectedEndpointId(response.endpoint.id);
      setWebhookLabel('');
      setWebhookUrl('');
      setSelectedEvents(['payment.succeeded']);
      setDialog({ kind: 'webhook-secret', response });
    } catch {
      setFormError('La création a échoué. Vérifiez l’URL et réessayez.');
    }
  };

  const confirmRevoke = async () => {
    if (dialog?.kind === 'revoke-api') {
      try {
        await revokeApiKey.mutateAsync({ apiKeyId: dialog.id });
        await queryClient.invalidateQueries({ queryKey: getListDeveloperApiKeysQueryKey() });
        closeDialog();
      } catch {
        setFormError('Impossible de révoquer cette clé pour le moment.');
      }
    }
    if (dialog?.kind === 'revoke-webhook') {
      try {
        await revokeWebhook.mutateAsync({ endpointId: dialog.id });
        await queryClient.invalidateQueries({ queryKey: getListDeveloperWebhooksQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getListDeveloperWebhookDeliveriesQueryKey(dialog.id) });
        closeDialog();
      } catch {
        setFormError('Impossible de révoquer ce point de terminaison pour le moment.');
      }
    }
  };

  const activeKeyCount = apiKeys.filter((key) => key.status === 'active').length;
  const activeWebhookCount = endpoints.filter((endpoint) => endpoint.status === 'active').length;

  return (
    <main className="sendflow-developers">
      <div className="dev-page">
        <header className="dev-page-header">
          <div className="dev-breadcrumb"><span>SendFlow</span><span className="dev-breadcrumb-sep">/</span><span>Développeurs</span></div>
          <div className="dev-title-row">
            <div>
              <div className="dev-kicker"><Code2 size={15} /> INTÉGRATIONS MARCHAND</div>
              <h1>Développeurs</h1>
              <p className="dev-intro">Connectez votre application à SendFlow. Gérez ici vos accès et les notifications de paiement.</p>
            </div>
            <div className="dev-secure-note"><ShieldCheck size={17} /><span>Accès sécurisé<br /><strong>Clés privées non réaffichées</strong></span></div>
          </div>
        </header>

        <section className="dev-mode-panel" aria-labelledby="dev-mode-heading">
          <div className="dev-mode-copy">
            <span className="dev-section-index">01 / INTÉGRATION</span>
            <h2 id="dev-mode-heading">Deux façons d’encaisser</h2>
            <p>Vous avez choisi l’API directe et le paiement hébergé SendFlow. Une session créée par API peut lancer le paiement directement dans votre interface ou renvoyer une URL de checkout SendFlow.</p>
          </div>
          <div className="dev-mode-options">
            <article className="dev-mode-option">
              <span className="dev-mode-symbol"><Code2 size={20} /></span>
              <div><strong>API directe</strong><p>Gardez le parcours dans votre site ou votre application.</p></div>
              <span className="dev-selected">Sélectionné</span>
            </article>
            <article className="dev-mode-option">
              <span className="dev-mode-symbol is-hosted"><ArrowUpRight size={20} /></span>
              <div><strong>Checkout hébergé</strong><p>Redirigez le client vers une page de paiement SendFlow.</p></div>
              <span className="dev-selected">Sélectionné</span>
            </article>
          </div>
          <div className="dev-docs-note"><CircleHelp size={16} /><span>La documentation API publique sera publiée prochainement. Les identifiants sont prêts à être configurés.</span></div>
        </section>

        <div className="dev-stats" aria-label="Résumé des intégrations">
          <div className="dev-stat"><span>CLÉS ACTIVES</span><strong>{apiKeysQuery.isLoading ? <i className="dev-skeleton dev-skeleton-number" /> : apiKeysQuery.isError ? '—' : activeKeyCount.toString().padStart(2, '0')}</strong><small>Accès à l’API</small></div>
          <div className="dev-stat"><span>WEBHOOKS ACTIFS</span><strong>{webhooksQuery.isLoading ? <i className="dev-skeleton dev-skeleton-number" /> : webhooksQuery.isError ? '—' : activeWebhookCount.toString().padStart(2, '0')}</strong><small>Points de terminaison</small></div>
          <div className="dev-stat dev-stat-status"><span>ÉTAT DES LIVRAISONS</span><strong><Activity size={17} /> {selectedEndpoint ? 'Suivi disponible' : 'À configurer'}</strong><small>{selectedEndpoint ? 'Sélectionnez un endpoint pour consulter les événements.' : 'Créez un webhook pour recevoir les événements.'}</small></div>
        </div>

        <section className="dev-section dev-keys-section" aria-labelledby="dev-keys-heading">
          <div className="dev-section-heading">
            <div className="dev-section-title">
              <span className="dev-section-index">02 / IDENTIFIANTS</span>
              <h2 id="dev-keys-heading"><KeyRound size={21} /> Clés API</h2>
              <p>La clé publique identifie votre intégration. La clé secrète ne s’affiche qu’une seule fois, à sa création.</p>
            </div>
            <button type="button" className="dev-primary-button" onClick={() => { setApiLabel(''); setFormError(''); setDialog({ kind: 'api-create' }); }} data-testid="button-create-api-key"><Plus size={17} /> Créer une clé</button>
          </div>
          {apiKeysQuery.isLoading && <div className="dev-loading-block" aria-label="Chargement des clés API"><span /><span /><span /></div>}
          {apiKeysQuery.isError && <div className="dev-state dev-state-error" role="alert"><AlertCircle size={20} /><span><strong>Clés indisponibles</strong><small>Les données n’ont pas pu être chargées.</small></span><button type="button" onClick={() => void apiKeysQuery.refetch()}><RefreshCw size={15} /> Réessayer</button></div>}
          {!apiKeysQuery.isLoading && !apiKeysQuery.isError && apiKeys.length === 0 && (
            <div className="dev-empty-state"><span className="dev-empty-icon"><KeyRound size={22} /></span><div><strong>Aucune clé API</strong><p>Créez une paire de clés pour commencer à connecter votre application.</p></div><button className="dev-secondary-button" type="button" onClick={() => setDialog({ kind: 'api-create' })}>Créer une clé</button></div>
          )}
          {!apiKeysQuery.isLoading && !apiKeysQuery.isError && apiKeys.length > 0 && (
            <div className="dev-key-list">
              {apiKeys.map((key) => (
                <article className={`dev-key-card${key.status === 'revoked' ? ' is-revoked' : ''}`} key={key.id} data-testid={`card-api-key-${key.id}`}>
                  <div className="dev-key-card-main">
                    <div className="dev-key-name-line"><span className="dev-key-mark"><KeyRound size={17} /></span><div><h3>{key.label}</h3><span className={`dev-status-pill ${key.status === 'active' ? 'is-active' : 'is-revoked'}`}><i />{statusLabel(key.status)}</span></div></div>
                    <div className="dev-key-values">
                      <div><span>CLÉ PUBLIQUE</span><code>{key.publicKeyPrefix}••••••••</code></div>
                      <div><span>CLÉ SECRÈTE</span><code>{key.secretKeyPrefix}••••••••</code></div>
                    </div>
                  </div>
                  <div className="dev-key-meta"><span>Créée le {formatDate(key.createdAt)}</span><span>Dernière utilisation&nbsp;: {formatDate(key.lastUsedAt)}</span>{key.revokedAt && <span>Révoquée le {formatDate(key.revokedAt)}</span>}</div>
                  {key.status === 'active' && <button className="dev-text-danger" type="button" onClick={() => { setFormError(''); setDialog({ kind: 'revoke-api', id: key.id, label: key.label }); }} data-testid={`button-revoke-api-key-${key.id}`}>Révoquer</button>}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dev-section dev-webhooks-section" aria-labelledby="dev-webhooks-heading">
          <div className="dev-section-heading">
            <div className="dev-section-title">
              <span className="dev-section-index">03 / ÉVÉNEMENTS</span>
              <h2 id="dev-webhooks-heading"><Webhook size={21} /> Webhooks</h2>
              <p>Recevez une notification signée lorsqu’un paiement réussit ou échoue.</p>
            </div>
            <button type="button" className="dev-primary-button" onClick={() => { setWebhookLabel(''); setWebhookUrl(''); setSelectedEvents(['payment.succeeded']); setFormError(''); setDialog({ kind: 'webhook-create' }); }} data-testid="button-create-webhook"><Plus size={17} /> Ajouter un endpoint</button>
          </div>
          {webhooksQuery.isLoading && <div className="dev-loading-block" aria-label="Chargement des webhooks"><span /><span /><span /></div>}
          {webhooksQuery.isError && <div className="dev-state dev-state-error" role="alert"><AlertCircle size={20} /><span><strong>Webhooks indisponibles</strong><small>Les données n’ont pas pu être chargées.</small></span><button type="button" onClick={() => void webhooksQuery.refetch()}><RefreshCw size={15} /> Réessayer</button></div>}
          {!webhooksQuery.isLoading && !webhooksQuery.isError && endpoints.length === 0 && (
            <div className="dev-empty-state"><span className="dev-empty-icon"><Webhook size={22} /></span><div><strong>Aucun webhook configuré</strong><p>Ajoutez une URL HTTPS pour suivre les événements de paiement de votre application.</p></div><button className="dev-secondary-button" type="button" onClick={() => setDialog({ kind: 'webhook-create' })}>Ajouter un endpoint</button></div>
          )}
          {!webhooksQuery.isLoading && !webhooksQuery.isError && endpoints.length > 0 && (
            <div className="dev-webhook-layout">
              <div className="dev-endpoint-list" aria-label="Points de terminaison webhook">
                {endpoints.map((endpoint) => (
                  <button
                    type="button"
                    key={endpoint.id}
                    className={`dev-endpoint-card${selectedEndpointId === endpoint.id ? ' is-selected' : ''}${endpoint.status === 'revoked' ? ' is-revoked' : ''}`}
                    onClick={() => setSelectedEndpointId(endpoint.id)}
                    aria-pressed={selectedEndpointId === endpoint.id}
                    data-testid={`button-select-endpoint-${endpoint.id}`}
                  >
                    <span className="dev-endpoint-top"><span className="dev-endpoint-icon"><Webhook size={17} /></span><span className={`dev-status-pill ${endpoint.status === 'active' ? 'is-active' : 'is-revoked'}`}><i />{statusLabel(endpoint.status)}</span></span>
                    <strong>{endpoint.label}</strong><code>{endpoint.url}</code>
                    <span className="dev-event-tags">{endpoint.events.map((event) => <small key={event}>{event}</small>)}</span>
                    <span className="dev-endpoint-foot">Créé le {formatDate(endpoint.createdAt)}{endpoint.revokedAt ? ` · Révoqué le ${formatDate(endpoint.revokedAt)}` : ''}</span>
                  </button>
                ))}
              </div>
              <section className="dev-deliveries" aria-labelledby="dev-deliveries-heading">
                <div className="dev-deliveries-header">
                  <div><span className="dev-section-index">JOURNAL RÉCENT</span><h3 id="dev-deliveries-heading">Livraisons</h3><p>{selectedEndpoint?.label ?? 'Sélectionnez un endpoint'}</p></div>
                  {selectedEndpoint?.status === 'active' && <button className="dev-text-danger" type="button" onClick={() => { setFormError(''); setDialog({ kind: 'revoke-webhook', id: selectedEndpoint.id, label: selectedEndpoint.label }); }} data-testid={`button-revoke-webhook-${selectedEndpoint.id}`}>Révoquer</button>}
                </div>
                {deliveriesQuery.isLoading && <div className="dev-delivery-skeleton"><span /><span /><span /></div>}
                {deliveriesQuery.isError && <div className="dev-inline-state is-error" role="alert"><span>Impossible de charger les livraisons.</span><button type="button" onClick={() => void deliveriesQuery.refetch()}>Réessayer</button></div>}
                {!deliveriesQuery.isLoading && !deliveriesQuery.isError && deliveries.length === 0 && <div className="dev-delivery-empty"><span><Activity size={20} /></span><strong>Aucune livraison récente</strong><p>Les événements reçus apparaîtront ici.</p></div>}
                {!deliveriesQuery.isLoading && !deliveriesQuery.isError && deliveries.length > 0 && (
                  <div className="dev-delivery-table-wrap">
                    <table className="dev-delivery-table">
                      <thead><tr><th>ÉVÉNEMENT</th><th>ÉTAT</th><th>TENTATIVES</th><th>DERNIÈRE TENTATIVE</th></tr></thead>
                      <tbody>{deliveries.map((delivery) => (
                        <tr key={delivery.id} data-testid={`row-webhook-delivery-${delivery.id}`}>
                          <td><strong>{delivery.eventType}</strong><small>{formatDate(delivery.createdAt)}</small></td>
                          <td><span className={`dev-status-pill is-${delivery.status}`}><i />{statusLabel(delivery.status)}</span>{delivery.lastHttpStatus !== null && <small className="dev-http-status">HTTP {delivery.lastHttpStatus}</small>}</td>
                          <td>{delivery.attempts}</td>
                          <td><span>{formatDate(delivery.lastAttemptAt)}</span>{delivery.lastErrorClass && <small className="dev-error-class">{delivery.lastErrorClass}</small>}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}
        </section>
        <footer className="dev-footer"><LockKeyhole size={15} /><span>Ne partagez jamais vos secrets. SendFlow ne les conserve pas sous une forme consultable.</span></footer>
      </div>

      {dialog?.kind === 'api-create' && (
        <Dialog title="Créer une paire de clés" onClose={closeDialog}>
          <form className="dev-form" onSubmit={(event) => void submitApiKey(event)}>
            <p>Donnez un nom qui vous aidera à identifier l’application ou l’environnement concerné.</p>
            <label htmlFor="api-key-label">Nom de la clé</label>
            <input id="api-key-label" value={apiLabel} onChange={(event) => setApiLabel(event.target.value)} maxLength={80} required autoFocus placeholder="Ex. Boutique web — production" data-testid="input-api-key-label" />
            {formError && <p className="dev-form-error" role="alert">{formError}</p>}
            <div className="dev-dialog-actions"><button type="button" className="dev-secondary-button" onClick={closeDialog}>Annuler</button><button className="dev-primary-button" type="submit" disabled={createApiKey.isPending || !apiLabel.trim()}>{createApiKey.isPending && <LoaderCircle className="dev-spin" size={16} />}{createApiKey.isPending ? 'Création…' : 'Créer la clé'}</button></div>
          </form>
        </Dialog>
      )}

      {dialog?.kind === 'webhook-create' && (
        <Dialog title="Ajouter un webhook" onClose={closeDialog}>
          <form className="dev-form" onSubmit={(event) => void submitWebhook(event)}>
            <p>SendFlow enverra les événements sélectionnés à votre serveur. Utilisez une URL HTTPS accessible.</p>
            <label htmlFor="webhook-label">Nom de l’endpoint</label>
            <input id="webhook-label" value={webhookLabel} onChange={(event) => setWebhookLabel(event.target.value)} maxLength={80} required autoFocus placeholder="Ex. Notifications de paiement" data-testid="input-webhook-label" />
            <label htmlFor="webhook-url">URL de destination</label>
            <input id="webhook-url" type="url" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} maxLength={2048} required placeholder="https://exemple.com/webhooks/sendflow" data-testid="input-webhook-url" />
            <fieldset className="dev-event-fieldset"><legend>Événements à recevoir</legend>{EVENT_OPTIONS.map((option) => <label className="dev-checkbox-label" key={option.value}><input type="checkbox" checked={selectedEvents.includes(option.value)} onChange={(event) => setSelectedEvents((current) => event.target.checked ? [...current, option.value] : current.filter((item) => item !== option.value))} /><span>{option.label}</span><small>{option.value}</small></label>)}</fieldset>
            {formError && <p className="dev-form-error" role="alert">{formError}</p>}
            <div className="dev-dialog-actions"><button type="button" className="dev-secondary-button" onClick={closeDialog}>Annuler</button><button className="dev-primary-button" type="submit" disabled={createWebhook.isPending || !webhookLabel.trim() || !webhookUrl.trim() || selectedEvents.length === 0}>{createWebhook.isPending && <LoaderCircle className="dev-spin" size={16} />}{createWebhook.isPending ? 'Création…' : 'Ajouter le webhook'}</button></div>
          </form>
        </Dialog>
      )}

      {dialog?.kind === 'api-secret' && (
        <Dialog title="Clés créées" onClose={closeDialog}>
          <div className="dev-secret-content">
            <div className="dev-one-time-warning"><AlertCircle size={19} /><div><strong>Copiez et conservez ces clés maintenant.</strong><p>La clé secrète ne sera plus affichée après la fermeture de cette fenêtre. Ne la partagez jamais.</p></div></div>
            <SecretValue label="Clé publique" value={dialog.response.publicKey} />
            <SecretValue label="Clé secrète" value={dialog.response.secretKey} secret />
            <button className="dev-primary-button dev-full-button" type="button" onClick={closeDialog}><CheckCircle2 size={17} /> J’ai enregistré mes clés</button>
          </div>
        </Dialog>
      )}

      {dialog?.kind === 'webhook-secret' && (
        <Dialog title="Webhook configuré" onClose={closeDialog}>
          <div className="dev-secret-content">
            <div className="dev-one-time-warning"><AlertCircle size={19} /><div><strong>Enregistrez le secret de signature maintenant.</strong><p>Il ne sera plus affiché après la fermeture. Utilisez-le pour vérifier la signature des événements reçus.</p></div></div>
            <div className="dev-created-summary"><span>ENDPOINT</span><strong>{dialog.response.endpoint.label}</strong><code>{dialog.response.endpoint.url}</code></div>
            <SecretValue label="Secret de signature" value={dialog.response.signingSecret} secret />
            <button className="dev-primary-button dev-full-button" type="button" onClick={closeDialog}><CheckCircle2 size={17} /> J’ai enregistré le secret</button>
          </div>
        </Dialog>
      )}

      {(dialog?.kind === 'revoke-api' || dialog?.kind === 'revoke-webhook') && (
        <Dialog title="Confirmer la révocation" onClose={closeDialog}>
          <div className="dev-revoke-confirm">
            <p>Révoquer <strong>{dialog.label}</strong> ? Cette action est définitive et les requêtes ou livraisons utilisant cet accès ne pourront plus aboutir.</p>
            {formError && <p className="dev-form-error" role="alert">{formError}</p>}
            <div className="dev-dialog-actions"><button type="button" className="dev-secondary-button" onClick={closeDialog}>Conserver</button><button type="button" className="dev-danger-button" onClick={() => void confirmRevoke()} disabled={revokeApiKey.isPending || revokeWebhook.isPending}>{(revokeApiKey.isPending || revokeWebhook.isPending) && <LoaderCircle className="dev-spin" size={16} />}{(revokeApiKey.isPending || revokeWebhook.isPending) ? 'Révocation…' : 'Révoquer définitivement'}</button></div>
          </div>
        </Dialog>
      )}
    </main>
  );
}

function SecretValue({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  return (
    <div className="dev-secret-field">
      <span>{label}{secret && <em>SECRET</em>}</span>
      <div><code>{value}</code><CopyButton value={value} label={label.toLowerCase().replaceAll(' ', '-')} /></div>
    </div>
  );
}
