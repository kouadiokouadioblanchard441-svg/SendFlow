import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Info, RefreshCw, ShieldCheck, ShieldOff, Unlock } from 'lucide-react';
import {
  getGetAdminNetworkDefenseQueryKey,
  useCreateAdminNetworkException,
  useGetAdminNetworkDefense,
  useReleaseAdminAutomaticBlock,
  useRevokeAdminNetworkException,
} from '@workspace/api-client-react';
import type { AutomaticIpBlock, NetworkException } from '@workspace/api-client-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function looksLikeIp(value: string) {
  const v = value.trim();
  if (v.includes('/')) return false;
  if (IPV4.test(v)) return true;
  if (!v.includes(':') || v.length > 45 || !/^[0-9a-fA-F:.]+$/.test(v)) return false;
  return (v.match(/::/g) ?? []).length <= 1;
}

function errStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const c = error as { status?: number; response?: { status?: number } };
  return c.status ?? c.response?.status;
}

function errMessage(error: unknown): string {
  const status = errStatus(error);
  const data = (error as { data?: { error?: unknown } } | null)?.data;
  const serverMsg = data && typeof data.error === 'string' ? data.error : null;
  if (status === 401) return 'Session administrateur requise. L’accès administrateur est peut-être désactivé côté serveur.';
  if (status === 403) return 'Accès administrateur refusé ou désactivé côté serveur.';
  if (status === 409) return serverMsg ?? 'Cette entrée a changé entre-temps. Les données ont été actualisées ; vérifiez avant de réessayer.';
  if (status === 400 || status === 422) return serverMsg ?? 'Requête refusée par le serveur (format ou motif invalide).';
  if (status === 503) return 'Service indisponible : l’accès administrateur ou la défense réseau n’est peut-être pas disponible.';
  return serverMsg ?? 'La requête a échoué. Réessayez.';
}

function fmt(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

export default function AdminNetworkDefense() {
  const queryClient = useQueryClient();
  const queryKey = getGetAdminNetworkDefenseQueryKey();
  const query = useGetAdminNetworkDefense({ query: { queryKey, refetchInterval: 30_000 } });
  const createException = useCreateAdminNetworkException();
  const revokeException = useRevokeAdminNetworkException();
  const releaseBlock = useReleaseAdminAutomaticBlock();

  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [revokeTarget, setRevokeTarget] = useState<NetworkException | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<AutomaticIpBlock | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const data = query.data;
  const unavailable = !data || query.isError;
  const anyPending = createException.isPending || revokeException.isPending || releaseBlock.isPending;
  const blocks = data?.blocks ?? [];
  const exceptions = data?.exceptions ?? [];
  const activeExceptions = exceptions.filter((e) => !e.revokedAt);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (unavailable) return;
    if (!looksLikeIp(ip)) return setFormError('Saisissez une seule adresse IPv4 ou IPv6 (les plages CIDR ne sont pas acceptées).');
    if (reason.trim().length < 3) return setFormError('Le motif est obligatoire (3 caractères minimum).');
    setFormError(null);
    setConfirmOpen(true);
  };

  const confirmCreate = () => {
    if (createException.isPending || unavailable) return;
    createException.mutate(
      { data: { ipAddress: ip.trim(), reason: reason.trim() } },
      {
        onSuccess: (ex) => {
          setFeedback(`Exception enregistrée pour ${ex.ipAddress}.`);
          setIp('');
          setReason('');
          setConfirmOpen(false);
          void invalidate();
        },
        onError: (err) => {
          setConfirmOpen(false);
          setFormError(errMessage(err));
          if (errStatus(err) === 409) void invalidate();
        },
      },
    );
  };

  const openAction = (kind: 'revoke' | 'release', target: NetworkException | AutomaticIpBlock) => {
    setActionReason('');
    setActionError(null);
    setFeedback(null);
    if (kind === 'revoke') setRevokeTarget(target as NetworkException);
    else setReleaseTarget(target as AutomaticIpBlock);
  };

  const closeAction = () => {
    if (anyPending) return;
    setRevokeTarget(null);
    setReleaseTarget(null);
  };

  const confirmAction = () => {
    if (anyPending || unavailable) return;
    if (actionReason.trim().length < 3) return setActionError('Le motif est obligatoire (3 caractères minimum).');
    const onError = (err: unknown) => {
      setActionError(errMessage(err));
      if (errStatus(err) === 409) void invalidate();
    };
    if (revokeTarget) {
      revokeException.mutate(
        { id: revokeTarget.id, data: { expectedVersion: revokeTarget.version, reason: actionReason.trim() } },
        { onSuccess: (ex) => { setFeedback(`Exception de ${ex.ipAddress} révoquée.`); setRevokeTarget(null); void invalidate(); }, onError },
      );
    } else if (releaseTarget) {
      releaseBlock.mutate(
        { id: releaseTarget.id, data: { expectedVersion: releaseTarget.version, reason: actionReason.trim() } },
        { onSuccess: (b) => { setFeedback(`Blocage automatique de ${b.ipAddress} levé.`); setReleaseTarget(null); void invalidate(); }, onError },
      );
    }
  };

  const actionTarget = revokeTarget ?? releaseTarget;

  return (
    <div className="space-y-6" data-testid="page-admin-network-defense">
      <div className="sendflow-admin-page-intro">
        <div>
          <p className="sendflow-admin-overline">Détection automatique côté serveur</p>
          <h2 data-testid="heading-admin-network-defense">Autodéfense réseau</h2>
          <p className="sendflow-admin-subtitle">Blocages définitifs jusqu’à votre levée explicite. Actualisé toutes les 30 s.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching} data-testid="button-refresh-network-defense">
          <RefreshCw className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`} /> Actualiser
        </Button>
      </div>

      {query.isError && (
        <Alert variant="destructive" data-testid={`alert-network-defense-error-${errStatus(query.error) ?? 'general'}`}>
          <CircleAlert className="size-4" />
          <AlertTitle>Données d’autodéfense indisponibles</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{errMessage(query.error)} Les actions sont désactivées.</span>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()} data-testid="button-retry-network-defense">Réessayer</Button>
          </AlertDescription>
        </Alert>
      )}

      <Alert data-testid="text-network-defense-explainer">
        <Info className="size-4" />
        <AlertTitle>Fonctionnement et limites</AlertTitle>
        <AlertDescription className="space-y-1 text-sm">
          {data ? (
            <p data-testid="text-network-defense-policy">
              Règles actuelles du serveur : plus de {data.policy.requestsPerMinute} requêtes par minute, ou {data.policy.probesPerTenMinutes} sondages de chemins de reconnaissance connus en 10 minutes, déclenchent un blocage définitif, sans expiration. Seule une levée administrative explicite et journalisée rétablit l’accès.
            </p>
          ) : (
            <p>Les règles s’afficheront dès que le serveur les aura transmises.</p>
          )}
          <p>La détection reconnaît les rafales et les sondages répétés de chemins connus. Elle ne reconnaît pas toute requête malveillante ni toutes les adresses de fournisseurs cloud.</p>
          <p>Aucun pare-feu Plesk ni WAF en périphérie n’est déployé : seule l’application applique ces blocages.</p>
          <p>Historique borné : le serveur renvoie au plus les 100 derniers blocages et les 500 dernières exceptions. Ce n’est pas une analyse exhaustive.</p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Blocages automatiques</CardTitle>
          <CardDescription>Échéances indiquées par le serveur ; l’état actif est déterminé par le serveur, pas par l’horloge de ce navigateur.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading && <div className="sendflow-admin-table-skeleton" data-testid="loading-network-blocks">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}
          {data && blocks.length === 0 && (
            <div className="sendflow-admin-empty" data-testid="empty-network-blocks">
              <div className="sendflow-admin-empty-icon"><ShieldCheck className="size-5" /></div>
              <p className="font-semibold">Aucun blocage automatique récent</p>
              <p className="text-sm">Les blocages déclenchés par la détection apparaîtront ici.</p>
            </div>
          )}
          {data && blocks.length > 0 && (
            <Table>
              <TableHeader><TableRow><TableHead>Adresse</TableHead><TableHead>Règle</TableHead><TableHead>Occurrences</TableHead><TableHead>Décision (serveur)</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {blocks.map((b) => (
                  <TableRow key={b.id} data-testid={`row-network-block-${b.id}`}>
                    <TableCell className="font-mono font-semibold" data-testid={`text-network-block-ip-${b.id}`}>{b.ipAddress}</TableCell>
                    <TableCell className="text-sm">{b.rule ?? '—'}</TableCell>
                    <TableCell className="tabular-nums" data-testid={`text-network-block-count-${b.id}`}>{b.banCount}</TableCell>
                    <TableCell className="text-sm" data-testid={`text-network-block-until-${b.id}`}>
                      {b.blockedAt ? fmt(b.blockedAt) : '—'}
                      <Badge variant={b.active ? 'destructive' : 'outline'} className="ml-2">
                        {b.active ? 'Bloqué définitivement' : b.trusted ? 'Exception active' : 'Levé'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {b.active && (
                        <Button variant="outline" size="sm" disabled={unavailable || anyPending} onClick={() => openAction('release', b)} data-testid={`button-release-network-block-${b.id}`}>
                          <Unlock className="size-4" /> Lever
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ajouter une adresse de confiance</CardTitle>
          <CardDescription>
            IP observée par le serveur pour votre session : <code className="font-mono" data-testid="text-network-requester-ip">{data?.requesterIp ?? 'inconnue'}</code>. Une adresse unique, sans plage CIDR. L’exception reste inchangée jusqu’à sa révocation explicite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] md:items-end" data-testid="form-network-exception">
            <div className="space-y-1.5">
              <Label htmlFor="network-exception-ip">Adresse IPv4 ou IPv6</Label>
              <Input id="network-exception-ip" className="font-mono" value={ip} maxLength={45} onChange={(e) => setIp(e.target.value)} placeholder="198.51.100.23" disabled={unavailable} data-testid="input-network-exception-ip" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="network-exception-reason">Motif (obligatoire)</Label>
              <Input id="network-exception-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="Ex. sonde de supervision interne" disabled={unavailable} data-testid="input-network-exception-reason" />
            </div>
            <Button type="submit" disabled={unavailable || anyPending} data-testid="button-submit-network-exception">
              <ShieldCheck className="size-4" /> Exempter
            </Button>
          </form>
          {formError && <p className="mt-3 text-sm text-destructive" data-testid="error-network-exception-form">{formError}</p>}
          {feedback && <p className="mt-3 text-sm text-muted-foreground" data-testid="status-network-defense-feedback">{feedback}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exceptions de confiance</CardTitle>
          <CardDescription>{data ? `${activeExceptions.length} active(s) sur ${exceptions.length} enregistrée(s) dans l’historique renvoyé.` : 'Historique des exceptions.'}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading && <div className="sendflow-admin-table-skeleton" data-testid="loading-network-exceptions">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}
          {data && exceptions.length === 0 && (
            <div className="sendflow-admin-empty" data-testid="empty-network-exceptions">
              <div className="sendflow-admin-empty-icon"><ShieldOff className="size-5" /></div>
              <p className="font-semibold">Aucune exception</p>
              <p className="text-sm">Toutes les adresses sont soumises à la détection automatique.</p>
            </div>
          )}
          {data && exceptions.length > 0 && (
            <Table>
              <TableHeader><TableRow><TableHead>Adresse</TableHead><TableHead>État</TableHead><TableHead>Motif</TableHead><TableHead>Créée</TableHead><TableHead>Révoquée</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {exceptions.map((ex) => {
                  const active = !ex.revokedAt;
                  return (
                    <TableRow key={ex.id} data-testid={`row-network-exception-${ex.id}`} className={active ? '' : 'opacity-70'}>
                      <TableCell className="font-mono font-semibold" data-testid={`text-network-exception-ip-${ex.id}`}>{ex.ipAddress}</TableCell>
                      <TableCell><Badge variant="outline" data-testid={`status-network-exception-${ex.id}`}>{active ? 'Active' : 'Révoquée'}</Badge></TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal text-sm">{ex.reason}</TableCell>
                      <TableCell className="text-sm"><div>{fmt(ex.createdAt)}</div><small className="text-muted-foreground">par {ex.createdBy}</small></TableCell>
                      <TableCell className="text-sm">{fmt(ex.revokedAt)}</TableCell>
                      <TableCell className="text-right">
                        {active && (
                          <Button variant="outline" size="sm" disabled={unavailable || anyPending} onClick={() => openAction('revoke', ex)} data-testid={`button-revoke-network-exception-${ex.id}`}>
                            Révoquer
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !createException.isPending && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exempter {ip.trim()} de la détection automatique ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette exception désactive uniquement la détection automatique future pour cette adresse. Elle ne lève aucun blocage existant, manuel ou automatique, et ne contourne ni l’authentification ni la vérification de signature des webhooks. Elle reste en place jusqu’à une révocation explicite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={createException.isPending} data-testid="button-cancel-network-exception">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmCreate(); }} disabled={createException.isPending || unavailable} data-testid="button-confirm-network-exception">
              {createException.isPending ? 'Enregistrement…' : 'Confirmer l’exception'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!actionTarget} onOpenChange={(o) => { if (!o) closeAction(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{revokeTarget ? `Révoquer l’exception de ${revokeTarget.ipAddress}` : `Lever le blocage automatique de ${releaseTarget?.ipAddress ?? ''}`}</DialogTitle>
            <DialogDescription>
              {revokeTarget
                ? 'Cette adresse sera de nouveau soumise à la détection automatique. Action auditée.'
                : 'Seul le blocage automatique est levé ; aucun blocage manuel n’est modifié. La détection peut de nouveau bloquer cette adresse. Action auditée.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="network-action-reason">Motif (obligatoire)</Label>
            <Textarea id="network-action-reason" value={actionReason} maxLength={500} onChange={(e) => setActionReason(e.target.value)} data-testid="input-network-action-reason" />
          </div>
          {actionError && <p className="text-sm text-destructive" data-testid="error-network-action">{actionError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={closeAction} disabled={anyPending} data-testid="button-cancel-network-action">Annuler</Button>
            <Button onClick={confirmAction} disabled={anyPending || unavailable} data-testid="button-confirm-network-action">
              {anyPending ? 'Envoi…' : revokeTarget ? 'Révoquer' : 'Lever le blocage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
