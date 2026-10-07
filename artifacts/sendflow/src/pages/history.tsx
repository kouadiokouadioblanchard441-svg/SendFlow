import { useEffect, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Link, Redirect, useLocation } from 'wouter';
import { getGetCurrentAccountQueryKey, useGetCurrentAccount } from '@workspace/api-client-react';
import { TransactionCard } from '@/components/transaction-card';
import { useCustomerTransactions } from '@/lib/customer-transactions';
import { toTransactionView } from '@/lib/transactions';
import { useSeo } from '@/lib/seo';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';

export default function HistoryPage() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const accountQuery = useGetCurrentAccount({
    query: { queryKey: getGetCurrentAccountQueryKey(), enabled: isUnlocked },
  });
  const transactionsQuery = useCustomerTransactions(accountQuery.data?.userId, search);
  const transactions = transactionsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useSeo({
    path: '/history',
    locale: 'fr',
    title: 'Historique des transactions · SendFlow',
    description: 'Consultez vos transactions SendFlow.',
    robots: 'noindex,nofollow',
  });

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
        <label className="sendflow-history-search">
          <Search size={28} strokeWidth={2.1} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={80}
            placeholder="Rechercher par numéro ou référence"
            aria-label="Rechercher par numéro ou référence"
            data-testid="input-history-search"
          />
        </label>

        <h1 id="history-title">Historique des transactions</h1>

        <div className="sendflow-history-list">
          {accountQuery.isLoading && <p className="sendflow-history-empty">Chargement de votre compte…</p>}
          {accountQuery.isError && (
            <div className="sendflow-history-empty" role="alert">
              <p>Impossible de charger votre compte. Vérifiez votre session puis réessayez.</p>
              <button type="button" onClick={() => void accountQuery.refetch()} disabled={accountQuery.isFetching} data-testid="button-history-retry-account">
                {accountQuery.isFetching ? 'Chargement…' : 'Réessayer'}
              </button>
            </div>
          )}
          {transactionsQuery.isLoading && <p className="sendflow-history-empty">Chargement des transactions…</p>}
          {transactionsQuery.isError && !transactionsQuery.isFetchNextPageError && (
            <div className="sendflow-history-empty" role="alert">
              <p>Impossible de charger votre historique.</p>
              <button type="button" onClick={() => void transactionsQuery.refetch()} disabled={transactionsQuery.isFetching} data-testid="button-history-retry-transactions">
                {transactionsQuery.isFetching ? 'Chargement…' : 'Réessayer'}
              </button>
            </div>
          )}
          {!accountQuery.isLoading && !accountQuery.isError && !transactionsQuery.isLoading && (!transactionsQuery.isError || transactionsQuery.isFetchNextPageError) && transactions.map((record, index) => (
            <TransactionCard
              key={record.id}
              transaction={toTransactionView(record)}
              className={index === 0 ? 'is-highlighted' : ''}
              onClick={() => setLocation(`/transaction/${encodeURIComponent(record.id)}`)}
              testId={`history-transaction-${record.id}`}
            />
          ))}
          {!accountQuery.isLoading && !accountQuery.isError && !transactionsQuery.isLoading && !transactionsQuery.isError && transactions.length === 0 && (
            <p className="sendflow-history-empty">
              {search ? 'Aucune transaction ne correspond à cette recherche.' : 'Aucune transaction trouvée.'}
            </p>
          )}
          {transactionsQuery.isFetchNextPageError && (
            <p className="sendflow-history-empty" role="alert">Impossible de charger les transactions plus anciennes. Réessayez.</p>
          )}
          {transactionsQuery.hasNextPage && (
            <button
              type="button"
              className="sendflow-history-load-more"
              onClick={() => void transactionsQuery.fetchNextPage()}
              disabled={transactionsQuery.isFetchingNextPage}
              data-testid="button-history-load-more"
            >
              {transactionsQuery.isFetchingNextPage ? 'Chargement…' : transactionsQuery.isFetchNextPageError ? 'Réessayer' : 'Charger les plus anciennes'}
            </button>
          )}
        </div>
      </section>

    </main>
  );
}