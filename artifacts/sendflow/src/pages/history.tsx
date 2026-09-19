import { useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Link, Redirect, useLocation } from 'wouter';
import { TransactionCard } from '@/components/transaction-card';
import { transactions } from '@/lib/transactions';
import { useSeo } from '@/lib/seo';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import historyIllustration from '@assets/generated_images/sendflow-history-transactions-3d.png';

export default function HistoryPage() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState('');
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';

  useSeo({
    path: '/history',
    locale: 'fr',
    title: 'Historique des transactions · SendFlow',
    description: 'Consultez vos transactions SendFlow.',
    robots: 'noindex,nofollow',
  });

  const visibleTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return transactions;

    return transactions.filter((transaction) =>
      `${transaction.sender} ${transaction.recipient} ${transaction.date} ${transaction.amount}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query]);

  if (!isUnlocked) return <Redirect to="/sign-in" />;

  return (
    <main className="sendflow-history-shell">
      <header className="sendflow-history-header">
        <div className="sendflow-history-header-inner">
          <button type="button" className="sendflow-history-back sendflow-header-button" onClick={() => setLocation('/account')} aria-label="Retour au compte" data-testid="button-history-back">
            <ArrowLeft size={26} strokeWidth={2} />
          </button>
          <Link href="/account" className="sendflow-dashboard-brand" aria-label="SendFlow, retour au compte" data-testid="link-history-brand">
            <img className="sendflow-history-mark" src={sendflowMark} alt="" />
            <img className="sendflow-history-wordmark" src={sendflowWordmark} alt="SendFlow" />
          </Link>
          <span aria-hidden="true" />
        </div>
      </header>

      <section className="sendflow-history-page" aria-labelledby="history-title">
        <div className="sendflow-history-illustration" aria-hidden="true">
          <img src={historyIllustration} alt="" />
        </div>
        <label className="sendflow-history-search">
          <Search size={28} strokeWidth={2.1} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher par numéro"
            aria-label="Rechercher par numéro"
          />
        </label>

        <h1 id="history-title">Historique des transactions</h1>

        <div className="sendflow-history-list">
          {visibleTransactions.map((transaction, index) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              className={index === 0 ? 'is-highlighted' : ''}
              onClick={() => setLocation('/account')}
              testId={`history-transaction-${transaction.id}`}
            />
          ))}
          {visibleTransactions.length === 0 && (
            <p className="sendflow-history-empty">Aucune transaction trouvée.</p>
          )}
        </div>
      </section>

    </main>
  );
}