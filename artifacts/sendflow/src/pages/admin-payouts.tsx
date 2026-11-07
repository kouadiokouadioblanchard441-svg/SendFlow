import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  getGetAdminAccessStatusQueryKey,
  getGetAdminPayoutQueryKey,
  getListAdminPayoutsQueryKey,
  useGetAdminAccessStatus,
  useGetAdminPayout,
  useListAdminPayouts,
  useRejectAdminPayout,
} from '@workspace/api-client-react';
import type { AdminPayoutRequest, PayoutStatus } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { getSafeApiErrorCopy } from '@/lib/safe-api-error';

const payoutStatuses: Array<{ value: PayoutStatus; label: string }> = [
  { value: 'created', label: 'Créé' },
  { value: 'validated', label: 'Validé' },
  { value: 'funds_reserved', label: 'Fonds réservés' },
  { value: 'submitted', label: 'Transmis' },
  { value: 'processing', label: 'En traitement' },
  { value: 'succeeded', label: 'Réussi' },
  { value: 'rejected', label: 'Rejeté' },
  { value: 'failed', label: 'Échoué' },
  { value: 'uncertain', label: 'À confirmer' },
  { value: 'cancelled', label: 'Annulé' },
];

function statusLabel(status: string) {
  return payoutStatuses.find((item) => item.value === status)?.label ?? status;
}

function statusTone(status: string) {
  if (status === 'succeeded') return 'sendflow-admin-status-succeeded';
  if (status === 'failed' || status === 'rejected' || status === 'cancelled') return 'sendflow-admin-status-failed';
  if (status === 'uncertain' || status === 'funds_reserved') return 'sendflow-admin-status-pending';
  return 'sendflow-admin-status-neutral';
}

function formatMoney(minor: number | null | undefined, currency = 'XOF') {
  if (minor === null || minor === undefined) return '—';
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
  return `${formatted} ${currency === 'XOF' ? 'FCFA' : currency}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function PayoutStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`sendflow-payout-status ${statusTone(status)}`} variant="outline">
      <span className="sendflow-payout-status-dot" aria-hidden="true" />
      {statusLabel(status)}
    </Badge>
  );
}

function DetailValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="sendflow-payout-detail-value">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function PayoutDetail({ payout }: { payout: AdminPayoutRequest }) {
  return (
    <div className="space-y-6" data-testid={`content-admin-payout-detail-${payout.id}`}>
      <div className="sendflow-payout-detail-hero">
        <div className="sendflow-payout-detail-icon"><ArrowUpRight className="size-5" /></div>
        <div className="min-w-0">
          <PayoutStatusBadge status={payout.status} />
          <h3>{formatMoney(payout.amountMinor, payout.currency)}</h3>
          <p>{payout.reference}</p>
        </div>
      </div>

      <section className="sendflow-payout-detail-section" aria-label="Détails du versement">
        <h4>Montants et frais</h4>
        <div className="sendflow-payout-detail-grid">
          <DetailValue label="Montant demandé">{formatMoney(payout.amountMinor, payout.currency)}</DetailValue>
          <DetailValue label="Frais SendFlow">{formatMoney(payout.feeMinor, payout.currency)}</DetailValue>
          <DetailValue label="Débit total">{formatMoney(payout.totalDebitMinor, payout.currency)}</DetailValue>
          <DetailValue label="Bénéficiaire reçoit">{formatMoney(payout.beneficiaryAmountMinor, payout.currency)}</DetailValue>
          <DetailValue label="Frais payés par">{payout.feePayer === 'merchant' ? 'Marchand' : 'Bénéficiaire'}</DetailValue>
        </div>
      </section>

      <section className="sendflow-payout-detail-section" aria-label="Bénéficiaire et marchand">
        <h4>Parties</h4>
        <div className="sendflow-payout-detail-grid">
          <DetailValue label="Bénéficiaire">{payout.beneficiary.name || 'Nom non renseigné'}</DetailValue>
          <DetailValue label="Téléphone masqué">•••• {payout.beneficiary.phoneLast4}</DetailValue>
          <DetailValue label="Compte marchand">{payout.merchantUserId}</DetailValue>
          <DetailValue label="Référence marchand">{payout.merchantReference || 'Non renseignée'}</DetailValue>
          <DetailValue label="Pays / opérateur">{payout.countryCode.toUpperCase()} · {payout.operatorId}</DetailValue>
        </div>
      </section>

      <section className="sendflow-payout-detail-section">
        <h4>Chronologie d’audit</h4>
        {payout.timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun événement de chronologie n’est disponible.</p>
        ) : (
          <ol className="sendflow-payout-timeline">
            {payout.timeline.map((event, index) => (
              <li key={`${event.createdAt}-${index}`} data-testid={`timeline-payout-event-${index}`}>
                <span className="sendflow-payout-timeline-marker"><Clock3 className="size-3.5" /></span>
                <div>
                  <strong>{statusLabel(event.toStatus)}</strong>
                  <p>{event.fromStatus ? `${statusLabel(event.fromStatus)} → ` : ''}{statusLabel(event.toStatus)}</p>
                  <small>{event.actorType} · {event.reasonCode || 'Motif non renseigné'}</small>
                  <time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      <div className="sendflow-payout-dates">
        <span>Créé le {formatDate(payout.createdAt)}</span>
        <span>Mis à jour le {formatDate(payout.updatedAt)}</span>
        {payout.submittedAt && <span>Transmis le {formatDate(payout.submittedAt)}</span>}
        {payout.completedAt && <span>Terminé le {formatDate(payout.completedAt)}</span>}
        {payout.failureCode && <span>Code d’échec : {payout.failureCode}</span>}
      </div>
    </div>
  );
}

export default function AdminPayoutsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'all' | PayoutStatus>('all');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
  const [selectedId, setSelectedId] = useState('');
  const [rejectTarget, setRejectTarget] = useState<AdminPayoutRequest | null>(null);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [mutationError, setMutationError] = useState('');
  const access = useGetAdminAccessStatus({
    query: { queryKey: getGetAdminAccessStatusQueryKey(), staleTime: 15_000 },
  });
  const canMutate = access.data?.canMutate === true;
  const params = useMemo(
    () => ({ limit: 50, ...(cursor ? { cursor } : {}), ...(status !== 'all' ? { status } : {}) }),
    [cursor, status],
  );
  const listQuery = useListAdminPayouts(params);
  const detailQuery = useGetAdminPayout(selectedId, {
    query: { enabled: Boolean(selectedId), queryKey: getGetAdminPayoutQueryKey(selectedId) },
  });
  const rejectMutation = useRejectAdminPayout();
  const payouts = listQuery.data?.items ?? [];
  const filteredPayouts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return payouts;
    return payouts.filter((payout) => [
      payout.reference,
      payout.merchantReference ?? '',
      payout.merchantUserId,
      payout.beneficiary.name ?? '',
      payout.beneficiary.phoneLast4,
    ].some((value) => value.toLowerCase().includes(needle)));
  }, [payouts, search]);

  const openReject = (payout: AdminPayoutRequest) => {
    setMutationError('');
    setFeedback('');
    setReason('');
    setRejectTarget(payout);
  };

  const rejectPayout = () => {
    if (!rejectTarget || reason.trim().length < 3 || reason.trim().length > 500) return;
    const payoutId = rejectTarget.id;
    const rejectedReference = rejectTarget.reference;
    setMutationError('');
    setFeedback('');
    rejectMutation.mutate(
      { payoutId, data: { reason: reason.trim() } },
      {
        onSuccess: async (updated) => {
          queryClient.setQueryData(getGetAdminPayoutQueryKey(payoutId), updated);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: getListAdminPayoutsQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getGetAdminPayoutQueryKey(payoutId) }),
          ]);
          setRejectTarget(null);
          setReason('');
          setFeedback(`La demande ${rejectedReference} a été rejetée. Le détail a été actualisé depuis le serveur.`);
        },
        onError: (error) => setMutationError(getSafeApiErrorCopy(error).message),
      },
    );
  };

  const canReject = (payout: AdminPayoutRequest) =>
    payout.status === 'funds_reserved' && payout.reservationState === 'active' && payout.submittedAt === null;

  const moveNext = () => {
    if (!listQuery.data?.nextCursor) return;
    setCursorHistory((history) => [...history, cursor]);
    setCursor(listQuery.data.nextCursor);
  };

  const movePrevious = () => {
    if (cursorHistory.length === 0) return;
    setCursor(cursorHistory[cursorHistory.length - 1]);
    setCursorHistory((history) => history.slice(0, -1));
  };

  return (
    <div className="sendflow-payout-page" data-testid="content-admin-payouts">
      <div className="sendflow-admin-page-intro sendflow-payout-intro">
        <div>
          <p className="sendflow-admin-overline">Contrôle des mouvements</p>
          <h2 data-testid="heading-admin-payouts">Demandes de versement</h2>
          <p className="sendflow-admin-subtitle">
            Examinez les demandes marchands, les réservations et leur chronologie. Les informations de bénéficiaire restent masquées.
          </p>
        </div>
        <div className="sendflow-admin-readonly-chip"><ShieldCheck className="size-4" /> Traçabilité active</div>
      </div>

      <Alert className="sendflow-payout-blocked-alert" data-testid="alert-payout-execution-blocked">
        <AlertTriangle className="size-4" />
        <AlertTitle>Exécution de nouveaux versements bloquée</AlertTitle>
        <AlertDescription>
          Le service de versement SendFlow n’est pas activé. Cette interface ne peut ni transmettre ni confirmer un versement.
          Aucun statut de réussite ne peut être forcé depuis l’administration.
        </AlertDescription>
      </Alert>

      {feedback && (
        <Alert data-testid="alert-admin-payout-success">
          <AlertTitle>Modification confirmée</AlertTitle>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}
      {mutationError && (
        <Alert variant="destructive" data-testid="alert-admin-payout-error">
          <AlertTitle>Rejet non confirmé</AlertTitle>
          <AlertDescription>{mutationError}</AlertDescription>
        </Alert>
      )}

      <Card className="sendflow-payout-list-card">
        <CardHeader className="sendflow-payout-list-header">
          <div>
            <CardTitle>Registre des demandes</CardTitle>
            <CardDescription>Les montants sont affichés tels que renvoyés par le serveur.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void listQuery.refetch()} disabled={listQuery.isFetching} data-testid="button-refresh-admin-payouts">
            <RefreshCw className={`mr-2 size-4 ${listQuery.isFetching ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="sendflow-payout-filters">
            <label className="sendflow-payout-search">
              <Search className="size-4" aria-hidden="true" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Référence, marchand ou bénéficiaire"
                aria-label="Rechercher dans les versements"
                data-testid="input-search-admin-payouts"
              />
            </label>
            <Select value={status} onValueChange={(value) => {
              setStatus(value as 'all' | PayoutStatus);
              setCursor(undefined);
              setCursorHistory([]);
            }}>
              <SelectTrigger className="sendflow-payout-status-filter" data-testid="select-filter-admin-payout-status">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {payoutStatuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {listQuery.isLoading && (
            <div className="space-y-3" data-testid="loading-admin-payouts">
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-[62px] w-full rounded-lg" />)}
            </div>
          )}
          {listQuery.isError && (
            <Alert variant="destructive" data-testid="error-admin-payouts-load">
              <AlertTitle>Registre indisponible</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span>Impossible de charger les demandes de versement autorisées pour cette session.</span>
                <Button type="button" size="sm" variant="outline" onClick={() => void listQuery.refetch()} data-testid="button-retry-admin-payouts">Réessayer</Button>
              </AlertDescription>
            </Alert>
          )}
          {!listQuery.isLoading && !listQuery.isError && filteredPayouts.length === 0 && (
            <div className="sendflow-payout-empty" data-testid="empty-admin-payouts">
              <span className="sendflow-payout-empty-mark"><ArrowDownLeft className="size-5" /></span>
              <strong>{search ? 'Aucune demande correspondante' : 'Aucune demande sur cette page'}</strong>
              <p>{search ? 'Vérifiez la référence ou retirez le filtre de recherche.' : 'Les demandes réelles apparaîtront ici dès que le serveur en renverra.'}</p>
            </div>
          )}
          {!listQuery.isLoading && !listQuery.isError && filteredPayouts.length > 0 && (
            <div className="sendflow-payout-table-wrap">
              <Table className="sendflow-payout-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence / bénéficiaire</TableHead>
                    <TableHead>Marchand</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead>Créée</TableHead>
                    <TableHead className="text-right">Contrôle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayouts.map((payout) => (
                    <TableRow key={payout.id} data-testid={`row-admin-payout-${payout.id}`}>
                      <TableCell>
                        <div className="sendflow-payout-reference">
                          <strong>{payout.reference}</strong>
                          <span>{payout.beneficiary.name || 'Bénéficiaire sans nom'} · •••• {payout.beneficiary.phoneLast4}</span>
                          <small>{payout.countryCode.toUpperCase()} · {payout.operatorId}</small>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="sendflow-payout-merchant">
                          <strong>{payout.merchantReference || 'Référence absente'}</strong>
                          <span>{payout.merchantUserId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="sendflow-payout-amount">
                          <strong>{formatMoney(payout.amountMinor, payout.currency)}</strong>
                          <span>Débit {formatMoney(payout.totalDebitMinor, payout.currency)}</span>
                        </div>
                      </TableCell>
                      <TableCell><PayoutStatusBadge status={payout.status} /></TableCell>
                      <TableCell className="sendflow-payout-date">{formatDate(payout.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="sendflow-payout-row-actions">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedId(payout.id)} data-testid={`button-view-admin-payout-${payout.id}`}>
                            <Eye className="mr-1.5 size-4" /> Détail
                          </Button>
                          {canReject(payout) && (
                            <Button type="button" variant="outline" size="sm" disabled={!canMutate} onClick={() => openReject(payout)} data-testid={`button-reject-admin-payout-${payout.id}`}>
                              <X className="mr-1 size-3.5" /> Rejeter
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="sendflow-payout-pager">
            <span>{listQuery.data?.items.length ?? 0} demandes chargées · page par curseur</span>
            <div>
              <Button type="button" variant="outline" size="sm" onClick={movePrevious} disabled={cursorHistory.length === 0 || listQuery.isFetching} data-testid="button-payout-previous-page">Précédent</Button>
              <Button type="button" variant="outline" size="sm" onClick={moveNext} disabled={!listQuery.data?.nextCursor || listQuery.isFetching} data-testid="button-payout-next-page">Suivant</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(''); }}>
        <DialogContent className="sendflow-payout-detail-dialog" data-testid="dialog-admin-payout-detail">
          <DialogHeader>
            <DialogTitle>Détail de la demande</DialogTitle>
            <DialogDescription>Lecture du registre serveur · identifiant de demande : {selectedId}</DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading && <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-48" /><Skeleton className="h-32" /></div>}
          {detailQuery.isError && (
            <Alert variant="destructive" data-testid="error-admin-payout-detail">
              <AlertTitle>Détail indisponible</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span>La demande n’a pas pu être relue depuis le serveur.</span>
                <Button type="button" size="sm" variant="outline" onClick={() => void detailQuery.refetch()} data-testid="button-retry-admin-payout-detail">Réessayer</Button>
              </AlertDescription>
            </Alert>
          )}
          {detailQuery.data && <PayoutDetail payout={detailQuery.data} />}
          {detailQuery.data && canReject(detailQuery.data) && (
            <DialogFooter>
              <Button type="button" variant="destructive" disabled={!canMutate} onClick={() => openReject(detailQuery.data)} data-testid="button-reject-payout-from-detail">
                Rejeter la demande
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => { if (!open && !rejectMutation.isPending) setRejectTarget(null); }}>
        <DialogContent data-testid="dialog-reject-admin-payout">
          <DialogHeader>
            <DialogTitle>Rejeter cette demande</DialogTitle>
            <DialogDescription>
              {rejectTarget?.reference} — action permise uniquement avant transmission, lorsque les fonds sont réservés.
              Le motif sera conservé dans la chronologie d’audit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="admin-payout-reject-reason">Motif obligatoire</Label>
            <Textarea
              id="admin-payout-reject-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={3}
              maxLength={500}
              placeholder="Expliquez la raison du rejet."
              data-testid="input-admin-payout-reject-reason"
            />
            <p className="text-xs text-muted-foreground">{reason.trim().length}/500 · minimum 3 caractères</p>
          </div>
          {mutationError && <Alert variant="destructive"><AlertTitle>Rejet non confirmé</AlertTitle><AlertDescription>{mutationError}</AlertDescription></Alert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectTarget(null)} disabled={rejectMutation.isPending} data-testid="button-cancel-admin-payout-reject">Annuler</Button>
            <Button type="button" variant="destructive" onClick={rejectPayout} disabled={!canMutate || reason.trim().length < 3 || rejectMutation.isPending} data-testid="button-confirm-admin-payout-reject">
              {rejectMutation.isPending ? 'Rejet en cours…' : 'Confirmer le rejet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
