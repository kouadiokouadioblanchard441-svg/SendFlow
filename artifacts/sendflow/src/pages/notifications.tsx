import { ArrowLeft } from 'lucide-react';
import { Redirect, useLocation } from 'wouter';
import mixxLogo from '@assets/generated_images/sendflow-mixx-logo.png';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import waveLogo from '@assets/generated_images/sendflow-wave-logo.png';
import { operatorNames } from '@/lib/transactions';
import { notifications, type SendFlowNotification } from '@/lib/notifications';
import { useSeo } from '@/lib/seo';

const operatorLogos: Partial<Record<SendFlowNotification['operator'], string>> = {
  mixx: mixxLogo,
  wave: waveLogo,
};

const operatorWordmarks: Partial<Record<SendFlowNotification['operator'], string>> = {
  tmoney: 'TMoney',
  moov: 'Moov',
};

function NotificationOperatorIcon({ notification }: { notification: SendFlowNotification }) {
  const logo = operatorLogos[notification.operator];
  const operatorName = operatorNames[notification.operator];
  const wordmark = operatorWordmarks[notification.operator] ?? operatorName;

  return (
    <span
      className={`sendflow-notification-operator is-${notification.operator}`}
      role="img"
      aria-label={`Opérateur : ${operatorName}`}
    >
      {logo ? <img src={logo} alt="" /> : <strong aria-hidden="true">{wordmark}</strong>}
    </span>
  );
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: SendFlowNotification;
  onOpen: (notification: SendFlowNotification) => void;
}) {
  const content = (
    <>
      <NotificationOperatorIcon notification={notification} />
      <div className="sendflow-notification-copy">
        <strong>{notification.title}</strong>
        <span>{notification.message}</span>
        <small>{notification.relativeTime}</small>
      </div>
    </>
  );

  if (notification.type === 'general') {
    return (
      <button
        type="button"
        className="sendflow-notification-row is-actionable"
        onClick={() => onOpen(notification)}
        aria-label={`Lire la notification : ${notification.title}`}
        data-testid={`notification-${notification.id}`}
      >
        {content}
      </button>
    );
  }

  return (
    <article className="sendflow-notification-row" key={notification.id} data-testid={`notification-${notification.id}`}>
      {content}
    </article>
  );
}

export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';

  useSeo({
    path: '/notifications',
    locale: 'fr',
    title: 'Notifications · SendFlow',
    description: 'Consultez les notifications de vos transferts SendFlow.',
    robots: 'noindex,nofollow',
  });

  if (!isUnlocked) return <Redirect to="/sign-in" />;

  return (
    <main className="sendflow-notifications-shell">
      <header className="sendflow-notifications-header">
        <div className="sendflow-notifications-brand" aria-label="SendFlow">
          <img className="sendflow-notifications-mark" src={sendflowMark} alt="" />
          <img className="sendflow-notifications-wordmark" src={sendflowWordmark} alt="SendFlow" />
        </div>
      </header>

      <section className="sendflow-notifications-card" aria-labelledby="notifications-page-title">
        <button
          type="button"
          className="sendflow-notifications-back"
          onClick={() => setLocation('/account')}
          data-testid="button-notifications-back"
        >
          Retour
        </button>

        <h1 id="notifications-page-title">Notifications</h1>

        <div className="sendflow-notifications-list">
          {notifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onOpen={(nextNotification) => setLocation(`/notifications/${encodeURIComponent(nextNotification.id)}`)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

export function NotificationDetailPage() {
  const [location, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const notificationId = decodeURIComponent(location.split('/').filter(Boolean).at(-1) ?? '');
  const notification = notifications.find(
    (candidate) => candidate.id === notificationId && candidate.type === 'general',
  );

  useSeo({
    path: location,
    locale: 'fr',
    title: 'Notification · SendFlow',
    description: 'Lisez une notification SendFlow.',
    robots: 'noindex,nofollow',
  });

  if (!isUnlocked) return <Redirect to="/sign-in" />;
  if (!notification) return <Redirect to="/notifications" />;

  return (
    <main className="sendflow-notifications-shell">
      <header className="sendflow-notifications-header">
        <div className="sendflow-notifications-brand" aria-label="SendFlow">
          <img className="sendflow-notifications-mark" src={sendflowMark} alt="" />
          <img className="sendflow-notifications-wordmark" src={sendflowWordmark} alt="SendFlow" />
        </div>
      </header>

      <article className="sendflow-notification-detail-card" aria-labelledby="notification-detail-title">
        <button
          type="button"
          className="sendflow-notifications-back"
          onClick={() => setLocation('/notifications')}
          data-testid="button-notification-detail-back"
        >
          <ArrowLeft size={18} strokeWidth={2.1} aria-hidden="true" />
          Retour aux notifications
        </button>

        <div className="sendflow-notification-detail-icon">
          <NotificationOperatorIcon notification={notification} />
        </div>
        <p className="sendflow-notification-detail-kicker">Notification SendFlow</p>
        <h1 id="notification-detail-title">{notification.title}</h1>
        <p className="sendflow-notification-detail-message">{notification.message}</p>
        {notification.details && <p className="sendflow-notification-detail-body">{notification.details}</p>}
        <small className="sendflow-notification-detail-time">{notification.relativeTime}</small>
      </article>
    </main>
  );
}