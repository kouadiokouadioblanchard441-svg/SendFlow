import { ArrowRight } from 'lucide-react';
import sendflowMark from '@assets/sendflow-mark-original.png';
import { CatalogOperatorIcon } from '@/components/catalog-operator-icon';
import { operatorNames, type OperatorCode, type Transaction } from '@/lib/transactions';

export function OperatorLogo({ operator }: { operator: OperatorCode }) {
  if (operator === 'sendflow') {
    return (
      <span className="sendflow-transaction-logo is-sendflow">
        <img src={sendflowMark} alt="" />
      </span>
    );
  }

  return (
    <span className={`sendflow-transaction-logo is-${operator}`}>
      <CatalogOperatorIcon operatorCode={operator} />
    </span>
  );
}

function TransactionCardContent({ transaction }: { transaction: Transaction }) {
  const amountPrefix = transaction.kind === 'deposit' ? '+ ' : transaction.kind === 'international' ? '- ' : '';
  const amountClass = transaction.kind === 'deposit' ? 'is-deposit' : transaction.kind === 'international' ? 'is-international' : '';
  const statusLabel = transaction.status === 'succeeded'
    ? 'RÉUSSIE'
    : transaction.status === 'pending'
      ? 'ATTENTE'
      : 'ÉCHEC';
  const statusClass = transaction.status === 'succeeded'
    ? 'is-success'
    : transaction.status === 'pending'
      ? 'is-pending'
      : 'is-failed';

  return (
    <>
      <span className="sendflow-transaction-route" aria-label={`De ${operatorNames[transaction.fromOperator]} vers ${operatorNames[transaction.toOperator]}`}>
        <OperatorLogo operator={transaction.fromOperator} />
        <ArrowRight className="sendflow-transaction-route-arrow" size={17} strokeWidth={1.8} aria-hidden="true" />
        <OperatorLogo operator={transaction.toOperator} />
      </span>
      <span className="sendflow-transaction-copy">
        <strong>De {transaction.sender} vers {transaction.recipient}</strong>
        <small>{transaction.date}</small>
      </span>
      <span className="sendflow-transaction-amount-wrap">
        <span className={`sendflow-transaction-amount ${amountClass}`.trim()}>{amountPrefix}{transaction.amount}</span>
        {statusLabel && <span className={`sendflow-transaction-status ${statusClass}`}>{statusLabel}</span>}
      </span>
    </>
  );
}

export function TransactionCard({
  transaction,
  onClick,
  testId,
  className = '',
}: {
  transaction: Transaction;
  onClick?: () => void;
  testId?: string;
  className?: string;
}) {
  const classes = `sendflow-transaction-card ${className}`.trim();

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} data-testid={testId}>
        <TransactionCardContent transaction={transaction} />
      </button>
    );
  }

  return (
    <article className={classes} data-testid={testId}>
      <TransactionCardContent transaction={transaction} />
    </article>
  );
}