import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminPaymentLimitsQueryKey,
  getGetPublicPaymentLimitsQueryKey,
  useGetAdminPaymentLimits,
  useUpdateAdminPaymentLimits,
} from "@workspace/api-client-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type LimitField =
  | "minimumDepositMinor"
  | "minimumPayoutMinor"
  | "minimumInterNetworkMinor"
  | "maximumTransferMinor"
  | "maximumPayinMinor";

type LimitDraft = Record<LimitField, string>;

const limitFields: Array<{ key: LimitField; label: string; help: string }> = [
  { key: "minimumDepositMinor", label: "Dépôt minimum", help: "Pay-in et dépôts client, en FCFA entiers." },
  { key: "minimumPayoutMinor", label: "Payout minimum", help: "Retrait international du produit SendFlow ; ce réglage ne crée pas d’API payout marchand." },
  { key: "minimumInterNetworkMinor", label: "Transfert inter-réseaux minimum", help: "Seuil du transfert inter-réseaux, en FCFA entiers." },
  { key: "maximumTransferMinor", label: "Maximum transfert", help: "Plafond technique actuel : 10 000 000 FCFA." },
  { key: "maximumPayinMinor", label: "Maximum pay-in", help: "Plafond technique actuel : 2 000 000 FCFA." },
];

function toDraft(values: Record<LimitField, number>): LimitDraft {
  return {
    minimumDepositMinor: String(values.minimumDepositMinor),
    minimumPayoutMinor: String(values.minimumPayoutMinor),
    minimumInterNetworkMinor: String(values.minimumInterNetworkMinor),
    maximumTransferMinor: String(values.maximumTransferMinor),
    maximumPayinMinor: String(values.maximumPayinMinor),
  };
}

function parseDraft(draft: LimitDraft): Record<LimitField, number> | null {
  const parsed = Object.fromEntries(
    Object.entries(draft).map(([key, value]) => [key, /^\d+$/.test(value.trim()) ? Number(value) : NaN]),
  ) as Record<LimitField, number>;
  return Object.values(parsed).every(Number.isSafeInteger) ? parsed : null;
}

function formatFcfa(value: number) {
  return `${value.toLocaleString("fr-FR")} FCFA`;
}

export function AdminPaymentLimitsSection() {
  const queryClient = useQueryClient();
  const query = useGetAdminPaymentLimits({
    query: { queryKey: getGetAdminPaymentLimitsQueryKey(), retry: false },
  });
  const mutation = useUpdateAdminPaymentLimits();
  const [draft, setDraft] = useState<LimitDraft | null>(null);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const values = draft ? parseDraft(draft) : null;
  const valid = Boolean(
    values
      && values.minimumDepositMinor >= 200
      && values.minimumDepositMinor <= values.maximumPayinMinor
      && values.minimumDepositMinor <= values.maximumTransferMinor
      && values.minimumPayoutMinor >= 200
      && values.minimumPayoutMinor <= 2_000_000
      && values.minimumPayoutMinor <= values.maximumTransferMinor
      && values.minimumInterNetworkMinor >= 1
      && values.minimumInterNetworkMinor <= values.maximumTransferMinor
      && values.maximumTransferMinor <= 10_000_000
      && values.maximumPayinMinor >= 200
      && values.maximumPayinMinor <= 2_000_000
      && reason.trim().length >= 3,
  );

  useEffect(() => {
    if (query.data) setDraft(toDraft(query.data));
  }, [query.data]);

  const save = () => {
    if (!query.data || !values || !valid) return;
    setError("");
    setFeedback("");
    mutation.mutate({
      data: {
        ...values,
        expectedVersion: query.data.version,
        reason: reason.trim(),
      },
    }, {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetAdminPaymentLimitsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetPublicPaymentLimitsQueryKey() }),
        ]);
        setReason("");
        setFeedback("Les limites ont été enregistrées et relues depuis le serveur.");
      },
      onError: () => {
        setError("La sauvegarde a échoué. Actualisez les valeurs serveur avant de réessayer.");
        void query.refetch();
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="sendflow-admin-page-intro">
        <div>
          <p className="sendflow-admin-overline">Configuration · Seuils financiers</p>
          <h2 data-testid="heading-admin-payment-limits">Limites de paiement</h2>
          <p className="sendflow-admin-subtitle">
            Réglez les seuils globaux utilisés par les validations serveur et les interfaces de paiement.
            Les montants sont exprimés en XOF/FCFA, sans décimales.
          </p>
        </div>
      </div>

      <Alert>
        <AlertTitle>La validation serveur reste la référence</AlertTitle>
        <AlertDescription>
          Les changements ne sont actifs qu’après confirmation du serveur. Les limites maximum restent bornées
          par les capacités techniques existantes ; cette page ne crée pas de nouvelle route payout marchande.
        </AlertDescription>
      </Alert>

      {feedback && (
        <Alert data-testid="status-payment-limits-feedback">
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" data-testid="error-payment-limits-update">
          <AlertTitle>Modification non confirmée</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {query.isError && (
        <Alert variant="destructive" data-testid="error-payment-limits-load">
          <AlertTitle>Réglages indisponibles</AlertTitle>
          <AlertDescription>
            Le serveur ne peut pas lire les limites. Vérifiez le déploiement de la configuration de base de données.
          </AlertDescription>
          <Button className="mt-3" variant="outline" onClick={() => { void query.refetch(); }}>Réessayer</Button>
        </Alert>
      )}
      {query.isLoading && <p role="status">Chargement des limites depuis le serveur…</p>}

      {query.data && draft && (
        <Card data-testid="card-admin-payment-limits">
          <CardHeader>
            <CardTitle>Valeurs actives</CardTitle>
            <CardDescription>
              Version {query.data.version} · dernière mise à jour{" "}
              {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(query.data.updatedAt))}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              {limitFields.map(({ key, label, help }) => (
                <div className="space-y-2" key={key}>
                  <Label htmlFor={`payment-limit-${key}`}>{label}</Label>
                  <Input
                    id={`payment-limit-${key}`}
                    type="number"
                    inputMode="numeric"
                    min={key === "minimumInterNetworkMinor" ? 1 : 200}
                    step={1}
                    value={draft[key]}
                    onChange={(event) => {
                      setDraft((current) => current ? { ...current, [key]: event.target.value } : current);
                      setFeedback("");
                    }}
                    aria-describedby={`payment-limit-help-${key}`}
                    data-testid={`input-payment-limit-${key}`}
                  />
                  <p className="text-sm text-muted-foreground" id={`payment-limit-help-${key}`}>{help}</p>
                  {values && <p className="text-xs text-muted-foreground">Actif : {formatFcfa(values[key])}</p>}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-limits-reason">Motif d’audit</Label>
              <Textarea
                id="payment-limits-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={3}
                maxLength={500}
                placeholder="Expliquez pourquoi ces seuils sont modifiés."
                data-testid="input-payment-limits-reason"
              />
            </div>
            {values && !valid && (
              <p className="text-sm text-destructive" role="alert">
                Vérifiez les entiers FCFA, les relations entre minimum et maximum, et le motif d’audit.
              </p>
            )}
            <Button
              onClick={save}
              disabled={!valid || mutation.isPending || query.isFetching || query.isError}
              data-testid="button-save-payment-limits"
            >
              {mutation.isPending ? "Enregistrement…" : "Enregistrer les limites"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
