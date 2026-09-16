import { useEffect, useState } from 'react';
import { ChevronRight, Globe2, Menu, X } from 'lucide-react';
import { Link } from 'wouter';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import orangeOperatorLogo from '../assets/operator-logos/operator-logo-01.png';
import moovOperatorLogo from '../assets/operator-logos/operator-logo-02.png';
import waveOperatorLogo from '../assets/operator-logos/operator-logo-03.png';
import momoMtnOperatorLogo from '../assets/operator-logos/operator-logo-momo-mtn.png';
import crossNetworkIcon from '../assets/sendflow-icon-cross-network.svg';
import internationalIcon from '../assets/sendflow-icon-international-transfer.svg';
import { SendFlowFooter, type FooterContentItem, type FooterMediaItem, type FooterSettings } from '@/components/sendflow-footer';

type Language = 'fr' | 'en';

type LandingResponse = {
  settings?: FooterSettings | null;
  content?: FooterContentItem[];
  media?: FooterMediaItem[];
};

const copy = {
  fr: {
    home: 'Accueil',
    features: 'Fonctionnalités',
    download: 'Télécharger',
    support: 'Assistance',
    language: 'EN',
    menuOpen: 'Ouvrir le menu',
    menuClose: 'Fermer le menu',
    switchLanguage: 'Passer en anglais',
    heroLead: 'Nos',
    heroAccent: 'Fonctionnalités',
    heroBody: 'Tout ce dont vous avez besoin pour envoyer et recevoir de l’argent simplement, entre réseaux et au-delà des frontières.',
    compatible: 'Compatible avec',
    networkTitle: 'Transfert inter-réseaux',
    networkBody: 'Envoyez de l’argent d’un réseau Mobile Money à un autre, sans demander au bénéficiaire de changer ses habitudes. SendFlow relie les réseaux pour rendre chaque transfert plus simple.',
    internationalTitle: 'Transfert international',
    internationalBody: 'Envoyez de l’argent à vos proches au-delà des frontières, avec un parcours clair et des informations visibles à chaque étape.',
    securityTitle: 'Des transferts pensés pour vous',
    securityBody: 'Des choix clairs, des détails visibles et une expérience conçue pour vous aider à garder le contrôle.',
    securityItems: ['Suivi lisible de chaque transaction', 'Montant et frais affichés avant confirmation', 'Protection de vos informations personnelles'],
    ctaTitle: 'Votre prochain transfert commence ici.',
    ctaBody: 'Découvrez une façon plus claire de faire circuler l’argent entre les réseaux de paiement.',
    cta: 'Découvrir SendFlow',
    footerNote: 'SendFlow connecte les réseaux de paiement et les personnes qui les utilisent.',
  },
  en: {
    home: 'Home',
    features: 'Features',
    download: 'Download',
    support: 'Support',
    language: 'FR',
    menuOpen: 'Open menu',
    menuClose: 'Close menu',
    switchLanguage: 'Switch to French',
    heroLead: 'Our',
    heroAccent: 'Features',
    heroBody: 'Everything you need to send and receive money simply, across networks and across borders.',
    compatible: 'Compatible with',
    networkTitle: 'Cross-network transfers',
    networkBody: 'Send money from one Mobile Money network to another without asking recipients to change their habits. SendFlow connects networks to make every transfer simpler.',
    internationalTitle: 'International transfers',
    internationalBody: 'Send money to loved ones across borders with a clear journey and visible information at every step.',
    securityTitle: 'Transfers designed around you',
    securityBody: 'Clear choices, visible details, and an experience designed to help you stay in control.',
    securityItems: ['Readable tracking for every transaction', 'Amount and fees shown before confirmation', 'Protection for your personal information'],
    ctaTitle: 'Your next transfer starts here.',
    ctaBody: 'Discover a clearer way to move money across payment networks.',
    cta: 'Discover SendFlow',
    footerNote: 'SendFlow connects payment networks and the people who use them.',
  },
} as const;

const operatorLogos = [
  { name: 'Orange', src: orangeOperatorLogo },
  { name: 'Moov Africa', src: moovOperatorLogo },
  { name: 'Wave', src: waveOperatorLogo },
  { name: 'MTN MoMo', src: momoMtnOperatorLogo },
];

function Brand() {
  return (
    <Link href="/" className="sf-features-brand" aria-label="SendFlow">
      <img src={sendflowMark} alt="" />
      <img src={sendflowWordmark} alt="SendFlow" />
    </Link>
  );
}

export default function FeaturesPage() {
  const [language, setLanguage] = useState<Language>('fr');
  const [menuOpen, setMenuOpen] = useState(false);
  const [settings, setSettings] = useState<FooterSettings | null>(null);
  const [content, setContent] = useState<FooterContentItem[]>([]);
  const [media, setMedia] = useState<FooterMediaItem[]>([]);
  const t = copy[language];

  useEffect(() => {
    document.title = language === 'fr' ? 'Fonctionnalités · SendFlow' : 'Features · SendFlow';
    const description = language === 'fr'
      ? 'Découvrez les fonctionnalités SendFlow pour vos transferts inter-réseaux et internationaux.'
      : 'Discover SendFlow features for cross-network and international transfers.';
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
      .catch(() => {
        if (!active) return;
        setSettings(null);
        setContent([]);
        setMedia([]);
      });
    return () => { active = false; };
  }, []);

  const closeMenu = () => setMenuOpen(false);
  const toggleLanguage = () => {
    setLanguage((current) => current === 'fr' ? 'en' : 'fr');
    closeMenu();
  };
  const supportEmail = settings?.supportEmail?.trim() || 'support@sendflow.studio';

  return (
    <div className="sf-features-page">
      <header className="sf-features-header">
        <div className="sf-features-header-inner">
          <Brand />
          <nav className="sf-features-desktop-nav" aria-label="Primary">
            <Link href="/">{t.home}</Link>
            <Link href="/fonctionnalites" className="is-active">{t.features}</Link>
            <Link href="/download">{t.download}</Link>
            <a href={`mailto:${supportEmail}`}>{t.support}</a>
            <button type="button" onClick={toggleLanguage}><Globe2 size={15} />{t.language}</button>
          </nav>
          <button type="button" className="sf-features-menu-button" onClick={() => setMenuOpen(true)} aria-label={t.menuOpen} aria-expanded={menuOpen}>
            <Menu size={26} />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="sf-features-menu-backdrop" onClick={closeMenu}>
          <aside className="sf-features-menu" onClick={(event) => event.stopPropagation()}>
            <div className="sf-features-menu-top">
              <Brand />
              <button type="button" onClick={closeMenu} aria-label={t.menuClose}><X size={24} /></button>
            </div>
            <nav>
              <Link href="/" onClick={closeMenu}>{t.home}<ChevronRight size={18} /></Link>
              <Link href="/fonctionnalites" onClick={closeMenu}>{t.features}<ChevronRight size={18} /></Link>
              <Link href="/download" onClick={closeMenu}>{t.download}<ChevronRight size={18} /></Link>
              <a href={`mailto:${supportEmail}`} onClick={closeMenu}>{t.support}<ChevronRight size={18} /></a>
            </nav>
            <button type="button" className="sf-features-menu-language" onClick={toggleLanguage}>
              <span aria-hidden="true">{language === 'fr' ? '🇬🇧' : '🇫🇷'}</span>
              {t.switchLanguage}
            </button>
          </aside>
        </div>
      )}

      <main>
        <section className="sf-features-hero">
          <div className="sf-features-hero-content">
            <h1>{t.heroLead} <span>{t.heroAccent}</span></h1>
            <p>{t.heroBody}</p>
          </div>
        </section>

        <section className="sf-features-compatible" aria-labelledby="sf-features-compatible-title">
          <p id="sf-features-compatible-title">{t.compatible}</p>
          <div className="sf-features-operator-row">
            {operatorLogos.map((operator) => (
              <div className="sf-features-operator" key={operator.name}>
                <img src={operator.src} alt={operator.name} />
              </div>
            ))}
          </div>
        </section>

        <section className="sf-features-card-area" aria-label={t.features}>
          <div className="sf-features-card-grid">
            <article className="sf-features-card">
              <div className="sf-features-card-icon">
                <img src={crossNetworkIcon} alt="" />
              </div>
              <h2>{t.networkTitle}</h2>
              <p>{t.networkBody}</p>
              <span className="sf-features-card-tag">01</span>
            </article>
            <article className="sf-features-card">
              <div className="sf-features-card-icon">
                <img src={internationalIcon} alt="" />
              </div>
              <h2>{t.internationalTitle}</h2>
              <p>{t.internationalBody}</p>
              <span className="sf-features-card-tag">02</span>
            </article>
          </div>

          <section className="sf-features-security">
            <div>
              <p className="sf-features-kicker">{t.features}</p>
              <h2>{t.securityTitle}</h2>
              <p className="sf-features-security-body">{t.securityBody}</p>
            </div>
            <ul>
              {t.securityItems.map((item) => <li key={item}><span>✓</span>{item}</li>)}
            </ul>
          </section>
        </section>

        <section className="sf-features-cta">
          <div>
            <p className="sf-features-kicker">{t.features}</p>
            <h2>{t.ctaTitle}</h2>
            <p>{t.ctaBody}</p>
            <Link href="/download">{t.cta}<ChevronRight size={18} /></Link>
          </div>
        </section>
      </main>

      <SendFlowFooter isFrench={language === 'fr'} settings={settings} content={content} media={media} />
    </div>
  );
}