import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  Webhook,
  X,
} from 'lucide-react';
import {
  getListDeveloperApiKeysQueryKey,
  getListDeveloperWebhooksQueryKey,
  getListDeveloperWebhookDeliveriesQueryKey,
  useCreateDeveloperApiKey,
  useCreateDeveloperWebhook,
  useInitializePreviewDeveloperApiKey,
  useListDeveloperApiKeys,
  useListDeveloperWebhooks,
  useListDeveloperWebhookDeliveries,
  useRevokeDeveloperApiKey,
  useRevokeDeveloperWebhook,
} from '@workspace/api-client-react';
import { toast } from '@/hooks/use-toast';
import type {
  DeveloperApiKeyCreatedResponse,
  DeveloperWebhookCreatedResponse,
} from '@workspace/api-client-react';
import './developers.css';

type DialogState =
  | { kind: 'api-regenerate'; label: string }
  | { kind: 'webhook-create' }
  | { kind: 'api-secret'; response: DeveloperApiKeyCreatedResponse }
  | { kind: 'webhook-secret'; response: DeveloperWebhookCreatedResponse }
  | { kind: 'revoke-api'; id: string; label: string }
  | { kind: 'revoke-webhook'; id: string; label: string }
  | null;

type DeveloperTab = 'private' | 'identifier' | 'webhook';

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

function formatKeyTimestamp(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
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

function CopyButton({ value, label, testId, iconOnly = false }: { value: string; label: string; testId?: string; iconOnly?: boolean }) {
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
    <button className={`dev-copy-button${iconOnly ? ' is-icon-only' : ''}`} type="button" onClick={() => void copy()} aria-label={`Copier ${label}`} data-testid={testId ?? `button-copy-${label}`}>
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {!iconOnly && <span>{copied ? 'Copié' : 'Copier'}</span>}
    </button>
  );
}

function explainSecretIsUnavailable() {
  toast({
    title: 'Secret non consultable',
    description: 'Pour votre sécurité, le secret complet est affiché une seule fois après sa génération. Régénérez la paire pour en obtenir un nouveau.',
  });
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
  const [developerTab, setDeveloperTab] = useState<DeveloperTab>('private');
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  const [webhookLabel, setWebhookLabel] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['payment.succeeded']);
  const [formError, setFormError] = useState('');
  const [previewInitializationFailed, setPreviewInitializationFailed] = useState(false);
  const [hiddenPublicKeys, setHiddenPublicKeys] = useState<Record<string, boolean>>({});
  const previewKeyInitializationStarted = useRef(false);

  const apiKeysQuery = useListDeveloperApiKeys({ query: { queryKey: getListDeveloperApiKeysQueryKey() } });
  const webhooksQuery = useListDeveloperWebhooks({ query: { queryKey: getListDeveloperWebhooksQueryKey() } });
  const apiKeys = apiKeysQuery.data?.items ?? [];
  const activeApiKey = apiKeys.find((key) => key.status === 'active');
  const apiKeyTabLabel = activeApiKey?.label ?? apiKeys[0]?.label ?? 'Clé publique';
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
  const initializePreviewApiKey = useInitializePreviewDeveloperApiKey();
  const revokeApiKey = useRevokeDeveloperApiKey();
  const createWebhook = useCreateDeveloperWebhook();
  const revokeWebhook = useRevokeDeveloperWebhook();

  useEffect(() => {
    if (endpoints.length && !endpoints.some((endpoint) => endpoint.id === selectedEndpointId)) {
      setSelectedEndpointId(endpoints[0].id);
    }
    if (!endpoints.length) setSelectedEndpointId('');
  }, [endpoints, selectedEndpointId]);

  useEffect(() => {
    if (
      apiKeysQuery.data?.environment !== 'preview'
      || apiKeysQuery.isLoading
      || apiKeysQuery.isError
      || apiKeys.some((key) => key.status === 'active')
      || previewKeyInitializationStarted.current
    ) return;

    previewKeyInitializationStarted.current = true;
    void initializePreviewApiKey.mutateAsync().then(async (response) => {
      await queryClient.invalidateQueries({ queryKey: getListDeveloperApiKeysQueryKey() });
      if (response.created && response.publicKey && response.secretKey) {
        setDialog({
          kind: 'api-secret',
          response: {
            key: response.key,
            publicKey: response.publicKey,
            secretKey: response.secretKey,
            environment: 'preview',
          },
        });
      }
    }).catch(() => {
      setPreviewInitializationFailed(true);
    });
  }, [
    apiKeys,
    apiKeysQuery.data?.environment,
    apiKeysQuery.isError,
    apiKeysQuery.isLoading,
    initializePreviewApiKey,
    queryClient,
  ]);

  const closeDialog = () => {
    setDialog(null);
    setFormError('');
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

  const confirmRegenerateApiKey = async () => {
    if (dialog?.kind !== 'api-regenerate') return;
    setFormError('');
    try {
      const response = await createApiKey.mutateAsync({ data: { label: dialog.label } });
      await queryClient.invalidateQueries({ queryKey: getListDeveloperApiKeysQueryKey() });
      setDialog({ kind: 'api-secret', response });
    } catch {
      setFormError('La régénération a échoué. Vérifiez votre connexion puis réessayez.');
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

  return (
    <main className="sendflow-developers">
      <div className="dev-page">
        <header className="dev-page-header">
          <div className="dev-title-row">
            <div>
              <h1>Développeurs</h1>
              <p className="dev-intro">Recevez vos paiements en temps réel.</p>
            </div>
          </div>
        </header>

        <section className="dev-section dev-keys-section" aria-labelledby="dev-keys-heading">
          <div className="dev-section-heading">
            <div className="dev-section-title">
              <h2 id="dev-keys-heading"><KeyRound size={21} /> API</h2>
              <p>
                {developerTab === 'private'
                  ? 'La clé privée complète est affichée une seule fois lors de sa création.'
                  : developerTab === 'identifier'
                    ? 'Utilisez la clé publique comme identifiant de votre intégration.'
                    : 'Configurez l’URL qui recevra les notifications de paiement signées.'}
              </p>
            </div>
            <button
              type="button"
              className={developerTab === 'webhook' ? 'dev-primary-button' : 'dev-primary-button dev-regenerate-button'}
              onClick={() => {
                setFormError('');
                if (developerTab === 'webhook') {
                  setWebhookLabel('');
                  setWebhookUrl('');
                  setSelectedEvents(['payment.succeeded']);
                  setDialog({ kind: 'webhook-create' });
                } else {
                  setFormError('');
                  setDialog({ kind: 'api-regenerate', label: activeApiKey?.label ?? 'Clé principale' });
                }
              }}
              data-testid={developerTab === 'webhook' ? 'button-create-webhook' : 'button-regenerate-api-key'}
            >
              {developerTab === 'webhook' ? <Plus size={17} /> : <RefreshCw size={16} />}
              {developerTab === 'webhook' ? 'Configurer une URL' : 'Régénérer'}
            </button>
          </div>
          <div
            className="dev-integration-tabs"
            role="tablist"
            aria-label="Identifiants et webhook"
            onKeyDown={(event) => {
              const tabs: DeveloperTab[] = ['private', 'identifier', 'webhook'];
              const currentIndex = tabs.indexOf(developerTab);
              const nextIndex = event.key === 'ArrowRight'
                ? (currentIndex + 1) % tabs.length
                : event.key === 'ArrowLeft'
                  ? (currentIndex + tabs.length - 1) % tabs.length
                  : -1;
              if (nextIndex >= 0) {
                event.preventDefault();
                const nextTab = tabs[nextIndex];
                setDeveloperTab(nextTab);
                window.requestAnimationFrame(() => document.getElementById(`developer-tab-${nextTab}`)?.focus());
              }
            }}
          >
            <button type="button" role="tab" id="developer-tab-private" aria-controls="developer-integrations-panel" aria-selected={developerTab === 'private'} tabIndex={developerTab === 'private' ? 0 : -1} onClick={() => setDeveloperTab('private')} data-testid="tab-private-key"><LockKeyhole size={15} /> Clé privée</button>
            <button type="button" role="tab" id="developer-tab-identifier" aria-controls="developer-integrations-panel" aria-selected={developerTab === 'identifier'} tabIndex={developerTab === 'identifier' ? 0 : -1} onClick={() => setDeveloperTab('identifier')} title={apiKeyTabLabel} data-testid="tab-public-key"><KeyRound size={15} /><span className="dev-tab-name">{apiKeyTabLabel}</span></button>
            <button type="button" role="tab" id="developer-tab-webhook" aria-controls="developer-integrations-panel" aria-selected={developerTab === 'webhook'} tabIndex={developerTab === 'webhook' ? 0 : -1} onClick={() => setDeveloperTab('webhook')} data-testid="tab-webhook"><Webhook size={15} /> Webhook</button>
          </div>
          <div className="dev-tab-panel" id="developer-integrations-panel" role="tabpanel" aria-labelledby={`developer-tab-${developerTab}`}>
            {developerTab !== 'webhook' ? (
              <>
                {apiKeysQuery.isLoading && <div className="dev-loading-block" aria-label="Chargement des clés API"><span /><span /><span /></div>}
                {apiKeysQuery.isError && <div className="dev-state dev-state-error" role="alert"><AlertCircle size={20} /><span><strong>Clés indisponibles</strong><small>Les données n’ont pas pu être chargées.</small></span><button type="button" onClick={() => void apiKeysQuery.refetch()}><RefreshCw size={15} /> Réessayer</button></div>}
                {!apiKeysQuery.isLoading && !apiKeysQuery.isError && apiKeys.length === 0 && (
                  <div className="dev-empty-state"><span className="dev-empty-icon"><KeyRound size={22} /></span><div><strong>La paire principale est indisponible</strong><p>Les clés sont générées automatiquement à la création du compte. Utilisez « Régénérer » si la paire doit être renouvelée.</p>{previewInitializationFailed && <small role="alert">L’initialisation automatique a échoué. Réessayez avec « Régénérer ».</small>}</div></div>
                )}
                {!apiKeysQuery.isLoading && !apiKeysQuery.isError && apiKeys.length > 0 && (
                  <div className="dev-key-list">
                    {apiKeys.map((key) => {
                      const privateTab = developerTab === 'private';
                      const publicKeyHidden = Boolean(hiddenPublicKeys[key.id]);
                      return (
                        <article className={`dev-key-card${key.status === 'revoked' ? ' is-revoked' : ''}`} key={key.id} data-testid={`card-api-key-${key.id}`}>
                          <div className="dev-key-card-main">
                            <div className="dev-key-name-line"><span className="dev-key-mark"><KeyRound size={17} /></span><div><h3>{key.label}</h3><span className={`dev-status-pill ${key.status === 'active' ? 'is-active' : 'is-revoked'}`}><i />{statusLabel(key.status)}</span></div></div>
                            <div className="dev-key-field-row">
                              <div className="dev-key-field-value"><code>{privateTab || publicKeyHidden ? '•'.repeat(32) : key.publicKey}</code></div>
                              <div className="dev-key-field-actions">
                                <button
                                  className="dev-key-icon-button"
                                  type="button"
                                  onClick={() => {
                                    if (privateTab) {
                                      explainSecretIsUnavailable();
                                    } else {
                                      setHiddenPublicKeys((current) => ({ ...current, [key.id]: !current[key.id] }));
                                    }
                                  }}
                                  aria-label={privateTab ? 'Le secret complet est affiché une seule fois' : publicKeyHidden ? 'Afficher la clé publique' : 'Masquer la clé publique'}
                                  title={privateTab ? 'Le secret complet est affiché une seule fois après sa génération' : publicKeyHidden ? 'Afficher la clé publique' : 'Masquer la clé publique'}
                                  data-testid={`button-toggle-key-${key.id}`}
                                >
                                  {privateTab || publicKeyHidden ? <Eye size={19} /> : <EyeOff size={19} />}
                                </button>
                                {privateTab ? (
                                  <button
                                    className="dev-key-icon-button"
                                    type="button"
                                    onClick={explainSecretIsUnavailable}
                                    aria-label="Le secret ne peut pas être copié après sa génération"
                                    title="Régénérez la paire pour obtenir un nouveau secret"
                                  >
                                    <Copy size={19} />
                                  </button>
                                ) : (
                                  <CopyButton value={key.publicKey} label="la clé publique" testId={`button-copy-public-key-${key.id}`} iconOnly />
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="dev-key-meta">
                            <span>Dernière mise à jour : {formatKeyTimestamp(key.createdAt)}</span>
                            <span>Dernière utilisation : {formatDate(key.lastUsedAt)}</span>
                            {key.revokedAt && <span>Révoquée le {formatDate(key.revokedAt)}</span>}
                          </div>
                          {key.status === 'active' && <button className="dev-text-danger" type="button" onClick={() => { setFormError(''); setDialog({ kind: 'revoke-api', id: key.id, label: key.label }); }} data-testid={`button-revoke-api-key-${key.id}`}>Révoquer</button>}
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                {webhooksQuery.isLoading && <div className="dev-loading-block" aria-label="Chargement des webhooks"><span /><span /><span /></div>}
                {webhooksQuery.isError && <div className="dev-state dev-state-error" role="alert"><AlertCircle size={20} /><span><strong>Webhooks indisponibles</strong><small>Les données n’ont pas pu être chargées.</small></span><button type="button" onClick={() => void webhooksQuery.refetch()}><RefreshCw size={15} /> Réessayer</button></div>}
                {!webhooksQuery.isLoading && !webhooksQuery.isError && endpoints.length === 0 && (
                  <div className="dev-empty-state"><span className="dev-empty-icon"><Webhook size={22} /></span><div><strong>Aucun webhook configuré</strong><p>Ajoutez une URL HTTPS pour recevoir les notifications de paiement sur votre serveur.</p></div><button className="dev-secondary-button" type="button" onClick={() => { setWebhookLabel(''); setWebhookUrl(''); setSelectedEvents(['payment.succeeded']); setFormError(''); setDialog({ kind: 'webhook-create' }); }}>Configurer une URL</button></div>
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
              </>
            )}
          </div>
        </section>
      </div>

      {dialog?.kind === 'api-regenerate' && (
        <Dialog title="Régénérer la paire de clés" onClose={closeDialog}>
          <div className="dev-revoke-confirm">
            <p>{activeApiKey ? 'Toutes les paires API actuellement actives seront immédiatement désactivées. Les intégrations qui les utilisent devront être mises à jour avec la nouvelle clé API et le nouveau secret.' : 'La paire principale sera générée pour ce compte. Le secret ne sera affiché qu’une seule fois.'}</p>
            {formError && <p className="dev-form-error" role="alert">{formError}</p>}
            <div className="dev-dialog-actions">
              <button type="button" className="dev-secondary-button" onClick={closeDialog}>Conserver la paire actuelle</button>
              <button type="button" className="dev-primary-button dev-regenerate-button" onClick={() => void confirmRegenerateApiKey()} disabled={createApiKey.isPending}>
                {createApiKey.isPending && <LoaderCircle className="dev-spin" size={16} />}
                {createApiKey.isPending ? 'Régénération…' : 'Régénérer la paire'}
              </button>
            </div>
          </div>
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
        <Dialog title="Nouvelle paire de clés" onClose={closeDialog}>
          <div className="dev-secret-content">
            <div className="dev-one-time-warning"><AlertCircle size={19} /><div><strong>Copiez et conservez ces clés maintenant.</strong><p>La clé privée ne sera plus affichée après la fermeture de cette fenêtre. Ne la partagez jamais.</p></div></div>
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
  const [visible, setVisible] = useState(!secret);
  return (
    <div className="dev-secret-field">
      <span>{label}{secret && <em>SECRET</em>}</span>
      <div className="dev-secret-row">
        <div className="dev-secret-value"><code>{visible ? value : '•'.repeat(32)}</code></div>
        <div className="dev-secret-actions">
          <button
            className="dev-key-icon-button"
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? `Masquer ${label.toLowerCase()}` : `Afficher ${label.toLowerCase()}`}
            title={visible ? 'Masquer' : 'Afficher'}
          >
            {visible ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
          <CopyButton value={value} label={label.toLowerCase().replaceAll(' ', '-')} iconOnly />
        </div>
      </div>
    </div>
  );
}
