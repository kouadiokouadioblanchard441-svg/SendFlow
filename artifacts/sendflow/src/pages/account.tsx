import { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowDownToLine,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  Grid2X2,
  Headphones,
  History,
  LockKeyhole,
  Menu,
  PhoneCall,
  LogOut,
  X,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { Link, Redirect, useLocation } from 'wouter';
import { NativeWalletIcon } from '@/components/native-wallet-icon';
import { TransactionCard } from '@/components/transaction-card';
import { operatorNames, transactions, type Transaction } from '@/lib/transactions';
import { notifications } from '@/lib/notifications';
import { useSeo } from '@/lib/seo';
import { DEMO_SESSION_KEY } from '@/lib/demo-account';
import notificationBell from '@assets/633486_1789677628502.png';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/téléchargement_1789667092840.png';
import profileMariam from '@assets/generated_images/sendflow-profile-mariam.png';

type SheetName = 'inter' | 'plus' | 'call-credit' | 'notifications' | 'transaction' | 'account-info' | 'change-secret' | 'limit' | null;
const NOTIFICATIONS_READ_KEY = 'sendflow.notifications.read';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(() => (
    window.sessionStorage.getItem(NOTIFICATIONS_READ_KEY) === 'true' ? 0 : notifications.length
  ));
  const [creditAmount, setCreditAmount] = useState('1 000 FCFA');
  const [creditPurchased, setCreditPurchased] = useState(false);
  const [walletVisible, setWalletVisible] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

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

  if (!isUnlocked) return <Redirect to="/sign-in" />;

  const openSheet = (nextSheet: Exclude<SheetName, null>) => {
    setMenuOpen(false);
    setCreditPurchased(false);
    setSelectedTransaction(null);
    setSheet(nextSheet);
  };

  const openTransaction = (transaction: Transaction) => {
    setMenuOpen(false);
    setCreditPurchased(false);
    setSelectedTransaction(transaction);
    setSheet('transaction');
  };

  const openHistory = () => {
    setMenuOpen(false);
    setSheet(null);
    setLocation('/history');
  };

  const closePanels = () => {
    setMenuOpen(false);
    setCreditPurchased(false);
    setSelectedTransaction(null);
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
              <strong>{walletVisible ? '0' : '••••'}</strong>
              <span>FCFA</span>
            </div>
            <div className="sendflow-wallet-footer">
              <span>Solde disponible</span>
            </div>
          </section>

          <nav className="sendflow-action-grid" aria-label="Actions principales">
            <ActionTile icon={<Globe2 size={44} strokeWidth={2.2} />} label="Transfert international" onClick={() => { setMenuOpen(false); setSheet(null); setLocation('/international-transfer'); }} testId="button-transfer-international" />
            <ActionTile icon={<ArrowLeftRight size={44} strokeWidth={2.5} />} label="Transfert inter réseau" onClick={() => { setMenuOpen(false); setSheet(null); setLocation('/inter-transfer'); }} testId="button-transfer-inter-network" />
            <ActionTile icon={<History size={44} strokeWidth={2.4} />} label="Historique" onClick={openHistory} testId="button-view-history" />
            <ActionTile icon={<ArrowDownToLine size={44} strokeWidth={2.2} />} label="Dépôt" onClick={() => { setMenuOpen(false); setSheet(null); setLocation('/deposit'); }} testId="button-open-deposit" />
          </nav>

          <section className="sendflow-promo-section" aria-label="Offres SendFlow">
            <div className="sendflow-promo-viewport">
              <div className="sendflow-promo-track">
                {[0, 1].map((copy) => (
                  <button type="button" className={`sendflow-promo-card promo-${copy}`} key={copy} onClick={() => { setMenuOpen(false); setSheet(null); setLocation('/international-transfer'); }} data-testid={`button-promotion-${copy + 1}`}>
                    <span className="sendflow-promo-orbit" aria-hidden="true"><span /><span /><span /></span>
                    <span className="sendflow-promo-copy">
                      <strong>{copy === 0 ? 'Envoyez plus loin.' : 'Un même geste, partout.'}</strong>
                      <small>{copy === 0 ? 'Les transferts internationaux commencent ici.' : 'Transférez entre réseaux, simplement.'}</small>
                    </span>
                    <span className="sendflow-promo-cta">Découvrir <ChevronRight size={16} /></span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="sendflow-transactions" id="transactions" aria-labelledby="transactions-title">
            <div className="sendflow-section-heading">
              <div>
                <h2 id="transactions-title">Transactions récentes</h2>
              </div>
              <button type="button" className="sendflow-see-all" onClick={openHistory} data-testid="button-view-all-transactions">Voir tout <ChevronRight size={18} /></button>
            </div>
            <div className="sendflow-transaction-list">
              {transactions.slice(0, 5).map((transaction) => (
                <TransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  onClick={() => openTransaction(transaction)}
                  testId={`button-transaction-${transaction.id}`}
                />
              ))}
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
             <div className="sendflow-menu-profile"><img className="sendflow-profile-avatar" src={profileMariam} alt="" /><span><strong>Mariam A.</strong><small>Compte personnel</small></span></div>
            <div className="sendflow-menu-links">
               <button type="button" onClick={() => openSheet('account-info')} data-testid="button-menu-account-info"><UserRound size={19} />Informations du compte<ChevronRight size={17} /></button>
               <button type="button" onClick={() => openSheet('change-secret')} data-testid="button-menu-change-secret"><LockKeyhole size={19} />Modifier le code secret<ChevronRight size={17} /></button>
               <button type="button" onClick={() => openSheet('limit')} data-testid="button-menu-limit"><WalletCards size={19} />Plafond du compte<ChevronRight size={17} /></button>
               <button type="button" onClick={() => { setMenuOpen(false); setSheet(null); setLocation('/confidentialite'); }} data-testid="button-menu-privacy"><FileText size={19} />Politique de confidentialité<ChevronRight size={17} /></button>
            </div>
              <div className="sendflow-menu-footer"><button type="button" onClick={() => openSheet('notifications')} data-testid="button-menu-help"><Headphones size={19} />Service client<ChevronRight size={17} /></button><button type="button" onClick={() => { window.sessionStorage.removeItem('sendflow.pin.unlocked'); window.sessionStorage.removeItem(DEMO_SESSION_KEY); setLocation('/sign-in'); }} data-testid="button-menu-logout"><LogOut size={19} />Déconnecter</button></div>
              <p className="sendflow-menu-copyright">© 2026 SendFlow</p>
          </aside>
        </div>
      )}

      {sheet && (
        <div className="sendflow-sheet-layer" role="presentation">
          <button type="button" className="sendflow-sheet-backdrop" onClick={closePanels} aria-label="Fermer la fenêtre" data-testid="button-close-sheet-backdrop" />
          <section className="sendflow-action-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
            <div className="sendflow-sheet-handle" aria-hidden="true" />
             <div className="sendflow-sheet-header"><div><p className="sendflow-section-kicker">SendFlow</p><h2 id="sheet-title">{sheet === 'inter' ? 'Transfert inter réseau' : sheet === 'plus' ? 'Plus de services' : sheet === 'transaction' ? 'Détail de la transaction' : sheet === 'account-info' ? 'Informations du compte' : sheet === 'change-secret' ? 'Modifier le code secret' : sheet === 'limit' ? 'Plafond du compte' : 'Service client'}</h2></div><button type="button" className="sendflow-close-button" onClick={closePanels} aria-label="Fermer" data-testid="button-close-sheet"><X size={20} /></button></div>
            {sheet === 'inter' && <><p className="sendflow-sheet-text">Envoyez de l’argent au même pays, même lorsque votre destinataire utilise un autre réseau.</p><div className="sendflow-route-card"><span>Votre réseau</span><ArrowLeftRight size={19} /><span>Autre réseau</span></div><button type="button" className="sendflow-sheet-primary" onClick={() => setSheet(null)} data-testid="button-start-inter-transfer">Commencer un transfert</button></>}
             {sheet === 'plus' && <><p className="sendflow-sheet-text">Des services utiles, directement depuis votre compte SendFlow.</p><button type="button" className="sendflow-service-row" onClick={() => openSheet('call-credit')} data-testid="button-buy-call-credit"><span className="sendflow-service-icon"><PhoneCall size={20} /></span><span><strong>Crédit d'appel</strong><small>Acheter du crédit pour votre ligne</small></span><ChevronRight size={18} /></button></>}
             {sheet === 'call-credit' && <><p className="sendflow-sheet-text">Choisissez le montant à créditer sur votre ligne. Le crédit sera disponible après confirmation du paiement.</p><div className="sendflow-credit-options" role="group" aria-label="Montant du crédit d'appel">{['500 FCFA', '1 000 FCFA', '2 000 FCFA'].map((amount) => <button type="button" className={`sendflow-credit-option${creditAmount === amount ? ' is-selected' : ''}`} onClick={() => setCreditAmount(amount)} key={amount}>{amount}</button>)}</div>{creditPurchased ? <p className="sendflow-purchase-success" role="status"><Check size={18} /> Crédit d'appel acheté avec succès.</p> : <button type="button" className="sendflow-sheet-primary" onClick={() => setCreditPurchased(true)} data-testid="button-confirm-call-credit">Acheter {creditAmount}</button>}</>}
              {sheet === 'account-info' && <><p className="sendflow-sheet-text">Consultez les informations principales de votre compte SendFlow.</p><div className="sendflow-detail-grid"><span>Nom<strong>Mariam A.</strong></span><span>Type<strong>Compte personnel</strong></span></div></>}
              {sheet === 'change-secret' && <><p className="sendflow-sheet-text">Pour protéger votre compte, vous pouvez réinitialiser votre code secret depuis le parcours sécurisé.</p><button type="button" className="sendflow-sheet-primary" onClick={() => setLocation('/forgot-password')} data-testid="button-start-change-secret">Modifier le code secret</button></>}
              {sheet === 'limit' && <><p className="sendflow-sheet-text">Le plafond de votre compte sera affiché ici lorsque les limites de transfert seront activées pour votre profil.</p><div className="sendflow-route-card"><span>Plafond actuel</span><strong>À définir</strong></div></>}
             {sheet === 'transaction' && selectedTransaction && <><p className="sendflow-sheet-text">Cette opération a été enregistrée sur votre compte.</p><div className="sendflow-detail-amount">{selectedTransaction.amount}<small>{selectedTransaction.kind === 'deposit' ? 'Dépôt vers le wallet' : selectedTransaction.kind === 'international' ? 'Transfert international' : 'Transfert inter réseau'}</small></div><div className="sendflow-detail-grid"><span>{selectedTransaction.kind === 'deposit' ? 'Source' : 'Destinataire'}<strong>{selectedTransaction.kind === 'deposit' ? operatorNames[selectedTransaction.fromOperator] : selectedTransaction.recipient}</strong></span><span>Date<strong>{selectedTransaction.date}</strong></span><span>Opérateur<strong>{operatorNames[selectedTransaction.kind === 'deposit' ? selectedTransaction.fromOperator : selectedTransaction.toOperator]}</strong></span><span>Statut<strong className="is-success">Terminé</strong></span></div></>}
            {sheet === 'notifications' && <><p className="sendflow-sheet-text">Notre équipe est là pour vous aider.</p><button type="button" className="sendflow-sheet-primary" onClick={() => setSheet(null)} data-testid="button-contact-support">Contacter le support</button></>}
          </section>
        </div>
      )}
    </main>
  );
}