import type { OperatorCode } from '@/lib/transactions';

export type SendFlowNotification = {
  id: string;
  operator: OperatorCode;
  type: 'transaction' | 'general';
  title: string;
  message: string;
  relativeTime: string;
  details?: string;
};

export const notifications: SendFlowNotification[] = [];