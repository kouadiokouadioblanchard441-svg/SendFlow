import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CircleAlert, Info, RefreshCw, ShieldBan, ShieldOff } from 'lucide-react';
import {
  getListAdminIpBlocksQueryKey,
  useCreateAdminIpBlock,
  useListAdminIpBlocks,
  useRevokeAdminIpBlock,
} from '@workspace/api-client-react';
import type { IpBlock } from '@workspace/api-client-react';
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
  if (IPV4.test(v)) return true;
  if (!v.includes(':') || v.length > 45 || !/^[0-9a-fA-F:.]+$/.test(v)) return false;
  if ((v.match(/::/g) ?? []).length > 1) return false;
  return true;
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
  if (status === 409) return serverMsg ?? 'Cette entrée a changé entre-temps. Actualisez la liste avant de réessayer.';
  if (status === 400 || status === 422) return serverMsg ?? 'Adresse refusée par le serveur (format invalide, votre propre IP ou infrastructure locale).';
  if (status === 503) return 'Service temporairement indisponible.';
  return serverMsg ?? 'La requête a échoué. Réessayez.';
}

function fmt(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

export default function AdminIpBlocklist() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const query = useListAdminIpBlocks({ page }, { query: { queryKey: getListAdminIpBlocksQueryKey({ page }), refetchInterval: 30_000 } });
  const createBlock = useCreateAdminIpBlock();
  const revokeBlock = useRevokeAdminIpBlock();

  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [revokeTarget, setRevokeTarget] = useState<IpBlock | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListAdminIpBlocksQueryKey() });
  const data = query.data;
  const items = data?.items ?? [];
  const accessDisabled = [401, 403].includes(errStatus(query.error) ?? 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!looksLikeIp(ip)) return setFormError('Saisissez une adresse IPv4 ou IPv6 valide.');
    if (reason.trim().length < 3) return setFormError('Le motif est obligatoire (3 caractères minimum).');
    setFormError(null);
    setConfirmOpen(true);
  };

  const confirmBlock = () => {
    createBlock.mutate(
      { data: { ipAddress: ip.trim(), reason: reason.trim() } },
      {
        onSuccess: (block) => {
          setFeedback(`Adresse ${block.ipAddress} bloquée.`);
          setIp('');
          setReason('');
          setConfirmOpen(false);
          setPage(1);
          void invalidate();
        },
        onError: (err) => {
          setConfirmOpen(false);
          setFormError(errMessage(err));
        },
      },
    );
  };

  const confirmRevoke = () => {
    if (!revokeTarget) return;
    if (revokeReason.trim().length < 3) return setRevokeError('Le motif de révocation est obligatoire (3 caractères minimum).');
    revokeBlock.mutate(
      { id: revokeTarget.id, data: { expectedVersion: revokeTarget.version, reason: revokeReason.trim() } },
      {
        onSuccess: (block) => {
          setFeedback(`Blocage de ${block.ipAddress} révoqué.`);
          setRevokeTarget(null);
          setRevokeReason('');
          void invalidate();
        },
        onError: (err) => {
          setRevokeError(errMessage(err));
          if (errStatus(err) === 409) void invalidate();
        },
      },
    );
  };

  return (
    <div className="space-y-6" data-testid="page-admin-ip-blocklist">
      <div className="sendflow-admin-page-intro">
        <div>
          <p className="sendflow-admin-overline">Contrôle d’accès réseau</p>
          <h2 data-testid="heading-admin-ip-blocklist">Adresses IP bloquées</h2>
          <p className="sendflow-admin-subtitle">Blocage permanent jusqu’à une révocation explicite et auditée.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching} data-testid="button-refresh-ip-blocklist">
          <RefreshCw className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`} /> Actualiser
        </Button>
      </div>

      <Alert data-testid="text-ip-block-explainer">
        <Info className="size-4" />
        <AlertTitle>Ce que fait un blocage IP</AlertTitle>
        <AlertDescription className="space-y-1 text-sm">
          <p>Un blocage vise une adresse réseau, pas une personne : tous les utilisateurs partageant cette IP (NAT d’opérateur mobile, entreprise, Wi-Fi public) seront bloqués, et une personne peut changer d’IP.</p>
          <p>Il s’applique à toutes les futures requêtes HTTP atteignant le serveur d’origine. Les ressources déjà mises en cache (navigateur, CDN) ne peuvent pas être révoquées.</p>
          <p>La couverture au niveau de l’hébergement (Plesk ou pare-feu) n’est pas encore raccordée : seule l’application applique ce blocage.</p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Bloquer une adresse</CardTitle>
          <CardDescription>
            IP observée par le serveur pour votre session :{' '}
            <code className="font-mono" data-testid="text-requester-ip">{data?.requesterIp ?? 'inconnue'}</code>. Le serveur refuse de bloquer votre propre IP et l’infrastructure locale, et normalise l’adresse saisie.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] md:items-end" data-testid="form-ip-block">
            <div className="space-y-1.5">
              <Label htmlFor="ip-block-address">Adresse IPv4 ou IPv6</Label>
              <Input id="ip-block-address" className="font-mono" value={ip} maxLength={45} onChange={(e) => setIp(e.target.value)} placeholder="203.0.113.47 ou 2001:db8::1" data-testid="input-ip-block-address" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ip-block-reason">Motif (obligatoire)</Label>
              <Input id="ip-block-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="Ex. tentatives répétées de connexion frauduleuse" data-testid="input-ip-block-reason" />
            </div>
            <Button type="submit" variant="destructive" disabled={createBlock.isPending || accessDisabled} data-testid="button-submit-ip-block">
              <ShieldBan className="size-4" /> Bloquer
            </Button>
          </form>
          {formError && <p className="mt-3 text-sm text-destructive" data-testid="error-ip-block-form">{formError}</p>}
          {feedback && <p className="mt-3 text-sm text-muted-foreground" data-testid="status-ip-block-feedback">{feedback}</p>}
        </CardContent>
      </Card>

      <Card className="sendflow-admin-list-card">
        <CardContent className="p-0">
          {query.isLoading && (
            <div className="sendflow-admin-table-skeleton" data-testid="loading-ip-blocklist">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          )}
          {query.isError && (
            <div className="p-5">
              <Alert variant="destructive" data-testid={`alert-ip-blocklist-error-${errStatus(query.error) ?? 'general'}`}>
                <CircleAlert className="size-4" />
                <AlertTitle>{accessDisabled ? 'Accès administrateur indisponible' : 'Impossible de charger la liste'}</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-3">
                  <span>{errMessage(query.error)}</span>
                  <Button variant="outline" size="sm" onClick={() => void query.refetch()} data-testid="button-retry-ip-blocklist">Réessayer</Button>
                </AlertDescription>
              </Alert>
            </div>
          )}
          {!query.isLoading && !query.isError && items.length === 0 && (
            <div className="sendflow-admin-empty" data-testid="empty-ip-blocklist">
              <div className="sendflow-admin-empty-icon"><ShieldOff className="size-5" /></div>
              <p className="font-semibold">Aucune adresse bloquée</p>
              <p className="text-sm">{page > 1 ? 'Cette page est vide.' : 'Les blocages apparaîtront ici avec leur historique d’audit.'}</p>
            </div>
          )}
          {!query.isLoading && !query.isError && items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Adresse</TableHead><TableHead>État</TableHead><TableHead>Motif</TableHead><TableHead>Bloquée</TableHead><TableHead>Révoquée</TableHead><TableHead className="text-right">Action</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {items.map((b) => {
                  const active = !b.revokedAt;
                  return (
                    <TableRow key={b.id} data-testid={`row-ip-block-${b.id}`} className={active ? '' : 'opacity-70'}>
                      <TableCell className="font-mono font-semibold" data-testid={`text-ip-block-address-${b.id}`}>{b.ipAddress}</TableCell>
                      <TableCell>
                        <Badge variant={active ? 'destructive' : 'outline'} data-testid={`status-ip-block-${b.id}`}>{active ? 'Actif' : 'Révoqué'}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal text-sm" data-testid={`text-ip-block-reason-${b.id}`}>{b.reason}</TableCell>
                      <TableCell className="text-sm"><div>{fmt(b.blockedAt)}</div><small className="text-muted-foreground">par {b.blockedBy}</small></TableCell>
                      <TableCell className="text-sm">{b.revokedAt ? <><div>{fmt(b.revokedAt)}</div><small className="text-muted-foreground">par {b.revokedBy ?? '—'}</small></> : '—'}</TableCell>
                      <TableCell className="text-right">
                        {active && (
                          <Button variant="outline" size="sm" onClick={() => { setRevokeTarget(b); setRevokeReason(''); setRevokeError(null); }} data-testid={`button-revoke-ip-block-${b.id}`}>
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
          {!query.isError && (data || page > 1) && (
            <div className="sendflow-admin-pager" data-testid="pagination-ip-blocklist">
              <span>Page {data?.page ?? page}{query.isFetching && !query.isLoading ? ' · actualisation' : ' · actualisée toutes les 30 s'}</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" aria-label="Page précédente" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="button-ip-blocklist-previous"><ChevronLeft className="size-4" /></Button>
                <Button variant="ghost" size="icon" aria-label="Page suivante" disabled={!data?.hasMore} onClick={() => setPage((p) => p + 1)} data-testid="button-ip-blocklist-next"><ChevronRight className="size-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !createBlock.isPending && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquer {ip.trim()} de façon permanente ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les futures requêtes provenant de cette adresse seront refusées, y compris pour les autres utilisateurs partageant la même IP. Le blocage reste actif jusqu’à une révocation auditée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={createBlock.isPending} data-testid="button-cancel-ip-block">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmBlock(); }} disabled={createBlock.isPending} data-testid="button-confirm-ip-block">
              {createBlock.isPending ? 'Blocage…' : 'Confirmer le blocage'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!revokeTarget} onOpenChange={(o) => { if (!o && !revokeBlock.isPending) setRevokeTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Révoquer le blocage de {revokeTarget?.ipAddress}</DialogTitle>
            <DialogDescription>Les requêtes futures de cette adresse seront de nouveau acceptées. Cette action est enregistrée dans l’audit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ip-revoke-reason">Motif de révocation (obligatoire)</Label>
            <Textarea id="ip-revoke-reason" value={revokeReason} maxLength={500} onChange={(e) => setRevokeReason(e.target.value)} data-testid="input-ip-revoke-reason" />
          </div>
          {revokeError && <p className="text-sm text-destructive" data-testid="error-ip-revoke">{revokeError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)} disabled={revokeBlock.isPending} data-testid="button-cancel-ip-revoke">Annuler</Button>
            <Button onClick={confirmRevoke} disabled={revokeBlock.isPending} data-testid="button-confirm-ip-revoke">
              {revokeBlock.isPending ? 'Révocation…' : 'Révoquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
