import { ArrowRight, ChevronRight } from 'lucide-react';
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
      <span className="sendflow-transaction-amount">{transaction.amount}</span>
      <ChevronRight className="sendflow-transaction-chevron" size={20} strokeWidth={2} aria-hidden="true" />
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