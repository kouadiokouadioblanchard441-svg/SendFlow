import type { CustomerTransactionRecord } from '@/lib/customer-transactions';

export type TransactionKind = 'inter-network' | 'deposit' | 'international';
export type TransactionStatus = 'pending' | 'succeeded' | 'failed';
export type OperatorCode =
  | 'sendflow'
  | 'orange'
  | 'wave'
  | 'mtn'
  | 'moov'
  | 'mixx'
  | 'tmoney'
  | 'unknown';

export type Transaction = {
  id: string;
  kind: TransactionKind;
  status: TransactionStatus;
  fromOperator: OperatorCode;
  toOperator: OperatorCode;
  sender: string;
  recipient: string;
  date: string;
  amount: string;
};

export const operatorNames: Record<OperatorCode, string> = {
  sendflow: 'Wallet SendFlow',
  orange: 'Orange Money',
  wave: 'Wave',
  mtn: 'MTN Mobile Money',
  moov: 'Moov Money',
  mixx: 'Mixx by Yas',
  tmoney: 'TMoney',
  unknown: 'Opérateur',
};

export function operatorCodeFor(value: string | null): OperatorCode {
  const normalized = value?.toLowerCase() ?? '';
  if (normalized.includes('sendflow') || normalized.includes('wallet')) return 'sendflow';
  if (normalized.includes('orange')) return 'orange';
  if (normalized.includes('wave')) return 'wave';
  if (normalized.includes('mtn')) return 'mtn';
  if (normalized.includes('moov')) return 'moov';
  if (normalized.includes('mixx')) return 'mixx';
  if (normalized.includes('tmoney') || normalized.includes('t-money')) return 'tmoney';
  return 'unknown';
}

export function formatCurrencyMinor(amountMinor: number, currency: string): string {
  try {
    const formatter = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: undefined,
    });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 0;
    return formatter.format(amountMinor / 10 ** fractionDigits);
  } catch {
    return `${new Intl.NumberFormat('fr-FR').format(amountMinor)} ${currency}`;
  }
}

export function formatTransactionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date indisponible';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function toTransactionView(record: CustomerTransactionRecord): Transaction {
  return {
    id: record.id,
    kind: record.kind,
    status: record.status,
    fromOperator: operatorCodeFor(record.fromOperator),
    toOperator: operatorCodeFor(record.toOperator),
    sender: record.senderPhone,
    recipient: record.recipientPhone,
    date: formatTransactionDate(record.createdAt),
    amount: formatCurrencyMinor(record.amountMinor, record.currency),
  };
}