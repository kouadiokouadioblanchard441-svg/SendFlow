import { ArrowLeft, CircleHelp, Download, Star } from 'lucide-react';
import { Redirect, useLocation } from 'wouter';
import { getGetCurrentAccountQueryKey, useGetCurrentAccount } from '@workspace/api-client-react';
import { OperatorLogo } from '@/components/transaction-card';
import { customerServiceProvider } from '@/lib/customer-service';
import { useCustomerTransaction } from '@/lib/customer-transactions';
import {
  formatCurrencyMinor,
  formatTransactionDate,
  operatorCodeFor,
  operatorNames,
} from '@/lib/transactions';
import { useSeo } from '@/lib/seo';

function readTransactionId(location: string): string {
  const rawId = location.split('/').filter(Boolean).at(-1) ?? '';

  try {
    return decodeURIComponent(rawId);
  } catch {
    return '';
  }
}

function DetailRow({
  label,
  value,
  emphasized = false,
  separated = false,
}: {
  label: string;
  value: React.ReactNode;
  emphasized?: boolean;
  separated?: boolean;
}) {
  return (
    <div className={`sendflow-receipt-row${emphasized ? ' is-emphasized' : ''}${separated ? ' is-separated' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function TransactionDetailPage() {
  const [location, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const transactionId = readTransactionId(location);
  const accountQuery = useGetCurrentAccount({
    query: { queryKey: getGetCurrentAccountQueryKey(), enabled: isUnlocked },
  });
  const detailQuery = useCustomerTransaction(accountQuery.data?.userId, transactionId);
  const transaction = detailQuery.data;

  useSeo({
    path: location,
    locale: 'fr',
    title: 'Détails de la transaction · SendFlow',
    description: 'Consultez le reçu détaillé de votre transaction SendFlow.',
    robots: 'noindex,nofollow',
  });

  if (!isUnlocked) return <Redirect to="/sign-in" />;
  if (accountQuery.isLoading || detailQuery.isLoading) {
    return <main className="sendflow-receipt-shell" role="status">Chargement des détails de transaction…</main>;
  }
  if (accountQuery.isError || detailQuery.isError || !transaction) {
    return (
      <main className="sendflow-receipt-shell">
        <p role="alert">Impossible de charger les détails réels de cette transaction.</p>
        <button type="button" onClick={() => void detailQuery.refetch()}>Réessayer</button>
        <button type="button" onClick={() => setLocation('/history')}>Retour à l’historique</button>
      </main>
    );
  }

  const isDeposit = transaction.kind === 'deposit';
  const statusLabel = transaction.status === 'succeeded'
    ? 'RÉUSSIE'
    : transaction.status === 'pending'
      ? 'ATTENTE'
      : 'ÉCHEC';
  const statusClass = transaction.status === 'succeeded'
    ? 'success'
    : transaction.status === 'pending'
      ? 'pending'
      : 'failed';
  const sentAmount = formatCurrencyMinor(transaction.amountMinor, transaction.currency);
  const fee = formatCurrencyMinor(transaction.feeMinor, transaction.currency);
  const total = formatCurrencyMinor(
    transaction.amountMinor + transaction.feeMinor,
    transaction.currency,
  );
  const transactionKindLabel = isDeposit
    ? "Dépôt d'argent"
    : transaction.kind === 'inter-network'
      ? 'Transfert inter réseau'
      : 'Transfert international';
  const operatorName = operatorNames[operatorCodeFor(transaction.toOperator)];
  const supportContact = customerServiceProvider.getContact();
  const whatsappMessage = [
    "Bonjour, je souhaite obtenir de l'aide concernant une transaction SendFlow.",
    '',
    `Montant envoyé : ${sentAmount}`,
    `Total payé : ${total}`,
    `Numéro débité : ${transaction.senderPhone}`,
    `Bénéficiaire : ${transaction.recipientPhone}`,
    `Opérateur : ${operatorName}`,
    `Référence : ${transaction.providerReference ?? transaction.reference}`,
    `Date : ${formatTransactionDate(transaction.createdAt)}`,
    '',
    'Pouvez-vous m’aider à vérifier cette opération ?',
  ].join('\n');
  const whatsappHref = `${supportContact.whatsappHref}${supportContact.whatsappHref.includes('?') ? '&' : '?'}text=${encodeURIComponent(whatsappMessage)}`;

  const handleDownload = () => {
    window.print();
  };

  const handleRate = () => {
    if (supportContact.playStoreHref) {
      window.location.assign(supportContact.playStoreHref);
    }
  };

  return (
    <main className="sendflow-receipt-shell">
      <header className="sendflow-receipt-header">
        <button
          type="button"
          className="sendflow-receipt-icon-button"
          onClick={() => setLocation('/history')}
          aria-label="Retour à l'historique"
          data-testid="button-receipt-back"
        >
          <ArrowLeft size={24} strokeWidth={2} aria-hidden="true" />
        </button>
        <h1>Détails transaction</h1>
        <button
          type="button"
          className="sendflow-receipt-icon-button"
          onClick={handleDownload}
          aria-label="Télécharger le reçu"
          data-testid="button-receipt-download"
        >
          <Download size={23} strokeWidth={2} aria-hidden="true" />
        </button>
      </header>

      <section className="sendflow-receipt-summary" aria-labelledby="receipt-summary-title">
        <div className="sendflow-receipt-summary-copy">
          <p id="receipt-summary-title" className="sendflow-receipt-total">{total}</p>
          <p className="sendflow-receipt-recipient">
            {isDeposit ? 'Dépôt sur votre wallet' : `Envoi au ${transaction.recipientPhone}`}
            <span aria-hidden="true"> • </span>
            {operatorName}
          </p>
        </div>
        <div className={`sendflow-receipt-operator is-${operatorCodeFor(transaction.toOperator)}`}>
          <OperatorLogo operator={operatorCodeFor(transaction.toOperator)} />
        </div>
      </section>

      <section className="sendflow-receipt-card" aria-labelledby="receipt-details-title">
        <h2 id="receipt-details-title">Détails transaction</h2>
        <dl>
          <DetailRow label="Nature de la transaction" value={transactionKindLabel} />
          <DetailRow label="Montant envoyé" value={sentAmount} />
          <DetailRow label="Frais enregistrés" value={fee} />
          <DetailRow label="Total enregistré" value={total} emphasized separated />
          <DetailRow label="Réseau bénéficiaire" value={operatorName} />
          <DetailRow label="Numéro débité" value={transaction.senderPhone} />
          <DetailRow label="Bénéficiaire" value={transaction.recipientPhone} />
          <DetailRow
            label="Statut"
            value={<span className={`sendflow-receipt-status is-${statusClass} is-prominent`}>{statusLabel}</span>}
          />
          <DetailRow label="Date et heure" value={formatTransactionDate(transaction.createdAt)} separated />
          <DetailRow label="Référence SendFlow" value={transaction.reference} />
          {transaction.providerReference && <DetailRow label="Référence opérateur" value={transaction.providerReference} />}
        </dl>
      </section>

      <section className="sendflow-receipt-actions" aria-label="Actions sur la transaction">
        <div className="sendflow-receipt-secondary-actions">
          <button
            type="button"
            className="sendflow-receipt-rate"
            onClick={handleRate}
            disabled={!supportContact.playStoreHref}
            title={!supportContact.playStoreHref ? 'Lien Play Store à configurer' : undefined}
            data-testid="button-rate-application"
          >
            <Star size={17} strokeWidth={2} aria-hidden="true" />
            Noter l'application
          </button>
          <a
            className="sendflow-receipt-report"
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            data-testid="link-receipt-whatsapp-support"
          >
            <CircleHelp size={19} strokeWidth={2.2} aria-hidden="true" />
            Besoin d’aide ?
          </a>
        </div>
      </section>
    </main>
  );
}