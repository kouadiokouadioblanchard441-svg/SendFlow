import { useMemo, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import {
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  useGetAdminOverview,
  useListAdminTransactions,
  useListAdminUsers,
} from '@workspace/api-client-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

type AdminSection = 'overview' | 'users' | 'deposits' | 'transfers';
type Status = 'pending' | 'succeeded' | 'failed';

const sectionMeta: Record<AdminSection, { title: string; eyebrow: string }> = {
  overview: { title: 'Vue d’ensemble', eyebrow: 'Opérations' },
  users: { title: 'Utilisateurs', eyebrow: 'Répertoire' },
  deposits: { title: 'Dépôts', eyebrow: 'Flux entrants' },
  transfers: { title: 'Transferts', eyebrow: 'Flux sortants' },
};

const navItems: Array<{ href: string; label: string; section: AdminSection; icon: typeof LayoutDashboard }> = [
  { href: '/admin', label: 'Vue d’ensemble', section: 'overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Utilisateurs', section: 'users', icon: Users },
  { href: '/admin/deposits', label: 'Dépôts', section: 'deposits', icon: ArrowDownToLine },
  { href: '/admin/transfers', label: 'Transferts', section: 'transfers', icon: ArrowLeftRight },
];

function formatMoney(minor: number | undefined, currency = 'XOF') {
  if (minor === undefined || minor === null) return '—';
  const value = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
  return `${value} ${currency === 'XOF' ? 'FCFA' : currency}`;
}

function formatNumber(value: number | undefined) {
  if (value === undefined || value === null) return '—';
  return new Intl.NumberFormat('fr-FR').format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Jamais';
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

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { status?: number; response?: { status?: number } };
  return candidate.status ?? candidate.response?.status;
}

function QueryState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = getErrorStatus(error);
  const title =
    status === 401
      ? 'Session administrateur requise'
      : status === 403
        ? 'Accès administrateur refusé'
        : status === 503
          ? 'Service temporairement indisponible'
          : 'Impossible de charger ces données';
  const description =
    status === 401
      ? 'Connectez-vous avec un compte autorisé pour consulter cet espace.'
      : status === 403
        ? 'Votre compte est authentifié mais ne dispose pas des droits nécessaires.'
        : status === 503
          ? 'Le service de données ne répond pas pour le moment. Réessayez dans quelques instants.'
          : 'SendFlow n’a pas pu joindre le service d’administration. Aucun chiffre n’est affiché.';

  return (
    <Alert variant="destructive" className="sendflow-admin-error" data-testid={`alert-admin-error-${status ?? 'general'}`}>
      <CircleAlert className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>{description}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry} data-testid="button-retry-admin-query">
          Réessayer
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="sendflow-admin-empty" data-testid="empty-admin-results">
      <div className="sendflow-admin-empty-icon"><Search className="size-5" /></div>
      <p className="font-semibold">Aucun résultat</p>
      <p className="text-sm">{label}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'violet',
}: {
  label: string;
  value: string;
  detail?: string;
  icon: typeof Users;
  tone?: 'violet' | 'orange' | 'blue' | 'green';
}) {
  return (
    <Card className={`sendflow-admin-metric sendflow-admin-metric-${tone}`} data-testid={`card-metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="sendflow-admin-metric-label" data-testid={`text-metric-label-${label.toLowerCase().replaceAll(' ', '-')}`}>{label}</p>
            <p className="sendflow-admin-metric-value" data-testid={`text-metric-value-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p>
            {detail && <p className="sendflow-admin-metric-detail" data-testid={`text-metric-detail-${label.toLowerCase().replaceAll(' ', '-')}`}>{detail}</p>}
          </div>
          <div className="sendflow-admin-metric-icon"><Icon className="size-4" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminShell({ section, children }: { section: AdminSection; children: React.ReactNode }) {
  const meta = sectionMeta[section];
  return (
    <SidebarProvider className="sendflow-admin-app">
      <Sidebar collapsible="offcanvas" className="sendflow-admin-sidebar">
        <SidebarHeader className="sendflow-admin-sidebar-header">
          <Link href="/admin" className="sendflow-admin-brand" data-testid="link-admin-brand">
            <span className="sendflow-admin-brand-mark"><Activity className="size-4" /></span>
            <span><strong>sendflow</strong><small>ADMIN CONSOLE</small></span>
          </Link>
          <div className="sendflow-admin-status" data-testid="status-admin-readonly">
            <span className="sendflow-admin-status-dot" />
            <span>Lecture seule</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Surveillance</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={item.section === section} size="lg">
                        <Link href={item.href} data-testid={`link-admin-${item.section}`}>
                          <Icon className="size-[17px]" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="mt-auto">
            <SidebarGroupLabel>Accès</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="sendflow-admin-sidebar-note" data-testid="text-admin-access-note">
                <ShieldCheck className="size-4" />
                <span>Données protégées par l’autorisation serveur.</span>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="sendflow-admin-sidebar-footer">
          <span>SendFlow Operations</span>
          <span>v1.0 · West Africa</span>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="sendflow-admin-main">
        <header className="sendflow-admin-topbar">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="sendflow-admin-sidebar-trigger" data-testid="button-toggle-admin-nav" />
            <div>
              <p className="sendflow-admin-kicker">{meta.eyebrow}</p>
              <h1 data-testid={`heading-admin-${section}`}>{meta.title}</h1>
            </div>
          </div>
          <div className="sendflow-admin-topbar-right">
            <span className="sendflow-admin-live-indicator"><span /> Données en direct</span>
            <span className="sendflow-admin-protected"><ShieldCheck className="size-3.5" /> Protégé</span>
          </div>
        </header>
        <main className="sendflow-admin-content">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function DateRange({
  from,
  to,
  setFrom,
  setTo,
}: {
  from: string;
  to: string;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
}) {
  return (
    <div className="sendflow-admin-date-range" data-testid="form-admin-date-range">
      <CalendarDays className="size-4 text-muted-foreground" />
      <div>
        <Label htmlFor="admin-from">Du</Label>
        <Input id="admin-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} data-testid="input-admin-date-from" />
      </div>
      <span className="sendflow-admin-date-separator">→</span>
      <div>
        <Label htmlFor="admin-to">Au</Label>
        <Input id="admin-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} data-testid="input-admin-date-to" />
      </div>
    </div>
  );
}

function OverviewPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params = useMemo(() => ({ ...(from ? { from } : {}), ...(to ? { to } : {}) }), [from, to]);
  const query = useGetAdminOverview(params);
  const overview = query.data;

  return (
    <AdminShell section="overview">
      <div className="sendflow-admin-page-intro">
        <div>
          <p className="sendflow-admin-overline">Vue opérationnelle</p>
          <h2 data-testid="heading-admin-overview-period">Un regard fiable sur la plateforme.</h2>
          <p className="sendflow-admin-subtitle" data-testid="text-admin-overview-period">
            {from || to ? `Période du ${from || 'début'} au ${to || 'jour'}.` : 'Tous les indicateurs disponibles, sans filtre de période.'}
          </p>
        </div>
        <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
      </div>
      {query.isLoading && (
        <div className="sendflow-admin-metric-grid" data-testid="loading-admin-overview">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-[142px] rounded-xl" />)}
        </div>
      )}
      {query.isError && <QueryState error={query.error} onRetry={() => void query.refetch()} />}
      {overview && !query.isError && (
        <div className="space-y-6" data-testid="content-admin-overview">
          <div className="sendflow-admin-metric-grid">
            <MetricCard label="Utilisateurs" value={formatNumber(overview.users.total)} detail={`+${formatNumber(overview.users.newInPeriod)} sur la période`} icon={Users} tone="violet" />
            <MetricCard label="Wallets actifs" value={formatNumber(overview.wallets.active)} detail="Comptes actuellement actifs" icon={WalletCards} tone="blue" />
            <MetricCard label="Solde wallets" value={formatMoney(overview.wallets.balanceMinor)} detail="Total conservé dans les wallets" icon={WalletCards} tone="orange" />
            <MetricCard label="Transactions" value={formatNumber(overview.transactions.total)} detail={`${formatNumber(overview.transactions.succeeded)} réussies`} icon={ArrowLeftRight} tone="violet" />
            <MetricCard label="Volume traité" value={formatMoney(overview.transactions.volumeMinor)} detail={`${formatMoney(overview.transactions.feesMinor)} de frais`} icon={ArrowUpRight} tone="green" />
            <MetricCard label="En attente" value={formatNumber(overview.transactions.pending)} detail={`${formatNumber(overview.transactions.failed)} échouées`} icon={CircleAlert} tone="orange" />
          </div>
          <div className="sendflow-admin-overview-grid">
            <Card className="sendflow-admin-breakdown-card">
              <CardHeader>
                <CardTitle>Flux entrants</CardTitle>
                <CardDescription>État des dépôts sur la période sélectionnée.</CardDescription>
              </CardHeader>
              <CardContent className="sendflow-admin-breakdown">
                <div><span>Réussis</span><strong data-testid="text-overview-deposits-succeeded">{formatNumber(overview.deposits.succeeded)}</strong></div>
                <div><span>En attente</span><strong data-testid="text-overview-deposits-pending">{formatNumber(overview.deposits.pending)}</strong></div>
                <div className="sendflow-admin-breakdown-total"><span>Volume</span><strong data-testid="text-overview-deposits-volume">{formatMoney(overview.deposits.volumeMinor)}</strong></div>
              </CardContent>
            </Card>
            <Card className="sendflow-admin-breakdown-card">
              <CardHeader>
                <CardTitle>Flux sortants</CardTitle>
                <CardDescription>Transferts vers les réseaux et opérateurs.</CardDescription>
              </CardHeader>
              <CardContent className="sendflow-admin-breakdown">
                <div><span>Réussis</span><strong data-testid="text-overview-transfers-succeeded">{formatNumber(overview.transfers.succeeded)}</strong></div>
                <div><span>En attente</span><strong data-testid="text-overview-transfers-pending">{formatNumber(overview.transfers.pending)}</strong></div>
                <div className="sendflow-admin-breakdown-total"><span>Volume</span><strong data-testid="text-overview-transfers-volume">{formatMoney(overview.transfers.volumeMinor)}</strong></div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {!query.isLoading && !query.isError && !overview && <EmptyState label="Les indicateurs apparaîtront lorsque l’API sera disponible." />}
    </AdminShell>
  );
}

function StatusBadge({ status, id }: { status: Status; id: string }) {
  const label = status === 'succeeded' ? 'Réussi' : status === 'pending' ? 'En attente' : 'Échoué';
  return <Badge variant="outline" className={`sendflow-admin-status-badge sendflow-admin-status-${status}`} data-testid={`status-transaction-${id}`}>{label}</Badge>;
}

function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="sendflow-admin-pager" data-testid="pagination-admin-results">
      <span data-testid="text-admin-pagination-summary">{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} sur ${formatNumber(total)}` : '0 résultat'}</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => onPage(page - 1)} data-testid="button-admin-previous-page"><ChevronLeft className="size-4" /></Button>
        <span className="sendflow-admin-page-number" data-testid="text-admin-current-page">{page} / {pageCount}</span>
        <Button variant="ghost" size="icon" disabled={page >= pageCount} onClick={() => onPage(page + 1)} data-testid="button-admin-next-page"><ChevronRight className="size-4" /></Button>
      </div>
    </div>
  );
}

function FilterBar({
  search,
  setSearch,
  status,
  setStatus,
}: {
  search: string;
  setSearch: (value: string) => void;
  status?: string;
  setStatus?: (value: string) => void;
}) {
  return (
    <div className="sendflow-admin-filterbar" data-testid="form-admin-filters">
      <div className="sendflow-admin-search">
        <Search className="size-4" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher par nom, téléphone ou référence" aria-label="Rechercher" data-testid="input-admin-search" />
      </div>
      {setStatus && (
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sendflow-admin-status-filter" data-testid="select-admin-status"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="succeeded">Réussis</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="failed">Échoués</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function UsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const params = useMemo(() => ({ ...(search ? { search } : {}), page, pageSize }), [search, page]);
  const query = useListAdminUsers(params);
  const result = query.data;
  const items = result?.items ?? [];

  return (
    <AdminShell section="users">
      <div className="sendflow-admin-page-intro sendflow-admin-list-intro">
        <div><p className="sendflow-admin-overline">Répertoire sécurisé</p><h2 data-testid="heading-admin-users-list">Utilisateurs SendFlow</h2><p className="sendflow-admin-subtitle">Consultez les profils et l’état des wallets, sans action de modification.</p></div>
        <div className="sendflow-admin-readonly-chip"><ShieldCheck className="size-4" /> Consultation uniquement</div>
      </div>
      <Card className="sendflow-admin-list-card">
        <CardContent className="p-0">
          <FilterBar search={search} setSearch={(value) => { setSearch(value); setPage(1); }} />
          {query.isLoading && <div className="sendflow-admin-table-skeleton" data-testid="loading-admin-users">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>}
          {query.isError && <div className="p-5"><QueryState error={query.error} onRetry={() => void query.refetch()} /></div>}
          {!query.isLoading && !query.isError && items.length === 0 && <EmptyState label="Aucun utilisateur ne correspond à votre recherche." />}
          {!query.isLoading && !query.isError && items.length > 0 && (
            <>
              <Table>
                <TableHeader><TableRow><TableHead>Utilisateur</TableHead><TableHead>Pays</TableHead><TableHead>Créé le</TableHead><TableHead>Dernière activité</TableHead><TableHead>Wallet</TableHead><TableHead>Solde</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((user) => (
                    <TableRow key={user.id} data-testid={`row-admin-user-${user.id}`}>
                      <TableCell><div className="sendflow-admin-user-cell"><span className="sendflow-admin-avatar">{(user.displayName || user.phone || '?').slice(0, 1).toUpperCase()}</span><span><strong data-testid={`text-user-name-${user.id}`}>{user.displayName || 'Nom non renseigné'}</strong><small data-testid={`text-user-phone-${user.id}`}>{user.phone || 'Téléphone non renseigné'}</small></span></div></TableCell>
                      <TableCell data-testid={`text-user-country-${user.id}`}>{user.countryCode || '—'}</TableCell>
                      <TableCell data-testid={`text-user-created-${user.id}`}>{formatDate(user.createdAt)}</TableCell>
                      <TableCell data-testid={`text-user-lastseen-${user.id}`}>{formatDate(user.lastSeenAt)}</TableCell>
                      <TableCell><Badge variant="outline" className="sendflow-admin-wallet-badge" data-testid={`status-user-wallet-${user.id}`}>{user.wallet.status === 'active' ? 'Actif' : user.wallet.status === 'locked' ? 'Bloqué' : 'Fermé'}</Badge></TableCell>
                      <TableCell className="font-semibold tabular-nums" data-testid={`text-user-balance-${user.id}`}>{formatMoney(user.wallet.balanceMinor, user.wallet.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pager page={result?.page ?? page} pageSize={result?.pageSize ?? pageSize} total={result?.total ?? 0} onPage={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}

function TransactionsPage({ section }: { section: 'deposits' | 'transfers' }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const kind: 'deposit' | 'inter-network' = section === 'deposits' ? 'deposit' : 'inter-network';
  const params = useMemo(() => ({
    kind,
    ...(search ? { search } : {}),
    ...(status !== 'all' ? { status: status as Status } : {}),
    page,
    pageSize,
  }), [kind, search, status, page]);
  const query = useListAdminTransactions(params);
  const result = query.data;
  const items = result?.items ?? [];
  const title = section === 'deposits' ? 'Dépôts mobile-money' : 'Transferts inter-réseaux';

  return (
    <AdminShell section={section}>
      <div className="sendflow-admin-page-intro sendflow-admin-list-intro">
        <div><p className="sendflow-admin-overline">{section === 'deposits' ? 'Flux entrants' : 'Flux sortants'}</p><h2 data-testid={`heading-admin-${section}-list`}>{title}</h2><p className="sendflow-admin-subtitle">Suivez les montants, statuts et références telles que reçues par SendFlow.</p></div>
        <div className="sendflow-admin-currency-note"><span>Devise</span><strong>FCFA</strong></div>
      </div>
      <Card className="sendflow-admin-list-card">
        <CardContent className="p-0">
          <FilterBar search={search} setSearch={(value) => { setSearch(value); setPage(1); }} status={status} setStatus={(value) => { setStatus(value); setPage(1); }} />
          {query.isLoading && <div className="sendflow-admin-table-skeleton" data-testid={`loading-admin-${section}`}>{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>}
          {query.isError && <div className="p-5"><QueryState error={query.error} onRetry={() => void query.refetch()} /></div>}
          {!query.isLoading && !query.isError && items.length === 0 && <EmptyState label={`Aucun ${section === 'deposits' ? 'dépôt' : 'transfert'} ne correspond à vos filtres.`} />}
          {!query.isLoading && !query.isError && items.length > 0 && (
            <>
              <Table>
                <TableHeader><TableRow><TableHead>Référence</TableHead><TableHead>Utilisateur</TableHead><TableHead>Réseau</TableHead><TableHead>Statut</TableHead><TableHead>Montant</TableHead><TableHead>Frais</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((transaction) => (
                    <TableRow key={transaction.id} data-testid={`row-admin-transaction-${transaction.id}`}>
                      <TableCell><div className="sendflow-admin-reference-cell"><strong data-testid={`text-transaction-reference-${transaction.id}`}>{transaction.reference}</strong><small>{transaction.providerReference || 'Référence opérateur indisponible'}</small></div></TableCell>
                      <TableCell><div className="sendflow-admin-reference-cell"><strong data-testid={`text-transaction-user-${transaction.id}`}>{transaction.displayName || 'Nom non renseigné'}</strong><small>{transaction.userId}</small></div></TableCell>
                      <TableCell data-testid={`text-transaction-operator-${transaction.id}`}>{transaction.fromOperator || transaction.toOperator || '—'}</TableCell>
                      <TableCell><StatusBadge status={transaction.status} id={transaction.id} /></TableCell>
                      <TableCell className="font-semibold tabular-nums" data-testid={`text-transaction-amount-${transaction.id}`}>{formatMoney(transaction.amountMinor, transaction.currency)}</TableCell>
                      <TableCell className="tabular-nums" data-testid={`text-transaction-fee-${transaction.id}`}>{formatMoney(transaction.feeMinor, transaction.currency)}</TableCell>
                      <TableCell data-testid={`text-transaction-date-${transaction.id}`}>{formatDate(transaction.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pager page={result?.page ?? page} pageSize={result?.pageSize ?? pageSize} total={result?.total ?? 0} onPage={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}

export function AdminRouter() {
  const [isOverview] = useRoute('/admin');
  const [isUsers] = useRoute('/admin/users');
  const [isDeposits] = useRoute('/admin/deposits');
  const [isTransfers] = useRoute('/admin/transfers');
  if (isOverview) return <OverviewPage />;
  if (isUsers) return <UsersPage />;
  if (isDeposits) return <TransactionsPage section="deposits" />;
  if (isTransfers) return <TransactionsPage section="transfers" />;
  return <OverviewPage />;
}
