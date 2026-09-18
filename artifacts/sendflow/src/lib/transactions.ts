import { DEMO_ACCOUNT } from '@/lib/demo-account';

export type TransactionKind = 'transfer' | 'deposit';
export type OperatorCode = 'mixx' | 'wave' | 'tmoney' | 'moov';

export type Transaction = {
  id: string;
  kind: TransactionKind;
  fromOperator: OperatorCode;
  toOperator: OperatorCode;
  sender: string;
  recipient: string;
  date: string;
  amount: string;
};

export const operatorNames: Record<OperatorCode, string> = {
  mixx: 'Mixx by Yas',
  wave: 'Wave',
  tmoney: 'TMoney',
  moov: 'Moov Africa',
};

export const transactions: Transaction[] = [
  {
    id: 'sf-001',
    kind: 'transfer',
    fromOperator: 'sendflow',
    toOperator: 'wave',
    sender: DEMO_ACCOUNT.phone,
    recipient: '0576915898',
    date: 'sept. 18, 2026 · 12:55',
    amount: '47 000',
  },
  {
    id: 'sf-002',
    kind: 'deposit',
    fromOperator: 'wave',
    toOperator: 'sendflow',
    sender: DEMO_ACCOUNT.phone,
    recipient: 'Wallet SendFlow',
    date: 'sept. 17, 2026 · 08:17',
    amount: '41 200',
  },
  {
    id: 'sf-003',
    kind: 'deposit',
    fromOperator: 'mixx',
    toOperator: 'sendflow',
    sender: DEMO_ACCOUNT.phone,
    recipient: 'Wallet SendFlow',
    date: 'sept. 16, 2026 · 22:18',
    amount: '125 000',
  },
  {
    id: 'sf-004',
    kind: 'transfer',
    fromOperator: 'sendflow',
    toOperator: 'wave',
    sender: DEMO_ACCOUNT.phone,
    recipient: '0585325450',
    date: 'août 21, 2026 · 20:53',
    amount: '32 500',
  },
  {
    id: 'sf-005',
    kind: 'transfer',
    fromOperator: 'sendflow',
    toOperator: 'wave',
    sender: DEMO_ACCOUNT.phone,
    recipient: '0585325450',
    date: 'août 21, 2026 · 12:32',
    amount: '35 000',
  },
  {
    id: 'sf-006',
    kind: 'transfer',
    fromOperator: 'sendflow',
    toOperator: 'wave',
    sender: DEMO_ACCOUNT.phone,
    recipient: '0595857098',
    date: 'août 21, 2026 · 00:08',
    amount: '31 000',
  },
];