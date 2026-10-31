import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListAdminEmailCampaignRecipientsQueryKey,
  getListAdminEmailCampaignsQueryKey,
  useCancelAdminEmailCampaign,
  useCreateAdminEmailCampaign,
  useDeleteAdminEmailCampaign,
  useListAdminEmailCampaignRecipients,
  useListAdminEmailCampaigns,
  useQueueAdminEmailCampaign,
  useUpdateAdminEmailCampaign,
} from "@workspace/api-client-react";
import type {
  AdminEmailCampaignInput,
  AdminEmailCampaignRecipient,
  AdminEmailCampaignSummary,
} from "@workspace/api-client-react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  FileText,
  Image as ImageIcon,
  Mail,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AudienceMode = AdminEmailCampaignInput["audienceMode"];
type LocalAttachment = { id: string; file: File; previewUrl: string | null };
type PendingAction = { kind: "queue" | "cancel" | "delete"; campaign: AdminEmailCampaignSummary } | null;

const PAGE_SIZE = 20;

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
  const [localCampaignInputs, setLocalCampaignInputs] = useState<Record<string, AdminEmailCampaignInput>>({});
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const attachmentUrls = useRef(new Set<string>());
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    attachmentUrls.current.forEach((url) => URL.revokeObjectURL(url));
    attachmentUrls.current.clear();
  }, []);

  const campaigns = campaignsQuery.data?.items ?? [];
  const recipients = recipientsQuery.data?.items ?? [];
  const sendingEnabled = campaignsQuery.data?.sendingEnabled === true;
  const pageCount = Math.max(1, Math.ceil((recipientsQuery.data?.total ?? 0) / (recipientsQuery.data?.pageSize ?? PAGE_SIZE)));
  const selectedCount = audienceMode === "all" ? null : selectedIds.length;
  const unverifiedCount = audienceMode === "all"
    ? null
    : selectedIds.filter((id) => !selectedRecipients[id]?.emailVerifiedAt).length;
  const formValid = subject.trim().length > 0
    && subject.trim().length <= 200
    && bodyText.trim().length > 0
    && bodyText.length <= 20_000
    && (audienceMode === "all" || (selectedIds.length > 0 && selectedIds.length <= 5000));
  const anyMutationPending = createCampaign.isPending || updateCampaign.isPending;

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
    setAttachments((current) => {
      current.forEach(({ previewUrl }) => {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          attachmentUrls.current.delete(previewUrl);
        }
      });
      return [];
    });
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
      setLocalCampaignInputs((current) => ({ ...current, [campaign.id]: data }));
      setFeedback("Brouillon enregistré sur le serveur. Les pièces jointes restent uniquement dans cet aperçu local.");
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
    const savedInput = localCampaignInputs[campaign.id];
    if (!savedInput && campaign.audienceMode === "selected") {
      setActionError("Les identifiants des destinataires sélectionnés ne figurent pas dans la liste. Ce brouillon ne peut être modifié ici sans risquer de changer son audience.");
      return;
    }
    const data = savedInput ?? {
      subject: campaign.subject,
      bodyText: campaign.bodyText,
      audienceMode: "all" as const,
      userIds: [],
    };
    setSubject(data.subject);
    setBodyText(data.bodyText);
    setAudienceMode(data.audienceMode);
    setSelectedIds(data.userIds);
    setSelectedRecipients((current) => {
      const retained: Record<string, AdminEmailCampaignRecipient> = {};
      data.userIds.forEach((id) => {
        if (current[id]) retained[id] = current[id];
      });
      return retained;
    });
    setEditingCampaignId(campaign.id);
    setFeedback("");
    setFormError("");
    setActionError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).filter((file) =>
      file.type === "application/pdf" || file.type.startsWith("image/"),
    );
    const newFiles = accepted.map((file) => {
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      if (previewUrl) attachmentUrls.current.add(previewUrl);
      return { id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`, file, previewUrl };
    });
    setAttachments((current) => [...current, ...newFiles]);
    if (accepted.length !== files.length) setFormError("Seuls les fichiers image et PDF peuvent être prévisualisés localement.");
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((current) => {
      const removed = current.find(({ id }) => id === attachmentId);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
        attachmentUrls.current.delete(removed.previewUrl);
      }
      return current.filter(({ id }) => id !== attachmentId);
    });
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
    <div className="space-y-6" data-testid="section-email-campaigns">
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
                  Le décompte est fourni par le serveur et peut inclure des comptes suspendus ou des adresses non vérifiées.
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
                  <span className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-primary" /> Tous les comptes avec e-mail</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">Inclut les comptes conservés, même suspendus ou non vérifiés.</span>
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
                    Le serveur inclut les comptes conservés avec une adresse enregistrée, même si elle n’est pas vérifiée ou si le compte est suspendu. Les comptes supprimés et ceux sans adresse sont exclus. Aucune adresse individuelle n’est chargée pour cette audience.
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
                  {unverifiedCount !== null && unverifiedCount > 0 && selectedIds.length > 0 && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900" data-testid="warning-selected-unverified">
                      {formatCount(unverifiedCount)} adresse(s) non vérifiée(s) parmi les destinataires actuellement sélectionnés.
                    </p>
                  )}
                  {selectedIds.length >= 5000 && <p className="text-xs font-medium text-amber-800" data-testid="warning-recipient-limit">Limite de 5 000 destinataires sélectionnés atteinte.</p>}
                </div>
              )}
            </section>

            <section className="space-y-3 border-t border-border pt-5" aria-labelledby="attachment-heading">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 id="attachment-heading" className="text-sm font-semibold">Aperçu de pièces jointes</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Sélection locale d’images ou de PDF, sans transfert.</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="sr-only"
                  onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ""; }}
                  data-testid="input-campaign-attachments"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-add-attachment">
                  <Paperclip className="mr-2 h-4 w-4" /> Choisir des fichiers
                </Button>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs leading-5 text-amber-900" data-testid="notice-attachments-local-only">
                Ces fichiers servent uniquement à l’aperçu local. Ils ne sont ni envoyés, ni enregistrés, ni inclus dans la campagne.
              </div>
              {attachments.length > 0 && (
                <ul className="grid gap-2 sm:grid-cols-2" data-testid="list-attachment-previews">
                  {attachments.map(({ id, file, previewUrl }) => (
                    <li key={id} className="flex min-w-0 items-center gap-3 rounded-lg border border-border p-2" data-testid={`item-attachment-${id}`}>
                      {previewUrl ? (
                        <img src={previewUrl} alt={`Aperçu local de ${file.name}`} className="h-12 w-12 rounded-md object-cover" />
                      ) : file.type === "application/pdf" ? (
                        <span className="grid h-12 w-12 place-items-center rounded-md bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span>
                      ) : (
                        <span className="grid h-12 w-12 place-items-center rounded-md bg-muted text-muted-foreground"><ImageIcon className="h-5 w-5" /></span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{file.name}</span>
                        <span className="block text-[10px] text-muted-foreground">{(file.size / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} Ko · aperçu local</span>
                      </span>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Retirer ${file.name}`} onClick={() => removeAttachment(id)} data-testid={`button-remove-attachment-${id}`}>
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
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
                  {attachments.length > 0 && <p className="border-t border-border pt-2 text-[10px] text-muted-foreground">{attachments.length} aperçu(s) local(aux), non inclus dans l’envoi</p>}
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
              {audienceMode === "selected" && unverifiedCount !== null && unverifiedCount > 0 && (
                <p className="mt-2 text-xs font-medium text-amber-800" data-testid="text-preview-selected-unverified">
                  {formatCount(unverifiedCount)} sélection(s) non vérifiée(s)
                </p>
              )}
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

      <Card className="overflow-hidden border-border/80 shadow-sm" data-testid="card-campaign-history">
        <CardHeader className="border-b border-border/70 bg-muted/25 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="sendflow-admin-overline">Suivi serveur</p>
            <CardTitle className="mt-1 text-xl">Campagnes et historique</CardTitle>
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
          ) : campaigns.length === 0 ? (
            <div className="px-5 py-12 text-center" data-testid="empty-campaign-history">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Mail className="h-5 w-5" /></span>
              <p className="mt-3 text-sm font-semibold">Aucune campagne enregistrée</p>
              <p className="mt-1 text-xs text-muted-foreground">Les campagnes apparaîtront ici après leur création. Aucune donnée fictive n’est affichée.</p>
            </div>
          ) : (
            <div className="divide-y divide-border" data-testid="list-campaign-history">
              {campaigns.map((campaign) => {
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
                            {campaign.audienceMode === "all" ? "Tous les comptes avec e-mail" : "Sélection manuelle"}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground" data-testid={`text-campaign-body-preview-${campaign.id}`}>
                          {campaign.bodyText}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                          <span data-testid={`text-campaign-recipient-count-${campaign.id}`}>{formatCount(campaign.recipientCount)} destinataire(s)</span>
                          {campaign.unverifiedRecipientCount > 0 && <span className="font-medium text-amber-800" data-testid={`text-campaign-unverified-${campaign.id}`}>{formatCount(campaign.unverifiedRecipientCount)} non vérifiée(s)</span>}
                          <span data-testid={`text-campaign-created-${campaign.id}`}>Créée le {formatDate(campaign.createdAt)}</span>
                          {campaign.queuedAt && <span data-testid={`text-campaign-queued-${campaign.id}`}>Mise en file le {formatDate(campaign.queuedAt)}</span>}
                          {campaign.completedAt && <span data-testid={`text-campaign-completed-${campaign.id}`}>Traitement terminé le {formatDate(campaign.completedAt)}</span>}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2" data-testid={`campaign-counts-${campaign.id}`}>
                          {([
                            ["En attente", campaign.counts.queued],
                            ["En cours", campaign.counts.sending],
                            ["Acceptés par le fournisseur", campaign.counts.accepted],
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
                        {(campaign.status === "queued" || campaign.status === "sending") && (
                          <Button variant="outline" size="sm" disabled={isBusy} onClick={() => setPendingAction({ kind: "cancel", campaign })} data-testid={`button-cancel-campaign-${campaign.id}`}>
                            Annuler la campagne
                          </Button>
                        )}
                        {(campaign.status === "queued" || campaign.status === "sending") && (
                          <span className="sr-only" data-testid={`text-campaign-processing-note-${campaign.id}`}>Le traitement est en cours côté serveur.</span>
                        )}
                      </div>
                    </div>
                    {campaign.audienceMode === "all" && campaign.unverifiedRecipientCount > 0 && (
                      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid={`warning-campaign-unverified-${campaign.id}`}>
                        Cette audience contient des adresses non vérifiées, y compris si elles ont été conservées sur des comptes suspendus.
                      </p>
                    )}
                    {campaign.status === "draft" && campaign.audienceMode === "selected" && !localCampaignInputs[campaign.id] && (
                      <p className="mt-3 text-[11px] leading-5 text-muted-foreground" data-testid={`notice-campaign-edit-limitation-${campaign.id}`}>
                        Les identifiants de destinataires sélectionnés ne sont pas inclus dans la liste historique. Le chargement en modification est bloqué pour protéger l’audience enregistrée.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
                ? `Le serveur préparera ${formatCount(pendingAction.campaign.recipientCount)} envoi(s). ${pendingAction.campaign.unverifiedRecipientCount > 0 ? `${formatCount(pendingAction.campaign.unverifiedRecipientCount)} adresse(s) ne sont pas vérifiées. ` : ""}La réception en boîte de réception n’est pas garantie.`
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
    </div>
  );
}
