import { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowDownToLine,
  BadgePercent,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  Headphones,
  History,
  LockKeyhole,
  Menu,
  LogOut,
  Radio,
  X,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { Link, Redirect, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetCurrentAccount,
  getGetCurrentAccountQueryKey,
  useListPublishedBanners,
  getListPublishedBannersQueryKey,
  useSignOutCustomer,
} from '@workspace/api-client-react';
import { NativeWalletIcon } from '@/components/native-wallet-icon';
import { TransactionCard } from '@/components/transaction-card';
import { useCustomerTransactions } from '@/lib/customer-transactions';
import { clearPinUnlock } from '@/lib/pin-unlock';
import { formatCurrencyMinor, toTransactionView } from '@/lib/transactions';
import { notifications } from '@/lib/notifications';
import { useSeo } from '@/lib/seo';
import { readAccountProfile } from '@/lib/account-profile';
import { getAvatarForUser, getCurrentAvatarUserKey } from '@/lib/avatar-bank';
import notificationBell from '@assets/633486_1789677628502.png';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/téléchargement_1789667092840.png';

type SheetName = 'notifications' | null;
const NOTIFICATIONS_READ_KEY = 'sendflow.notifications.read';

function safeBannerDestination(targetUrl: string | null | undefined) {
  if (!targetUrl) return null;
  if (targetUrl.startsWith('/') && !targetUrl.startsWith('//')) return targetUrl;
  try {
    const url = new URL(targetUrl);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function ActionTile({
  icon,
  label,
  detail,
  onClick,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button type="button" className="sendflow-action-tile" onClick={onClick} data-testid={testId}>
      <span className="sendflow-action-icon" aria-hidden="true">{icon}</span>
      <span className="sendflow-action-label">{label}</span>
      {detail && <span className="sendflow-action-detail">{detail}</span>}
    </button>
  );
}

export default function AccountPage() {
  const [, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const accountProfile = readAccountProfile();
  const profileAvatar = getAvatarForUser(getCurrentAvatarUserKey(accountProfile));
  const accountQuery = useGetCurrentAccount({
    query: { queryKey: getGetCurrentAccountQueryKey(), enabled: isUnlocked },
  });
  const transactionsQuery = useCustomerTransactions(accountQuery.data?.userId);
  const recentTransactions = transactionsQuery.data?.items.slice(0, 5) ?? [];
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(() => (
    window.sessionStorage.getItem(NOTIFICATIONS_READ_KEY) === 'true' ? 0 : notifications.length
  ));
  const [walletVisible, setWalletVisible] = useState(true);
  const bannersQuery = useListPublishedBanners({ query: { queryKey: getListPublishedBannersQueryKey() } });
  const publishedBanners = bannersQuery.data?.items ?? [];
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const signOutCustomer = useSignOutCustomer();
  const queryClient = useQueryClient();

  useEffect(() => {
    setActiveBannerIndex((current) => publishedBanners.length ? Math.min(current, publishedBanners.length - 1) : 0);
  }, [publishedBanners.length]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    if (carouselPaused || reducedMotion || publishedBanners.length < 2 || bannersQuery.isLoading || bannersQuery.isError) return;
    const timer = window.setInterval(() => {
      setActiveBannerIndex((current) => (current + 1) % publishedBanners.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [bannersQuery.isError, bannersQuery.isLoading, carouselPaused, publishedBanners.length, reducedMotion]);

  useSeo({
    path: '/account',
    locale: 'fr',
    title: 'Mon compte · SendFlow',
    description: 'Votre espace SendFlow.',
    robots: 'noindex,nofollow',
  });

  useEffect(() => {
    if (!isUnlocked) {
      setLocation('/sign-in');
    }
  }, [isUnlocked, setLocation]);

  useEffect(() => {
    if (!menuOpen && !sheet) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehaviorY;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehaviorY = 'none';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehaviorY = previousOverscrollBehavior;
    };
  }, [menuOpen, sheet]);

  useEffect(() => {
    if (!menuOpen && !sheet) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setSheet(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [menuOpen, sheet]);

  if (!isUnlocked) return <Redirect to="/sign-in" />;

  const openSheet = (nextSheet: Exclude<SheetName, null>) => {
    setMenuOpen(false);
    setSheet(nextSheet);
  };

  const openTransaction = (transactionId: string) => {
    setMenuOpen(false);
    setLocation(`/transaction/${encodeURIComponent(transactionId)}`);
  };

  const openHistory = () => {
    setMenuOpen(false);
    setSheet(null);
    setLocation('/history');
  };

  const closePanels = () => {
    setMenuOpen(false);
    setSheet(null);
  };

  return (
    <main className="sendflow-dashboard-shell">
      <section className="sendflow-dashboard" aria-labelledby="wallet-title">
        <header className="sendflow-dashboard-header">
          <div className="sendflow-dashboard-header-inner">
            <button type="button" className="sendflow-header-button" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu" aria-expanded={menuOpen} data-testid="button-open-menu">
              <Menu size={25} strokeWidth={2} />
            </button>
            <Link href="/account" className="sendflow-dashboard-brand" aria-label="SendFlow, accueil" data-testid="link-dashboard-home">
              <img className="sendflow-dashboard-mark" src={sendflowMark} alt="" />
              <img className="sendflow-dashboard-wordmark" src={sendflowWordmark} alt="SendFlow" />
            </Link>
            <button type="button" className={`sendflow-header-button sendflow-notification-button${unreadNotificationCount > 0 ? ' has-unread' : ''}`} onClick={() => { setUnreadNotificationCount(0); window.sessionStorage.setItem(NOTIFICATIONS_READ_KEY, 'true'); setLocation('/notifications'); }} aria-label="Voir les notifications" data-testid="button-open-notifications">
              <img className="sendflow-notification-icon" src={notificationBell} alt="" />
              {unreadNotificationCount > 0 && <span className="sendflow-notification-badge" aria-label={`${Math.min(unreadNotificationCount, 99)} notification${unreadNotificationCount > 1 ? 's' : ''} non lue${unreadNotificationCount > 1 ? 's' : ''}`}>{Math.min(unreadNotificationCount, 99)}</span>}
            </button>
          </div>
        </header>

        <section className="sendflow-dashboard-content">
          <section className="sendflow-wallet-card" aria-labelledby="wallet-title">
            <div className="sendflow-wallet-topline">
              <div className="sendflow-wallet-heading">
                <span className="sendflow-wallet-icon"><NativeWalletIcon className="is-wallet-card" /></span>
                <div>
                  <p>Wallet interne</p>
                  <h1 id="wallet-title">Mon wallet</h1>
                </div>
              </div>
              <button
                type="button"
                className="sendflow-wallet-visibility"
                onClick={() => setWalletVisible((current) => !current)}
                aria-label={walletVisible ? 'Masquer le solde du wallet' : 'Afficher le solde du wallet'}
                data-testid="button-toggle-wallet-balance"
              >
                {walletVisible ? <Eye size={20} /> : <EyeOff size={20} />}
              </button>
            </div>
            <div className="sendflow-wallet-balance-row">
              <strong>
                {walletVisible
                  ? accountQuery.isLoading
                    ? '…'
                    : accountQuery.isError || !accountQuery.data
                      ? '—'
                      : formatCurrencyMinor(
                          accountQuery.data.wallet.balanceMinor,
                          accountQuery.data.wallet.currency,
                        )
                  : '••••'}
              </strong>
            </div>
            <div className="sendflow-wallet-footer">
              <span>
                {accountQuery.isError
                  ? 'Solde indisponible'
                  : accountQuery.data?.wallet.status === 'active'
                    ? 'Solde disponible'
                    : 'Statut du wallet indisponible'}
              </span>
            </div>
          </section>

          <nav className="sendflow-action-grid" aria-label="Actions principales">
            <ActionTile icon={<Globe2 size={44} strokeWidth={2.2} />} label="Transfert international" onClick={() => { setMenuOpen(false); setSheet(null); setLocation('/international-transfer'); }} testId="button-transfer-international" />
            <ActionTile icon={<ArrowLeftRight size={44} strokeWidth={2.5} />} label="Transfert inter réseau" onClick={() => { setMenuOpen(false); setSheet(null); setLocation('/inter-transfer'); }} testId="button-transfer-inter-network" />
            <ActionTile icon={<History size={44} strokeWidth={2.4} />} label="Historique" onClick={openHistory} testId="button-view-history" />
            <ActionTile icon={<ArrowDownToLine size={44} strokeWidth={2.2} />} label="Dépôt" onClick={() => { setMenuOpen(false); setSheet(null); setLocation('/deposit'); }} testId="button-open-deposit" />
          </nav>

          <section className="sendflow-promo-section" aria-label="Actualités SendFlow">
            {bannersQuery.isLoading && (
              <div className="sendflow-promo-loading" data-testid="loading-published-banners">
                <span /><span />
              </div>
            )}
            {bannersQuery.isError && (
              <div className="sendflow-promo-state is-error" data-testid="alert-published-banners">
                <strong>Les offres ne sont pas disponibles.</strong>
                <button type="button" onClick={() => void bannersQuery.refetch()} data-testid="button-retry-published-banners">Réessayer</button>
              </div>
            )}
            {!bannersQuery.isLoading && !bannersQuery.isError && publishedBanners.length === 0 && (
              <div className="sendflow-promo-state" data-testid="empty-published-banners">
                <span className="sendflow-promo-state-mark" aria-hidden="true"><Radio size={18} /></span>
                <span><strong>Votre espace SendFlow, au calme.</strong><small>Les nouvelles offres apparaîtront ici.</small></span>
              </div>
            )}
            {!bannersQuery.isLoading && !bannersQuery.isError && publishedBanners.length > 0 && (
              <div
                className="sendflow-promo-carousel"
                role="region"
                aria-roledescription="carrousel"
                aria-label="Actualités SendFlow"
                onMouseEnter={() => setCarouselPaused(true)}
                onMouseLeave={() => setCarouselPaused(false)}
                onFocus={() => setCarouselPaused(true)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCarouselPaused(false);
                }}
                data-testid="carousel-published-banners"
              >
                <div className="sendflow-promo-viewport">
                  <div
                    className="sendflow-promo-track is-live"
                    style={{ transform: `translate3d(-${activeBannerIndex * 100}%, 0, 0)` }}
                    aria-live={carouselPaused ? 'polite' : 'off'}
                  >
                  {publishedBanners.map((banner) => {
                    const destination = safeBannerDestination(banner.targetUrl);
                    const isActive = publishedBanners[activeBannerIndex]?.id === banner.id;
                    return (
                      <button
                        type="button"
                        className={`sendflow-promo-card${isActive ? ' is-active' : ''}`}
                        key={banner.id}
                        onClick={() => {
                          if (!destination) return;
                          setMenuOpen(false);
                          setSheet(null);
                          if (destination.startsWith('/')) setLocation(destination);
                          else window.location.assign(destination);
                        }}
                        disabled={!destination}
                        aria-hidden={!isActive}
                        tabIndex={isActive ? 0 : -1}
                        aria-label={`${banner.title}${banner.ctaLabel ? ` · ${banner.ctaLabel}` : ''}`}
                        data-testid={`button-published-banner-${banner.id}`}
                      >
                        <picture className="sendflow-promo-image">
                          {banner.mobileImageUrl && <source media="(max-width: 520px)" srcSet={banner.mobileImageUrl} />}
                          <img src={banner.imageUrl} alt={banner.imageAlt} />
                        </picture>
                        <span className="sendflow-promo-overlay" />
                        <span className="sendflow-promo-copy">
                          <strong>{banner.title}</strong>
                          {banner.description && <small>{banner.description}</small>}
                        </span>
                        {banner.ctaLabel && <span className="sendflow-promo-cta">{banner.ctaLabel} <ChevronRight size={16} /></span>}
                      </button>
                    );
                  })}
                  </div>
                </div>
                {publishedBanners.length > 1 && (
                  <div className="sendflow-promo-controls">
                    <button
                      type="button"
                      className="sendflow-promo-arrow"
                      onClick={() => setActiveBannerIndex((current) => (current - 1 + publishedBanners.length) % publishedBanners.length)}
                      aria-label="Bannière précédente"
                      data-testid="button-previous-published-banner"
                    >
                      <ChevronRight size={18} className="rotate-180" />
                    </button>
                    <div className="sendflow-promo-dots" role="tablist" aria-label="Choisir une bannière">
                      {publishedBanners.map((banner, index) => (
                        <button
                          key={banner.id}
                          type="button"
                          role="tab"
                          aria-selected={index === activeBannerIndex}
                          aria-label={`Afficher la bannière ${index + 1} sur ${publishedBanners.length}`}
                          className={`sendflow-promo-dot${index === activeBannerIndex ? ' is-active' : ''}`}
                          onClick={() => setActiveBannerIndex(index)}
                          data-testid={`button-published-banner-slide-${banner.id}`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="sendflow-promo-arrow"
                      onClick={() => setActiveBannerIndex((current) => (current + 1) % publishedBanners.length)}
                      aria-label="Bannière suivante"
                      data-testid="button-next-published-banner"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="sendflow-transactions" id="transactions" aria-labelledby="transactions-title">
            <div className="sendflow-section-heading">
              <div>
                <h2 id="transactions-title">Transactions récentes</h2>
              </div>
              <button type="button" className="sendflow-see-all" onClick={openHistory} data-testid="button-view-all-transactions">Voir tout <ChevronRight size={18} /></button>
            </div>
            <div className="sendflow-transaction-list">
              {accountQuery.isLoading && <p className="sendflow-history-empty">Chargement de votre compte…</p>}
              {accountQuery.isError && <p className="sendflow-history-empty" role="alert">Impossible de charger vos données de compte.</p>}
              {transactionsQuery.isLoading && <p className="sendflow-history-empty">Chargement des transactions…</p>}
              {transactionsQuery.isError && (
                <p className="sendflow-history-empty" role="alert">
                  Historique indisponible.
                  <button type="button" onClick={() => void transactionsQuery.refetch()}>Réessayer</button>
                </p>
              )}
              {!accountQuery.isLoading && !accountQuery.isError && !transactionsQuery.isLoading && !transactionsQuery.isError && recentTransactions.map((record) => (
                <TransactionCard
                  key={record.id}
                  transaction={toTransactionView(record)}
                  onClick={() => openTransaction(record.id)}
                  testId={`button-transaction-${record.id}`}
                />
              ))}
              {!accountQuery.isLoading && !accountQuery.isError && !transactionsQuery.isLoading && !transactionsQuery.isError && recentTransactions.length === 0 && (
                <p className="sendflow-history-empty">Aucune transaction pour le moment.</p>
              )}
            </div>
          </section>
        </section>

      </section>

      {menuOpen && (
        <div className="sendflow-panel-layer">
          <button type="button" className="sendflow-panel-backdrop" onClick={closePanels} aria-label="Fermer le menu" data-testid="button-close-menu-backdrop" />
          <aside className="sendflow-side-menu" aria-label="Menu SendFlow">
            <div className="sendflow-side-menu-top">
              <div className="sendflow-side-brand"><img src={sendflowMark} alt="" /><img className="sendflow-side-wordmark" src={sendflowWordmark} alt="SendFlow" /></div>
              <button type="button" className="sendflow-close-button" onClick={closePanels} aria-label="Fermer le menu" data-testid="button-close-menu"><X size={20} /></button>
            </div>
             <div className="sendflow-menu-profile"><img className="sendflow-profile-avatar" src={profileAvatar.src} alt="" /><span><strong>{accountProfile.firstName} {accountProfile.lastName}</strong><small>Compte personnel</small></span></div>
            <div className="sendflow-menu-links">
                <button type="button" onClick={() => { setMenuOpen(false); setSheet(null); setLocation('/account-info'); }} data-testid="button-menu-account-info"><UserRound size={19} />Informations du compte<ChevronRight size={17} /></button>
                <button type="button" onClick={() => { setMenuOpen(false); setSheet(null); setLocation('/change-pin'); }} data-testid="button-menu-change-secret"><LockKeyhole size={19} />Modifier le code PIN<ChevronRight size={17} /></button>
                <button type="button" onClick={() => { setMenuOpen(false); setSheet(null); setLocation('/pricing'); }} data-testid="button-menu-pricing"><BadgePercent size={19} />Tarification<ChevronRight size={17} /></button>
                <button type="button" onClick={() => { setMenuOpen(false); setSheet(null); setLocation('/account-limit'); }} data-testid="button-menu-limit"><WalletCards size={19} />Plafond du compte<ChevronRight size={17} /></button>
               <button type="button" onClick={() => { setMenuOpen(false); setSheet(null); setLocation('/confidentialite'); }} data-testid="button-menu-privacy"><FileText size={19} />Politique de confidentialité<ChevronRight size={17} /></button>
            </div>
                <div className="sendflow-menu-footer"><button type="button" onClick={() => { setMenuOpen(false); setSheet(null); setLocation('/customer-service'); }} data-testid="button-menu-help"><Headphones size={19} />Service client<ChevronRight size={17} /></button><button type="button" disabled={signOutCustomer.isPending} onClick={async () => { try { await signOutCustomer.mutateAsync(); queryClient.clear(); clearPinUnlock(); window.sessionStorage.removeItem('sendflow.avatar.user-key'); setLocation('/sign-in'); } catch { /* Keep the session presentation intact until the server confirms logout. */ } }} data-testid="button-menu-logout"><LogOut size={19} />{signOutCustomer.isPending ? 'Déconnexion…' : 'Déconnecter'}</button></div>
              <p className="sendflow-menu-copyright">© 2026 SendFlow</p>
          </aside>
        </div>
      )}

      {sheet && (
        <div className="sendflow-sheet-layer" role="presentation">
          <button type="button" className="sendflow-sheet-backdrop" onClick={closePanels} aria-label="Fermer la fenêtre" data-testid="button-close-sheet-backdrop" />
          <section className="sendflow-action-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
            <div className="sendflow-sheet-handle" aria-hidden="true" />
             <div className="sendflow-sheet-header"><div><p className="sendflow-section-kicker">SendFlow</p><h2 id="sheet-title">Service client</h2></div><button type="button" className="sendflow-close-button" onClick={closePanels} aria-label="Fermer" data-testid="button-close-sheet"><X size={20} /></button></div>
            {sheet === 'notifications' && <><p className="sendflow-sheet-text">Notre équipe est là pour vous aider.</p><button type="button" className="sendflow-sheet-primary" onClick={() => setSheet(null)} data-testid="button-contact-support">Contacter le support</button></>}
          </section>
        </div>
      )}
    </main>
  );
}