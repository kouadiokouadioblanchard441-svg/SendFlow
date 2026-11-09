import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminUserQueryKey,
  useUpdateAdminUserMonthlyIncomingLimit,
} from "@workspace/api-client-react";
import type { AdminUserMonthlyIncomingPolicy } from "@workspace/api-client-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AdminUserMonthlyIncomingLimitProps = {
  userId: string;
  policy: AdminUserMonthlyIncomingPolicy;
  canMutate: boolean;
};

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export function AdminUserMonthlyIncomingLimitSection({
  userId,
  policy,
  canMutate,
}: AdminUserMonthlyIncomingLimitProps) {
  const queryClient = useQueryClient();
  const mutation = useUpdateAdminUserMonthlyIncomingLimit();
  const [limitDraft, setLimitDraft] = useState(
    policy.overrideMinor === null ? "" : String(policy.overrideMinor),
  );
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLimitDraft(policy.overrideMinor === null ? "" : String(policy.overrideMinor));
  }, [policy.overrideMinor]);

  const nextLimit = useMemo(() => {
    if (limitDraft.trim() === "") return null;
    if (!/^\d+$/.test(limitDraft.trim())) return undefined;
    const value = Number(limitDraft);
    return Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647
      ? value
      : undefined;
  }, [limitDraft]);
  const changed = nextLimit !== undefined && nextLimit !== policy.overrideMinor;
  const valid = canMutate
    && nextLimit !== undefined
    && changed
    && reason.trim().length >= 10
    && confirmation === "CONFIRMER";

  const save = () => {
    if (!valid || nextLimit === undefined) return;
    setError("");
    setFeedback("");
    mutation.mutate({
      userId,
      data: {
        monthlyIncomingLimitOverrideMinor: nextLimit,
        expectedMonthlyIncomingLimitOverrideMinor: policy.overrideMinor,
        reason: reason.trim(),
        confirmation: "CONFIRMER",
      },
    }, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetAdminUserQueryKey(userId) });
        setReason("");
        setConfirmation("");
        setFeedback(nextLimit === null
          ? "Le profil utilise maintenant le plafond global selon le statut d’identité."
          : "Le plafond mensuel personnalisé a été enregistré.");
      },
      onError: async () => {
        setError("La modification n’a pas été confirmée. Actualisez la fiche avant de réessayer.");
        await queryClient.invalidateQueries({ queryKey: getGetAdminUserQueryKey(userId) });
      },
    });
  };

  return (
    <Card className="sendflow-admin-detail-card" data-testid="card-admin-user-monthly-incoming-limit">
      <CardHeader>
        <CardTitle>Plafond mensuel des encaissements et des sorties</CardTitle>
        <CardDescription>
          Ce même plafond s’applique séparément aux encaissements et aux sorties depuis le début du mois (UTC).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-muted/20 p-4">
            <span className="text-sm text-muted-foreground">Identité</span>
            <strong className="mt-2 block">
              {policy.identityVerified ? "Approuvée" : "Non approuvée"}
            </strong>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <span className="text-sm text-muted-foreground">Reçu ce mois-ci</span>
            <strong className="mt-2 block tabular-nums">{formatFcfa(policy.receivedMinor)}</strong>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <span className="text-sm text-muted-foreground">Encaissements en cours réservés</span>
            <strong className="mt-2 block tabular-nums">{formatFcfa(policy.pendingReservedMinor)}</strong>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <span className="text-sm text-muted-foreground">Sorties confirmées</span>
            <strong className="mt-2 block tabular-nums">{formatFcfa(policy.outgoingSentMinor)}</strong>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <span className="text-sm text-muted-foreground">Sorties en cours réservées</span>
            <strong className="mt-2 block tabular-nums">{formatFcfa(policy.outgoingPendingMinor)}</strong>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <span className="text-sm text-muted-foreground">Sorties restantes ce mois-ci</span>
            <strong className="mt-2 block tabular-nums">{formatFcfa(policy.outgoingRemainingMinor)}</strong>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <span className="text-sm text-muted-foreground">Plafond actif</span>
            <strong className="mt-2 block tabular-nums">{formatFcfa(policy.effectiveLimitMinor)}</strong>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <span className="text-sm text-muted-foreground">Plafonds globaux</span>
            <strong className="mt-2 block tabular-nums">
              {formatFcfa(policy.unverifiedLimitMinor)} / {formatFcfa(policy.verifiedLimitMinor)}
            </strong>
            <small className="text-muted-foreground">Sans identité / identité approuvée</small>
          </div>
        </div>

        {feedback && (
          <Alert data-testid="status-admin-user-monthly-limit">
            <AlertDescription>{feedback}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive" data-testid="error-admin-user-monthly-limit">
            <AlertTitle>Modification non confirmée</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`user-monthly-incoming-limit-${userId}`}>Plafond personnalisé des deux flux (FCFA)</Label>
            <Input
              id={`user-monthly-incoming-limit-${userId}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={2_147_483_647}
              step={1}
              value={limitDraft}
              placeholder="Plafond global selon l’identité"
              disabled={!canMutate || mutation.isPending}
              onChange={(event) => {
                setLimitDraft(event.target.value);
                setFeedback("");
              }}
              data-testid="input-admin-user-monthly-incoming-limit"
            />
            <p className="text-sm text-muted-foreground">
              Laisser vide rétablit le plafond global lié au statut d’identité. Une valeur personnalisée remplace les deux plafonds globaux pour ce compte.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`user-monthly-incoming-reason-${userId}`}>Motif d’audit</Label>
            <Textarea
              id={`user-monthly-incoming-reason-${userId}`}
              value={reason}
              minLength={10}
              maxLength={500}
              disabled={!canMutate || mutation.isPending}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Expliquez la raison de cette modification."
              data-testid="input-admin-user-monthly-incoming-reason"
            />
          </div>
        </div>
        {canMutate && (
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor={`user-monthly-incoming-confirm-${userId}`}>Confirmation</Label>
              <Input
                id={`user-monthly-incoming-confirm-${userId}`}
                value={confirmation}
                disabled={mutation.isPending}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Saisissez CONFIRMER"
                data-testid="input-admin-user-monthly-incoming-confirm"
              />
            </div>
            <Button
              onClick={save}
              disabled={!valid || mutation.isPending}
              data-testid="button-save-admin-user-monthly-incoming-limit"
            >
              {mutation.isPending ? "Enregistrement…" : "Enregistrer le plafond"}
            </Button>
          </div>
        )}
        {!canMutate && (
          <p className="text-sm text-muted-foreground" role="status">
            Votre accès administrateur est en lecture seule.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
