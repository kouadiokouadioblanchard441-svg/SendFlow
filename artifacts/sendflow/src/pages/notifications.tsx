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

function NotificationOperatorIcon({ notification }: { notification: SendFlowNotification }) {
  const logo = operatorLogos[notification.operator];
  const operatorName = operatorNames[notification.operator];

  return (
    <span className={`sendflow-notification-operator is-${notification.operator}`} aria-label={`Opérateur : ${operatorName}`}>
      {logo ? <img src={logo} alt="" /> : <strong>{notification.operator === 'tmoney' ? 'T' : 'M'}</strong>}
    </span>
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
            <article className="sendflow-notification-row" key={notification.id} data-testid={`notification-${notification.id}`}>
              <NotificationOperatorIcon notification={notification} />
              <div className="sendflow-notification-copy">
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
                <small>{notification.relativeTime}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}