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

export const notifications: SendFlowNotification[] = [
  {
    id: 'notification-general-demo',
    type: 'general',
    operator: 'sendflow',
    title: 'Une nouvelle information SendFlow est disponible',
    message: 'Découvrez les nouveautés et les informations importantes de votre compte.',
    details: 'Cette notification de démonstration montre comment un message général envoyé depuis le futur panel sera présenté. Appuyez sur une notification générale pour lire son contenu complet.',
    relativeTime: 'à l’instant',
  },
  {
    id: 'notification-001',
    type: 'transaction',
    operator: 'wave',
    title: 'Votre transfert vers Wave est disponible en réception',
    message: 'Le bénéficiaire peut maintenant récupérer les fonds.',
    relativeTime: 'il y a 8 heures',
  },
  {
    id: 'notification-002',
    type: 'transaction',
    operator: 'mixx',
    title: 'Votre transfert inter réseau a été confirmé',
    message: 'La transaction a été traitée avec succès.',
    relativeTime: 'il y a 10 heures',
  },
  {
    id: 'notification-003',
    type: 'transaction',
    operator: 'mixx',
    title: 'Mixx by Yas est à nouveau disponible en réception',
    message: 'Vous pouvez reprendre vos transferts normalement.',
    relativeTime: 'il y a 10 heures',
  },
  {
    id: 'notification-004',
    type: 'transaction',
    operator: 'wave',
    title: 'Wave est momentanément indisponible en réception',
    message: 'Nous vous informerons dès le retour du service.',
    relativeTime: 'il y a un jour',
  },
  {
    id: 'notification-005',
    type: 'transaction',
    operator: 'tmoney',
    title: 'TMoney est indisponible en réception',
    message: 'Choisissez un autre réseau pour continuer.',
    relativeTime: 'il y a 7 jours',
  },
  {
    id: 'notification-006',
    type: 'transaction',
    operator: 'moov',
    title: 'Moov Africa est indisponible en réception',
    message: 'Le service sera rétabli dès que possible.',
    relativeTime: 'il y a 12 heures',
  },
  {
    id: 'notification-007',
    type: 'transaction',
    operator: 'mixx',
    title: 'Votre transfert est indisponible en émission',
    message: 'Vérifiez le statut de votre réseau avant de réessayer.',
    relativeTime: 'il y a 20 heures',
  },
  {
    id: 'notification-008',
    type: 'transaction',
    operator: 'wave',
    title: 'Wave est à nouveau disponible en réception',
    message: 'Les transferts peuvent reprendre normalement.',
    relativeTime: 'il y a 2 jours',
  },
];