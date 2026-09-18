import { ArrowLeft, Facebook, MessageCircle, PhoneCall, type LucideIcon } from 'lucide-react';
import { Redirect, useLocation } from 'wouter';
import { customerServiceProvider } from '@/lib/customer-service';
import { useSeo } from '@/lib/seo';

type SupportChannel = {
  id: 'whatsapp' | 'facebook' | 'phone';
  label: string;
  value: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
};

export default function CustomerServicePage() {
  const [, setLocation] = useLocation();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const contact = customerServiceProvider.getContact();
  const channels: SupportChannel[] = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      value: contact.whatsappNumber,
      href: contact.whatsappHref,
      icon: MessageCircle,
      external: true,
    },
    {
      id: 'facebook',
      label: 'Facebook',
      value: contact.facebookLabel,
      href: contact.facebookHref,
      icon: Facebook,
      external: true,
    },
    {
      id: 'phone',
      label: 'Téléphone',
      value: contact.phoneNumber,
      href: contact.phoneHref,
      icon: PhoneCall,
    },
  ];

  useSeo({
    path: '/customer-service',
    locale: 'fr',
    title: 'Service client · SendFlow',
    description: 'Contactez le service client SendFlow.',
    robots: 'noindex,nofollow',
  });

  if (!isUnlocked) return <Redirect to="/sign-in" />;

  return (
    <main className="sendflow-customer-service-shell">
      <section className="sendflow-customer-service-page" aria-labelledby="customer-service-title">
        <header className="sendflow-customer-service-header">
          <button
            type="button"
            className="sendflow-customer-service-back"
            onClick={() => setLocation('/account')}
            aria-label="Retour au compte"
            data-testid="button-customer-service-back"
          >
            <ArrowLeft size={23} strokeWidth={2.1} />
          </button>
          <h1 id="customer-service-title">Service client</h1>
        </header>

        <section className="sendflow-customer-service-list" aria-label="Moyens de contact">
          {channels.map((channel) => {
            const Icon = channel.icon;

            return (
              <a
                key={channel.id}
                className={`sendflow-customer-service-card is-${channel.id}`}
                href={channel.href}
                target={channel.external ? '_blank' : undefined}
                rel={channel.external ? 'noreferrer' : undefined}
                aria-label={`Contacter SendFlow via ${channel.label}`}
                data-testid={`link-customer-service-${channel.id}`}
              >
                <span className="sendflow-customer-service-copy">
                  <strong>{channel.label}</strong>
                  <span>{channel.value}</span>
                </span>
                <span className="sendflow-customer-service-icon" aria-hidden="true">
                  <Icon size={27} strokeWidth={2.35} />
                </span>
              </a>
            );
          })}
        </section>
      </section>
    </main>
  );
}