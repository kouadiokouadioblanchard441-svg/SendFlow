import { ArrowRight } from 'lucide-react';
import mixxLogo from '@assets/generated_images/sendflow-mixx-logo.png';
import sendflowMark from '@assets/sendflow-mark-original.png';
import waveLogo from '@assets/generated_images/sendflow-wave-logo.png';
import { operatorNames, type OperatorCode, type Transaction } from '@/lib/transactions';

const operatorLogos: Partial<Record<OperatorCode, string>> = {
  sendflow: sendflowMark,
  mixx: mixxLogo,
  wave: waveLogo,
};

function OperatorLogo({ operator }: { operator: OperatorCode }) {
  if (operator === 'sendflow') {
    return (
      <span className="sendflow-transaction-logo is-sendflow">
        <img src={sendflowMark} alt="" />
      </span>
    );
  }

  if (operator === 'mixx' || operator === 'wave') {
    return (
      <span className={`sendflow-transaction-logo is-${operator}`}>
        <img src={operatorLogos[operator]} alt="" />
      </span>
    );
  }

  return (
    <span className={`sendflow-transaction-logo is-${operator}`}>
      <strong>{operator === 'mtn' ? 'MTN' : operator === 'tmoney' ? 'T' : 'M'}</strong>
    </span>
  );
}

function TransactionCardContent({ transaction }: { transaction: Transaction }) {
  const amountPrefix = transaction.kind === 'deposit' ? '+ ' : transaction.kind === 'international' ? '- ' : '';
  const amountClass = transaction.kind === 'deposit' ? 'is-deposit' : transaction.kind === 'international' ? 'is-international' : '';

  return (
    <>
      <span className="sendflow-transaction-route" aria-label={`De ${operatorNames[transaction.fromOperator]} vers ${operatorNames[transaction.toOperator]}`}>
        <OperatorLogo operator={transaction.fromOperator} />
        <ArrowRight className="sendflow-transaction-route-arrow" size={17} strokeWidth={1.8} aria-hidden="true" />
        <OperatorLogo operator={transaction.toOperator} />
      </span>
      <span className="sendflow-transaction-copy">
        <span className="sendflow-transaction-parties" aria-label={`De ${transaction.sender} vers ${transaction.recipient}`}>
          <span className="sendflow-transaction-party">
            <small>De</small>
            <strong>{transaction.sender}</strong>
          </span>
          <span className="sendflow-transaction-party">
            <small>Vers</small>
            <strong>{transaction.recipient}</strong>
          </span>
        </span>
        <small className="sendflow-transaction-date">{transaction.date}</small>
      </span>
      <span className={`sendflow-transaction-amount ${amountClass}`.trim()}>{amountPrefix}{transaction.amount}</span>
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