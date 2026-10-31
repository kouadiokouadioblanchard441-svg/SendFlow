import { useMemo, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListAdminEmailCampaignRecipientsQueryKey,
  getListAdminEmailCampaignHistoryQueryKey,
  getListAdminEmailCampaignsQueryKey,
  getGetAdminEmailCampaignSettingsQueryKey,
  getAdminEmailCampaign,
  retryAdminEmailCampaignRecipient,
  useCancelAdminEmailCampaign,
  useCreateAdminEmailCampaign,
  useDeleteAdminEmailCampaign,
  useListAdminEmailCampaignRecipients,
  useListAdminEmailCampaignHistory,
  useListAdminEmailCampaigns,
  useGetAdminEmailCampaignSettings,
  useQueueAdminEmailCampaign,
  useUpdateAdminEmailCampaign,
} from "@workspace/api-client-react";
import type {
  AdminEmailCampaignInput,
  AdminEmailCampaignRecipient,
  AdminEmailCampaignSummary,
  ListAdminEmailCampaignHistoryParams,
} from "@workspace/api-client-react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Mail,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AudienceMode = AdminEmailCampaignInput["audienceMode"];
type PendingAction = { kind: "queue" | "cancel" | "delete"; campaign: AdminEmailCampaignSummary } | null;
type CampaignView = "campaigns" | "drafts" | "history" | "accepted" | "delivered" | "bounced" | "complained" | "failed" | "settings";

const PAGE_SIZE = 20;
const sendFlowEmailTheme = {
  "--primary": "211 100% 50%",
  "--primary-foreground": "0 0% 100%",
} as CSSProperties;

function formatCount(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(status: AdminEmailCampaignSummary["status"]) {
  const labels: Record<AdminEmailCampaignSummary["status"], string> = {
    draft: "Brouillon",
    queued: "En attente",
    sending: "En cours",
    completed: "Terminée",
    completed_with_errors: "Terminée avec erreurs",
    cancelled: "Annulée",
  };
  return labels[status];
}

function statusClass(status: AdminEmailCampaignSummary["status"]) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "completed_with_errors") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "cancelled") return "border-muted bg-muted/60 text-muted-foreground";
  if (status === "queued" || status === "sending") return "border-primary/20 bg-primary/10 text-primary";
  return "border-secondary/70 bg-secondary/30 text-foreground";
}

function deliveryStatusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "En attente",
    sending: "En cours",
    accepted: "Accepté par le fournisseur",
    delivered: "Livré au serveur de messagerie",
    bounced: "Adresse rejetée",
    complained: "Signalé comme indésirable",
    failed: "Échec",
    cancelled: "Annulé",
  };
  return labels[status] ?? status;
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`h-4 animate-pulse rounded-md bg-muted ${className}`} />;
}

export function EmailCampaignsSection() {
  const queryClient = useQueryClient();
  const campaignsQuery = useListAdminEmailCampaigns({
    query: { queryKey: getListAdminEmailCampaignsQueryKey(), retry: false },
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [campaignView, setCampaignView] = useState<CampaignView>("campaigns");
  const settingsQuery = useGetAdminEmailCampaignSettings({
    query: {
      queryKey: getGetAdminEmailCampaignSettingsQueryKey(),
      enabled: campaignView === "settings",
      retry: false,
    },
  });
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [retryingRecipientId, setRetryingRecipientId] = useState<string | null>(null);
  const [retryConfirmation, setRetryConfirmation] = useState<{ campaignId: string; recipientId: string; email: string | null; subject: string } | null>(null);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all");
  const recipientParams = useMemo(
    () => ({ search: search.trim() || undefined, page }),
    [search, page],
  );
  const recipientsQuery = useListAdminEmailCampaignRecipients(recipientParams, {
    query: {
      queryKey: getListAdminEmailCampaignRecipientsQueryKey(recipientParams),
      enabled: audienceMode === "selected",
      retry: false,
    },
  });
  const historyStatus: ListAdminEmailCampaignHistoryParams["status"] =
    ["accepted", "delivered", "bounced", "complained", "failed"].includes(campaignView)
      ? campaignView as ListAdminEmailCampaignHistoryParams["status"]
      : undefined;
  const historyParams = useMemo(() => ({
    page: historyPage,
    pageSize: 25,
    search: historySearch.trim() || undefined,
    status: historyStatus,
  }), [historyPage, historySearch, historyStatus]);
  const historyQuery = useListAdminEmailCampaignHistory(historyParams, {
    query: {
      queryKey: getListAdminEmailCampaignHistoryQueryKey(historyParams),
      enabled: ["history", "accepted", "delivered", "bounced", "complained", "failed"].includes(campaignView),
      retry: false,
    },
  });

  const createCampaign = useCreateAdminEmailCampaign();
  const updateCampaign = useUpdateAdminEmailCampaign();
  const queueCampaign = useQueueAdminEmailCampaign();
  const cancelCampaign = useCancelAdminEmailCampaign();
  const deleteCampaign = useDeleteAdminEmailCampaign();

  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Record<string, AdminEmailCampaignRecipient>>({});
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const campaigns = campaignsQuery.data?.items ?? [];
  const recipients = recipientsQuery.data?.items ?? [];
  const sendingEnabled = campaignsQuery.data?.sendingEnabled === true;
  const showCampaignWorkspace = campaignView === "campaigns" || campaignView === "drafts";
  const pageCount = Math.max(1, Math.ceil((recipientsQuery.data?.total ?? 0) / (recipientsQuery.data?.pageSize ?? PAGE_SIZE)));
  const selectedCount = audienceMode === "all" ? null : selectedIds.length;
  const formValid = subject.trim().length > 0
    && subject.trim().length <= 200
    && bodyText.trim().length > 0
    && bodyText.length <= 20_000
    && (audienceMode === "all" || (selectedIds.length > 0 && selectedIds.length <= 5000));
  const anyMutationPending = createCampaign.isPending || updateCampaign.isPending;
  const visibleCampaigns = campaigns.filter((campaign) =>
    campaignView === "drafts" ? campaign.status === "draft"
      : campaignView === "campaigns" ? campaign.status !== "draft"
        : false,
  );

  const invalidateCampaignData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListAdminEmailCampaignsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListAdminEmailCampaignRecipientsQueryKey() }),
    ]);
  };

  const currentInput = (): AdminEmailCampaignInput => ({
    subject: subject.trim(),
    bodyText: bodyText.trim(),
    audienceMode,
    userIds: audienceMode === "selected" ? selectedIds : [],
  });

  const clearComposer = () => {
    setSubject("");
    setBodyText("");
    setAudienceMode("all");
    setSelectedIds([]);
    setSelectedRecipients({});
    setEditingCampaignId(null);
    setFeedback("");
    setFormError("");
  };

  const saveDraft = () => {
    setFeedback("");
    setFormError("");
    if (!formValid) {
      setFormError("Renseignez un objet (1 à 200 caractères), un message (1 à 20 000 caractères) et une audience valide.");
      return;
    }
    const data = currentInput();
    const onSaved = (campaign: AdminEmailCampaignSummary) => {
      setEditingCampaignId(campaign.id);
      setFeedback("Brouillon enregistré sur le serveur. Aucun e-mail n’a été envoyé.");
      void invalidateCampaignData();
    };
    if (editingCampaignId) {
      updateCampaign.mutate({ campaignId: editingCampaignId, data }, {
        onSuccess: (result) => onSaved(result.campaign),
        onError: () => setFormError("La mise à jour du brouillon a échoué. Vérifiez la connexion puis réessayez."),
      });
    } else {
      createCampaign.mutate({ data }, {
        onSuccess: (result) => onSaved(result.campaign),
        onError: () => setFormError("L’enregistrement du brouillon a échoué. Vérifiez la disponibilité du serveur puis réessayez."),
      });
    }
  };

  const loadDraft = (campaign: AdminEmailCampaignSummary) => {
    setActionError("");
    void getAdminEmailCampaign(campaign.id).then((result) => {
      const data = result.campaign;
      setSubject(data.subject);
      setBodyText(data.bodyText);
      setAudienceMode(data.audienceMode);
      setSelectedIds(result.recipientUserIds);
      setEditingCampaignId(campaign.id);
      setFeedback("");
      setFormError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }).catch(() => {
      setActionError("Le brouillon complet n’a pas pu être chargé. Son audience n’a pas été modifiée.");
    });
  };

  const toggleRecipient = (recipient: AdminEmailCampaignRecipient) => {
    setSelectedIds((current) => {
      if (current.includes(recipient.userId)) {
        setSelectedRecipients((selected) => {
          const next = { ...selected };
          delete next[recipient.userId];
          return next;
        });
        return current.filter((id) => id !== recipient.userId);
      }
      if (current.length >= 5000) return current;
      setSelectedRecipients((selected) => ({ ...selected, [recipient.userId]: recipient }));
      return [...current, recipient.userId];
    });
  };

  const executeRetry = async (campaignId: string, recipientId: string) => {
    if (retryingRecipientId || !window.crypto?.randomUUID) {
      setActionError("Une relance est déjà en cours ou la génération sécurisée d’une clé est indisponible.");
      return;
    }
    setRetryingRecipientId(recipientId);
    setActionError("");
    try {
      await retryAdminEmailCampaignRecipient(campaignId, recipientId, {
        headers: { "Idempotency-Key": window.crypto.randomUUID() },
      });
      setRetryConfirmation(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListAdminEmailCampaignHistoryQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListAdminEmailCampaignsQueryKey() }),
      ]);
    } catch {
      setActionError("La relance n’a pas été confirmée. Actualisez l’historique avant toute nouvelle action.");
    } finally {
      setRetryingRecipientId(null);
    }
  };

  const openRetryConfirmation = (item: { campaignId: string; recipientId: string; email: string | null; subject: string }) => {
    setRetryConfirmation(item);
    setActionError("");
  };

  const executePendingAction = () => {
    if (!pendingAction) return;
    setActionError("");
    const { campaign, kind } = pendingAction;
    const done = () => {
      setPendingAction(null);
      void invalidateCampaignData();
    };
    if (kind === "queue") {
      if (!sendingEnabled) return;
      queueCampaign.mutate({ campaignId: campaign.id }, {
        onSuccess: done,
        onError: () => {
          setActionError("La mise en file a échoué. Aucun succès d’envoi n’est confirmé ; vérifiez l’état de la campagne auprès du serveur."),
          setPendingAction(null);
        },
      });
    } else if (kind === "cancel") {
      cancelCampaign.mutate({ campaignId: campaign.id }, {
        onSuccess: done,
        onError: () => {
          setActionError("L’annulation n’a pas été confirmée. Actualisez l’historique avant toute nouvelle action.");
          setPendingAction(null);
        },
      });
    } else {
      deleteCampaign.mutate({ campaignId: campaign.id }, {
        onSuccess: done,
        onError: () => {
          setActionError("La suppression du brouillon a échoué. Actualisez l’historique puis réessayez.");
          setPendingAction(null);
        },
      });
    }
  };

  const actionPending = queueCampaign.isPending || cancelCampaign.isPending || deleteCampaign.isPending;

  return (
    <div className="space-y-6" style={sendFlowEmailTheme} data-testid="section-email-campaigns">
      <header className="sendflow-admin-page-intro" data-testid="header-email-campaigns">
        <div>
          <p className="sendflow-admin-overline">Communication · Espace administrateur</p>
          <h2 data-testid="heading-email-campaigns">Campagnes e-mail</h2>
          <p className="sendflow-admin-subtitle">
            Préparez des messages clairs et vérifiez leur audience avant toute mise en file.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-sm" data-testid="status-sending-readiness">
          <span className={`h-2.5 w-2.5 rounded-full ${sendingEnabled ? "bg-emerald-500" : "bg-amber-500"}`} />
          <span className="font-medium">{campaignsQuery.data ? (sendingEnabled ? "Envoi disponible" : "Envoi indisponible") : "État de l’envoi inconnu"}</span>
        </div>
      </header>

      {campaignsQuery.isError && (
        <Alert variant="destructive" data-testid="error-email-campaigns-load">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Historique indisponible</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>Le serveur n’a pas pu charger les campagnes. Aucune donnée de démonstration n’est affichée.</span>
            <Button variant="outline" size="sm" onClick={() => { void campaignsQuery.refetch(); }} data-testid="button-retry-campaigns">
              <RefreshCw className="mr-2 h-4 w-4" /> Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {campaignsQuery.data && !sendingEnabled && (
        <Alert data-testid="warning-sending-disabled">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Mise en file désactivée</AlertTitle>
          <AlertDescription>
            L’envoi dépend de la configuration du serveur. Vous pouvez préparer et enregistrer des brouillons, mais aucune campagne ne peut être mise en file actuellement.
          </AlertDescription>
        </Alert>
      )}
      {actionError && (
        <Alert variant="destructive" data-testid="error-campaign-action">
          <AlertTitle>Action non confirmée</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {showCampaignWorkspace && (
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.85fr)]">
        <Card className="overflow-hidden border-border/80 shadow-sm" data-testid="card-campaign-composer">
          <CardHeader className="border-b border-border/70 bg-muted/35 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="sendflow-admin-overline">{editingCampaignId ? "Modification" : "Nouvelle communication"}</p>
                <CardTitle className="mt-1 text-xl">{editingCampaignId ? "Modifier le brouillon" : "Composer un e-mail"}</CardTitle>
                <CardDescription className="mt-1">Le contenu est enregistré en brouillon avant toute mise en file.</CardDescription>
              </div>
              {editingCampaignId && (
                <Button variant="ghost" size="sm" onClick={clearComposer} data-testid="button-new-campaign">
                  Nouveau
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-5 sm:p-6">
            {feedback && (
              <Alert data-testid="status-campaign-save">
                <Check className="h-4 w-4" />
                <AlertDescription>{feedback}</AlertDescription>
              </Alert>
            )}
            {formError && (
              <Alert variant="destructive" data-testid="error-campaign-form">
                <AlertTitle>Vérification nécessaire</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email-campaign-subject">Objet</Label>
              <Input
                id="email-campaign-subject"
                value={subject}
                onChange={(event) => { setSubject(event.target.value); setFeedback(""); }}
                maxLength={200}
                placeholder="Ex. Information sur votre compte SendFlow"
                aria-describedby="email-campaign-subject-count"
                data-testid="input-campaign-subject"
              />
              <p id="email-campaign-subject-count" className="text-right text-xs text-muted-foreground" data-testid="text-subject-length">
                {subject.length} / 200
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="email-campaign-body">Message</Label>
                <span className="text-xs text-muted-foreground" data-testid="text-body-length">{formatCount(bodyText.length)} / 20 000</span>
              </div>
              <Textarea
                id="email-campaign-body"
                value={bodyText}
                onChange={(event) => { setBodyText(event.target.value); setFeedback(""); }}
                maxLength={20_000}
                rows={10}
                placeholder="Rédigez ici votre annonce ou message de service."
                className="min-h-56 resize-y leading-7"
                data-testid="input-campaign-body"
              />
              <p className="text-xs text-muted-foreground">Texte brut. Aucun modèle n’est préchargé.</p>
            </div>

            <section className="space-y-3" aria-labelledby="audience-heading">
              <div>
                <h3 id="audience-heading" className="text-sm font-semibold">Destinataires</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Le décompte ne comprend que les comptes actifs ayant une adresse vérifiée et un accord marketing actif.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Mode de sélection des destinataires">
                <button
                  type="button"
                  aria-pressed={audienceMode === "all"}
                  onClick={() => { setAudienceMode("all"); setFeedback(""); }}
                  className={`rounded-xl border p-3 text-left transition-colors ${audienceMode === "all" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card hover:bg-muted/50"}`}
                  data-testid="button-audience-all"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-primary" /> Tous les comptes éligibles</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">Comptes actifs, e-mail vérifié, consentement actif et adresse non exclue.</span>
                </button>
                <button
                  type="button"
                  aria-pressed={audienceMode === "selected"}
                  onClick={() => { setAudienceMode("selected"); setFeedback(""); }}
                  className={`rounded-xl border p-3 text-left transition-colors ${audienceMode === "selected" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card hover:bg-muted/50"}`}
                  data-testid="button-audience-selected"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold"><Check className="h-4 w-4 text-primary" /> Sélection manuelle</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">Choisissez uniquement parmi les résultats réels du serveur.</span>
                </button>
              </div>

              {audienceMode === "all" ? (
                <div className="rounded-xl border border-primary/15 bg-primary/[0.035] p-4" data-testid="panel-audience-all">
                  <p className="text-sm font-semibold" data-testid="text-all-recipient-count">
                    Effectif calculé par le serveur à l’enregistrement du brouillon
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Le serveur exclut les comptes supprimés ou suspendus, les e-mails non vérifiés, les utilisateurs désabonnés et les adresses rejetées ou signalées. Le consentement est revérifié au moment de la mise en file et avant chaque envoi.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-border p-3 sm:p-4" data-testid="panel-audience-selected">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                        placeholder="Rechercher les destinataires"
                        className="pl-9"
                        aria-label="Rechercher les destinataires"
                        data-testid="input-recipient-search"
                      />
                    </div>
                    <div className="shrink-0 rounded-lg bg-muted/60 px-3 py-2 text-sm font-medium" data-testid="text-selected-count">
                      {formatCount(selectedIds.length)} sélectionné(s)
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid="text-recipient-search-contract">
                    La recherche suit les critères pris en charge par le serveur. Elle ne garantit pas de correspondance approximative.
                  </p>
                  {recipientsQuery.isLoading ? (
                    <div className="space-y-3 py-2" data-testid="loading-recipients">
                      {[0, 1, 2].map((item) => <SkeletonLine key={item} className="h-12 w-full" />)}
                    </div>
                  ) : recipientsQuery.isError ? (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4" data-testid="error-recipients">
                      <p className="text-sm text-destructive">Impossible de charger les destinataires réels.</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => { void recipientsQuery.refetch(); }} data-testid="button-retry-recipient-results">
                        Réessayer
                      </Button>
                    </div>
                  ) : recipients.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center" data-testid="empty-recipients">
                      <Users className="mx-auto h-6 w-6 text-muted-foreground" />
                      <p className="mt-2 text-sm font-medium">Aucun destinataire dans ces résultats</p>
                      <p className="mt-1 text-xs text-muted-foreground">Aucune donnée de compte n’est simulée ici.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border rounded-lg border border-border" data-testid="list-recipient-results">
                      {recipients.map((recipient) => {
                        const checked = selectedIds.includes(recipient.userId);
                        return (
                          <label key={recipient.userId} className="flex min-h-14 cursor-pointer items-start gap-3 p-3 hover:bg-muted/35" data-testid={`row-recipient-${recipient.userId}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!checked && selectedIds.length >= 5000}
                              onChange={() => toggleRecipient(recipient)}
                              className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                              data-testid={`checkbox-recipient-${recipient.userId}`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{recipient.displayName || recipient.email}</span>
                              <span className="block truncate text-xs text-muted-foreground">{recipient.email}</span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${recipient.accountStatus === "active" ? "bg-emerald-50 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
                                {recipient.accountStatus === "active" ? "Actif" : "Suspendu"}
                              </span>
                              <span className={`text-[10px] ${recipient.emailVerifiedAt ? "text-muted-foreground" : "font-medium text-amber-800"}`}>
                                {recipient.emailVerifiedAt ? "Adresse vérifiée" : "Non vérifiée"}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground" data-testid="text-recipient-page">
                      {recipientsQuery.data ? `${formatCount(recipientsQuery.data.total)} résultat(s) · page ${recipientsQuery.data.page} sur ${pageCount}` : ""}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" aria-label="Page précédente" disabled={page <= 1 || recipientsQuery.isLoading} onClick={() => setPage((value) => Math.max(1, value - 1))} data-testid="button-recipient-previous">
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" aria-label="Page suivante" disabled={page >= pageCount || recipientsQuery.isLoading} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} data-testid="button-recipient-next">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {selectedIds.length >= 5000 && <p className="text-xs font-medium text-amber-800" data-testid="warning-recipient-limit">Limite de 5 000 destinataires sélectionnés atteinte.</p>}
                </div>
              )}
            </section>

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-muted-foreground" data-testid="text-draft-save-note">
                La mise en file se fait séparément après l’enregistrement du brouillon.
              </p>
              <div className="flex gap-2">
                {editingCampaignId && <Button type="button" variant="outline" onClick={clearComposer} data-testid="button-cancel-edit">Annuler</Button>}
                <Button type="button" onClick={saveDraft} disabled={!formValid || anyMutationPending || (audienceMode === "selected" && (recipientsQuery.isLoading || recipientsQuery.isError))} data-testid="button-save-campaign">
                  <Mail className="mr-2 h-4 w-4" />
                  {anyMutationPending ? "Enregistrement…" : editingCampaignId ? "Enregistrer les modifications" : "Enregistrer le brouillon"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/80 shadow-sm" data-testid="card-campaign-preview">
            <CardHeader className="pb-3">
              <p className="sendflow-admin-overline">Vérification</p>
              <CardTitle className="text-lg">Aperçu du message</CardTitle>
              <CardDescription>Rendu indicatif du texte saisi, sans envoi.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                <div className="flex items-center gap-3 border-b border-border bg-muted/35 px-4 py-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary"><Mail className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">SendFlow</p>
                    <p className="text-[10px] text-muted-foreground">Aperçu du contenu</p>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <p className="break-words text-sm font-semibold" data-testid="preview-campaign-subject">{subject.trim() || "Objet de votre message"}</p>
                  <p className="min-h-24 whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground" data-testid="preview-campaign-body">{bodyText || "Le texte de votre message apparaîtra ici."}</p>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/55 p-3 text-xs leading-5 text-muted-foreground" data-testid="notice-provider-acceptance">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Une acceptation par le fournisseur ne prouve pas que le message est arrivé dans la boîte de réception.</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted-foreground">Audience estimée</span>
                <span className="font-semibold tabular-nums" data-testid="text-audience-estimate">
                  {selectedCount === null ? "Calculé à l’enregistrement" : formatCount(selectedCount)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm" data-testid="card-campaign-workflow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Étapes de validation</CardTitle>
              <CardDescription>Un contrôle explicite avant la mise en file.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ["01", "Rédiger", "Objet et contenu en texte brut."],
                ["02", "Vérifier l’audience", audienceMode === "all" ? "Le serveur calcule l’effectif lors de l’enregistrement." : `${formatCount(selectedIds.length)} destinataire(s) choisi(s).`],
                ["03", "Enregistrer", "Un brouillon serveur, sans envoi."],
                ["04", "Confirmer", sendingEnabled ? "Mise en file séparée et confirmée." : "Bloquée par la configuration serveur."],
              ].map(([number, title, detail]) => (
                <div key={number} className="flex gap-3" data-testid={`step-campaign-${number}`}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{number}</span>
                  <div><p className="text-xs font-semibold">{title}</p><p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{detail}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      <nav className="flex gap-2 overflow-x-auto rounded-xl border border-border bg-card p-1.5" role="tablist" aria-label="Vues des campagnes e-mail" data-testid="campaign-views">
        {([
          ["campaigns", "Campagnes"],
          ["drafts", "Brouillons"],
          ["history", "Historique global"],
          ["accepted", "Acceptés"],
          ["delivered", "Livrés"],
          ["bounced", "Rejets"],
          ["complained", "Plaintes"],
          ["failed", "Échecs"],
          ["settings", "Paramètres"],
        ] as const).map(([view, label]) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={campaignView === view}
            onClick={() => { setCampaignView(view); setHistoryPage(1); }}
            className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-semibold transition-colors ${campaignView === view ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            data-testid={`tab-campaign-${view}`}
          >
            {label}
            {view === "accepted" && historyQuery.data ? ` · ${formatCount(historyQuery.data.counts.accepted)}` : ""}
            {view === "delivered" && historyQuery.data ? ` · ${formatCount(historyQuery.data.counts.delivered)}` : ""}
            {view === "bounced" && historyQuery.data ? ` · ${formatCount(historyQuery.data.counts.bounced)}` : ""}
            {view === "complained" && historyQuery.data ? ` · ${formatCount(historyQuery.data.counts.complained)}` : ""}
            {view === "failed" && historyQuery.data ? ` · ${formatCount(historyQuery.data.counts.failed)}` : ""}
          </button>
        ))}
      </nav>

      {campaignView === "settings" && (
        <Card className="border-border/80 shadow-sm" data-testid="card-email-campaign-settings">
          <CardHeader className="gap-4 border-b border-border/70 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="sendflow-admin-overline">État serveur</p>
              <CardTitle className="mt-1 text-xl">Paramètres et limites</CardTitle>
              <CardDescription className="mt-1">Indicateurs sans valeur de secret. Les pièces jointes ne sont pas prises en charge.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => { void settingsQuery.refetch(); }} disabled={settingsQuery.isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${settingsQuery.isFetching ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </CardHeader>
          <CardContent className="space-y-5 p-4 sm:p-6">
            {settingsQuery.isLoading ? (
              <div className="space-y-3" data-testid="loading-email-campaign-settings"><SkeletonLine /><SkeletonLine /><SkeletonLine /></div>
            ) : settingsQuery.isError || !settingsQuery.data ? (
              <Alert variant="destructive" data-testid="error-email-campaign-settings">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>État de configuration indisponible</AlertTitle>
                <AlertDescription>Aucun état n’est simulé. Réessayez après vérification du serveur.</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    ["Mise en file", settingsQuery.data.sendingEnabled ? "Disponible" : "Désactivée"],
                    ["Secret de signature reçu", settingsQuery.data.webhookConfigured ? "Configuré" : "Manquant"],
                    ["Événements de livraison", settingsQuery.data.providerEventsReady ? "Confirmation déploiement requise" : "Non confirmé"],
                    ["Désinscription", settingsQuery.data.unsubscribeConfigured ? "Configurée" : "Manquante"],
                    ["Pièces jointes", settingsQuery.data.attachmentsEnabled ? "Activées" : "Non prises en charge"],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-border bg-muted/15 p-4">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className={`mt-1 text-sm font-semibold ${value === "Désactivée" || value === "Manquant" || value === "Non confirmé" ? "text-amber-800" : "text-foreground"}`}>{value}</p>
                    </div>
                  ))}
                </div>
                <p className="rounded-lg border border-border bg-muted/25 p-3 text-xs leading-5 text-muted-foreground">
                  « Événements de livraison » reflète le drapeau de configuration du déploiement; il ne vérifie pas le tableau de bord du fournisseur. Avant tout envoi, l’URL de webhook doit être enregistrée côté fournisseur pour les événements de livraison, rejet et plainte.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {([
                    ["Tentatives automatiques", settingsQuery.data.automaticAttemptLimit],
                    ["Relances max par destinataire", settingsQuery.data.manualRetryLimitPerRecipient],
                    ["Mises en file / admin / heure", settingsQuery.data.queueLimitPerAdminPerHour],
                    ["Relances / admin / 15 min", settingsQuery.data.retryLimitPerAdminPer15Minutes],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-border p-4">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{formatCount(value)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {showCampaignWorkspace && (
      <Card className="overflow-hidden border-border/80 shadow-sm" data-testid="card-campaign-history">
        <CardHeader className="border-b border-border/70 bg-muted/25 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="sendflow-admin-overline">Suivi serveur</p>
            <CardTitle className="mt-1 text-xl">{campaignView === "drafts" ? "Brouillons" : "Campagnes"}</CardTitle>
            <CardDescription className="mt-1">État et compteurs rapportés par le serveur, sans présumer de la réception.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => { void campaignsQuery.refetch(); }} disabled={campaignsQuery.isFetching} data-testid="button-refresh-campaigns">
            <RefreshCw className={`mr-2 h-4 w-4 ${campaignsQuery.isFetching ? "animate-spin" : ""}`} /> Actualiser
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {campaignsQuery.isLoading ? (
            <div className="space-y-3 p-5" data-testid="loading-campaign-history">
              {[0, 1, 2].map((item) => <SkeletonLine key={item} className="h-20 w-full" />)}
            </div>
          ) : campaignsQuery.isError ? (
            <div className="px-5 py-10 text-center" data-testid="empty-campaign-history-error">
              <p className="text-sm font-medium">Aucun historique à afficher</p>
              <p className="mt-1 text-xs text-muted-foreground">La lecture des campagnes a échoué. Réessayez après vérification du serveur.</p>
            </div>
          ) : visibleCampaigns.length === 0 ? (
            <div className="px-5 py-12 text-center" data-testid="empty-campaign-history">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Mail className="h-5 w-5" /></span>
              <p className="mt-3 text-sm font-semibold">{campaignView === "drafts" ? "Aucun brouillon" : "Aucune campagne enregistrée"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Les campagnes apparaîtront ici après leur création. Aucune donnée fictive n’est affichée.</p>
            </div>
          ) : (
            <div className="divide-y divide-border" data-testid="list-campaign-history">
              {visibleCampaigns.map((campaign) => {
                const isBusy = actionPending;
                return (
                  <article key={campaign.id} className="p-4 sm:p-5" data-testid={`campaign-row-${campaign.id}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="max-w-full break-words text-sm font-semibold" data-testid={`text-campaign-subject-${campaign.id}`}>{campaign.subject}</h3>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClass(campaign.status)}`} data-testid={`status-campaign-${campaign.id}`}>
                            {statusLabel(campaign.status)}
                          </span>
                          <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground" data-testid={`audience-campaign-${campaign.id}`}>
                        {campaign.audienceMode === "all" ? "Tous les comptes éligibles" : "Sélection manuelle"}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground" data-testid={`text-campaign-body-preview-${campaign.id}`}>
                          {campaign.bodyText}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                          <span data-testid={`text-campaign-recipient-count-${campaign.id}`}>{formatCount(campaign.recipientCount)} destinataire(s)</span>
                          <span data-testid={`text-campaign-created-${campaign.id}`}>Créée le {formatDate(campaign.createdAt)}</span>
                          {campaign.queuedAt && <span data-testid={`text-campaign-queued-${campaign.id}`}>Mise en file le {formatDate(campaign.queuedAt)}</span>}
                          {campaign.completedAt && <span data-testid={`text-campaign-completed-${campaign.id}`}>Traitement terminé le {formatDate(campaign.completedAt)}</span>}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2" data-testid={`campaign-counts-${campaign.id}`}>
                          {([
                            ["En attente", campaign.counts.queued],
                            ["En cours", campaign.counts.sending],
                            ["Acceptés par le fournisseur", campaign.counts.accepted],
                            ["Livrés", campaign.counts.delivered],
                            ["Rejets", campaign.counts.bounced],
                            ["Plaintes", campaign.counts.complained],
                            ["Échecs", campaign.counts.failed],
                            ["Annulés", campaign.counts.cancelled],
                          ] as const).map(([label, count]) => (
                            <span key={label} className="rounded-md bg-muted/65 px-2 py-1 text-[10px] text-muted-foreground" data-testid={`count-${label.toLowerCase().replaceAll(" ", "-")}-${campaign.id}`}>
                              {label} · {formatCount(count)}
                            </span>
                          ))}
                          <span className="rounded-md bg-muted/65 px-2 py-1 text-[10px] text-muted-foreground" data-testid={`count-draft-${campaign.id}`}>Brouillons destinataires · {formatCount(campaign.counts.draft)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:max-w-56 lg:justify-end">
                        {campaign.status === "draft" && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => loadDraft(campaign)} data-testid={`button-edit-campaign-${campaign.id}`}>
                              Modifier
                            </Button>
                            <Button
                              size="sm"
                              disabled={!sendingEnabled || campaign.recipientCount < 1 || isBusy}
                              onClick={() => setPendingAction({ kind: "queue", campaign })}
                              title={!sendingEnabled ? "L’envoi est désactivé par la configuration du serveur." : undefined}
                              data-testid={`button-queue-campaign-${campaign.id}`}
                            >
                              <Send className="mr-1.5 h-3.5 w-3.5" /> Mettre en file
                            </Button>
                            <Button variant="ghost" size="icon" aria-label="Supprimer le brouillon" disabled={isBusy} onClick={() => setPendingAction({ kind: "delete", campaign })} data-testid={`button-delete-campaign-${campaign.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {campaign.status === "queued" && (
                          <Button variant="outline" size="sm" disabled={isBusy} onClick={() => setPendingAction({ kind: "cancel", campaign })} data-testid={`button-cancel-campaign-${campaign.id}`}>
                            Annuler la campagne
                          </Button>
                        )}
                        {(campaign.status === "queued" || campaign.status === "sending") && (
                          <span className="sr-only" data-testid={`text-campaign-processing-note-${campaign.id}`}>Le traitement est en cours côté serveur.</span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {(["history", "accepted", "delivered", "bounced", "complained", "failed"] as CampaignView[]).includes(campaignView) && (
        <Card className="overflow-hidden border-border/80 shadow-sm" data-testid="card-recipient-email-history">
          <CardHeader className="gap-4 border-b border-border/70 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="sendflow-admin-overline">Suivi par destinataire</p>
              <CardTitle className="mt-1 text-xl">
                {campaignView === "accepted" ? "Acceptés par le fournisseur"
                  : campaignView === "delivered" ? "Livrés au serveur de messagerie"
                    : campaignView === "bounced" ? "Adresses rejetées"
                      : campaignView === "complained" ? "Plaintes"
                        : campaignView === "failed" ? "Échecs de traitement"
                          : "Historique global"}
              </CardTitle>
              <CardDescription className="mt-1">L’acceptation du fournisseur ne confirme pas la livraison dans la boîte du destinataire.</CardDescription>
            </div>
            <div className="flex w-full gap-2 sm:max-w-lg">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={historySearch}
                  onChange={(event) => { setHistorySearch(event.target.value); setHistoryPage(1); }}
                  placeholder="Rechercher objet, adresse ou identifiant"
                  aria-label="Rechercher dans l’historique des e-mails"
                  data-testid="input-email-history-search"
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="icon" aria-label="Actualiser l’historique" onClick={() => { void historyQuery.refetch(); }} disabled={historyQuery.isFetching} data-testid="button-refresh-email-history">
                <RefreshCw className={`h-4 w-4 ${historyQuery.isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {historyQuery.data && (
              <div className="grid grid-cols-2 gap-2 border-b border-border p-4 sm:grid-cols-4 xl:grid-cols-8">
                {([
                  ["En attente", historyQuery.data.counts.queued],
                  ["En cours", historyQuery.data.counts.sending],
                  ["Acceptés", historyQuery.data.counts.accepted],
                  ["Livrés", historyQuery.data.counts.delivered],
                  ["Rejets", historyQuery.data.counts.bounced],
                  ["Plaintes", historyQuery.data.counts.complained],
                  ["Échecs", historyQuery.data.counts.failed],
                  ["Annulés", historyQuery.data.counts.cancelled],
                ] as const).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatCount(value)}</p>
                  </div>
                ))}
              </div>
            )}
            {historyQuery.isLoading ? (
              <div className="space-y-3 p-5"><SkeletonLine className="h-20 w-full" /><SkeletonLine className="h-20 w-full" /></div>
            ) : historyQuery.isError ? (
              <p className="p-6 text-sm text-muted-foreground" role="status">L’historique par destinataire est indisponible. Réessayez après vérification du serveur.</p>
            ) : (historyQuery.data?.items.length ?? 0) === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Aucun envoi ne correspond à cette vue.</p>
            ) : (
              <div className="divide-y divide-border">
                {historyQuery.data?.items.map((item) => (
                  <article key={item.recipientId} className="space-y-3 p-4 sm:p-5" data-testid={`email-delivery-${item.recipientId}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="break-all text-sm font-semibold">{item.email ?? "Adresse indisponible"}</p>
                        <p className="break-words text-sm">Campagne : {item.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.createdAt)} · {formatCount(item.attemptCount)} tentative(s) · {item.manualRetries} relance(s) manuelle(s)
                        </p>
                        {item.providerMessageId && <p className="break-all font-mono text-[11px] text-muted-foreground">ID fournisseur : {item.providerMessageId}</p>}
                        {item.acceptedAt && <p className="text-xs text-muted-foreground">Accepté le {formatDate(item.acceptedAt)}</p>}
                        {item.providerUpdatedAt && <p className="text-xs text-muted-foreground">Dernier événement fournisseur : {formatDate(item.providerUpdatedAt)}</p>}
                        {item.lastErrorClass && (
                          <p className="break-words text-xs text-destructive">
                            Erreur : {item.lastErrorClass}{item.lastErrorStatus ? ` · HTTP ${item.lastErrorStatus}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                          item.status === "delivered" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : item.status === "bounced" || item.status === "complained" || item.status === "failed" ? "border-red-200 bg-red-50 text-red-800"
                              : item.status === "accepted" ? "border-blue-200 bg-blue-50 text-blue-800"
                                : "border-primary/20 bg-primary/10 text-primary"
                        }`}>
                          {deliveryStatusLabel(item.status)}
                        </span>
                        {item.status === "failed" && item.lastErrorClass !== "network_or_response" && item.lastErrorClass !== "delivery_outcome_unknown" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!sendingEnabled || retryingRecipientId !== null}
                            onClick={() => openRetryConfirmation({
                              campaignId: item.campaignId,
                              recipientId: item.recipientId,
                              email: item.email,
                              subject: item.subject,
                            })}
                            data-testid={`button-retry-email-${item.recipientId}`}
                          >
                            {retryingRecipientId === item.recipientId ? "Relance…" : "Relancer"}
                          </Button>
                        )}
                      </div>
                    </div>
                    {item.attempts.length > 0 && (
                      <details className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-semibold">Détail des tentatives ({item.attempts.length})</summary>
                        <ol className="mt-2 space-y-2">
                          {item.attempts.map((attempt, index) => (
                            <li key={`${item.recipientId}-${attempt.attemptNumber}`} className="border-l-2 border-border pl-3 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Tentative {index + 1}</span> · {deliveryStatusLabel(attempt.status)} · {formatDate(attempt.startedAt)}
                              {attempt.finishedAt && ` – ${formatDate(attempt.finishedAt)}`}
                              {attempt.errorClass && ` · ${attempt.errorClass}`}
                              {attempt.httpStatus && ` · HTTP ${attempt.httpStatus}`}
                              {attempt.providerUpdatedAt && <span className="block">Événement fournisseur : {formatDate(attempt.providerUpdatedAt)}</span>}
                              {attempt.providerMessageId && <span className="block break-all font-mono">ID fournisseur : {attempt.providerMessageId}</span>}
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </article>
                ))}
              </div>
            )}
            {historyQuery.data && (
              <div className="flex items-center justify-between gap-3 border-t border-border p-4">
                <p className="text-xs text-muted-foreground">
                  {formatCount(historyQuery.data.total)} résultat(s) · page {historyPage} / {Math.max(1, Math.ceil(historyQuery.data.total / historyQuery.data.pageSize))}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" aria-label="Page précédente" disabled={historyPage <= 1 || historyQuery.isFetching} onClick={() => setHistoryPage((value) => Math.max(1, value - 1))}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" aria-label="Page suivante" disabled={historyPage >= Math.max(1, Math.ceil(historyQuery.data.total / historyQuery.data.pageSize)) || historyQuery.isFetching} onClick={() => setHistoryPage((value) => value + 1)}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground" data-testid="notice-email-delivery-status">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Les compteurs et statuts décrivent le traitement serveur. « Accepté par le fournisseur » ne signifie pas que le destinataire a reçu ou consulté le message.</p>
      </div>

      <Dialog open={Boolean(pendingAction)} onOpenChange={(open) => { if (!open && !actionPending) setPendingAction(null); }}>
        <DialogContent data-testid="dialog-campaign-confirmation">
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.kind === "queue" ? "Confirmer la mise en file" : pendingAction?.kind === "cancel" ? "Annuler cette campagne ?" : "Supprimer ce brouillon ?"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.kind === "queue"
                ? `Le serveur revérifiera le statut du compte, la vérification de l’adresse et le consentement avant chaque envoi. La réception en boîte de réception n’est pas garantie.`
                : pendingAction?.kind === "cancel"
                  ? "Le serveur tentera d’annuler les envois qui n’ont pas commencé. Le statut sera relu depuis le serveur."
                  : "Cette action supprime définitivement le brouillon serveur. Elle ne peut pas être annulée."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button variant="outline" disabled={actionPending} onClick={() => setPendingAction(null)} data-testid="button-dismiss-campaign-confirmation">Retour</Button>
            <Button
              variant={pendingAction?.kind === "delete" ? "destructive" : "default"}
              disabled={actionPending || (pendingAction?.kind === "queue" && !sendingEnabled)}
              onClick={executePendingAction}
              data-testid="button-confirm-campaign-action"
            >
              {actionPending ? "Traitement…" : pendingAction?.kind === "queue" ? "Confirmer la mise en file" : pendingAction?.kind === "cancel" ? "Confirmer l’annulation" : "Supprimer le brouillon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(retryConfirmation)} onOpenChange={(open) => { if (!open && retryingRecipientId === null) setRetryConfirmation(null); }}>
        <DialogContent data-testid="dialog-email-retry-confirmation">
          <DialogHeader>
            <DialogTitle>Confirmer la relance</DialogTitle>
            <DialogDescription>
              {retryConfirmation
                ? `Relancer l’e-mail « ${retryConfirmation.subject} » vers ${retryConfirmation.email ?? "l’adresse conservée côté serveur"} ? Le serveur revérifiera l’échec, l’éligibilité et l’absence d’un envoi en cours avant d’enregistrer une nouvelle tentative.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {!sendingEnabled && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Relance désactivée</AlertTitle>
              <AlertDescription>La configuration serveur n’autorise pas actuellement le traitement des campagnes.</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button variant="outline" disabled={retryingRecipientId !== null} onClick={() => setRetryConfirmation(null)} data-testid="button-dismiss-email-retry">
              Annuler
            </Button>
            <Button
              disabled={!sendingEnabled || retryingRecipientId !== null || !retryConfirmation}
              onClick={() => {
                if (retryConfirmation) void executeRetry(retryConfirmation.campaignId, retryConfirmation.recipientId);
              }}
              data-testid="button-confirm-email-retry"
            >
              {retryingRecipientId ? "Relance en cours…" : "Confirmer la relance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
