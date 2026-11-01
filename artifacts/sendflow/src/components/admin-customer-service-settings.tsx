import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminCustomerServiceSettingsQueryKey,
  getGetCustomerServiceSettingsQueryKey,
  useGetAdminCustomerServiceSettings,
  useUpdateAdminCustomerServiceSettings,
} from "@workspace/api-client-react";
import type { AdminCustomerServiceSettings } from "@workspace/api-client-react";
import { AlertCircle, CheckCircle2, Facebook, MessageCircle, Phone } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ContactDraft = {
  phoneNumber: string;
  whatsappNumber: string;
  facebookLabel: string;
  facebookUrl: string;
};

const emptyDraft: ContactDraft = {
  phoneNumber: "",
  whatsappNumber: "",
  facebookLabel: "",
  facebookUrl: "",
};
const e164Pattern = /^\+[1-9][0-9]{7,14}$/;
const facebookPattern = /^https:\/\/(www\.)?facebook\.com\//i;

function toDraft(settings: AdminCustomerServiceSettings): ContactDraft {
  return {
    phoneNumber: settings.phoneNumber ?? "",
    whatsappNumber: settings.whatsappNumber ?? "",
    facebookLabel: settings.facebookLabel ?? "",
    facebookUrl: settings.facebookUrl ?? "",
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function AdminCustomerServiceSettingsSection() {
  const queryClient = useQueryClient();
  const query = useGetAdminCustomerServiceSettings({
    query: { queryKey: getGetAdminCustomerServiceSettingsQueryKey(), retry: false },
  });
  const mutation = useUpdateAdminCustomerServiceSettings();
  const [draft, setDraft] = useState<ContactDraft>(emptyDraft);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.data) setDraft(toDraft(query.data));
  }, [query.data?.version]);

  const phoneValid = (value: string) => !value.trim() || e164Pattern.test(value.trim());
  const facebookPairValid = Boolean(draft.facebookLabel.trim()) === Boolean(draft.facebookUrl.trim());
  const valid = phoneValid(draft.phoneNumber)
    && phoneValid(draft.whatsappNumber)
    && Boolean(draft.phoneNumber.trim() || draft.whatsappNumber.trim())
    && facebookPairValid
    && (!draft.facebookUrl.trim() || facebookPattern.test(draft.facebookUrl.trim()))
    && reason.trim().length >= 3;

  const updateField = (field: keyof ContactDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setFeedback("");
  };

  const save = () => {
    if (!query.data || !valid) return;
    setError("");
    setFeedback("");
    mutation.mutate({
      data: {
        phoneNumber: draft.phoneNumber.trim() || null,
        whatsappNumber: draft.whatsappNumber.trim() || null,
        facebookLabel: draft.facebookLabel.trim() || null,
        facebookUrl: draft.facebookUrl.trim() || null,
        expectedVersion: query.data.version,
        reason: reason.trim(),
      },
    }, {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetAdminCustomerServiceSettingsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetCustomerServiceSettingsQueryKey() }),
        ]);
        setReason("");
        setFeedback("Les coordonnées ont été enregistrées. Les prochains e-mails utiliseront ces valeurs actives.");
      },
      onError: () => {
        setError("L’enregistrement n’a pas été confirmé. Actualisez les coordonnées avant de réessayer.");
        void query.refetch();
      },
    });
  };

  return (
    <div className="space-y-6">
      <header className="sendflow-admin-page-intro">
        <div>
          <p className="sendflow-admin-overline">Configuration · Contacts publics</p>
          <h2 data-testid="heading-admin-customer-service-settings">Coordonnées du service client</h2>
          <p className="sendflow-admin-subtitle">
            Gérez les coordonnées utilisées sur la page Service client et dans le pied des prochains e-mails de campagne.
          </p>
        </div>
      </header>

      <Alert>
        <AlertCircle className="size-4" />
        <AlertTitle>Les coordonnées actives viennent du serveur</AlertTitle>
        <AlertDescription>
          Aucun numéro de démonstration n’est utilisé. Les modifications s’appliquent après confirmation et ne changent pas les e-mails déjà envoyés.
        </AlertDescription>
      </Alert>

      {feedback && (
        <Alert data-testid="status-customer-service-settings">
          <CheckCircle2 className="size-4" />
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" data-testid="error-customer-service-settings">
          <AlertTitle>Modification non confirmée</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {query.isError && (
        <Alert variant="destructive" data-testid="error-customer-service-settings-load">
          <AlertTitle>Coordonnées indisponibles</AlertTitle>
          <AlertDescription>Le serveur n’a pas pu charger les valeurs actives. Réessayez après vérification du serveur.</AlertDescription>
          <Button className="mt-3" variant="outline" onClick={() => { void query.refetch(); }}>Réessayer</Button>
        </Alert>
      )}
      {query.isLoading && <p role="status">Chargement des coordonnées actives…</p>}

      {query.data && !query.isError && (
        <Card data-testid="card-admin-customer-service-settings">
          <CardHeader>
            <CardTitle>Coordonnées publiées</CardTitle>
            <CardDescription>
              Version {query.data.version} · dernière mise à jour {formatDate(query.data.updatedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="support-phone-number"><Phone className="mr-2 inline size-4" />Téléphone du service client</Label>
                <Input
                  id="support-phone-number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={draft.phoneNumber}
                  onChange={(event) => updateField("phoneNumber", event.target.value)}
                  placeholder="+indicatif international et numéro"
                  aria-describedby="support-phone-help"
                  data-testid="input-support-phone"
                />
                <p id="support-phone-help" className="text-sm text-muted-foreground">Format international E.164, par exemple avec un + suivi des chiffres.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-whatsapp-number"><MessageCircle className="mr-2 inline size-4" />WhatsApp du service client</Label>
                <Input
                  id="support-whatsapp-number"
                  type="tel"
                  inputMode="tel"
                  value={draft.whatsappNumber}
                  onChange={(event) => updateField("whatsappNumber", event.target.value)}
                  placeholder="+indicatif international et numéro"
                  aria-describedby="support-whatsapp-help"
                  data-testid="input-support-whatsapp"
                />
                <p id="support-whatsapp-help" className="text-sm text-muted-foreground">Utilisé pour ouvrir une conversation WhatsApp et dans les e-mails.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-facebook-label"><Facebook className="mr-2 inline size-4" />Nom de la page Facebook</Label>
                <Input
                  id="support-facebook-label"
                  value={draft.facebookLabel}
                  onChange={(event) => updateField("facebookLabel", event.target.value)}
                  maxLength={100}
                  placeholder="Nom public de la page"
                  data-testid="input-support-facebook-label"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-facebook-url">Lien officiel Facebook</Label>
                <Input
                  id="support-facebook-url"
                  type="url"
                  inputMode="url"
                  value={draft.facebookUrl}
                  onChange={(event) => updateField("facebookUrl", event.target.value)}
                  maxLength={500}
                  placeholder="https://www.facebook.com/…"
                  data-testid="input-support-facebook-url"
                />
              </div>
            </div>

            {(!phoneValid(draft.phoneNumber) || !phoneValid(draft.whatsappNumber)
              || (!draft.phoneNumber.trim() && !draft.whatsappNumber.trim())
              || !facebookPairValid || (draft.facebookUrl.trim() && !facebookPattern.test(draft.facebookUrl.trim()))) && (
              <p className="text-sm text-destructive" role="alert">
                Configurez au moins un numéro de téléphone ou WhatsApp, puis vérifiez les formats et les coordonnées Facebook.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="customer-service-settings-reason">Motif de modification</Label>
              <Textarea
                id="customer-service-settings-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={3}
                maxLength={500}
                placeholder="Indiquez pourquoi les coordonnées sont modifiées."
                data-testid="input-customer-service-settings-reason"
              />
            </div>

            <Button
              onClick={save}
              disabled={!valid || mutation.isPending || query.isFetching || query.isError}
              data-testid="button-save-customer-service-settings"
            >
              {mutation.isPending ? "Enregistrement…" : "Enregistrer les coordonnées"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
