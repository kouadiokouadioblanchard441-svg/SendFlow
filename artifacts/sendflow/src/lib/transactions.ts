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

export type TransactionDetail = {
  nature: string;
  sentAmount: string;
  fee: string;
  total: string;
  senderCountry: string;
  senderFlag: string;
  recipientCountry: string;
  recipientFlag: string;
  debitedNumber: string;
  beneficiary: string;
  status: 'En cours' | 'Réussie' | 'Échouée';
  dateTime: string;
  reference: string;
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
    recipient: 'Wallet',
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
    recipient: 'Wallet',
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

export const transactionDetails: Record<string, TransactionDetail> = {
  'sf-001': {
    nature: "Transfert d'argent",
    sentAmount: '47 000 Fcfa',
    fee: '1 000 Fcfa',
    total: '48 000 Fcfa',
    senderCountry: "Côte d'Ivoire",
    senderFlag: '🇨🇮',
    recipientCountry: 'Cameroun',
    recipientFlag: '🇨🇲',
    debitedNumber: DEMO_ACCOUNT.phone,
    beneficiary: '0576915898',
    status: 'Réussie',
    dateTime: '18/09/2026 à 12h55',
    reference: 'SF-260918-0001-7A3D9C21',
  },
  'sf-002': {
    nature: "Dépôt d'argent",
    sentAmount: '41 200 Fcfa',
    fee: '0 Fcfa',
    total: '41 200 Fcfa',
    senderCountry: "Côte d'Ivoire",
    senderFlag: '🇨🇮',
    recipientCountry: "Côte d'Ivoire",
    recipientFlag: '🇨🇮',
    debitedNumber: DEMO_ACCOUNT.phone,
    beneficiary: 'Wallet',
    status: 'Réussie',
    dateTime: '17/09/2026 à 08h17',
    reference: 'SF-260917-0001-2F94B801',
  },
  'sf-003': {
    nature: 'Transfert international',
    sentAmount: '18 500 Fcfa',
    fee: '1 500 Fcfa',
    total: '20 000 Fcfa',
    senderCountry: "Côte d'Ivoire",
    senderFlag: '🇨🇮',
    recipientCountry: 'Cameroun',
    recipientFlag: '🇨🇲',
    debitedNumber: DEMO_ACCOUNT.phone,
    beneficiary: '0585325450',
    status: 'En cours',
    dateTime: '16/09/2026 à 18h42',
    reference: 'SF-260916-0001-6D1E4B0F',
  },
  'sf-004': {
    nature: "Dépôt d'argent",
    sentAmount: '125 000 Fcfa',
    fee: '0 Fcfa',
    total: '125 000 Fcfa',
    senderCountry: "Côte d'Ivoire",
    senderFlag: '🇨🇮',
    recipientCountry: "Côte d'Ivoire",
    recipientFlag: '🇨🇮',
    debitedNumber: DEMO_ACCOUNT.phone,
    beneficiary: 'Wallet',
    status: 'Réussie',
    dateTime: '16/09/2026 à 22h18',
    reference: 'SF-260916-0002-9C8A2E44',
  },
  'sf-005': {
    nature: "Transfert d'argent",
    sentAmount: '32 500 Fcfa',
    fee: '1 000 Fcfa',
    total: '33 500 Fcfa',
    senderCountry: "Côte d'Ivoire",
    senderFlag: '🇨🇮',
    recipientCountry: "Côte d'Ivoire",
    recipientFlag: '🇨🇮',
    debitedNumber: DEMO_ACCOUNT.phone,
    beneficiary: '0585325450',
    status: 'Échouée',
    dateTime: '21/08/2026 à 20h53',
    reference: 'SF-260821-0003-4E1F7AC6',
  },
  'sf-006': {
    nature: "Transfert d'argent",
    sentAmount: '35 000 Fcfa',
    fee: '1 000 Fcfa',
    total: '36 000 Fcfa',
    senderCountry: "Côte d'Ivoire",
    senderFlag: '🇨🇮',
    recipientCountry: "Côte d'Ivoire",
    recipientFlag: '🇨🇮',
    debitedNumber: DEMO_ACCOUNT.phone,
    beneficiary: '0585325450',
    status: 'Réussie',
    dateTime: '21/08/2026 à 12h32',
    reference: 'SF-260821-0002-1B7D25E0',
  },
  'sf-007': {
    nature: "Transfert d'argent",
    sentAmount: '31 000 Fcfa',
    fee: '1 000 Fcfa',
    total: '32 000 Fcfa',
    senderCountry: "Côte d'Ivoire",
    senderFlag: '🇨🇮',
    recipientCountry: "Côte d'Ivoire",
    recipientFlag: '🇨🇮',
    debitedNumber: DEMO_ACCOUNT.phone,
    beneficiary: '0595857098',
    status: 'Réussie',
    dateTime: '21/08/2026 à 00h08',
    reference: 'SF-260821-0001-8F2C4D19',
  },
};