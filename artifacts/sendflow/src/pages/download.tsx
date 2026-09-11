import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowRight, ChevronRight, Globe2, Headphones, Menu, X } from 'lucide-react';
import { Link } from 'wouter';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import androidMaterialIcon from '@assets/google-android-material-icon.svg';
import stepDownloadArt from '@assets/generated_images/sendflow-step-download-clean.png';
import stepAccountArt from '@assets/generated_images/sendflow-step-account-clean.png';
import stepWalletArt from '@assets/generated_images/sendflow-step-wallet-clean.png';
import stepTransferArt from '@assets/generated_images/sendflow-step-transfer-clean.png';
import materialGetAppIcon from '@assets/google-material/get-app.svg';
import materialPersonIcon from '@assets/google-material/person.svg';
import materialWalletIcon from '@assets/google-material/account-balance-wallet.svg';
import materialOutboxIcon from '@assets/google-material/outbox.svg';
import { SendFlowFooter } from '@/components/sendflow-footer';

type Language = 'fr' | 'en';

type DownloadSettings = {
  supportEmail?: string | null;
  supportPhone?: string | null;
  companyName?: string | null;
  legalAddress?: string | null;
  legalForm?: string | null;
  legalEmail?: string | null;
  footerAddress?: string | null;
  footerAddressCountry?: string | null;
  footerAddressFlag?: string | null;
  regulatorNameFr?: string | null;
  regulatorNameEn?: string | null;
  regulatorLogoKey?: string | null;
  googlePlayUrl?: string | null;
  appStoreUrl?: string | null;
  appGalleryUrl?: string | null;
  apkUrl?: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
};

type LandingResponse = {
  settings?: DownloadSettings | null;
  content?: Array<{ contentKey: string; locale: string; value: string; isVisible: boolean }>;
  media?: Array<{ slug: string; publicUrl: string | null; isVisible: boolean }>;
};

const copy = {
  fr: {
    navHome: 'Accueil',
    navFeatures: 'Fonctionnalités',
    navSupport: 'Assistance',
    language: 'EN',
    menuOpen: 'Ouvrir le menu',
    menuClose: 'Fermer le menu',
    kicker: 'L’application SendFlow',
    title: 'Téléchargez SendFlow',
    body: 'Gratuit, sans frais cachés. Disponible sur iOS et Android.',
    free: 'Gratuit à télécharger. Disponible sur iOS et Android.',
    download: 'Télécharger',
    available: 'Disponible sur',
    comingSoon: 'Bientôt disponible',
    apkTitle: 'Télécharger l’APK (Android)',
    apkMeta: 'Android direct · bientôt disponible',
    apkReady: 'Android direct',
    startKicker: 'Le premier mouvement',
    startTitle: 'Comment démarrer ?',
    step1: 'Téléchargez l’application',
    step1Body: 'Disponible gratuitement sur App Store et Google Play.',
    step2: 'Créez votre compte',
    step2Body: 'Inscription en 2 minutes avec votre numéro de téléphone.',
    step3: 'Ajoutez votre compte mobile',
    step3Body: 'Liez votre compte Orange, MTN, Moov ou Wave en toute sécurité.',
    step4: 'Commencez à transférer',
    step4Body: 'Choisissez un réseau, vérifiez les détails, puis envoyez.',
    supportKicker: 'Besoin d’aide ?',
    supportTitle: 'Une question avant de commencer ?',
    supportBody: 'Notre équipe est là pour vous accompagner dans vos premiers transferts.',
    contact: 'Contacter l’assistance',
    footerLead: 'Une façon plus claire de faire circuler l’argent entre les réseaux.',
    products: 'Produit',
    company: 'Entreprise',
    legal: 'Légal',
    features: 'Fonctionnalités',
    security: 'Sécurité',
    about: 'À propos de nous',
    support: 'Support & aide',
    terms: 'Conditions générales d’utilisation',
    privacy: 'Politique de confidentialité',
    mentions: 'Mentions légales',
    address: 'Nos adresses',
    footerNote: 'SendFlow connecte les réseaux de paiement et les personnes qui les utilisent.',
    residence: 'Pays de résidence',
    legalIdentity: 'Identité légale',
    regulator: 'Réglementé par',
    legalContact: 'Contact légal',
    legalNotice: 'SendFlow est une solution de technologie financière développée par Flow Digital SARL. Nous ne sommes pas une banque ; nos services s’appuient sur des partenaires agréés.',
    rights: 'Tous droits réservés.',
  },
  en: {
    navHome: 'Home',
    navFeatures: 'Features',
    navSupport: 'Support',
    language: 'FR',
    menuOpen: 'Open menu',
    menuClose: 'Close menu',
    kicker: 'The SendFlow app',
    title: 'Download SendFlow',
    body: 'Free, with no hidden fees. Available on iOS and Android.',
    free: 'Free to download. Available on iOS and Android.',
    download: 'Download',
    available: 'Available on',
    comingSoon: 'Coming soon',
    apkTitle: 'Download APK (Android)',
    apkMeta: 'Direct Android install · coming soon',
    apkReady: 'Direct Android install',
    startKicker: 'Your first move',
    startTitle: 'How to get started',
    step1: 'Download the app',
    step1Body: 'Available free on the App Store and Google Play.',
    step2: 'Create your account',
    step2Body: 'Sign up in two minutes with your phone number.',
    step3: 'Add your mobile account',
    step3Body: 'Link your Orange, MTN, Moov or Wave account securely.',
    step4: 'Start transferring',
    step4Body: 'Choose a network, review the details, then send.',
    supportKicker: 'Need a hand?',
    supportTitle: 'Questions before you start?',
    supportBody: 'Our team is here to guide you through your first transfers.',
    contact: 'Contact support',
    footerLead: 'A clearer way to move money across payment networks.',
    products: 'Product',
    company: 'Company',
    legal: 'Legal',
    features: 'Features',
    security: 'Security',
    about: 'About us',
    support: 'Support & help',
    terms: 'Terms of use',
    privacy: 'Privacy policy',
    mentions: 'Legal notice',
    address: 'Our offices',
    footerNote: 'SendFlow connects payment networks and the people who use them.',
    residence: 'Country of residence',
    legalIdentity: 'Legal identity',
    regulator: 'Regulated by',
    legalContact: 'Legal contact',
    legalNotice: 'SendFlow is a financial technology solution developed by Flow Digital SARL. We are not a bank; our services rely on licensed partners.',
    rights: 'All rights reserved.',
  },
} as const;

type DownloadCopyKey = keyof typeof copy.fr;
const downloadContentKeys: Record<DownloadCopyKey, string> = {
  navHome: 'download.nav.home',
  navFeatures: 'download.nav.features',
  navSupport: 'download.nav.support',
  language: 'download.language',
  menuOpen: 'download.menu.open',
  menuClose: 'download.menu.close',
  kicker: 'download.hero.kicker',
  title: 'download.hero.title',
  body: 'download.hero.body',
  free: 'download.hero.free',
  download: 'download.cta',
  available: 'download.store.available',
  comingSoon: 'download.store.comingSoon',
  apkTitle: 'download.apk.title',
  apkMeta: 'download.apk.meta',
  apkReady: 'download.apk.ready',
  startKicker: 'download.steps.kicker',
  startTitle: 'download.steps.title',
  step1: 'download.steps.1.title',
  step1Body: 'download.steps.1.body',
  step2: 'download.steps.2.title',
  step2Body: 'download.steps.2.body',
  step3: 'download.steps.3.title',
  step3Body: 'download.steps.3.body',
  step4: 'download.steps.4.title',
  step4Body: 'download.steps.4.body',
  supportKicker: 'download.support.kicker',
  supportTitle: 'download.support.title',
  supportBody: 'download.support.body',
  contact: 'download.support.cta',
  footerLead: 'download.footer.lead',
  products: 'download.footer.products',
  company: 'download.footer.company',
  legal: 'download.footer.legal',
  features: 'download.footer.features',
  security: 'download.footer.security',
  about: 'download.footer.about',
  support: 'download.footer.support',
  terms: 'download.footer.terms',
  privacy: 'download.footer.privacy',
  mentions: 'download.footer.mentions',
  address: 'download.footer.address',
  footerNote: 'download.footer.note',
  residence: 'download.footer.residence',
  legalIdentity: 'download.footer.legalIdentity',
  regulator: 'download.footer.regulator',
  legalContact: 'download.footer.legalContact',
  legalNotice: 'download.footer.legalNotice',
  rights: 'download.footer.rights',
};

function Brand() {
  return (
    <Link href="/" className="sf-download-brand" aria-label="SendFlow">
      <img src={sendflowMark} alt="" />
      <img src={sendflowWordmark} alt="SendFlow" />
    </Link>
  );
}

function StoreIcon({ store }: { store: 'apple' | 'play' | 'gallery' }) {
  if (store === 'apple') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M21.2 16.8c0-3 2.5-4.5 2.6-4.6-1.4-2.1-3.7-2.4-4.5-2.4-1.9-.2-3.7 1.1-4.7 1.1-1 0-2.5-1.1-4.1-1-2.1 0-4.1 1.2-5.2 3.1-2.2 3.8-.6 9.4 1.5 12.5 1 1.5 2.3 3.2 3.9 3.1 1.6-.1 2.2-1 4.1-1 1.9 0 2.4 1 4.1.9 1.7 0 2.8-1.5 3.8-3 1.2-1.7 1.7-3.4 1.7-3.5-.1 0-3.2-1.2-3.2-5.2Z" />
        <path d="M18.2 7.9c.9-1.1 1.5-2.6 1.3-4.1-1.3.1-2.9.9-3.8 2-.8.9-1.5 2.5-1.3 3.9 1.5.1 2.9-.7 3.8-1.8Z" />
      </svg>
    );
  }
  if (store === 'play') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4.5 3.8C3.6 4.7 3 6.1 3 7.8v16.4c0 1.7.6 3.1 1.5 4l14-14.2L4.5 3.8Z" fill="#00a0ff" />
        <path d="m18.5 14 4.2-4.3 4.8 2.7c1.5.9 1.5 2.5 0 3.4l-4.8 2.7-4.2-4.5Z" fill="#ffd900" />
        <path d="M4.5 3.8 18.5 18l4.2-4.3L7.2 2.3c-1-.5-2-.1-2.7 1.5Z" fill="#ff3a44" />
        <path d="M4.5 28.2 18.5 14l4.2 4.5-15.5 8.9c-1 .5-2 .1-2.7-1.5Z" fill="#00c86f" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="8" fill="#f3d64f" />
      <path d="M9 10h14v12H9z" fill="#1d31d7" />
      <path d="m13 13 6 3-6 3v-6Z" fill="#fff" />
    </svg>
  );
}

function StoreButton({ store, label, href, language }: { store: 'apple' | 'play' | 'gallery'; label: string; href?: string | null; language: Language }) {
  const title = store === 'apple' ? 'App Store' : store === 'play' ? 'Google Play' : 'AppGallery';
  const badge = (
    <span className={`sf-download-store ${href ? '' : 'is-disabled'}`}>
      <StoreIcon store={store} />
      <span><small>{href ? copy[language].available : copy[language].comingSoon}</small><strong>{title}</strong></span>
    </span>
  );
  return href ? <a href={href} target="_blank" rel="noreferrer" aria-label={`${label} ${title}`}>{badge}</a> : <span aria-disabled="true">{badge}</span>;
}

function getSafeApkUrl(value?: string | null) {
  const candidate = value?.trim() ?? '';
  return /^(https?:\/\/|\/(?!\/))/i.test(candidate) ? candidate : null;
}

export default function DownloadPage() {
  const [language, setLanguage] = useState<Language>('fr');
  const [menuOpen, setMenuOpen] = useState(false);
  const [settings, setSettings] = useState<DownloadSettings | null>(null);
  const [content, setContent] = useState<LandingResponse['content']>([]);
  const [media, setMedia] = useState<NonNullable<LandingResponse['media']>>([]);
  const [loading, setLoading] = useState(true);
  const t = Object.fromEntries(
    Object.entries(copy[language]).map(([property, fallback]) => {
      const key = downloadContentKeys[property as DownloadCopyKey];
      const value = content?.find((item) => item.contentKey === key && item.locale === language && item.isVisible)?.value;
      return [property, value ?? fallback];
    }),
  ) as typeof copy.fr;

  useEffect(() => {
    document.title = language === 'fr' ? 'Télécharger l’application · SendFlow' : 'Download the SendFlow app';
    const description = language === 'fr'
      ? 'Téléchargez SendFlow et simplifiez vos transferts entre réseaux de paiement.'
      : 'Download SendFlow and simplify transfers across payment networks.';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description);
  }, [language]);

  useEffect(() => {
    let active = true;
    fetch('/api/landing')
      .then((response) => response.ok ? response.json() as Promise<LandingResponse> : null)
       .then((data) => {
         if (!active) return;
         setSettings(data?.settings ?? null);
         setContent(data?.content ?? []);
         setMedia(data?.media ?? []);
       })
      .catch(() => { if (active) setSettings(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const closeMenu = () => setMenuOpen(false);
  const toggleLanguage = () => { setLanguage((current) => current === 'fr' ? 'en' : 'fr'); closeMenu(); };
  const supportEmail = settings?.supportEmail?.trim() || 'support@sendflow.studio';
  const apkUrl = getSafeApkUrl(settings?.apkUrl);
  const navigateToLandingSection = (id: string) => { window.location.assign(`/#${id}`); };

  return (
    <div className="sf-download-page">
      <header className="sf-download-header">
        <div className="sf-download-header-inner">
          <Brand />
          <nav className="sf-download-desktop-nav" aria-label="Primary">
            <Link href="/">{t.navHome}</Link>
            <a href="/#features-cards">{t.navFeatures}</a>
            <a href={`mailto:${supportEmail}`}>{t.navSupport}</a>
            <button type="button" onClick={toggleLanguage}><Globe2 size={15} />{t.language}</button>
          </nav>
          <button type="button" className="sf-download-menu-button" onClick={() => setMenuOpen(true)} aria-label={t.menuOpen} aria-expanded={menuOpen}><Menu size={26} /></button>
        </div>
      </header>

      {menuOpen && (
        <div className="sf-download-menu-backdrop" onClick={closeMenu}>
          <aside className="sf-download-menu" onClick={(event) => event.stopPropagation()}>
            <div className="sf-download-menu-top"><Brand /><button type="button" onClick={closeMenu} aria-label={t.menuClose}><X size={24} /></button></div>
            <nav>
              <Link href="/" onClick={closeMenu}>{t.navHome}<ChevronRight size={18} /></Link>
              <a href="/#features-cards" onClick={closeMenu}>{t.navFeatures}<ChevronRight size={18} /></a>
              <a href={`mailto:${supportEmail}`} onClick={closeMenu}>{t.navSupport}<ChevronRight size={18} /></a>
            </nav>
            <button type="button" className="sf-download-menu-language" onClick={toggleLanguage}>
              <span className="sf-download-language-flag" aria-hidden="true">{language === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
              {language === 'fr' ? 'Passer en anglais' : 'Switch to French'}
            </button>
          </aside>
        </div>
      )}

      <main>
        <section className="sf-download-hero">
          <div className="sf-download-hero-shape sf-download-hero-shape-one" />
          <div className="sf-download-hero-shape sf-download-hero-shape-two" />
          <div className="sf-download-hero-content">
            <div className="sf-download-app-icon"><img src={sendflowMark} alt="SendFlow" /></div>
            <h1>{t.title}</h1>
            <p className="sf-download-hero-body">{t.body}</p>
            <div className="sf-download-stores">
              <StoreButton store="apple" label={t.download} href={settings?.appStoreUrl} language={language} />
              <StoreButton store="play" label={t.download} href={settings?.googlePlayUrl} language={language} />
            </div>
            <a className={`sf-download-apk ${loading || !apkUrl ? 'is-disabled' : ''}`} href={apkUrl || undefined} onClick={(event) => { if (!apkUrl) event.preventDefault(); }} target={apkUrl ? '_blank' : undefined} rel={apkUrl ? 'noreferrer' : undefined} aria-disabled={!apkUrl} aria-label={t.apkTitle}>
              <span className="sf-download-apk-icon"><img src={androidMaterialIcon} alt="" /></span>
              <span><strong>{t.apkTitle}</strong><small>{apkUrl ? t.apkReady : t.apkMeta}</small></span>
              {apkUrl && <ArrowRight size={18} />}
            </a>
          </div>
          <div className="sf-download-hero-orbit" aria-hidden="true"><span /><span /><span /></div>
        </section>

        <section className="sf-download-steps">
          <div className="sf-download-section-heading"><span className="sf-download-heading-icon"><ArrowDownToLine size={20} /></span><div><p>{t.startKicker}</p><h2>{t.startTitle}</h2></div></div>
          <div className="sf-download-step-list">
            {[
              { title: t.step1, body: t.step1Body, icon: materialGetAppIcon, art: stepDownloadArt, alt: language === 'fr' ? 'Personnage SendFlow qui télécharge l’application sur son téléphone' : 'SendFlow character downloading the app on a phone' },
              { title: t.step2, body: t.step2Body, icon: materialPersonIcon, art: stepAccountArt, alt: language === 'fr' ? 'Personnage SendFlow qui crée son compte' : 'SendFlow character creating an account' },
              { title: t.step3, body: t.step3Body, icon: materialWalletIcon, art: stepWalletArt, alt: language === 'fr' ? 'Personnage SendFlow qui sécurise son portefeuille mobile' : 'SendFlow character securing a mobile wallet' },
              { title: t.step4, body: t.step4Body, icon: materialOutboxIcon, art: stepTransferArt, alt: language === 'fr' ? 'Personnage SendFlow qui envoie un transfert' : 'SendFlow character sending a transfer' },
            ].map((step, index) => {
              return (
                <article className={`sf-download-step sf-download-step-${index + 1}`} key={step.title}>
                  <div className="sf-download-step-art">
                    <img src={step.art} alt={step.alt} loading="lazy" decoding="async" />
                    <span className="sf-download-step-icon" aria-hidden="true"><img src={step.icon} alt="" /></span>
                  </div>
                  <div className="sf-download-step-copy">
                    <div className="sf-download-step-meta"><span>0{index + 1}</span><img src={step.icon} alt="" aria-hidden="true" /></div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="sf-download-support">
          <div><p className="sf-download-kicker">{t.supportKicker}</p><h2>{t.supportTitle}</h2><p>{t.supportBody}</p></div>
          <a href={`mailto:${supportEmail}`}><Headphones size={18} />{t.contact}<ArrowRight size={17} /></a>
        </section>
      </main>

      <SendFlowFooter
        isFrench={language === 'fr'}
        onNavigate={navigateToLandingSection}
        settings={settings}
        content={content ?? []}
        media={media}
      />
    </div>
  );
}
