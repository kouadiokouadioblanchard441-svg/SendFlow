export type OperatorCode = 'mixx' | 'wave' | 'tmoney' | 'moov';

export type Transaction = {
  id: string;
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
    fromOperator: 'mixx',
    toOperator: 'wave',
    sender: '72086435',
    recipient: '0576915898',
    date: 'sept. 16, 2026 · 12:55',
    amount: '47 000',
  },
  {
    id: 'sf-002',
    fromOperator: 'mixx',
    toOperator: 'wave',
    sender: '90489727',
    recipient: '0595857098',
    date: 'sept. 12, 2026 · 08:17',
    amount: '41 200',
  },
  {
    id: 'sf-003',
    fromOperator: 'mixx',
    toOperator: 'wave',
    sender: '92299772',
    recipient: '0595857098',
    date: 'sept. 06, 2026 · 22:18',
    amount: '125 000',
  },
  {
    id: 'sf-004',
    fromOperator: 'mixx',
    toOperator: 'wave',
    sender: '92299772',
    recipient: '0585325450',
    date: 'août 21, 2026 · 20:53',
    amount: '32 500',
  },
  {
    id: 'sf-005',
    fromOperator: 'mixx',
    toOperator: 'wave',
    sender: '72086435',
    recipient: '0585325450',
    date: 'août 21, 2026 · 12:32',
    amount: '35 000',
  },
  {
    id: 'sf-006',
    fromOperator: 'mixx',
    toOperator: 'wave',
    sender: '72886555',
    recipient: '0595857098',
    date: 'août 21, 2026 · 00:08',
    amount: '31 000',
  },
];