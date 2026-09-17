import { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Bell,
  Check,
  ChevronRight,
  Clock3,
  Gift,
  Globe2,
  Grid2X2,
  HelpCircle,
  Menu,
  PhoneCall,
  Send,
  X,
} from 'lucide-react';
import { Link, Redirect, useLocation } from 'wouter';
import { useSeo } from '@/lib/seo';
import sendflowMark from '@assets/sendflow-mark-original.png';
import profileMariam from '@assets/generated_images/sendflow-profile-mariam.png';

type SheetName = 'inter' | 'international' | 'history' | 'plus' | 'call-credit' | 'notifications' | 'transaction' | null;

type Transaction = {
  id: string;
  operator: 'TM' | 'MA' | 'WF';
  label: string;
  recipient: string;
  date: string;
  amount: string;
  tone: 'yellow' | 'blue' | 'navy';
};

const transactions: Transaction[] = [
  { id: 'sf-001', operator: 'TM', label: 'Transfert vers', recipient: '99935673', date: '16/06/2026 · 13:16', amount: '-22 000 FCFA', tone: 'yellow' },
  { id: 'sf-002', operator: 'MA', label: 'Transfert vers', recipient: '92299772', date: '15/06/2026 · 12:47', amount: '-20 000 FCFA', tone: 'blue' },
  { id: 'sf-003', operator: 'WF', label: 'Transfert vers', recipient: '71935494', date: '15/06/2026 · 01:13', amount: '-20 000 FCFA', tone: 'navy' },
  { id: 'sf-004', operator: 'MA', label: 'Transfert vers', recipient: '71935494', date: '15/06/2026 · 01:10', amount: '-20 000 FCFA', tone: 'blue' },
  { id: 'sf-005', operator: 'TM', label: 'Transfert vers', recipient: '99935673', date: '15/06/2026 · 01:03', amount: '-12 000 FCFA', tone: 'yellow' },
];

const operatorNames: Record<Transaction['operator'], string> = {
  TM: 'TMoney',
  MA: 'Moov Africa',
  WF: 'Wave',
};

function OperatorBadge({ transaction }: { transaction: Transaction }) {
  return (
    <span className={`sendflow-operator-badge is-${transaction.tone}`} aria-label={operatorNames[transaction.operator]}>
      {transaction.operator === 'TM' ? <><strong>T</strong><small>Money</small></> : transaction.operator === 'MA' ? <><strong>M</strong><small>oov</small></> : <strong>W</strong>}
    </span>
  );
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
  detail: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button type="button" className="sendflow-action-tile" onClick={onClick} data-testid={testId}>
      <span className="sendflow-action-icon" aria-hidden="true">{icon}</span>
      <span className="sendflow-action-label">{label}</span>
      <span className="sendflow-action-detail">{detail}</span>
    </button>
  );
}

export default function AccountPage() {
  const [, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [notificationRead, setNotificationRead] = useState(false);
  const [creditAmount, setCreditAmount] = useState('1 000 FCFA');
  const [creditPurchased, setCreditPurchased] = useState(false);

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
    setNotificationsOpen(false);
    setCreditPurchased(false);
    setSheet(nextSheet);
  };

  const closePanels = () => {
    setMenuOpen(false);
    setNotificationsOpen(false);
    setCreditPurchased(false);
    setSheet(null);
  };

  return (
    <main className="sendflow-dashboard-shell">
      <section className="sendflow-dashboard" aria-labelledby="account-title">
        <header className="sendflow-dashboard-header">
          <div className="sendflow-dashboard-header-inner">
            <button type="button" className="sendflow-header-button" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu" aria-expanded={menuOpen} data-testid="button-open-menu">
              <Menu size={25} strokeWidth={2} />
            </button>
            <Link href="/account" className="sendflow-dashboard-brand" aria-label="SendFlow, accueil" data-testid="link-dashboard-home">
              <img src={sendflowMark} alt="" />
              <span>SendFlow</span>
            </Link>
            <button type="button" className={`sendflow-header-button sendflow-notification-button${notificationRead ? '' : ' has-unread'}`} onClick={() => { setNotificationsOpen(true); setNotificationRead(true); }} aria-label="Voir les notifications" data-testid="button-open-notifications">
              <Bell size={22} strokeWidth={2} />
              {!notificationRead && <span className="sendflow-notification-dot" aria-hidden="true" />}
            </button>
          </div>
        </header>

        <section className="sendflow-dashboard-content">
          <div className="sendflow-dashboard-welcome">
             <img className="sendflow-profile-avatar" src={profileMariam} alt="Photo de profil de Mariam" />
            <p className="sendflow-dashboard-kicker">Votre espace SendFlow</p>
            <h1 id="account-title">Bonjour, Mariam</h1>
            <p className="sendflow-dashboard-subtitle">L’argent circule. Les réseaux aussi.</p>
          </div>

          <nav className="sendflow-action-grid" aria-label="Actions principales">
            <ActionTile icon={<ArrowLeftRight size={25} />} label="Transfert inter réseau" detail="Même pays" onClick={() => openSheet('inter')} testId="button-transfer-inter-network" />
            <ActionTile icon={<Globe2 size={24} />} label="Transfert international" detail="Pays à pays" onClick={() => openSheet('international')} testId="button-transfer-international" />
            <ActionTile icon={<Clock3 size={24} />} label="Historique" detail="Vos mouvements" onClick={() => openSheet('history')} testId="button-view-history" />
            <ActionTile icon={<Grid2X2 size={23} />} label="Plus" detail="Services SendFlow" onClick={() => openSheet('plus')} testId="button-open-more" />
          </nav>

          <section className="sendflow-promo-section" aria-label="Offres SendFlow">
            <div className="sendflow-promo-heading">
              <span>À la une</span>
              <span className="sendflow-promo-status"><span aria-hidden="true" /> Actualités SendFlow</span>
            </div>
            <div className="sendflow-promo-viewport">
              <div className="sendflow-promo-track">
                {[0, 1].map((copy) => (
                  <button type="button" className={`sendflow-promo-card promo-${copy}`} key={copy} onClick={() => openSheet('international')} data-testid={`button-promotion-${copy + 1}`}>
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
                <p className="sendflow-section-kicker">Votre activité</p>
                <h2 id="transactions-title">Transactions récentes</h2>
              </div>
              <button type="button" className="sendflow-see-all" onClick={() => openSheet('history')} data-testid="button-view-all-transactions">Voir tout <ChevronRight size={18} /></button>
            </div>
            <div className="sendflow-transaction-list">
              {transactions.map((transaction) => (
                <button type="button" className="sendflow-transaction" key={transaction.id} onClick={() => openSheet('transaction')} data-testid={`button-transaction-${transaction.id}`}>
                  <OperatorBadge transaction={transaction} />
                  <span className="sendflow-transaction-copy">
                    <strong>{transaction.label} {transaction.recipient}</strong>
                    <small>{transaction.date}</small>
                  </span>
                  <span className="sendflow-transaction-amount">{transaction.amount}</span>
                  <ChevronRight className="sendflow-transaction-chevron" size={17} aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        </section>

        <nav className="sendflow-bottom-nav" aria-label="Navigation principale">
          <Link href="/account" className="sendflow-bottom-link is-active" aria-current="page" data-testid="link-bottom-home"><span className="sendflow-bottom-icon"><Send size={19} /></span><span>Accueil</span></Link>
          <button type="button" className="sendflow-bottom-link" onClick={() => openSheet('history')} data-testid="button-bottom-history"><span className="sendflow-bottom-icon"><Clock3 size={19} /></span><span>Historique</span></button>
          <button type="button" className="sendflow-bottom-link" onClick={() => openSheet('plus')} data-testid="button-bottom-more"><span className="sendflow-bottom-icon"><Grid2X2 size={19} /></span><span>Plus</span></button>
        </nav>
      </section>

      {menuOpen && (
        <div className="sendflow-panel-layer">
          <button type="button" className="sendflow-panel-backdrop" onClick={closePanels} aria-label="Fermer le menu" data-testid="button-close-menu-backdrop" />
          <aside className="sendflow-side-menu" aria-label="Menu SendFlow">
            <div className="sendflow-side-menu-top">
              <div className="sendflow-side-brand"><img src={sendflowMark} alt="" /><span>SendFlow</span></div>
              <button type="button" className="sendflow-close-button" onClick={closePanels} aria-label="Fermer le menu" data-testid="button-close-menu"><X size={20} /></button>
            </div>
             <div className="sendflow-menu-profile"><img className="sendflow-profile-avatar" src={profileMariam} alt="" /><span><strong>Mariam A.</strong><small>Compte personnel</small></span></div>
            <div className="sendflow-menu-links">
              <button type="button" onClick={() => openSheet('inter')} data-testid="button-menu-inter"><ArrowLeftRight size={19} />Transfert inter réseau<ChevronRight size={17} /></button>
              <button type="button" onClick={() => openSheet('international')} data-testid="button-menu-international"><Globe2 size={19} />Transfert international<ChevronRight size={17} /></button>
              <button type="button" onClick={() => openSheet('history')} data-testid="button-menu-history"><Clock3 size={19} />Historique<ChevronRight size={17} /></button>
              <button type="button" onClick={() => openSheet('plus')} data-testid="button-menu-services"><Grid2X2 size={19} />Services SendFlow<ChevronRight size={17} /></button>
            </div>
            <div className="sendflow-menu-footer"><button type="button" onClick={() => openSheet('notifications')} data-testid="button-menu-help"><HelpCircle size={19} />Besoin d’aide<ChevronRight size={17} /></button><button type="button" onClick={() => { window.sessionStorage.removeItem('sendflow.pin.unlocked'); setLocation('/sign-in'); }} data-testid="button-menu-logout"><span className="sendflow-menu-logout-icon">↗</span>Se déconnecter</button></div>
          </aside>
        </div>
      )}

      {notificationsOpen && (
        <div className="sendflow-panel-layer">
          <button type="button" className="sendflow-panel-backdrop" onClick={closePanels} aria-label="Fermer les notifications" data-testid="button-close-notifications-backdrop" />
          <aside className="sendflow-notification-panel" aria-labelledby="notifications-title">
            <div className="sendflow-sheet-header"><div><p className="sendflow-section-kicker">SendFlow</p><h2 id="notifications-title">Notifications</h2></div><button type="button" className="sendflow-close-button" onClick={closePanels} aria-label="Fermer les notifications" data-testid="button-close-notifications"><X size={20} /></button></div>
            <div className="sendflow-notification-item"><span className="sendflow-notification-check"><Check size={17} /></span><span><strong>Compte sécurisé</strong><small>Votre session est protégée par votre code PIN.</small></span></div>
            <div className="sendflow-notification-item"><span className="sendflow-notification-mark"><Gift size={17} /></span><span><strong>Bienvenue sur SendFlow</strong><small>Transférez entre réseaux, sans frontière.</small></span></div>
          </aside>
        </div>
      )}

      {sheet && (
        <div className="sendflow-sheet-layer" role="presentation">
          <button type="button" className="sendflow-sheet-backdrop" onClick={closePanels} aria-label="Fermer la fenêtre" data-testid="button-close-sheet-backdrop" />
          <section className="sendflow-action-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
            <div className="sendflow-sheet-handle" aria-hidden="true" />
            <div className="sendflow-sheet-header"><div><p className="sendflow-section-kicker">SendFlow</p><h2 id="sheet-title">{sheet === 'inter' ? 'Transfert inter réseau' : sheet === 'international' ? 'Transfert international' : sheet === 'history' ? 'Votre historique' : sheet === 'plus' ? 'Plus de services' : sheet === 'transaction' ? 'Détail de la transaction' : 'Besoin d’aide'}</h2></div><button type="button" className="sendflow-close-button" onClick={closePanels} aria-label="Fermer" data-testid="button-close-sheet"><X size={20} /></button></div>
            {sheet === 'inter' && <><p className="sendflow-sheet-text">Envoyez de l’argent au même pays, même lorsque votre destinataire utilise un autre réseau.</p><div className="sendflow-route-card"><span>Votre réseau</span><ArrowLeftRight size={19} /><span>Autre réseau</span></div><button type="button" className="sendflow-sheet-primary" onClick={() => setSheet(null)} data-testid="button-start-inter-transfer">Commencer un transfert</button></>}
            {sheet === 'international' && <><p className="sendflow-sheet-text">Transférez de pays à pays avec un parcours clair et les frais affichés avant l’envoi.</p><div className="sendflow-route-card"><span>France</span><Globe2 size={19} /><span>Sénégal</span></div><button type="button" className="sendflow-sheet-primary" onClick={() => setSheet(null)} data-testid="button-start-international-transfer">Choisir un pays</button></>}
            {sheet === 'history' && <><p className="sendflow-sheet-text">Retrouvez les dernières opérations de votre compte.</p><div className="sendflow-sheet-history-list">{transactions.slice(0, 3).map((transaction) => <div className="sendflow-mini-transaction" key={`mini-${transaction.id}`}><OperatorBadge transaction={transaction} /><span><strong>{transaction.label} {transaction.recipient}</strong><small>{transaction.date}</small></span><b>{transaction.amount}</b></div>)}</div><button type="button" className="sendflow-sheet-secondary" onClick={() => { document.getElementById('transactions')?.scrollIntoView({ behavior: 'smooth' }); setSheet(null); }} data-testid="button-scroll-transactions">Voir les transactions</button></>}
             {sheet === 'plus' && <><p className="sendflow-sheet-text">Des services utiles, directement depuis votre compte SendFlow.</p><button type="button" className="sendflow-service-row" onClick={() => openSheet('call-credit')} data-testid="button-buy-call-credit"><span className="sendflow-service-icon"><PhoneCall size={20} /></span><span><strong>Crédit d'appel</strong><small>Acheter du crédit pour votre ligne</small></span><ChevronRight size={18} /></button></>}
             {sheet === 'call-credit' && <><p className="sendflow-sheet-text">Choisissez le montant à créditer sur votre ligne. Le crédit sera disponible après confirmation du paiement.</p><div className="sendflow-credit-options" role="group" aria-label="Montant du crédit d'appel">{['500 FCFA', '1 000 FCFA', '2 000 FCFA'].map((amount) => <button type="button" className={`sendflow-credit-option${creditAmount === amount ? ' is-selected' : ''}`} onClick={() => setCreditAmount(amount)} key={amount}>{amount}</button>)}</div>{creditPurchased ? <p className="sendflow-purchase-success" role="status"><Check size={18} /> Crédit d'appel acheté avec succès.</p> : <button type="button" className="sendflow-sheet-primary" onClick={() => setCreditPurchased(true)} data-testid="button-confirm-call-credit">Acheter {creditAmount}</button>}</>}
            {sheet === 'transaction' && <><p className="sendflow-sheet-text">Cette opération a été enregistrée sur votre compte.</p><div className="sendflow-detail-amount">{transactions[0].amount}<small>Transfert inter réseau</small></div><div className="sendflow-detail-grid"><span>Destinataire<strong>{transactions[0].recipient}</strong></span><span>Date<strong>{transactions[0].date}</strong></span><span>Opérateur<strong>{operatorNames[transactions[0].operator]}</strong></span><span>Statut<strong className="is-success">Terminé</strong></span></div></>}
            {sheet === 'notifications' && <><p className="sendflow-sheet-text">Notre équipe est là pour vous aider.</p><button type="button" className="sendflow-sheet-primary" onClick={() => setSheet(null)} data-testid="button-contact-support">Contacter le support</button></>}
          </section>
        </div>
      )}
    </main>
  );
}