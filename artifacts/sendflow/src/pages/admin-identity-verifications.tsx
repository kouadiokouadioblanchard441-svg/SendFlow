import { useEffect, useMemo, useState } from 'react';
import { Check, Download, FileSearch, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { useGetAdminAccessStatus, getGetAdminAccessStatusQueryKey } from '@workspace/api-client-react';
import { fetchWithCsrf, resolveApiUrl } from '@workspace/api-client-react';
import { adminRoute } from '@/lib/admin-route';
import { ErrorDialog } from '@/components/error-dialog';
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
import { Textarea } from '@/components/ui/textarea';

type RequestStatus = 'pending' | 'approved' | 'rejected';
type RequestSummary = {
  id: string;
  userId: string;
  displayName: string | null;
  countryCode: string | null;
  status: RequestStatus;
  submittedAt: string;
  reviewedAt: string | null;
};
type IdentityDetail = {
  id: string;
  status: RequestStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  decisionReason: string | null;
  personalData: {
    firstName: string;
    lastName: string;
    documentType: string;
    documentNumber: string;
    birthDate: string;
    documentExpiryDate: string;
  };
  user: {
    id: string;
    displayName: string | null;
    phone: string | null;
    email: string | null;
    countryCode: string | null;
    status: string;
  };
  documents: Array<{ id: string; kind: 'front' | 'back' | 'selfie'; contentType: string; sizeBytes: number }>;
};
type ListResult = {
  items: RequestSummary[];
  page: number;
  pageSize: number;
  total: number;
  counts: Record<RequestStatus, number>;
};

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Refusée',
};

function dateLabel(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusClass(status: RequestStatus) {
  if (status === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'rejected') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error('request-failed');
  return response.json() as Promise<T>;
}

export function AdminIdentityVerificationsPage() {
  const profileUserId = useMemo(() => new URLSearchParams(window.location.search).get('userId')?.trim() ?? '', []);
  const access = useGetAdminAccessStatus({
    query: { queryKey: getGetAdminAccessStatusQueryKey(), staleTime: 15_000 },
  });
  const canMutate = access.data?.canMutate === true;
  const [status, setStatus] = useState<RequestStatus | 'all'>('pending');
  const [searchInput, setSearchInput] = useState(profileUserId);
  const [search, setSearch] = useState(profileUserId);
  const [page, setPage] = useState(1);
  const [list, setList] = useState<ListResult | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<IdentityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingPhoto, setDownloadingPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const pageSize = 20;

  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status !== 'all') query.set('status', status);
    if (profileUserId) query.set('userId', profileUserId);
    else if (search) query.set('search', search);
    void fetch(resolveApiUrl(`${adminRoute('/identity-verifications')}?${query.toString()}`), {
      credentials: 'include',
      cache: 'no-store',
    }).then(readJson<ListResult>).then((result) => {
      if (!active) return;
      setList(result);
      if (!selectedId || !result.items.some((item) => item.id === selectedId)) {
        setSelectedId(result.items[0]?.id ?? '');
      }
    }).catch(() => {
      if (active) setError('La liste des demandes ne peut pas être chargée pour le moment.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [page, pageSize, profileUserId, search, selectedId, status]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    void fetch(resolveApiUrl(adminRoute(`/identity-verifications/${encodeURIComponent(selectedId)}`)), {
      credentials: 'include',
      cache: 'no-store',
    }).then(readJson<IdentityDetail>).then((result) => {
      if (active) setDetail(result);
    }).catch(() => {
      if (active) {
        setDetail(null);
        setError('Les informations de cette demande ne sont pas disponibles.');
      }
    }).finally(() => {
      if (active) setDetailLoading(false);
    });
    return () => { active = false; };
  }, [selectedId]);

  const filteredItems = list?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((list?.total ?? 0) / pageSize));
  const documentKinds = useMemo(() => [
    { kind: 'front' as const, label: 'Pièce d’identité — recto' },
    { kind: 'back' as const, label: 'Pièce d’identité — verso' },
    { kind: 'selfie' as const, label: 'Selfie avec la pièce' },
  ], []);
  const hasCompletePhotos = Boolean(
    detail && documentKinds.every(({ kind }) => detail.documents.some((document) => document.kind === kind)),
  );

  const downloadExport = async () => {
    if (!selectedId || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(resolveApiUrl(adminRoute(`/identity-verifications/${encodeURIComponent(selectedId)}/export`)), {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('export-failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sendflow-verification-${selectedId}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Le téléchargement sécurisé n’a pas abouti. Réessayez plus tard.');
    } finally {
      setDownloading(false);
    }
  };

  const downloadPdf = async () => {
    if (!selectedId || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const response = await fetch(resolveApiUrl(adminRoute(`/identity-verifications/${encodeURIComponent(selectedId)}/pdf`)), {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('pdf-export-failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sendflow-identity-${selectedId}.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      setError('Le PDF sécurisé n’a pas pu être préparé. Réessayez plus tard.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const downloadPhoto = async (kind: 'front' | 'back' | 'selfie') => {
    if (!selectedId || downloadingPhoto) return;
    setDownloadingPhoto(kind);
    try {
      const response = await fetch(
        resolveApiUrl(adminRoute(`/identity-verifications/${encodeURIComponent(selectedId)}/documents/${kind}?download=1`)),
        { credentials: 'include', cache: 'no-store' },
      );
      if (!response.ok) throw new Error('photo-download-failed');
      const blob = await response.blob();
      const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1] || 'img';
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sendflow-identity-${kind}-${selectedId}.${extension}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      setError('La photo sécurisée n’a pas pu être téléchargée. Réessayez plus tard.');
    } finally {
      setDownloadingPhoto(null);
    }
  };

  const decide = async () => {
    if (!selectedId || !action || saving || !canMutate) return;
    if (action === 'reject' && reason.trim().length < 10) {
      setError('Ajoutez un motif clair avant de refuser la demande.');
      return;
    }
    setSaving(true);
    try {
      await readJson(await fetchWithCsrf(
        resolveApiUrl(adminRoute(`/identity-verifications/${encodeURIComponent(selectedId)}/decision`)),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: action,
            reason: action === 'reject' ? reason.trim() : undefined,
            confirmation: 'CONFIRMER',
          }),
        },
      ));
      setAction(null);
      setReason('');
      setPage(1);
      setSearch('');
      setStatus(action === 'approve' ? 'approved' : 'rejected');
      setSelectedId('');
    } catch {
      setError('La décision n’a pas été enregistrée. Vérifiez votre autorisation puis réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const getDocumentUrl = (kind: string) =>
    resolveApiUrl(adminRoute(`/identity-verifications/${encodeURIComponent(selectedId)}/documents/${kind}`));

  return (
    <div className="space-y-5" data-testid="admin-identity-verifications">
      <div className="sendflow-admin-page-intro">
        <div>
          <p className="sendflow-admin-overline">Contrôle sécurisé</p>
          <h2>Vérifications d’identité</h2>
          <p className="sendflow-admin-subtitle">Dossiers, documents privés et décisions conservés dans l’historique SendFlow.</p>
        </div>
        <div className="sendflow-admin-readonly-chip"><ShieldCheck className="size-4" /> Accès administrateur contrôlé</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(['pending', 'approved', 'rejected'] as const).map((item) => (
          <Card key={item} className="sendflow-admin-detail-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{STATUS_LABEL[item]}</p>
              <strong className="mt-1 block text-2xl tabular-nums">{list?.counts[item] ?? '—'}</strong>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="sendflow-admin-list-card">
        <CardHeader>
          <CardTitle>Demandes reçues</CardTitle>
          <CardDescription>Les images ne sont accessibles qu’aux administrateurs autorisés et chaque consultation est journalisée.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profileUserId && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <span>Demandes du profil {profileUserId}</span>
              <Button variant="outline" size="sm" onClick={() => window.location.assign(adminRoute('/identity-verifications'))}>
                Afficher toutes les demandes
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((item) => (
                <Button
                  key={item}
                  size="sm"
                  variant={status === item ? 'default' : 'outline'}
                  onClick={() => { setStatus(item); setPage(1); }}
                  data-testid={`filter-identity-${item}`}
                >
                  {item === 'all' ? 'Toutes' : STATUS_LABEL[item]}
                </Button>
              ))}
            </div>
            <form
              className="flex flex-1 gap-2 sm:ml-auto sm:max-w-sm"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(searchInput.trim());
                setPage(1);
              }}
            >
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="ID de demande ou d’utilisateur"
                aria-label="Rechercher une demande d’identité"
                data-testid="input-identity-search"
              />
              <Button type="submit" variant="outline" size="icon" aria-label="Rechercher">
                <Search className="size-4" />
              </Button>
            </form>
          </div>

          {loading ? (
            <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground" role="status">Chargement des demandes…</div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Aucune demande dans cette vue.</div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.4fr)]">
              <div className="divide-y overflow-hidden rounded-xl border">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`block w-full p-4 text-left transition-colors hover:bg-muted/40 ${selectedId === item.id ? 'bg-primary/5' : 'bg-background'}`}
                    data-testid={`identity-request-${item.id}`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <strong className="block truncate text-sm">{item.displayName || 'Nom non renseigné'}</strong>
                        <small className="mt-1 block truncate text-muted-foreground">{item.userId}</small>
                      </span>
                      <Badge variant="outline" className={statusClass(item.status)}>{STATUS_LABEL[item.status]}</Badge>
                    </span>
                    <span className="mt-3 flex justify-between gap-3 text-xs text-muted-foreground">
                      <span>{item.countryCode || 'Pays non renseigné'}</span>
                      <span>{dateLabel(item.submittedAt)}</span>
                    </span>
                  </button>
                ))}
                <div className="flex items-center justify-between gap-2 p-3 text-sm">
                  <span className="text-muted-foreground">{list?.total ?? 0} demande(s)</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</Button>
                    <span>{page} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Suivant</Button>
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                {detailLoading ? (
                  <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground" role="status">Chargement du dossier…</div>
                ) : detail ? (
                  <Card className="sendflow-admin-detail-card">
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle>{detail.user.displayName || `${detail.personalData.firstName} ${detail.personalData.lastName}`}</CardTitle>
                        <CardDescription className="mt-1 break-all">{detail.id}</CardDescription>
                      </div>
                      <Badge variant="outline" className={statusClass(detail.status)}>{STATUS_LABEL[detail.status]}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Nom complet</span><strong className="mt-1 block">{detail.personalData.firstName} {detail.personalData.lastName}</strong></div>
                        <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Document</span><strong className="mt-1 block">{detail.personalData.documentType}</strong></div>
                        <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Numéro du document</span><strong className="mt-1 block break-all">{detail.personalData.documentNumber}</strong></div>
                        <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Naissance / expiration</span><strong className="mt-1 block">{detail.personalData.birthDate} · {detail.personalData.documentExpiryDate}</strong></div>
                        <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Téléphone / e-mail</span><strong className="mt-1 block break-all">{detail.user.phone || '—'} · {detail.user.email || '—'}</strong></div>
                        <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Envoi / examen</span><strong className="mt-1 block">{dateLabel(detail.submittedAt)} · {dateLabel(detail.reviewedAt)}</strong></div>
                      </div>
                      <div>
                        <h3 className="mb-3 text-sm font-semibold">Documents transmis</h3>
                        <div className="grid gap-3 md:grid-cols-3">
                          {documentKinds.map(({ kind, label }) => {
                            const document = detail.documents.find((item) => item.kind === kind);
                            return (
                              <div className="overflow-hidden rounded-xl border bg-muted/10" key={kind}>
                                {document ? (
                                  <a href={getDocumentUrl(kind)} target="_blank" rel="noreferrer" className="block">
                                    <img className="h-36 w-full object-cover" src={getDocumentUrl(kind)} alt={label} loading="lazy" />
                                  </a>
                                ) : (
                                  <div className="grid h-36 place-items-center text-xs text-muted-foreground">Document indisponible</div>
                                )}
                                <div className="flex items-center justify-between gap-2 p-2">
                                  <p className="text-xs font-medium">{label}</p>
                                  {document && (
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      aria-label={`Télécharger ${label.toLocaleLowerCase('fr-FR')}`}
                                      title={`Télécharger ${label.toLocaleLowerCase('fr-FR')}`}
                                      disabled={downloadingPhoto !== null}
                                      aria-busy={downloadingPhoto === kind}
                                      onClick={() => void downloadPhoto(kind)}
                                    >
                                      <Download className="size-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {detail.decisionReason && (
                        <div className="rounded-lg border border-muted p-3 text-sm">
                          <strong>Motif enregistré</strong><p className="mt-1 text-muted-foreground">{detail.decisionReason}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => void downloadExport()} disabled={downloading || !hasCompletePhotos}>
                          <Download className="mr-2 size-4" />{downloading ? 'Préparation…' : 'Télécharger le dossier ZIP'}
                        </Button>
                        <Button variant="outline" onClick={() => void downloadPdf()} disabled={downloadingPdf || !hasCompletePhotos}>
                          <Download className="mr-2 size-4" />{downloadingPdf ? 'Préparation du PDF…' : 'Télécharger en PDF'}
                        </Button>
                        {detail.status === 'pending' && canMutate && (
                          <>
                            <Button onClick={() => setAction('approve')}><Check className="mr-2 size-4" />Approuver</Button>
                            <Button variant="destructive" onClick={() => setAction('reject')}><X className="mr-2 size-4" />Refuser</Button>
                          </>
                        )}
                      </div>
                      {!hasCompletePhotos && (
                        <p className="text-xs text-muted-foreground">
                          Les exports sont disponibles lorsque les trois photos du dossier sont présentes.
                        </p>
                      )}
                      <a href={adminRoute(`/users/${encodeURIComponent(detail.user.id)}`)} className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
                        <FileSearch className="size-4" />Ouvrir le profil utilisateur
                      </a>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Sélectionnez une demande pour consulter le dossier.</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(action)}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setAction(null);
            setReason('');
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{action === 'approve' ? 'Approuver cette demande ?' : 'Refuser cette demande ?'}</DialogTitle>
            <DialogDescription>
              {action === 'approve'
                ? 'La vérification sera enregistrée comme approuvée. Le plafond financier reste inchangé.'
                : 'Le refus sera conservé dans l’historique et le motif sera chiffré.'}
            </DialogDescription>
          </DialogHeader>
          {action === 'reject' && (
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="Motif du refus (10 caractères minimum)"
              aria-label="Motif du refus"
              data-testid="input-identity-rejection-reason"
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAction(null); setReason(''); }} disabled={saving}>Annuler</Button>
            <Button variant={action === 'reject' ? 'destructive' : 'default'} onClick={() => void decide()} disabled={!action || saving || (action === 'reject' && reason.trim().length < 10)}>
              {saving ? 'Enregistrement…' : action === 'approve' ? 'Confirmer l’approbation' : 'Confirmer le refus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && <ErrorDialog open title="Action indisponible" message={error} onClose={() => setError('')} />}
    </div>
  );
}

export function AdminUserIdentitySummary({ userId }: { userId: string }) {
  const [request, setRequest] = useState<RequestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ userId, page: '1', pageSize: '1' });
    void fetch(resolveApiUrl(`${adminRoute(`/identity-verifications`)}?${query.toString()}`), {
      credentials: 'include',
      cache: 'no-store',
    }).then(readJson<ListResult>).then((result) => {
      if (active) setRequest(result.items[0] ?? null);
    }).catch(() => {
      if (active) {
        setRequest(null);
        setFailed(true);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  return (
    <Card className="sendflow-admin-detail-card" data-testid="card-admin-user-identity-verification">
      <CardHeader>
        <CardTitle>Vérification d’identité</CardTitle>
        <CardDescription>État du dossier associé à ce profil.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        {loading ? (
          <span className="text-sm text-muted-foreground">Chargement du statut…</span>
        ) : request ? (
          <div className="space-y-1">
            <Badge variant="outline" className={statusClass(request.status)}>{STATUS_LABEL[request.status]}</Badge>
            <p className="text-xs text-muted-foreground">Soumise le {dateLabel(request.submittedAt)}</p>
          </div>
        ) : failed ? (
          <span className="text-sm text-muted-foreground">Statut temporairement indisponible.</span>
        ) : (
          <span className="text-sm text-muted-foreground">Aucune demande d’identité enregistrée.</span>
        )}
        <Button asChild variant="outline" size="sm">
          <a href={`${adminRoute('/identity-verifications')}?userId=${encodeURIComponent(userId)}`}>
            <FileSearch className="mr-2 size-4" />Consulter le dossier
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
