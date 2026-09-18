import { DEMO_ACCOUNT } from '@/lib/demo-account';

export type TransactionKind = 'inter-network' | 'deposit' | 'international';
export type OperatorCode = 'sendflow' | 'mixx' | 'wave' | 'mtn' | 'tmoney' | 'moov';

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
  sendflow: 'SendFlow',
  mixx: 'Mixx by Yas',
  wave: 'Wave',
  mtn: 'MTN Mobile Money',
  tmoney: 'TMoney',
  moov: 'Moov Africa',
};

export const transactions: Transaction[] = [
  {
    id: 'sf-001',
    kind: 'inter-network',
    fromOperator: 'wave',
    toOperator: 'mtn',
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
    kind: 'international',
    fromOperator: 'sendflow',
    toOperator: 'wave',
    sender: DEMO_ACCOUNT.phone,
    recipient: '0585325450',
    date: 'sept. 16, 2026 · 18:42',
    amount: '18 500',
  },
  {
    id: 'sf-004',
    kind: 'deposit',
    fromOperator: 'mixx',
    toOperator: 'sendflow',
    sender: DEMO_ACCOUNT.phone,
    recipient: 'Wallet SendFlow',
    date: 'sept. 16, 2026 · 22:18',
    amount: '125 000',
  },
  {
    id: 'sf-005',
    kind: 'inter-network',
    fromOperator: 'mtn',
    toOperator: 'wave',
    sender: DEMO_ACCOUNT.phone,
    recipient: '0585325450',
    date: 'août 21, 2026 · 20:53',
    amount: '32 500',
  },
  {
    id: 'sf-006',
    kind: 'inter-network',
    fromOperator: 'wave',
    toOperator: 'mtn',
    sender: DEMO_ACCOUNT.phone,
    recipient: '0585325450',
    date: 'août 21, 2026 · 12:32',
    amount: '35 000',
  },
  {
    id: 'sf-007',
    kind: 'inter-network',
    fromOperator: 'mtn',
    toOperator: 'wave',
    sender: DEMO_ACCOUNT.phone,
    recipient: '0595857098',
    date: 'août 21, 2026 · 00:08',
    amount: '31 000',
  },
];