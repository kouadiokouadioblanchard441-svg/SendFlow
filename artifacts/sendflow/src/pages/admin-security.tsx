import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListAdminSessionsQueryKey,
  useListAdminSessions,
  useRevokeAdminSession,
  useRevokeAllAdminSessions,
} from "@workspace/api-client-react";
import { Clock3, MonitorX, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(value: unknown) {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "Date indisponible"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function AdminSecurityPage() {
  const queryClient = useQueryClient();
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [message, setMessage] = useState("");
  const sessionsQuery = useListAdminSessions({
    query: {
      queryKey: getListAdminSessionsQueryKey(),
      retry: false,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    },
  });
  const revokeOne = useRevokeAdminSession({
    mutation: {
      onSuccess: async (_data, variables) => {
        setMessage("La session a été révoquée.");
        await queryClient.invalidateQueries({ queryKey: getListAdminSessionsQueryKey() });
        if (sessionsQuery.data?.some((session) => session.id === variables.sessionId && session.isCurrent)) {
          window.location.reload();
        }
      },
      onError: () => setMessage("La révocation n’a pas abouti. Réessayez."),
    },
  });
  const revokeAll = useRevokeAllAdminSessions({
    mutation: {
      onSuccess: () => window.location.reload(),
      onError: () => setMessage("La révocation globale n’a pas abouti. Réessayez."),
    },
  });

  const sessions = sessionsQuery.data ?? [];

  return (
    <div className="space-y-5" data-testid="admin-security-sessions">
      <div className="sendflow-admin-page-intro">
        <div>
          <p className="sendflow-admin-overline">Sécurité du compte</p>
          <h2>Sessions administrateur</h2>
          <p className="sendflow-admin-subtitle">
            Consultez les sessions actives et révoquez immédiatement celles que vous ne reconnaissez pas.
          </p>
        </div>
        <div className="sendflow-admin-readonly-chip"><ShieldCheck className="size-4" /> Contrôle serveur</div>
      </div>

      <Alert>
        <Clock3 className="size-4" />
        <AlertTitle>Durée des sessions</AlertTitle>
        <AlertDescription>
          Une session expire après 15 minutes sans activité confirmée et ne peut pas dépasser 8 heures.
          Le renouvellement automatique ne prolonge pas le délai d’inactivité.
        </AlertDescription>
      </Alert>

      {message && (
        <Alert role="status" data-testid="admin-security-feedback">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {sessionsQuery.isError && (
        <Alert variant="destructive" data-testid="admin-security-error">
          <AlertTitle>Sessions indisponibles</AlertTitle>
          <AlertDescription>La liste ne peut pas être chargée pour le moment.</AlertDescription>
        </Alert>
      )}

      <Card className="sendflow-admin-detail-card">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Sessions actives ({sessions.length})</CardTitle>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmRevokeAll(true)}
            disabled={sessions.length === 0 || revokeAll.isPending}
            data-testid="button-revoke-all-admin-sessions"
          >
            <MonitorX className="mr-2 size-4" />
            Révoquer toutes les sessions
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsQuery.isLoading && <p role="status">Chargement des sessions…</p>}
          {!sessionsQuery.isLoading && sessions.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune session active n’a été trouvée.</p>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
              data-testid={`admin-session-${session.id}`}
            >
              <div className="space-y-1">
                <p className="font-medium">
                  {session.isCurrent ? "Session actuelle" : "Autre session"}
                </p>
                <p className="text-sm text-muted-foreground">Créée : {formatDate(session.createdAt)}</p>
                <p className="text-sm text-muted-foreground">Dernière activité : {formatDate(session.lastActivityAt)}</p>
                <p className="text-sm text-muted-foreground">Expire après inactivité : {formatDate(session.idleExpiresAt)}</p>
                <p className="text-sm text-muted-foreground">Expiration maximale : {formatDate(session.absoluteExpiresAt)}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMessage("");
                  revokeOne.mutate({ sessionId: session.id });
                }}
                disabled={revokeOne.isPending}
                data-testid={`button-revoke-admin-session-${session.id}`}
              >
                Révoquer
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={confirmRevokeAll} onOpenChange={setConfirmRevokeAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer toutes les sessions ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action déconnecte immédiatement toutes les sessions administrateur, y compris celle-ci.
              Un nouveau code d’authentification sera demandé à la prochaine connexion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeAll.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                setConfirmRevokeAll(false);
                revokeAll.mutate();
              }}
              disabled={revokeAll.isPending}
            >
              {revokeAll.isPending ? "Révocation…" : "Révoquer les sessions"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
