import { ArrowLeft, Download, Flag, Star } from 'lucide-react';
import { Redirect, useLocation } from 'wouter';
import { OperatorLogo } from '@/components/transaction-card';
import { customerServiceProvider } from '@/lib/customer-service';
import {
  operatorNames,
  transactionDetails,
  transactions,
  type Transaction,
  type TransactionDetail,
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

function getTransactionDetail(transaction: Transaction): TransactionDetail {
  return transactionDetails[transaction.id] ?? {
    nature: transaction.kind === 'deposit' ? "Dépôt d'argent" : "Transfert d'argent",
    sentAmount: `${transaction.amount} Fcfa`,
    fee: '0 Fcfa',
    total: `${transaction.amount} Fcfa`,
    senderCountry: "Côte d'Ivoire",
    senderFlag: '🇨🇮',
    recipientCountry: "Côte d'Ivoire",
    recipientFlag: '🇨🇮',
    debitedNumber: transaction.sender,
    beneficiary: transaction.recipient,
    status: 'En cours',
    dateTime: transaction.date,
    reference: `sendflow_${transaction.id}`,
  };
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
  const transaction = transactions.find((candidate) => candidate.id === transactionId);
  const detail = transaction ? getTransactionDetail(transaction) : undefined;

  useSeo({
    path: location,
    locale: 'fr',
    title: 'Détails de la transaction · SendFlow',
    description: 'Consultez le reçu détaillé de votre transaction SendFlow.',
    robots: 'noindex,nofollow',
  });

  if (!isUnlocked) return <Redirect to="/sign-in" />;
  if (!transaction || !detail) return <Redirect to="/history" />;

  const isDeposit = transaction.kind === 'deposit';
  const supportContact = customerServiceProvider.getContact();
  const whatsappMessage = [
    "Bonjour, je souhaite obtenir de l'aide concernant une transaction SendFlow.",
    '',
    `Montant envoyé : ${detail.sentAmount}`,
    `Total payé : ${detail.total}`,
    `Numéro débité : ${detail.debitedNumber}`,
    `Bénéficiaire : ${detail.beneficiary}`,
    `Opérateur : ${operatorNames[transaction.toOperator]}`,
    `Référence : ${detail.reference}`,
    `Date : ${detail.dateTime}`,
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
          <p id="receipt-summary-title" className="sendflow-receipt-total">{detail.total}</p>
          <p className="sendflow-receipt-recipient">
            {isDeposit ? 'Dépôt sur votre wallet' : `Envoi au ${detail.beneficiary}`}
            <span aria-hidden="true"> • </span>
            {detail.recipientCountry} {detail.recipientFlag}
          </p>
        </div>
        <div className={`sendflow-receipt-operator is-${transaction.toOperator}`}>
          <OperatorLogo operator={transaction.toOperator} />
        </div>
      </section>

      <section className="sendflow-receipt-card" aria-labelledby="receipt-details-title">
        <h2 id="receipt-details-title">Détails transaction</h2>
        <dl>
          <DetailRow label="Nature de la transaction" value={detail.nature} />
          <DetailRow label="Montant envoyé" value={detail.sentAmount} />
          <DetailRow label="Frais" value={detail.fee} />
          <DetailRow label="Total payé" value={detail.total} emphasized separated />
          <DetailRow
            label="Pays de l'expéditeur"
            value={<>{detail.senderCountry} {detail.senderFlag}</>}
          />
          <DetailRow label="Numéro débité" value={detail.debitedNumber} />
          <DetailRow label="Bénéficiaire" value={detail.beneficiary} />
          <DetailRow
            label="Statut"
            value={<span className={`sendflow-receipt-status is-${detail.status === 'Réussie' ? 'success' : detail.status === 'Échouée' ? 'failed' : 'pending'}`}>{detail.status}</span>}
          />
          <DetailRow label="Date et heure" value={detail.dateTime} separated />
          <DetailRow label="ID transaction" value={detail.reference} />
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
            <Flag size={17} strokeWidth={2} aria-hidden="true" />
            Besoin d’aide ?
          </a>
        </div>
      </section>
    </main>
  );
}