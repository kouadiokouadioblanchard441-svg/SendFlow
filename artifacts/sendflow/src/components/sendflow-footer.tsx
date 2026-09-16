import { Facebook, Instagram, Linkedin } from 'lucide-react';
import { Link } from 'wouter';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import bceaoLogo from '@assets/image_search/bceao-logo-official.png';

type Copy = { fr: string; en: string };

export type FooterSettings = {
  supportEmail?: string | null;
  companyName?: string | null;
  legalForm?: string | null;
  legalAddress?: string | null;
  legalEmail?: string | null;
  footerAddressFlag?: string | null;
  footerAddressCountry?: string | null;
  footerAddress?: string | null;
  regulatorNameFr?: string | null;
  regulatorNameEn?: string | null;
  regulatorLogoKey?: string | null;
  googlePlayUrl?: string | null;
  appStoreUrl?: string | null;
  appGalleryUrl?: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
};

export type FooterContentItem = {
  contentKey: string;
  locale: string;
  value: string;
  isVisible: boolean;
};

type SendFlowFooterProps = {
  isFrench: boolean;
  onNavigate?: (id: string) => void;
  settings: FooterSettings | null | undefined;
  content: FooterContentItem[];
};

function StoreLogo({ icon }: { icon: 'play' | 'apple' | 'gallery' }) {
  if (icon === 'play') {
    return (
      <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0" aria-hidden="true">
        <path d="M4.5 3.8C3.6 4.7 3 6.1 3 7.8v16.4c0 1.7.6 3.1 1.5 4l14-14.2L4.5 3.8Z" fill="#00A0FF" />
        <path d="m18.5 14 4.2-4.3 4.8 2.7c1.5.9 1.5 2.5 0 3.4l-4.8 2.7-4.2-4.5Z" fill="#FFD900" />
        <path d="M4.5 3.8 18.5 18l4.2-4.3L7.2 2.3c-1-.5-2-.1-2.7 1.5Z" fill="#FF3A44" />
        <path d="M4.5 28.2 18.5 14l4.2 4.5-15.5 8.9c-1 .5-2 .1-2.7-1.5Z" fill="#00C86F" />
      </svg>
    );
  }

  if (icon === 'apple') {
    return (
      <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0" aria-hidden="true">
        <path d="M21.2 16.8c0-3 2.5-4.5 2.6-4.6-1.4-2.1-3.7-2.4-4.5-2.4-1.9-.2-3.7 1.1-4.7 1.1-1 0-2.5-1.1-4.1-1-2.1 0-4.1 1.2-5.2 3.1-2.2 3.8-.6 9.4 1.5 12.5 1 1.5 2.3 3.2 3.9 3.1 1.6-.1 2.2-1 4.1-1 1.9 0 2.4 1 4.1.9 1.7 0 2.8-1.5 3.8-3 1.2-1.7 1.7-3.4 1.7-3.5-.1 0-3.2-1.2-3.2-5.2Z" fill="currentColor" />
        <path d="M18.2 7.9c.9-1.1 1.5-2.6 1.3-4.1-1.3.1-2.9.9-3.8 2-.8.9-1.5 2.5-1.3 3.9 1.5.1 2.9-.7 3.8-1.8Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0" aria-hidden="true">
      <rect x="4" y="4" width="24" height="24" rx="7" fill="#E8CD4D" />
      <path d="M10 11h12v10H10z" fill="#6D35D8" />
      <path d="m13 13 6 3-6 3v-6Z" fill="#fff" />
    </svg>
  );
}

function StoreBadge({ store, icon, href }: { store: string; icon: 'play' | 'apple' | 'gallery'; href?: string | null }) {
  const badge = (
    <div className="sendflow-store-badge" aria-label={`Disponible sur ${store}`}>
      <StoreLogo icon={icon} />
      <span>
        <small>{icon === 'gallery' ? 'DÉCOUVREZ-LE SUR' : icon === 'play' ? 'DISPONIBLE SUR' : 'Télécharger sur'}</small>
        <strong>{store}</strong>
      </span>
    </div>
  );
  return href ? <a href={href} target="_blank" rel="noreferrer">{badge}</a> : badge;
}

function contentValue(content: FooterContentItem[], key: string, fallback: Copy, isFrench: boolean) {
  return content.find((item) => item.contentKey === key && item.locale === (isFrench ? 'fr' : 'en') && item.isVisible)?.value ?? fallback[isFrench ? 'fr' : 'en'];
}

export function SendFlowFooter({ isFrench, onNavigate, settings, content }: SendFlowFooterProps) {
  const supportEmail = settings?.supportEmail?.trim() || 'support@sendflow.studio';
  const legalCompany = settings?.companyName?.trim() || 'Flow Digital SARL';
  const legalForm = settings?.legalForm?.trim();
  const legalAddress = settings?.legalAddress?.trim() || settings?.footerAddress?.trim() || 'Côte d’Ivoire, Abidjan, Cocody Riviera Palmeraie';
  const legalEmail = settings?.legalEmail?.trim() || supportEmail;
  const navigate = (id: string) => {
    if (onNavigate) {
      onNavigate(id);
      return;
    }
    window.location.assign(`/#${id}`);
  };
  const copy = (key: string, fallback: Copy) => contentValue(content, key, fallback, isFrench);

  return (
    <footer id="footer" className="sendflow-reference-footer">
      <div className="sendflow-footer-inner">
        <section className="sendflow-footer-regulator" aria-label="BCEAO">
          <a href="https://www.bceao.int/" target="_blank" rel="noreferrer" aria-label="Visiter le site officiel de la BCEAO">
            <img src={bceaoLogo} alt="BCEAO — Banque Centrale des États de l’Afrique de l’Ouest" className="sendflow-official-regulator-logo" />
          </a>
        </section>

        <div className="sendflow-footer-link-groups">
          <section>
            <h3>{isFrench ? 'Produits' : 'Products'}</h3>
            <button onClick={() => navigate('top')}>SendFlow Africa</button>
          </section>
          <section>
            <h3>{isFrench ? 'Assistance' : 'Support'}</h3>
            <a href={`mailto:${supportEmail}`} data-testid="link-footer-support-email">{supportEmail}</a>
            <button onClick={() => navigate('join')}>{copy('footer.referral', { fr: 'Parrainage', en: 'Referral' })}</button>
          </section>
          <section>
            <h3>{isFrench ? 'Réglementation' : 'Regulation'}</h3>
            <Link href="/confidentialite">{isFrench ? 'Politique de Confidentialité' : 'Privacy Policy'}</Link>
            <Link href="/conditions-utilisation">{isFrench ? 'Conditions d’utilisation' : 'Terms of Use'}</Link>
            <Link href="/mentions-legales">{isFrench ? 'Mentions légales' : 'Legal notice'}</Link>
          </section>
        </div>

        <section className="sendflow-footer-addresses">
          <h3>{copy('footer.address.title', { fr: 'Nos adresses', en: 'Our offices' })}</h3>
          <div className="sendflow-office">
            <span className="sendflow-office-flag" aria-hidden="true">{settings?.footerAddressFlag || '🇨🇮'}</span>
            <div>
              <strong>{settings?.footerAddressCountry || copy('footer.address.country', { fr: 'Côte d’Ivoire', en: 'Côte d’Ivoire' })}</strong>
              <p>{settings?.footerAddress || copy('footer.address.value', { fr: 'Abidjan, Cocody Riviera Palmeraie', en: 'Abidjan, Cocody Riviera Palmeraie' })}</p>
            </div>
          </div>
        </section>

        <section className="sendflow-footer-downloads">
          <div className="sendflow-store-row">
            <StoreBadge store="Google Play" icon="play" href={settings?.googlePlayUrl} />
            <StoreBadge store="App Store" icon="apple" href={settings?.appStoreUrl} />
          </div>
          <StoreBadge store="AppGallery" icon="gallery" href={settings?.appGalleryUrl} />
        </section>

        <div className="sendflow-footer-socials" aria-label={isFrench ? 'Réseaux sociaux' : 'Social networks'}>
          {settings?.linkedinUrl && <a href={settings.linkedinUrl} aria-label="LinkedIn" target="_blank" rel="noreferrer" data-testid="link-footer-linkedin"><Linkedin size={20} strokeWidth={2.5} /></a>}
          {settings?.facebookUrl && <a href={settings.facebookUrl} aria-label="Facebook" target="_blank" rel="noreferrer" data-testid="link-footer-facebook"><Facebook size={19} fill="currentColor" /></a>}
          {settings?.instagramUrl && <a href={settings.instagramUrl} aria-label="Instagram" target="_blank" rel="noreferrer" data-testid="link-footer-instagram"><Instagram size={20} strokeWidth={2.5} /></a>}
        </div>

        <div className="sendflow-footer-divider" />

        <section className="sendflow-footer-legal">
          <p>{copy('footer.legal.disclaimer', { fr: 'SendFlow est une solution de technologie financière, développée par Flow Digital SARL. Nous ne sommes pas une banque ; nos services s’appuient sur des partenariats avec des banques et des institutions financières dûment agréées.', en: 'SendFlow is a financial technology solution developed by Flow Digital SARL. We are not a bank; our services rely on partnerships with duly licensed banks and financial institutions.' })}</p>
          <p>{copy('footer.legal.partners', { fr: 'Les services de paiement SendFlow sont proposés via des partenaires agréés dans les territoires où le service est disponible, conformément aux règles locales. Les conditions varient selon la destination, le réseau et le montant du transfert.', en: 'SendFlow payment services are offered through licensed partners in territories where the service is available, in accordance with local rules. Conditions vary by destination, network, and transfer amount.' })}</p>
          <p className="sendflow-footer-legal-identity"><strong>{copy('footer.legal.identity', { fr: 'Identité légale', en: 'Legal identity' })} :</strong> {legalCompany}{legalForm ? ` · ${legalForm}` : ''}</p>
          <p className="sendflow-footer-legal-identity"><strong>{copy('footer.legal.address', { fr: 'Adresse légale', en: 'Legal address' })} :</strong> {legalAddress}</p>
          <p className="sendflow-footer-legal-identity"><strong>{copy('footer.legal.contact', { fr: 'Contact légal', en: 'Legal contact' })} :</strong> <a href={`mailto:${legalEmail}`}>{legalEmail}</a></p>
        </section>

        <div className="sendflow-footer-bottom">
          <span>© 2026 {legalCompany}. {isFrench ? 'Tous droits réservés.' : 'All rights reserved.'}</span>
          <div><Link href="/confidentialite">{isFrench ? 'Confidentialité' : 'Privacy'}</Link><Link href="/mentions-legales">{isFrench ? 'Mentions légales' : 'Legal notice'}</Link></div>
        </div>
      </div>
    </footer>
  );
}