import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useRoute } from 'wouter';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleX,
  Clock3,
  ExternalLink,
  FileSearch,
  Globe2,
  Landmark,
  LayoutDashboard,
  LogIn,
  MapPin,
  Monitor,
  Radio,
  Search,
  ShieldCheck,
  Pencil,
  Plus,
  Trash2,
  GripVertical,
  Power,
  Smartphone,
  Tablet,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react';
import { AdminActionDialog } from '@/components/admin-action-dialog';
import mixxLogo from '@assets/generated_images/sendflow-mixx-logo.png';
import waveLogo from '@assets/generated_images/sendflow-wave-logo.png';
import sendflowMark from '@assets/sendflow-mark-original.png';
import {
  useGetAdminTransaction,
  useGetAdminUser,
  useGetAdminOverview,
  useListAdminTransactions,
  useListAdminLoginActivity,
  useListAdminUsers,
  useListAdminBanners,
  useCreateAdminBanner,
  useUpdateAdminBanner,
  useDeleteAdminBanner,
  useReorderAdminBanners,
  getListAdminBannersQueryKey,
  getListPublishedBannersQueryKey,
} from '@workspace/api-client-react';
import type { AdminBanner, BannerInput, BannerUpdate } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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

type AdminSection = 'overview' | 'transactions' | 'users' | 'deposits' | 'international' | 'transfers' | 'login-activity' | 'banners';
type Status = 'pending' | 'succeeded' | 'failed';
type TransactionKind = 'inter-network' | 'deposit' | 'international';

const sectionMeta: Record<AdminSection, { title: string; eyebrow: string }> = {
  overview: { title: 'Vue d’ensemble', eyebrow: 'Opérations' },
  transactions: { title: 'Transactions', eyebrow: 'Traçabilité' },
  users: { title: 'Utilisateurs', eyebrow: 'Répertoire' },
  deposits: { title: 'Dépôts', eyebrow: 'Flux entrants' },
  international: { title: 'Transferts internationaux', eyebrow: 'Flux sortants' },
  transfers: { title: 'Transferts', eyebrow: 'Flux sortants' },
  'login-activity': { title: 'Connexions', eyebrow: 'Sécurité' },
  banners: { title: 'Bannières', eyebrow: 'Contenu client' },
};

const navItems: Array<{ href: string; label: string; section: AdminSection; icon: typeof LayoutDashboard }> = [
  { href: '/admin', label: 'Vue d’ensemble', section: 'overview', icon: LayoutDashboard },
  { href: '/admin/transactions', label: 'Transactions', section: 'transactions', icon: ArrowLeftRight },
  { href: '/admin/users', label: 'Utilisateurs', section: 'users', icon: Users },
  { href: '/admin/deposits', label: 'Dépôts', section: 'deposits', icon: ArrowDownToLine },
  { href: '/admin/international', label: 'International', section: 'international', icon: Globe2 },
  { href: '/admin/transfers', label: 'Transferts inter-réseaux', section: 'transfers', icon: ArrowLeftRight },
  { href: '/admin/login-activity', label: 'Connexions utilisateurs', section: 'login-activity', icon: LogIn },
  { href: '/admin/banners', label: 'Bannières client', section: 'banners', icon: Radio },
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
        : status === 409
          ? 'Les données ont changé'
        : status === 503
          ? 'Service temporairement indisponible'
          : 'Impossible de charger ces données';
  const description =
    status === 401
      ? 'Connectez-vous avec un compte autorisé pour consulter cet espace.'
      : status === 403
        ? 'Votre compte est authentifié mais ne dispose pas des droits nécessaires.'
        : status === 409
          ? 'Une modification concurrente a changé cette liste. Actualisez les données avant de réessayer.'
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

const adminOperatorLogos: Record<string, string> = {
  mixx: mixxLogo,
  sendflow: sendflowMark,
  wave: waveLogo,
};

const adminOperatorNames: Record<string, string> = {
  mtn: 'MTN Mobile Money',
  moov: 'Moov Money',
  orange: 'Orange Money',
  'orange-money': 'Orange Money',
  sendflow: 'SendFlow',
  tmoney: 'TMoney',
  wave: 'Wave',
};

function normalizeOperator(operator: string | null | undefined) {
  return operator?.trim().toLowerCase().replace(/\s+/g, '-') ?? '';
}

function getAdminOperatorName(operator: string | null | undefined) {
  const normalized = normalizeOperator(operator);
  return (normalized && adminOperatorNames[normalized]) || operator?.trim() || 'Réseau non renseigné';
}

function AdminOperatorIcon({ operator }: { operator: string | null | undefined }) {
  const normalized = normalizeOperator(operator);
  const name = getAdminOperatorName(operator);
  const logo = adminOperatorLogos[normalized];

  return (
    <span className="sendflow-admin-operator-icon" aria-label={`Icône : ${name}`}>
      {logo ? <img src={logo} alt="" /> : <Landmark className="size-4" aria-hidden="true" />}
    </span>
  );
}

function AdminOperatorLabel({ operator }: { operator: string | null | undefined }) {
  return (
    <span className="sendflow-admin-operator-label">
      <AdminOperatorIcon operator={operator} />
      <span>{getAdminOperatorName(operator)}</span>
    </span>
  );
}

function AdminOperatorRoute({
  fromOperator,
  toOperator,
}: {
  fromOperator: string | null | undefined;
  toOperator: string | null | undefined;
}) {
  return (
    <span className="sendflow-admin-operator-route">
      <AdminOperatorLabel operator={fromOperator} />
      <ArrowRight className="size-3.5" aria-hidden="true" />
      <AdminOperatorLabel operator={toOperator} />
    </span>
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
            <span className="sendflow-admin-brand-mark">
              <img src={sendflowMark} alt="SendFlow" />
            </span>
            <span><strong>sendflow</strong><small>ADMIN CONSOLE</small></span>
          </Link>
          <div className="sendflow-admin-status" data-testid="status-admin-readonly">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            <span>Actions contrôlées</span>
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
            <span className="sendflow-admin-live-indicator"><Radio className="size-3.5" aria-hidden="true" /> Données en direct</span>
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
  const Icon = status === 'succeeded' ? CheckCircle2 : status === 'pending' ? Clock3 : CircleX;
  return <Badge variant="outline" className={`sendflow-admin-status-badge sendflow-admin-status-${status}`} data-testid={`status-transaction-${id}`}><Icon className="size-3" aria-hidden="true" /><span>{label}</span></Badge>;
}

function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="sendflow-admin-pager" data-testid="pagination-admin-results">
      <span data-testid="text-admin-pagination-summary">{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} sur ${formatNumber(total)}` : '0 résultat'}</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Page précédente" disabled={page <= 1} onClick={() => onPage(page - 1)} data-testid="button-admin-previous-page"><ChevronLeft className="size-4" /></Button>
        <span className="sendflow-admin-page-number" data-testid="text-admin-current-page">{page} / {pageCount}</span>
        <Button variant="ghost" size="icon" aria-label="Page suivante" disabled={page >= pageCount} onClick={() => onPage(page + 1)} data-testid="button-admin-next-page"><ChevronRight className="size-4" /></Button>
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
              <Table className="sendflow-admin-user-table">
                <TableHeader><TableRow><TableHead>Utilisateur</TableHead><TableHead>Pays</TableHead><TableHead>Créé le</TableHead><TableHead>Dernière activité</TableHead><TableHead>Wallet</TableHead><TableHead>Solde</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((user) => (
                    <TableRow key={user.id} data-testid={`row-admin-user-${user.id}`}>
                     <TableCell><div className="sendflow-admin-user-cell"><span className="sendflow-admin-avatar"><UserRound className="size-4" aria-hidden="true" /></span><span><Link href={`/admin/users/${user.id}`} className="sendflow-admin-user-link"><strong data-testid={`text-user-name-${user.id}`}>{user.displayName || 'Nom non renseigné'}</strong></Link><small data-testid={`text-user-phone-${user.id}`}>{user.phone || 'Téléphone non renseigné'}</small></span></div></TableCell>
                      <TableCell data-testid={`text-user-country-${user.id}`}>{user.countryCode || '—'}</TableCell>
                      <TableCell data-testid={`text-user-created-${user.id}`}>{formatDate(user.createdAt)}</TableCell>
                      <TableCell data-testid={`text-user-lastseen-${user.id}`}>{formatDate(user.lastSeenAt)}</TableCell>
                       <TableCell><div className="sendflow-admin-status-stack"><Badge variant="outline" className="sendflow-admin-wallet-badge" data-testid={`status-user-wallet-${user.id}`}>{user.wallet.status === 'active' ? 'Actif' : user.wallet.status === 'locked' ? 'Bloqué' : 'Fermé'}</Badge><Badge variant="outline" className={`sendflow-admin-account-status sendflow-admin-account-status-${user.status}`} data-testid={`status-admin-user-${user.id}`}>{user.status === 'active' ? 'Compte actif' : user.status === 'suspended' ? 'Suspendu' : 'Supprimé'}</Badge></div></TableCell>
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

function transactionKindLabel(kind: 'inter-network' | 'deposit' | 'international') {
  if (kind === 'deposit') return 'Dépôt';
  if (kind === 'international') return 'International';
  return 'Inter-réseaux';
}

function UserDetailPage({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const detailQuery = useGetAdminUser(userId);
  const transactionsQuery = useListAdminTransactions(
    useMemo(() => ({ userId, page, pageSize }), [userId, page]),
  );
  const detail = detailQuery.data;
  const transactionResult = transactionsQuery.data;
  const transactions = transactionResult?.items ?? [];

  return (
    <AdminShell section="users">
      <div className="sendflow-admin-page-intro sendflow-admin-detail-intro">
        <div>
          <Link href="/admin/users" className="sendflow-admin-back-link" data-testid="link-admin-users-back">
            <ArrowLeft className="size-4" /> Retour aux utilisateurs
          </Link>
          <p className="sendflow-admin-overline">Fiche sécurisée</p>
          <h2 data-testid="heading-admin-user-detail">Détail utilisateur</h2>
          <p className="sendflow-admin-subtitle">Données persistées avec actions sensibles contrôlées par l’autorisation serveur et l’audit.</p>
        </div>
        <div className="sendflow-admin-readonly-chip"><ShieldCheck className="size-4" /> Actions contrôlées</div>
      </div>

      {detailQuery.isLoading && (
        <div className="space-y-4" data-testid="loading-admin-user-detail">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      )}
      {detailQuery.isError && <QueryState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />}

      {detail && !detailQuery.isError && (
        <div className="space-y-5" data-testid="content-admin-user-detail">
          <Card className="sendflow-admin-profile-banner">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="sendflow-admin-profile-heading">
                <span className="sendflow-admin-avatar sendflow-admin-avatar-large">
                  <UserRound className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 data-testid="text-admin-user-detail-name">{detail.user.displayName || 'Nom non renseigné'}</h3>
                  <p data-testid="text-admin-user-detail-id">{detail.user.id}</p>
                </div>
              </div>
               <div className="sendflow-admin-profile-actions">
                 <div className="sendflow-admin-profile-status"><UserRound className="size-4" /> {detail.user.status === 'active' ? 'Compte actif' : detail.user.status === 'suspended' ? 'Compte suspendu' : 'Compte supprimé'}</div>
                 {detail.user.status === 'active' && <AdminActionDialog kind="suspend" targetId={userId} />}
                 {detail.user.status === 'suspended' && <AdminActionDialog kind="restore" targetId={userId} />}
                 {detail.user.status !== 'deleted' && <AdminActionDialog kind="delete-user" targetId={userId} />}
               </div>
            </CardContent>
          </Card>

          <div className="sendflow-admin-metric-grid sendflow-admin-detail-metric-grid">
            <MetricCard label="Transactions" value={formatNumber(detail.transactionSummary.total)} detail={`${formatNumber(detail.transactionSummary.succeeded)} réussies`} icon={ArrowLeftRight} tone="violet" />
            <MetricCard label="Volume traité" value={formatMoney(detail.transactionSummary.volumeMinor)} detail={`${formatMoney(detail.transactionSummary.feesMinor)} de frais`} icon={Banknote} tone="green" />
            <MetricCard label="En attente" value={formatNumber(detail.transactionSummary.pending)} detail={`${formatNumber(detail.transactionSummary.failed)} échouées`} icon={CircleAlert} tone="orange" />
            <MetricCard label="Dernière activité" value={formatDate(detail.user.lastSeenAt)} detail="Dernière présence enregistrée" icon={Clock3} tone="blue" />
          </div>

          <div className="sendflow-admin-overview-grid">
            <Card className="sendflow-admin-detail-card">
              <CardHeader>
                <CardTitle>Profil</CardTitle>
                <CardDescription>Informations enregistrées dans SendFlow.</CardDescription>
              </CardHeader>
              <CardContent className="sendflow-admin-detail-list">
                <div><span>Téléphone</span><strong data-testid="text-admin-user-detail-phone">{detail.user.phone || 'Non renseigné'}</strong></div>
                <div><span>Pays</span><strong data-testid="text-admin-user-detail-country">{detail.user.countryCode || 'Non renseigné'}</strong></div>
                <div><span>Compte créé</span><strong data-testid="text-admin-user-detail-created">{formatDate(detail.user.createdAt)}</strong></div>
                <div><span>Dernière mise à jour</span><strong data-testid="text-admin-user-detail-updated">{formatDate(detail.user.updatedAt)}</strong></div>
              </CardContent>
            </Card>
            <Card className="sendflow-admin-detail-card">
              <CardHeader>
                <CardTitle>Wallet</CardTitle>
                <CardDescription>Solde et statut provenant du wallet persistant.</CardDescription>
              </CardHeader>
              <CardContent>
                {detail.wallet ? (
                  <div className="sendflow-admin-wallet-detail">
                    <div><span>Solde disponible</span><strong data-testid="text-admin-user-detail-balance">{formatMoney(detail.wallet.balanceMinor, detail.wallet.currency)}</strong></div>
                     <div><span>Statut</span><Badge variant="outline" className="sendflow-admin-wallet-badge" data-testid="status-admin-user-detail-wallet">{detail.wallet.status === 'active' ? 'Actif' : detail.wallet.status === 'locked' ? 'Bloqué' : 'Fermé'}</Badge></div>
                    <div><span>Devise</span><strong data-testid="text-admin-user-detail-currency">{detail.wallet.currency}</strong></div>
                     {detail.wallet.status === 'active' && detail.user.status !== 'deleted' && (
                       <div className="sendflow-admin-wallet-actions">
                         <AdminActionDialog kind="credit" targetId={userId} currentBalanceMinor={detail.wallet.balanceMinor} currency={detail.wallet.currency} />
                         <AdminActionDialog kind="debit" targetId={userId} currentBalanceMinor={detail.wallet.balanceMinor} currency={detail.wallet.currency} />
                       </div>
                     )}
                  </div>
                ) : (
                  <div className="sendflow-admin-detail-unavailable" data-testid="empty-admin-user-detail-wallet">
                    <WalletCards className="size-5" />
                    <span>Aucun wallet enregistré pour ce compte.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="sendflow-admin-list-card">
            <CardHeader>
              <CardTitle>Transactions et opérations</CardTitle>
              <CardDescription>Toutes les opérations enregistrées pour cet utilisateur, avec pagination.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {transactionsQuery.isLoading && <div className="sendflow-admin-table-skeleton" data-testid="loading-admin-user-transactions">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>}
              {transactionsQuery.isError && <div className="p-5"><QueryState error={transactionsQuery.error} onRetry={() => void transactionsQuery.refetch()} /></div>}
              {!transactionsQuery.isLoading && !transactionsQuery.isError && transactions.length === 0 && <EmptyState label="Aucune transaction enregistrée pour cet utilisateur." />}
              {!transactionsQuery.isLoading && !transactionsQuery.isError && transactions.length > 0 && (
                <>
                  <Table className="sendflow-admin-user-transactions-table">
                    <TableHeader><TableRow><TableHead>Référence</TableHead><TableHead>Opération</TableHead><TableHead>Réseau</TableHead><TableHead>Statut</TableHead><TableHead>Montant</TableHead><TableHead>Frais</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id} data-testid={`row-admin-user-transaction-${transaction.id}`}>
                          <TableCell><div className="sendflow-admin-reference-cell"><Link href={`/admin/transactions/${transaction.id}`} className="sendflow-admin-transaction-link"><strong>{transaction.reference}</strong></Link><small>{transaction.providerReference || 'Référence opérateur indisponible'}</small></div></TableCell>
                          <TableCell data-testid={`text-admin-user-transaction-kind-${transaction.id}`}>{transactionKindLabel(transaction.kind)}</TableCell>
                          <TableCell><AdminOperatorRoute fromOperator={transaction.fromOperator} toOperator={transaction.toOperator} /></TableCell>
                          <TableCell><StatusBadge status={transaction.status} id={`user-${transaction.id}`} /></TableCell>
                          <TableCell className="font-semibold tabular-nums">{formatMoney(transaction.amountMinor, transaction.currency)}</TableCell>
                          <TableCell className="tabular-nums">{formatMoney(transaction.feeMinor, transaction.currency)}</TableCell>
                          <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Pager page={transactionResult?.page ?? page} pageSize={transactionResult?.pageSize ?? pageSize} total={transactionResult?.total ?? 0} onPage={setPage} />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {!detailQuery.isLoading && !detailQuery.isError && !detail && <EmptyState label="Le profil utilisateur n’est pas disponible." />}
    </AdminShell>
  );
}

function TransactionDetailPage({ transactionId }: { transactionId: string }) {
  const query = useGetAdminTransaction(transactionId);
  const transaction = query.data;

  return (
    <AdminShell section="transactions">
      <div className="sendflow-admin-page-intro sendflow-admin-detail-intro">
        <div>
          <Link href="/admin/transactions" className="sendflow-admin-back-link" data-testid="link-admin-transactions-back">
            <ArrowLeft className="size-4" /> Retour aux transactions
          </Link>
          <p className="sendflow-admin-overline">Fiche transaction</p>
          <h2 data-testid="heading-admin-transaction-detail">Détail de la transaction</h2>
          <p className="sendflow-admin-subtitle">Traçabilité des comptes source et destinataire, avec les références reçues par SendFlow.</p>
        </div>
        <div className="sendflow-admin-readonly-chip"><ShieldCheck className="size-4" /> Actions contrôlées</div>
      </div>

      {query.isLoading && (
        <div className="space-y-4" data-testid="loading-admin-transaction-detail">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      )}
      {query.isError && <QueryState error={query.error} onRetry={() => void query.refetch()} />}

      {transaction && !query.isError && (
        <div className="space-y-5" data-testid="content-admin-transaction-detail">
          <Card className="sendflow-admin-profile-banner">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="sendflow-admin-profile-heading">
                <span className="sendflow-admin-avatar sendflow-admin-avatar-large"><FileSearch className="size-5" /></span>
                <div>
                  <h3 data-testid="text-admin-transaction-reference">{transaction.reference}</h3>
                  <p data-testid="text-admin-transaction-id">{transaction.id}</p>
                </div>
              </div>
               <div className="sendflow-admin-profile-actions">
                 <StatusBadge status={transaction.status} id={`detail-${transaction.id}`} />
                 {!transaction.archivedAt && <AdminActionDialog kind="archive-transaction" targetId={transaction.id} />}
               </div>
            </CardContent>
          </Card>

          <div className="sendflow-admin-metric-grid sendflow-admin-detail-metric-grid">
            <MetricCard label="Montant" value={formatMoney(transaction.amountMinor, transaction.currency)} detail="Montant de l’opération" icon={Banknote} tone="green" />
            <MetricCard label="Frais" value={formatMoney(transaction.feeMinor, transaction.currency)} detail="Frais enregistrés" icon={FileSearch} tone="orange" />
            <MetricCard label="Type" value={transactionKindLabel(transaction.kind)} detail="Catégorie d’opération" icon={ArrowLeftRight} tone="violet" />
            <MetricCard label="Créée le" value={formatDate(transaction.createdAt)} detail="Date persistée" icon={Clock3} tone="blue" />
          </div>

          <div className="sendflow-admin-overview-grid">
            <Card className="sendflow-admin-detail-card">
              <CardHeader>
                <CardTitle>Traçabilité des comptes</CardTitle>
                <CardDescription>Numéros présents sur l’opération telle qu’enregistrée.</CardDescription>
              </CardHeader>
              <CardContent className="sendflow-admin-trace">
                <div className="sendflow-admin-trace-endpoint">
                  <span>Compte source</span>
                  <strong data-testid="text-admin-transaction-source">{transaction.senderPhone}</strong>
                  <small>Départ de l’opération</small>
                </div>
                <ArrowRight className="sendflow-admin-trace-arrow size-5" />
                <div className="sendflow-admin-trace-endpoint">
                  <span>Compte destinataire</span>
                  <strong data-testid="text-admin-transaction-destination">{transaction.recipientPhone}</strong>
                  <small>Destination de l’opération</small>
                </div>
              </CardContent>
            </Card>
            <Card className="sendflow-admin-detail-card">
              <CardHeader>
                <CardTitle>Compte SendFlow et réseau</CardTitle>
                <CardDescription>Contexte applicatif et références opérateur.</CardDescription>
              </CardHeader>
              <CardContent className="sendflow-admin-detail-list">
                <div><span>Utilisateur</span><Link href={`/admin/users/${transaction.userId}`} className="sendflow-admin-detail-link" data-testid="link-admin-transaction-user">{transaction.displayName || transaction.userId}</Link></div>
                <div><span>Téléphone du compte</span><strong data-testid="text-admin-transaction-user-phone">{transaction.userPhone || 'Non renseigné'}</strong></div>
                <div><span>Réseau de départ</span><strong data-testid="text-admin-transaction-from-operator"><AdminOperatorLabel operator={transaction.fromOperator} /></strong></div>
                <div><span>Réseau d’arrivée</span><strong data-testid="text-admin-transaction-to-operator"><AdminOperatorLabel operator={transaction.toOperator} /></strong></div>
              </CardContent>
            </Card>
          </div>

          <Card className="sendflow-admin-detail-card">
            <CardHeader>
              <CardTitle>Références et dates</CardTitle>
              <CardDescription>Identifiants de suivi disponibles sans exposer de secret d’idempotence.</CardDescription>
            </CardHeader>
            <CardContent className="sendflow-admin-detail-list sendflow-admin-detail-list-wide">
              <div><span>Référence SendFlow</span><strong data-testid="text-admin-transaction-reference-secondary">{transaction.reference}</strong></div>
              <div><span>Référence opérateur</span><strong data-testid="text-admin-transaction-provider-reference">{transaction.providerReference || 'Non renseignée'}</strong></div>
              <div><span>Dernière mise à jour</span><strong data-testid="text-admin-transaction-updated">{formatDate(transaction.updatedAt)}</strong></div>
            </CardContent>
          </Card>
        </div>
      )}
      {!query.isLoading && !query.isError && !transaction && <EmptyState label="La transaction n’est pas disponible." />}
    </AdminShell>
  );
}

function LoginActivityPage() {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const params = useMemo(() => ({
    ...(search ? { search } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    page,
    pageSize,
  }), [search, from, to, page]);
  const query = useListAdminLoginActivity(params);
  const result = query.data;
  const items = result?.items ?? [];

  const deviceIcon = (deviceType: string) => {
    if (deviceType === 'mobile') return Smartphone;
    if (deviceType === 'tablet') return Tablet;
    return Monitor;
  };

  return (
    <AdminShell section="login-activity">
      <div className="sendflow-admin-page-intro sendflow-admin-list-intro">
        <div>
          <p className="sendflow-admin-overline">Sécurité et traçabilité</p>
          <h2 data-testid="heading-admin-login-activity-list">Connexions utilisateurs</h2>
          <p className="sendflow-admin-subtitle">
            Une ligne est enregistrée par session Clerk détectée par SendFlow, avec les métadonnées réseau et appareil disponibles.
          </p>
        </div>
        <div className="sendflow-admin-readonly-chip"><ShieldCheck className="size-4" /> Données sensibles</div>
      </div>
      <Card className="sendflow-admin-list-card">
        <CardContent className="p-0">
          <div className="sendflow-admin-login-toolbar">
            <div className="sendflow-admin-search">
              <Search className="size-4" />
              <Input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Rechercher utilisateur, IP, ville ou session"
                aria-label="Rechercher une connexion"
                data-testid="input-admin-login-activity-search"
              />
            </div>
            <DateRange
              from={from}
              to={to}
              setFrom={(value) => { setFrom(value); setPage(1); }}
              setTo={(value) => { setTo(value); setPage(1); }}
            />
          </div>
          {query.isLoading && <div className="sendflow-admin-table-skeleton" data-testid="loading-admin-login-activity">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>}
          {query.isError && <div className="p-5"><QueryState error={query.error} onRetry={() => void query.refetch()} /></div>}
          {!query.isLoading && !query.isError && items.length === 0 && <EmptyState label="Aucune connexion enregistrée pour ces filtres." />}
          {!query.isLoading && !query.isError && items.length > 0 && (
            <>
              <Table className="sendflow-admin-login-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Connexion</TableHead>
                    <TableHead>Emplacement</TableHead>
                    <TableHead>Appareil</TableHead>
                    <TableHead>Navigateur et système</TableHead>
                    <TableHead>Session</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const DeviceIcon = deviceIcon(item.deviceType);
                    const location = [item.city, item.region, item.countryCode || item.countryName].filter(Boolean).join(', ');
                    return (
                      <TableRow key={item.id} data-testid={`row-admin-login-event-${item.id}`}>
                        <TableCell>
                          <div className="sendflow-admin-reference-cell">
                            <Link href={`/admin/users/${item.userId}`} className="sendflow-admin-detail-link">
                              <strong data-testid={`text-login-user-${item.id}`}>{item.displayName || 'Nom non renseigné'}</strong>
                            </Link>
                            <small>{item.phone || item.userId}</small>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="sendflow-admin-reference-cell">
                            <strong data-testid={`text-login-date-${item.id}`}>{formatDate(item.createdAt)}</strong>
                            <small>Session détectée</small>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="sendflow-admin-login-location">
                            <MapPin className="size-4" aria-hidden="true" />
                            <div>
                              <strong data-testid={`text-login-location-${item.id}`}>{location || 'Localisation indisponible'}</strong>
                              <small data-testid={`text-login-ip-${item.id}`}>{item.ipAddress}</small>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="sendflow-admin-login-device">
                            <DeviceIcon className="size-4" aria-hidden="true" />
                            <span>{item.deviceType}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="sendflow-admin-reference-cell">
                            <strong>{item.browser}</strong>
                            <small>{item.operatingSystem}</small>
                            {item.userAgent && <small className="sendflow-admin-login-user-agent" title={item.userAgent}>{item.userAgent}</small>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="sendflow-admin-reference-cell">
                            <strong className="sendflow-admin-login-session" title={item.sessionId}>{item.sessionId}</strong>
                            <small>{item.locationSource ? `Localisation : ${item.locationSource}` : 'Ville non fournie par le proxy'}</small>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

function TransactionsPage({ section }: { section: 'transactions' | 'deposits' | 'international' | 'transfers' }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const kind: TransactionKind | undefined =
    section === 'deposits'
      ? 'deposit'
      : section === 'international'
        ? 'international'
        : section === 'transfers'
          ? 'inter-network'
          : undefined;
  const params = useMemo(() => ({
    ...(kind ? { kind } : {}),
    ...(search ? { search } : {}),
    ...(status !== 'all' ? { status: status as Status } : {}),
    page,
    pageSize,
  }), [kind, search, status, page]);
  const query = useListAdminTransactions(params);
  const result = query.data;
  const items = result?.items ?? [];
  const title =
    section === 'deposits'
      ? 'Dépôts mobile-money'
      : section === 'international'
        ? 'Transferts internationaux'
        : section === 'transfers'
          ? 'Transferts inter-réseaux'
          : 'Toutes les transactions';
  const eyebrow =
    section === 'deposits'
      ? 'Flux entrants'
      : section === 'transactions'
        ? 'Traçabilité globale'
        : 'Flux sortants';
  const emptyLabel =
    section === 'deposits'
      ? 'Aucun dépôt ne correspond à vos filtres.'
      : section === 'international'
        ? 'Aucun transfert international ne correspond à vos filtres.'
        : section === 'transfers'
          ? 'Aucun transfert inter-réseaux ne correspond à vos filtres.'
          : 'Aucune transaction ne correspond à vos filtres.';

  return (
    <AdminShell section={section}>
      <div className="sendflow-admin-page-intro sendflow-admin-list-intro">
        <div><p className="sendflow-admin-overline">{eyebrow}</p><h2 data-testid={`heading-admin-${section}-list`}>{title}</h2><p className="sendflow-admin-subtitle">Consultez chaque opération et ouvrez sa fiche pour retracer le compte source, la destination et les références.</p></div>
        <div className="sendflow-admin-currency-note"><span>Devise</span><strong>FCFA</strong></div>
      </div>
      <Card className="sendflow-admin-list-card">
        <CardContent className="p-0">
          <FilterBar search={search} setSearch={(value) => { setSearch(value); setPage(1); }} status={status} setStatus={(value) => { setStatus(value); setPage(1); }} />
          {query.isLoading && <div className="sendflow-admin-table-skeleton" data-testid={`loading-admin-${section}`}>{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>}
          {query.isError && <div className="p-5"><QueryState error={query.error} onRetry={() => void query.refetch()} /></div>}
          {!query.isLoading && !query.isError && items.length === 0 && <EmptyState label={emptyLabel} />}
          {!query.isLoading && !query.isError && items.length > 0 && (
            <>
              <Table className="sendflow-admin-transactions-table">
                <TableHeader><TableRow><TableHead>Référence</TableHead><TableHead>Compte source</TableHead><TableHead>Compte destinataire</TableHead><TableHead>Utilisateur</TableHead><TableHead>Opération</TableHead><TableHead>Statut</TableHead><TableHead>Montant</TableHead><TableHead>Frais</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((transaction) => (
                    <TableRow key={transaction.id} data-testid={`row-admin-transaction-${transaction.id}`}>
                      <TableCell><div className="sendflow-admin-reference-cell"><Link href={`/admin/transactions/${transaction.id}`} className="sendflow-admin-transaction-link"><strong data-testid={`text-transaction-reference-${transaction.id}`}>{transaction.reference}</strong></Link><small>{transaction.providerReference || 'Référence opérateur indisponible'}</small></div></TableCell>
                      <TableCell><div className="sendflow-admin-reference-cell"><strong data-testid={`text-transaction-source-${transaction.id}`}>{transaction.senderPhone}</strong><small><AdminOperatorLabel operator={transaction.fromOperator} /></small></div></TableCell>
                      <TableCell><div className="sendflow-admin-reference-cell"><strong data-testid={`text-transaction-destination-${transaction.id}`}>{transaction.recipientPhone}</strong><small><AdminOperatorLabel operator={transaction.toOperator} /></small></div></TableCell>
                      <TableCell><div className="sendflow-admin-reference-cell"><Link href={`/admin/users/${transaction.userId}`} className="sendflow-admin-detail-link"><strong data-testid={`text-transaction-user-${transaction.id}`}>{transaction.displayName || 'Nom non renseigné'}</strong></Link><small>{transaction.userId}</small></div></TableCell>
                      <TableCell data-testid={`text-transaction-kind-${transaction.id}`}>{transactionKindLabel(transaction.kind)}</TableCell>
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

type BannerFormValues = {
  title: string;
  description: string;
  imageUrl: string;
  mobileImageUrl: string;
  imageAlt: string;
  ctaLabel: string;
  targetUrl: string;
  sortOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

function isSafeBannerUrl(value: string, allowEmpty = true) {
  if (!value.trim()) return allowEmpty;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isAllowedBannerImageUrl(value: string, allowEmpty = true) {
  if (!value.trim()) return allowEmpty;
  if (/^\/banners\/[a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp)$/i.test(value.trim())) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function toDateInput(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDatePayload(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function bannerFormValues(banner?: AdminBanner): BannerFormValues {
  return {
    title: banner?.title ?? '',
    description: banner?.description ?? '',
    imageUrl: banner?.imageUrl ?? '',
    mobileImageUrl: banner?.mobileImageUrl ?? '',
    imageAlt: banner?.imageAlt ?? '',
    ctaLabel: banner?.ctaLabel ?? '',
    targetUrl: banner?.targetUrl ?? '',
    sortOrder: banner?.sortOrder ?? 0,
    isActive: banner?.isActive ?? true,
    startsAt: toDateInput(banner?.startsAt),
    endsAt: toDateInput(banner?.endsAt),
  };
}

function BannerEditorDialog({
  open,
  banner,
  pending,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  banner?: AdminBanner;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BannerInput | BannerUpdate, editing: boolean) => void;
}) {
  const form = useForm<BannerFormValues>({
    defaultValues: bannerFormValues(banner),
    mode: 'onChange',
  });

  useEffect(() => {
    if (open) form.reset(bannerFormValues(banner));
  }, [banner, form, open]);

  const handleSubmit = (values: BannerFormValues) => {
    if (!isAllowedBannerImageUrl(values.imageUrl, false)) {
      form.setError('imageUrl', { message: 'Utilisez une URL HTTPS ou un visuel SendFlow sous /banners/.' });
      return;
    }
    if (values.mobileImageUrl && !isAllowedBannerImageUrl(values.mobileImageUrl, false)) {
      form.setError('mobileImageUrl', { message: 'Utilisez une URL HTTPS ou un visuel SendFlow sous /banners/.' });
      return;
    }
    if (values.startsAt && values.endsAt && new Date(values.endsAt).getTime() <= new Date(values.startsAt).getTime()) {
      form.setError('endsAt', { message: 'La fin doit être postérieure au début.' });
      return;
    }
    if (values.ctaLabel.trim() && !values.targetUrl.trim()) {
      form.setError('targetUrl', { message: 'Ajoutez une destination pour ce bouton.' });
      return;
    }
    if (!isSafeBannerUrl(values.targetUrl)) {
      form.setError('targetUrl', { message: 'Utilisez un chemin interne ou une URL HTTPS.' });
      return;
    }
    const shared = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      imageUrl: values.imageUrl.trim(),
      mobileImageUrl: values.mobileImageUrl.trim() || null,
      imageAlt: values.imageAlt.trim(),
      ctaLabel: values.ctaLabel.trim() || null,
      targetUrl: values.targetUrl.trim() || null,
      sortOrder: Number(values.sortOrder) || 0,
      isActive: values.isActive,
      startsAt: toDatePayload(values.startsAt),
      endsAt: toDatePayload(values.endsAt),
    };
    onSubmit(shared, Boolean(banner));
  };

  const fieldError = (name: keyof BannerFormValues) => Boolean(form.formState.errors[name]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sendflow-banner-dialog">
        <DialogHeader>
          <DialogTitle>{banner ? 'Modifier la bannière' : 'Nouvelle bannière'}</DialogTitle>
          <DialogDescription>
            Utilisez une URL HTTPS publique ou un visuel intégré sous /banners/. Les dates sont optionnelles et interprétées selon votre fuseau local.
          </DialogDescription>
          <div className="sendflow-banner-upload-notice" data-testid="notice-banner-upload-unavailable">
            <CircleAlert className="size-4" />
            <span><strong>Import direct temporairement indisponible.</strong> Vous pouvez utiliser une URL HTTPS hébergée ou les visuels SendFlow intégrés. L’envoi de fichiers sera ajouté lorsque le stockage persistant sera disponible.</span>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="sendflow-banner-form" data-testid="form-admin-banner">
            <div className="sendflow-banner-form-grid">
              <FormField control={form.control} name="title" rules={{ required: 'Le titre est requis.', maxLength: { value: 120, message: '120 caractères maximum.' } }} render={({ field }) => (
                <FormItem><FormLabel>Titre</FormLabel><FormControl><Input {...field} placeholder="Un transfert plus simple" data-testid="input-banner-title" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="imageAlt" rules={{ required: 'Le texte alternatif est requis.', maxLength: { value: 180, message: '180 caractères maximum.' } }} render={({ field }) => (
                <FormItem><FormLabel>Texte alternatif</FormLabel><FormControl><Input {...field} placeholder="Illustration d’une offre SendFlow" data-testid="input-banner-alt" /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={3} placeholder="Le détail visible sous le titre." data-testid="input-banner-description" /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="sendflow-banner-form-grid">
              <FormField control={form.control} name="imageUrl" rules={{ required: 'L’image principale est requise.' }} render={({ field }) => (
                <FormItem><FormLabel>Image desktop · URL HTTPS ou média SendFlow</FormLabel><FormControl><Input {...field} type="text" placeholder="https://… ou /banners/sendflow-international.jpg" data-testid="input-banner-image-url" className={fieldError('imageUrl') ? 'border-destructive' : ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="mobileImageUrl" render={({ field }) => (
                <FormItem><FormLabel>Image mobile · URL HTTPS ou média SendFlow</FormLabel><FormControl><Input {...field} type="text" placeholder="Optionnel" data-testid="input-banner-mobile-image-url" className={fieldError('mobileImageUrl') ? 'border-destructive' : ''} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="sendflow-banner-form-grid">
              <FormField control={form.control} name="ctaLabel" rules={{ maxLength: { value: 48, message: '48 caractères maximum.' } }} render={({ field }) => (
                <FormItem><FormLabel>Libellé du bouton</FormLabel><FormControl><Input {...field} placeholder="Découvrir" data-testid="input-banner-cta" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="targetUrl" render={({ field }) => (
                <FormItem><FormLabel>Destination</FormLabel><FormControl><Input {...field} placeholder="/international-transfer ou https://..." data-testid="input-banner-target-url" className={fieldError('targetUrl') ? 'border-destructive' : ''} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="sendflow-banner-form-grid">
              <FormField control={form.control} name="startsAt" render={({ field }) => (
                <FormItem><FormLabel>Début de publication</FormLabel><FormControl><Input {...field} type="datetime-local" data-testid="input-banner-starts-at" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="endsAt" render={({ field }) => (
                <FormItem><FormLabel>Fin de publication</FormLabel><FormControl><Input {...field} type="datetime-local" data-testid="input-banner-ends-at" /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="sendflow-banner-form-options">
              <FormField control={form.control} name="sortOrder" render={({ field }) => (
                <FormItem className="max-w-[140px]"><FormLabel>Ordre</FormLabel><FormControl><Input {...field} type="number" min={0} onChange={(event) => field.onChange(Number(event.target.value))} data-testid="input-banner-sort-order" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem className="sendflow-banner-switch-row"><div><FormLabel>Publication active</FormLabel><p>La bannière sera visible si les dates l’autorisent.</p></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-banner-active" /></FormControl></FormItem>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel-banner">Annuler</Button>
              <Button type="submit" disabled={pending} data-testid="button-save-banner">{pending ? 'Enregistrement…' : banner ? 'Enregistrer les modifications' : 'Créer la bannière'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function BannersPage() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AdminBanner | undefined>();
  const [deletingBanner, setDeletingBanner] = useState<AdminBanner | undefined>();
  const [feedback, setFeedback] = useState('');
  const query = useListAdminBanners({ query: { queryKey: getListAdminBannersQueryKey() } });
  const items = [...(query.data?.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const invalidateBanners = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListAdminBannersQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListPublishedBannersQueryKey() }),
    ]);
  };
  const create = useCreateAdminBanner({
    mutation: {
      onSuccess: async () => {
        await invalidateBanners();
        setEditorOpen(false);
        setFeedback('Bannière créée.');
      },
    },
  });
  const update = useUpdateAdminBanner({
    mutation: {
      onSuccess: async () => {
        await invalidateBanners();
        setEditorOpen(false);
        setFeedback('Bannière mise à jour.');
      },
    },
  });
  const remove = useDeleteAdminBanner({
    mutation: {
      onSuccess: async () => {
        await invalidateBanners();
        setDeletingBanner(undefined);
        setFeedback('Bannière supprimée.');
      },
    },
  });
  const reorder = useReorderAdminBanners({
    mutation: {
      onSuccess: async () => {
        await invalidateBanners();
        setFeedback('Ordre des bannières mis à jour.');
      },
    },
  });
  const error = query.error ?? create.error ?? update.error ?? remove.error ?? reorder.error;
  const pending = create.isPending || update.isPending || remove.isPending || reorder.isPending;

  const submitBanner = (data: BannerInput | BannerUpdate, editing: boolean) => {
    if (editing && editingBanner) update.mutate({ bannerId: editingBanner.id, data: data as BannerUpdate });
    else create.mutate({ data: data as BannerInput });
  };

  const toggleActive = (banner: AdminBanner) => {
    update.mutate({ bannerId: banner.id, data: { isActive: !banner.isActive } });
  };

  const moveBanner = (banner: AdminBanner, direction: -1 | 1) => {
    const index = items.findIndex((item) => item.id === banner.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= items.length) return;
    const expectedOrder = items.map((item) => item.id);
    const orderedIds = [...expectedOrder];
    [orderedIds[index], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[index]];
    reorder.mutate({ data: { expectedOrder, orderedIds } });
  };

  return (
    <AdminShell section="banners">
      <div className="sendflow-admin-page-intro sendflow-banner-intro">
        <div>
          <p className="sendflow-admin-overline">Contenu de l’espace client</p>
          <h2 data-testid="heading-admin-banners">Bannières qui arrivent au bon moment.</h2>
          <p className="sendflow-admin-subtitle">Pilotez les visuels, les destinations et la fenêtre de publication du carrousel de l’accueil.</p>
        </div>
        {query.isSuccess && <Button onClick={() => { setEditingBanner(undefined); setEditorOpen(true); }} data-testid="button-create-banner"><Plus className="size-4" /> Nouvelle bannière</Button>}
      </div>
      {feedback && <Alert className="sendflow-banner-feedback" data-testid="status-banner-feedback"><CheckCircle2 className="size-4" /><AlertDescription>{feedback}</AlertDescription></Alert>}
      {error && <QueryState error={error} onRetry={() => {
        if (query.isError) void query.refetch();
        else void invalidateBanners();
      }} />}
      {query.isLoading && <div className="sendflow-banner-list" data-testid="loading-admin-banners">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-48 rounded-2xl" />)}</div>}
      {!query.isLoading && !query.isError && items.length === 0 && <EmptyState label="Aucune bannière n’est configurée. Créez la première campagne pour l’espace client." />}
      {!query.isLoading && !query.isError && items.length > 0 && (
        <div className="sendflow-banner-list" data-testid="list-admin-banners">
          {items.map((banner, index) => (
            <Card key={banner.id} className="sendflow-banner-admin-card" data-testid={`card-admin-banner-${banner.id}`}>
              <div className="sendflow-banner-thumb">
                <img src={banner.imageUrl} alt="" />
                <span className={`sendflow-banner-status ${banner.isActive ? 'is-active' : 'is-inactive'}`} data-testid={`status-banner-${banner.id}`}>{banner.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <CardContent className="sendflow-banner-admin-content">
                <div className="sendflow-banner-admin-heading">
                  <div><p className="sendflow-banner-order">Position {index + 1}</p><h3 data-testid={`text-banner-title-${banner.id}`}>{banner.title}</h3><p>{banner.description || 'Aucune description'}</p></div>
                  <div className="sendflow-banner-reorder" aria-label={`Réordonner ${banner.title}`}>
                    <Button variant="ghost" size="icon" aria-label={`Monter ${banner.title}`} disabled={index === 0 || pending} onClick={() => moveBanner(banner, -1)} data-testid={`button-banner-up-${banner.id}`}><ArrowUpRight className="size-4 rotate-[-45deg]" /></Button>
                    <GripVertical className="size-4 text-muted-foreground" />
                    <Button variant="ghost" size="icon" aria-label={`Descendre ${banner.title}`} disabled={index === items.length - 1 || pending} onClick={() => moveBanner(banner, 1)} data-testid={`button-banner-down-${banner.id}`}><ArrowUpRight className="size-4 rotate-[135deg]" /></Button>
                  </div>
                </div>
                <div className="sendflow-banner-meta">
                  <span><CalendarDays className="size-3.5" /> {banner.startsAt ? formatDate(banner.startsAt) : 'Dès maintenant'}</span>
                  <span><Clock3 className="size-3.5" /> {banner.endsAt ? `Jusqu’au ${formatDate(banner.endsAt)}` : 'Sans date de fin'}</span>
                  {banner.targetUrl && <span><ExternalLink className="size-3.5" /> {banner.targetUrl}</span>}
                </div>
                <div className="sendflow-banner-actions">
                  <Button variant="outline" size="sm" onClick={() => { setEditingBanner(banner); setEditorOpen(true); }} data-testid={`button-edit-banner-${banner.id}`}><Pencil className="size-3.5" /> Modifier</Button>
                  <Button variant="outline" size="sm" onClick={() => toggleActive(banner)} disabled={pending} data-testid={`button-toggle-banner-${banner.id}`}><Power className="size-3.5" /> {banner.isActive ? 'Désactiver' : 'Activer'}</Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeletingBanner(banner)} data-testid={`button-delete-banner-${banner.id}`}><Trash2 className="size-3.5" /> Supprimer</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <BannerEditorDialog open={editorOpen} banner={editingBanner} pending={create.isPending || update.isPending} onOpenChange={setEditorOpen} onSubmit={submitBanner} />
      <AlertDialog open={Boolean(deletingBanner)} onOpenChange={(open) => { if (!open) setDeletingBanner(undefined); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Supprimer cette bannière&nbsp;?</AlertDialogTitle><AlertDialogDescription>Cette action retire définitivement « {deletingBanner?.title} » des contenus administrés.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel data-testid="button-cancel-delete-banner">Annuler</AlertDialogCancel><AlertDialogAction onClick={() => deletingBanner && remove.mutate({ bannerId: deletingBanner.id })} disabled={remove.isPending} data-testid="button-confirm-delete-banner">Supprimer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

export function AdminRouter() {
  const [isUserDetail, userRoute] = useRoute('/admin/users/:userId');
  const [isTransactionDetail, transactionRoute] = useRoute('/admin/transactions/:transactionId');
  const [isOverview] = useRoute('/admin');
  const [isUsers] = useRoute('/admin/users');
  const [isTransactions] = useRoute('/admin/transactions');
  const [isDeposits] = useRoute('/admin/deposits');
  const [isInternational] = useRoute('/admin/international');
  const [isTransfers] = useRoute('/admin/transfers');
  const [isLoginActivity] = useRoute('/admin/login-activity');
  const [isBanners] = useRoute('/admin/banners');
  if (isUserDetail && userRoute?.userId) return <UserDetailPage userId={userRoute.userId} />;
  if (isTransactionDetail && transactionRoute?.transactionId) return <TransactionDetailPage transactionId={transactionRoute.transactionId} />;
  if (isOverview) return <OverviewPage />;
  if (isUsers) return <UsersPage />;
  if (isTransactions) return <TransactionsPage section="transactions" />;
  if (isDeposits) return <TransactionsPage section="deposits" />;
  if (isInternational) return <TransactionsPage section="international" />;
  if (isTransfers) return <TransactionsPage section="transfers" />;
  if (isLoginActivity) return <LoginActivityPage />;
  if (isBanners) return <BannersPage />;
  return <OverviewPage />;
}
