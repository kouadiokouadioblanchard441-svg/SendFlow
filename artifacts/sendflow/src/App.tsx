import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Switch, Router as WouterRouter } from 'wouter';
import { ArrowDownRight, ArrowRight, Check, ChevronDown, Facebook, Globe2, Instagram, Linkedin, LockKeyhole, Menu, Play, ShieldCheck, Sparkles, X } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { LegalMentionsPage, PrivacyPage, TermsPage } from '@/pages/legal';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import heroPlaceholder from '@assets/generated_images/sendflow-hero-placeholder.png';
import heroGlobe from '@assets/generated_images/sendflow-earth-globe-transparent.png';
import networkSectionArt from '@assets/generated_images/sendflow-section-network-3d-transparent.png';
import howItWorksSectionArt from '@assets/generated_images/sendflow-section-how-it-works-3d-transparent.png';
import internationalSectionArt from '@assets/generated_images/sendflow-section-international-3d-transparent.png';
import securitySectionArt from '@assets/generated_images/sendflow-section-security-3d-transparent.png';
import securityGuardianArt from '@assets/generated_images/sendflow-security-guardian-3d-transparent.png';
import coverageSectionArt from '@assets/generated_images/sendflow-section-coverage-3d-transparent.png';
import downloadSectionArt from '@assets/generated_images/sendflow-section-download-3d-transparent.png';
import networkPersonArt from '@assets/generated_images/sendflow-network-person-3d-transparent.png';
import howPersonArt from '@assets/generated_images/sendflow-how-person-3d-transparent.png';
import internationalPersonArt from '@assets/generated_images/sendflow-international-person-3d-transparent.png';
import coveragePersonArt from '@assets/generated_images/sendflow-coverage-person-3d-transparent.png';
import downloadPersonArt from '@assets/generated_images/sendflow-download-person-3d-transparent.png';
import chooseStepArt from '@assets/generated_images/sendflow-step-choose-3d-transparent.png';
import checkStepArt from '@assets/generated_images/sendflow-step-check-3d-transparent.png';
import sendStepArt from '@assets/generated_images/sendflow-step-send-3d-transparent.png';

const queryClient = new QueryClient();

type Language = 'fr' | 'en';
type Copy = { fr: string; en: string };
const t = (copy: Copy, language: Language) => copy[language];

function BrandLockup() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-[#6d35d8]/20">
        <img src={sendflowMark} alt="" className="h-7 w-6 object-contain" />
      </span>
      <img src={sendflowWordmark} alt="SendFlow" className="h-5 w-auto object-contain" />
    </span>
  );
}

function BrandedCharacter({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative flex min-w-0 items-end justify-center ${className}`}>
      <img src={src} alt={alt} className="h-40 w-full object-contain sm:h-52" />
      <span className="absolute left-1/2 top-0 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[#6d35d8]/20 bg-white px-2.5 py-1.5 shadow-[0_8px_18px_rgba(80,40,170,.16)]">
        <img src={sendflowMark} alt="" className="h-4 w-4 object-contain" />
        <img src={sendflowWordmark} alt="SendFlow" className="h-3.5 w-auto object-contain" />
      </span>
    </div>
  );
}

const navItems = [
  { id: 'top', label: { fr: 'Accueil', en: 'Home' } },
  { id: 'features-cards', label: { fr: 'Fonctionnalités', en: 'Features' } },
  { id: 'how', label: { fr: 'Comment ça marche', en: 'How it works' } },
  { id: 'international', label: { fr: 'International', en: 'International' } },
  { id: 'security', label: { fr: 'Sécurité', en: 'Security' } },
  { id: 'about', label: { fr: 'À propos', en: 'About' } },
];

const countries = [
  { name: 'Côte d’Ivoire', code: 'CI', networks: ['Orange', 'MTN', 'Moov Africa', 'Wave'], flag: '🇨🇮', tone: '#dbeaff' },
  { name: 'Bénin', code: 'BJ', networks: ['MTN', 'Moov Africa', 'Celtiis'], flag: '🇧🇯', tone: '#dbeaff' },
  { name: 'Togo', code: 'TG', networks: ['Togocom', 'Moov Africa'], flag: '🇹🇬', tone: '#dbeaff' },
  { name: 'Cameroun', code: 'CM', networks: ['MTN', 'Orange', 'Camtel', 'Nexttel'], flag: '🇨🇲', tone: '#dbeaff' },
  { name: 'Burkina Faso', code: 'BF', networks: ['Orange', 'Moov Africa', 'Telecel Faso'], flag: '🇧🇫', tone: '#dbeaff' },
  { name: 'Cap-Vert', code: 'CV', networks: ['CVMóvel', 'Unitel T+'], flag: '🇨🇻', tone: '#dbeaff' },
  { name: 'Gambie', code: 'GM', networks: ['Africell', 'QCell', 'Comium'], flag: '🇬🇲', tone: '#dbeaff' },
  { name: 'Guinée', code: 'GN', networks: ['Orange', 'MTN', 'Cellcom'], flag: '🇬🇳', tone: '#dbeaff' },
  { name: 'Guinée-Bissau', code: 'GW', networks: ['Orange', 'MTN'], flag: '🇬🇼', tone: '#dbeaff' },
  { name: 'Liberia', code: 'LR', networks: ['Lonestar Cell MTN', 'Orange', 'Africell'], flag: '🇱🇷', tone: '#dbeaff' },
  { name: 'Mali', code: 'ML', networks: ['Orange', 'Moov Africa', 'Telecel Mali'], flag: '🇲🇱', tone: '#dbeaff' },
  { name: 'Mauritanie', code: 'MR', networks: ['Mauritel', 'Mattel', 'Chinguitel'], flag: '🇲🇷', tone: '#dbeaff' },
  { name: 'Niger', code: 'NE', networks: ['Airtel', 'Moov Africa', 'Zamani Telecom'], flag: '🇳🇪', tone: '#dbeaff' },
  { name: 'Nigeria', code: 'NG', networks: ['MTN', 'Airtel', 'Glo', '9mobile'], flag: '🇳🇬', tone: '#dbeaff' },
  { name: 'Sierra Leone', code: 'SL', networks: ['Africell', 'Orange', 'QCell'], flag: '🇸🇱', tone: '#dbeaff' },
  { name: 'Sénégal', code: 'SN', networks: ['Orange', 'Free', 'Expresso', 'Wave'], flag: '🇸🇳', tone: '#dbeaff' },
  { name: 'Ghana', code: 'GH', networks: ['MTN', 'Telecel', 'AT'], flag: '🇬🇭', tone: '#dbeaff' },
  { name: 'Kenya', code: 'KE', networks: ['Safaricom', 'Airtel', 'Telkom'], flag: '🇰🇪', tone: '#dbeaff' },
];

const operatorLogoUrls: Record<string, string> = {
  Orange: 'https://cdn.simpleicons.org/orange',
  Airtel: 'https://cdn.simpleicons.org/airtel',
  Vodafone: 'https://cdn.simpleicons.org/vodafone',
};

function OperatorRow({ network, index, total }: { network: string; index: number; total: number }) {
  const logoUrl = operatorLogoUrls[network];
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#f0ece3] text-[10px] font-bold text-[#6d35d8]">
        {index + 1}
        {index < total - 1 && <span className="absolute left-1/2 top-8 h-3 w-px bg-[#d6d0c7]" />}
      </span>
      <div className="flex flex-1 items-center gap-3 rounded-xl border border-[#2d2535]/10 px-4 py-3 text-[13px] font-semibold">
        {logoUrl && <img src={logoUrl} alt="" className="h-6 w-6 object-contain" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
        <span>{network}</span>
      </div>
      {index < total - 1 && <ArrowRight size={15} className="text-[#b1abb4]" />}
    </div>
  );
}

const heroCountryPositions: Record<string, string> = {
  CI: 'left-[7%] top-[53%]',
  BJ: 'right-[22%] top-[24%]',
  TG: 'right-[5%] top-[54%]',
  CM: 'left-[34%] bottom-[8%]',
};

const faqs: { q: Copy; a: Copy }[] = [
  { q: { fr: 'Qu’est-ce que SendFlow ?', en: 'What is SendFlow?' }, a: { fr: 'SendFlow simplifie les transferts d’argent entre réseaux Mobile Money avec un parcours clair, rapide et lisible.', en: 'SendFlow simplifies money transfers between Mobile Money networks with a clear, fast, and easy-to-follow journey.' } },
  { q: { fr: 'Quels réseaux sont disponibles ?', en: 'Which networks are available?' }, a: { fr: 'La couverture SendFlow réunit les principaux opérateurs disponibles dans les pays couverts. Sélectionnez un pays pour découvrir ses réseaux.', en: 'SendFlow coverage brings together the main operators available in supported countries. Select a country to explore its networks.' } },
  { q: { fr: 'Puis-je transférer vers un autre pays ?', en: 'Can I transfer to another country?' }, a: { fr: 'Oui. SendFlow est conçu pour relier les réseaux locaux et faciliter les transferts internationaux lorsque les conditions locales le permettent.', en: 'Yes. SendFlow is designed to connect local networks and simplify international transfers where local conditions allow.' } },
  { q: { fr: 'Comment suivre un transfert ?', en: 'How do I track a transfer?' }, a: { fr: 'SendFlow affiche chaque étape, de la vérification à la confirmation, avec un statut lisible pour le bénéficiaire et l’expéditeur.', en: 'SendFlow shows every step from review to confirmation, with a clear status for sender and recipient.' } },
  { q: { fr: 'SendFlow possède-t-il un wallet ?', en: 'Does SendFlow have a wallet?' }, a: { fr: 'Non. SendFlow agit comme une couche de connexion entre réseaux, et non comme un wallet ou un compte financier.', en: 'No. SendFlow acts as a connection layer between networks, not as a wallet or financial account.' } },
];

const footerAddresses = [
  { flag: '🇨🇮', country: 'Côte d’Ivoire', address: 'Abidjan, Cocody Riviera Palmeraie' },
];

function RegulatorLogo() {
  return (
    <svg className="sendflow-regulator-logo" viewBox="0 0 250 78" role="img" aria-label="National Bank of Belgium Eurosystem">
      <path d="M5 54V29c0-11 8-19 18-19 7 0 12 3 16 8 4-8 11-13 20-13 13 0 23 10 23 23v26H67V31c0-5-3-9-8-9s-9 4-9 9v23H37V31c0-5-3-9-8-9s-9 4-9 9v23H5Z" fill="#0b527f" />
      <path d="M39 18c5-8 12-13 21-13 13 0 23 10 23 23v26H67V31c0-5-3-9-8-9-5 0-9 4-9 9v23H39V18Z" fill="#b6b9bc" opacity=".9" />
      <text x="88" y="40" fill="#114e78" fontSize="24" fontWeight="700" letterSpacing="-1">National</text>
      <text x="187" y="40" fill="#9ea2a6" fontSize="24" fontWeight="400" letterSpacing="-1">Bank</text>
      <text x="164" y="53" fill="#114e78" fontSize="7" fontWeight="700" letterSpacing=".8">OF BELGIUM</text>
      <text x="88" y="68" fill="#a0a3a7" fontSize="13" fontWeight="400">Eurosystem</text>
    </svg>
  );
}

function StoreBadge({ store, icon }: { store: string; icon: 'play' | 'apple' | 'gallery' }) {
  return (
    <div className="sendflow-store-badge" aria-label={`Disponible sur ${store}`}>
      {icon === 'play' && <span className="sendflow-play-icon" aria-hidden="true">▶</span>}
      {icon === 'apple' && <span className="sendflow-apple-icon" aria-hidden="true">●</span>}
      {icon === 'gallery' && <span className="sendflow-gallery-icon" aria-hidden="true">▣</span>}
      <span>
        <small>{icon === 'gallery' ? 'DÉCOUVREZ-LE SUR' : icon === 'play' ? 'DISPONIBLE SUR' : 'Télécharger sur'}</small>
        <strong>{store}</strong>
      </span>
    </div>
  );
}

function SendFlowFooter({ isFrench, onNavigate }: { isFrench: boolean; onNavigate: (id: string) => void }) {
  return (
    <footer id="footer" className="sendflow-reference-footer">
      <div className="sendflow-footer-inner">
        <section className="sendflow-footer-regulator">
          <p className="sendflow-footer-kicker">{isFrench ? 'Réglementé par :' : 'Regulated by:'}</p>
          <RegulatorLogo />
        </section>

        <div className="sendflow-footer-link-groups">
          <section>
            <h3>{isFrench ? 'Produits' : 'Products'}</h3>
            <button onClick={() => onNavigate('top')}>SendFlow Afrique</button>
            <button onClick={() => onNavigate('international')}>SendFlow Europe</button>
            <button onClick={() => onNavigate('features-cards')}>SendFlow Business</button>
          </section>
          <section>
            <h3>{isFrench ? 'Assistance' : 'Support'}</h3>
            <a href="mailto:support@sendflow.studio">Support@sendflow.studio</a>
            <button onClick={() => onNavigate('join')}>{isFrench ? 'Parrainage' : 'Referral'}</button>
          </section>
          <section>
            <h3>{isFrench ? 'Réglementation' : 'Regulation'}</h3>
              <Link href="/confidentialite">{isFrench ? 'Politique de Confidentialité' : 'Privacy Policy'}</Link>
              <Link href="/conditions-utilisation">{isFrench ? 'Conditions d’utilisation' : 'Terms of Use'}</Link>
              <Link href="/mentions-legales">{isFrench ? 'Mentions légales' : 'Legal notice'}</Link>
          </section>
        </div>

        <section className="sendflow-footer-addresses">
          <h3>{isFrench ? 'Nos adresses' : 'Our offices'}</h3>
          {footerAddresses.map((office) => (
            <div className="sendflow-office" key={office.country}>
              <span className="sendflow-office-flag" aria-hidden="true">{office.flag}</span>
              <div><strong>{office.country}</strong><p>{office.address}</p></div>
            </div>
          ))}
        </section>

        <section className="sendflow-footer-downloads">
          <div className="sendflow-store-row">
            <StoreBadge store="Google Play" icon="play" />
            <StoreBadge store="App Store" icon="apple" />
          </div>
          <StoreBadge store="AppGallery" icon="gallery" />
        </section>

        <div className="sendflow-footer-socials" aria-label="Réseaux sociaux">
          <a href="#" aria-label="LinkedIn"><Linkedin size={20} strokeWidth={2.5} /></a>
          <a href="#" aria-label="Facebook"><Facebook size={19} fill="currentColor" /></a>
          <a href="#" aria-label="Instagram"><Instagram size={20} strokeWidth={2.5} /></a>
        </div>

        <div className="sendflow-footer-divider" />

        <section className="sendflow-footer-legal">
          <p>{isFrench ? 'SendFlow est une solution de technologie financière, développée par Flow Digital SARL. Nous ne sommes pas une banque ; nos services s’appuient sur des partenariats avec des banques et des institutions financières dûment agréées.' : 'SendFlow is a financial technology solution developed by Flow Digital SARL. We are not a bank; our services rely on partnerships with duly licensed banks and financial institutions.'}</p>
          <p>{isFrench ? 'Les services de paiement SendFlow sont proposés via des partenaires agréés dans les territoires où le service est disponible, conformément aux règles locales. Les conditions varient selon la destination, le réseau et le montant du transfert.' : 'SendFlow payment services are offered through licensed partners in territories where the service is available, in accordance with local rules. Conditions vary by destination, network, and transfer amount.'}</p>
        </section>

        <div className="sendflow-footer-bottom">
          <span>© 2025 Flow Digital SARL. {isFrench ? 'Tous droits réservés.' : 'All rights reserved.'}</span>
          <div><Link href="/confidentialite">{isFrench ? 'Confidentialité' : 'Privacy'}</Link><Link href="/mentions-legales">{isFrench ? 'Mentions légales' : 'Legal notice'}</Link></div>
        </div>
      </div>
    </footer>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Switch>
            <Route path="/" component={LandingPage} />
            <Route path="/conditions-utilisation" component={TermsPage} />
            <Route path="/confidentialite" component={PrivacyPage} />
            <Route path="/mentions-legales" component={LegalMentionsPage} />
            <Route component={NotFound} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function LandingPage() {
  const [language, setLanguage] = useState<Language>('fr');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const elements = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('reveal-visible');
    }), { threshold: .12 });
    elements.forEach((element) => observer.observe(element));
    const initialAnchor = window.location.hash.slice(1);
    if (initialAnchor) {
      window.setTimeout(() => document.getElementById(initialAnchor)?.scrollIntoView(), 500);
    }
    return () => observer.disconnect();
  }, []);

  const isFrench = language === 'fr';
  const displayNetworks = useMemo(() => selectedCountry.networks, [selectedCountry]);

  const goTo = (id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const downloadBrief = () => {
    const brief = `SendFlow\n\nUne vision plus calme des mouvements d’argent en Afrique.\n\nParcours exploré : ${selectedCountry.name}\nOpérateurs : ${selectedCountry.networks.join(', ')}\n\nsendflow.studio`;
    const blob = new Blob([brief], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sendflow-brief.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="noise min-h-[100dvh] bg-[#f7f3e9] text-[#211d2c]">
      <header className="fixed inset-x-0 top-0 z-40 px-4 pt-4 sm:px-8 sm:pt-6">
        <nav className="mx-auto flex max-w-[1240px] items-center justify-between rounded-full border border-[#2d2535]/10 bg-[#f7f3e9]/85 px-4 py-3 backdrop-blur-md sm:px-5">
          <button onClick={() => goTo('top')} className="flex items-center gap-2" data-testid="button-logo">
            <BrandLockup />
          </button>
          <div className="hidden items-center gap-7 md:flex">
            {navItems.map((item) => <a key={item.id} href={`#${item.id}`} onClick={() => setMobileOpen(false)} className="link-underline text-[13px] font-medium text-[#5e5766] transition-colors hover:text-[#6d35d8]" data-testid={`link-nav-${item.id}`}>{t(item.label, language)}</a>)}
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <button onClick={() => setLanguage(isFrench ? 'en' : 'fr')} className="flex items-center gap-1 rounded-full px-2 py-2 text-[12px] font-semibold text-[#5e5766] hover:text-[#6d35d8]" data-testid="button-language">{isFrench ? 'EN' : 'FR'} <Globe2 size={14} /></button>
            <button onClick={() => goTo('join')} className="rounded-full bg-[#211d2c] px-4 py-2.5 text-[12px] font-semibold text-[#fbf8ef] transition-transform hover:-translate-y-0.5" data-testid="button-nav-download">{isFrench ? 'Télécharger l’application' : 'Download the app'} <ArrowRight className="ml-1 inline" size={14} /></button>
          </div>
          <button type="button" onClick={downloadBrief} className="hidden items-center gap-1 rounded-full px-2 py-2 text-[11px] font-semibold text-[#6d35d8] lg:flex" data-testid="button-download-brief">{isFrench ? 'Brief' : 'Brief'} <ArrowDownRight size={13} /></button>
          <button className="rounded-full p-2 md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu" data-testid="button-open-menu"><Menu size={21} /></button>
        </nav>
      </header>

      {mobileOpen && <div className="fixed inset-0 z-50 bg-[#211d2c]/20 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}>
        <div className="ml-auto min-h-full w-[min(88%,380px)] bg-[#f7f3e9] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between">
            <BrandLockup />
            <button onClick={() => setMobileOpen(false)} className="rounded-full border border-[#2d2535]/10 p-2" data-testid="button-close-menu"><X size={19} /></button>
          </div>
          <div className="mt-16 flex flex-col gap-6">
            {navItems.map((item, index) => <a key={item.id} href={`#${item.id}`} onClick={() => setMobileOpen(false)} className="flex items-center justify-between border-b border-[#2d2535]/10 pb-4 text-left text-2xl font-semibold tracking-[-.04em]" data-testid={`link-mobile-${item.id}`}>{t(item.label, language)}<span className="text-[#6d35d8]">0{index + 1}</span></a>)}
          </div>
          <button onClick={() => { setLanguage(isFrench ? 'en' : 'fr'); setMobileOpen(false); }} className="mt-12 flex items-center gap-2 text-sm font-semibold text-[#6d35d8]" data-testid="button-mobile-language"><Globe2 size={16} /> {isFrench ? 'Passer en anglais' : 'Switch to French'}</button>
          <button onClick={() => goTo('join')} className="mt-5 w-full rounded-full bg-[#6d35d8] px-5 py-4 text-sm font-semibold text-[#fbf8ef]" data-testid="button-mobile-download">{isFrench ? 'Télécharger l’application' : 'Download the app'} <ArrowRight className="ml-2 inline" size={16} /></button>
        </div>
      </div>}

      <main id="top">
        <section className="relative overflow-hidden px-5 pb-10 pt-36 sm:px-8 sm:pb-16 sm:pt-44">
          <div className="absolute -right-32 top-24 h-[430px] w-[430px] rounded-full bg-[#d4f0e9] opacity-70 blur-3xl" />
          <div className="mx-auto grid max-w-[1240px] items-center gap-14 lg:grid-cols-[1.04fr_.96fr] lg:gap-8">
            <div className="relative z-10 max-w-[680px]">
              <div className="rise relative mb-7 aspect-[1.45/1] w-full max-w-[640px] overflow-hidden rounded-[34px] border border-[#6d35d8]/10 bg-white shadow-[0_22px_55px_rgba(75,44,180,.1)]" data-testid="hero-image-slot">
                <img src={heroPlaceholder} alt={isFrench ? 'Illustration temporaire du passage entre plusieurs réseaux' : 'Temporary illustration of a path across multiple networks'} className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                  <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-[#6d35d8]/15 bg-white/90 px-3 py-2 shadow-[0_8px_20px_rgba(50,30,130,.1)] backdrop-blur-sm">
                    <BrandLockup />
                  </div>
                  {countries.filter((country) => heroCountryPositions[country.code]).map((country) => <div key={country.code} className={`absolute ${heroCountryPositions[country.code]} flex items-center gap-1 rounded-full border border-white/80 bg-white/95 px-2 py-1 text-[10px] font-bold text-[#211d2c] shadow-[0_8px_18px_rgba(20,30,80,.12)]`}><span className="text-sm leading-none">{country.flag}</span><span className="hidden sm:inline">{country.name}</span></div>)}
                </div>
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <span className="hero-globe-spin block h-32 w-32 sm:h-48 sm:w-48">
                    <img src={heroGlobe} alt={isFrench ? 'Terre centrée sur l’Afrique' : 'Earth centered on Africa'} className="h-full w-full object-contain drop-shadow-[0_10px_16px_rgba(20,50,150,.22)]" />
                  </span>
                </div>
              </div>
              <h1 className="rise delay-1 mt-6 max-w-[760px] text-[clamp(3.7rem,9vw,7.6rem)] font-extrabold leading-[.88] tracking-[-.09em] text-[#17131f]">{isFrench ? <>L’argent circule.<br /><em className="font-serif font-normal text-[#5b21b6]">Les réseaux</em> aussi.</> : <>Money moves.<br /><em className="font-serif font-normal text-[#5b21b6]">Networks</em> do too.</>}</h1>
              <p className="rise delay-2 mt-8 max-w-[520px] text-[17px] font-semibold leading-7 text-[#30283b] sm:text-[19px]">{isFrench ? 'SendFlow simplifie vos transferts d’argent entre différents réseaux de paiement, localement et au-delà des frontières.' : 'SendFlow simplifies money transfers across different payment networks, locally and across borders.'}</p>
              <div className="rise delay-3 mt-9 flex flex-wrap items-center gap-3">
                <button onClick={() => goTo('join')} className="rounded-full bg-[#6d35d8] px-5 py-3.5 text-[13px] font-bold text-[#fbf8ef] shadow-[0_12px_24px_rgba(109,53,216,.2)] transition-all hover:-translate-y-1 hover:bg-[#5822c3]" data-testid="button-hero-download">{isFrench ? 'Télécharger l’application' : 'Download the app'} <ArrowRight className="ml-2 inline" size={15} /></button>
                <button onClick={() => goTo('features')} className="rounded-full border border-[#2d2535]/20 px-5 py-3.5 text-[13px] font-bold text-[#211d2c] transition-all hover:-translate-y-1 hover:border-[#6d35d8] hover:text-[#6d35d8]" data-testid="button-hero-discover"><Play className="mr-2 inline" size={14} fill="currentColor" />{isFrench ? 'Découvrir SendFlow' : 'Discover SendFlow'}</button>
              </div>
              <p className="mt-5 text-[11px] text-[#8d8792]">{isFrench ? 'Des transferts plus simples entre réseaux.' : 'Simpler transfers between networks.'}</p>
            </div>
            <div className="relative mx-auto h-[370px] w-full max-w-[530px] sm:h-[500px]">
              <div className="absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#6d35d8]/15 sm:h-[370px] sm:w-[370px]" />
              <div className="absolute left-1/2 top-1/2 h-[190px] w-[190px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#6d35d8]/20 sm:h-[255px] sm:w-[255px]" />
              <div className="absolute left-1/2 top-1/2 flex h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[36px] bg-[#211d2c] text-[#fbf8ef] shadow-[0_25px_50px_rgba(33,29,44,.25)] sm:h-[150px] sm:w-[150px]">
                <div className="text-center"><ArrowDownRight className="mx-auto mb-2 text-[#e8cd4d]" size={29} /><div className="text-[12px] font-bold tracking-[-.02em]">sendflow</div><div className="mt-1 text-[9px] text-[#bcb6c5]">{isFrench ? 'le point de passage' : 'the crossing point'}</div></div>
              </div>
              <div className="orbit-dot absolute left-1/2 top-1/2 -ml-3 -mt-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8cd4d] text-[11px] font-bold shadow-lg">A</div></div>
              <div className="orbit-dot-small absolute left-1/2 top-1/2 -ml-3 -mt-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#9adacb] text-[11px] font-bold shadow-lg">B</div></div>
              <div className="absolute left-[7%] top-[15%] flex items-center gap-2 text-[11px] font-semibold text-[#5e5766]"><span className="h-2 w-2 rounded-full bg-[#6d35d8]" />Réseau A</div>
              <div className="absolute bottom-[19%] right-[3%] flex items-center gap-2 text-[11px] font-semibold text-[#5e5766]"><span className="h-2 w-2 rounded-full bg-[#ef987f]" />Réseau B</div>
              <div className="absolute bottom-[8%] left-[18%] rounded-full border border-[#2d2535]/10 bg-[#fbf8ef]/70 px-3 py-1.5 text-[10px] text-[#5e5766] backdrop-blur-sm">+ 19 connexions possibles</div>
            </div>
           </div>
         </section>

        <section id="features-cards" className="px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-[1240px]">
            <div className="reveal max-w-[720px]">
              <h2 className="mt-0 max-w-[760px] text-5xl font-extrabold leading-[.9] tracking-[-.075em] text-[#17131f] sm:text-7xl lg:text-8xl">{isFrench ? <>Plusieurs réseaux.<br /><em className="font-serif font-normal text-[#5b21b6]">Une seule destination.</em></> : <>Many networks.<br /><em className="font-serif font-normal text-[#5b21b6]">One destination.</em></>}</h2>
              <p className="mt-7 max-w-[560px] text-[17px] font-semibold leading-7 text-[#30283b] sm:text-[19px]">{isFrench ? 'Envoyer de l’argent ne devrait pas dépendre du réseau utilisé par votre proche. SendFlow imagine un passage plus simple, plus lisible et plus direct.' : 'Sending money should not depend on the network your loved one uses. SendFlow imagines a simpler, clearer, more direct path.'}</p>
            </div>
            <div className="reveal mt-10 overflow-hidden rounded-[28px] border border-[#6d35d8]/10 bg-[#fbf8ef] shadow-[0_18px_50px_rgba(58,38,83,.07)]">
              <div className="grid items-center gap-2 p-4 sm:grid-cols-[1.25fr_.75fr] sm:p-6">
                <img src={networkSectionArt} alt={isFrench ? 'Réseaux de paiement interconnectés' : 'Interconnected payment networks'} className="mx-auto h-52 w-full object-contain sm:h-64" />
                <BrandedCharacter src={networkPersonArt} alt={isFrench ? 'Personne SendFlow aux côtés des réseaux interconnectés' : 'SendFlow person beside interconnected networks'} className="h-52 sm:h-64" />
              </div>
            </div>
            <div className="reveal mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: { fr: 'Transfert inter-réseaux', en: 'Cross-network transfers' }, text: { fr: 'Relier les réseaux sans demander au bénéficiaire de changer ses habitudes.', en: 'Connect networks without asking recipients to change their habits.' }, icon: ArrowRight },
                { title: { fr: 'Transfert international', en: 'International transfers' }, text: { fr: 'Explorer les chemins possibles entre pays africains, lorsque disponibles.', en: 'Explore possible routes across African countries where available.' }, icon: Globe2 },
                { title: { fr: 'Suivi des transactions', en: 'Transaction tracking' }, text: { fr: 'Voir où en est chaque étape avant de confirmer.', en: 'See where each step stands before confirming.' }, icon: Check },
                { title: { fr: 'Expérience simple', en: 'Simple experience' }, text: { fr: 'Moins de friction, plus de confiance dans chaque choix.', en: 'Less friction, more confidence in every choice.' }, icon: Sparkles },
              ].map((feature) => <div key={feature.title.fr} className="group min-h-[220px] rounded-[24px] border border-[#2d2535]/10 bg-[#fbf8ef] p-5 shadow-[0_15px_45px_rgba(58,38,83,.05)] transition-transform hover:-translate-y-1 sm:p-6"><feature.icon className="text-[#6d35d8] transition-transform group-hover:rotate-12" size={21} /><h3 className="mt-16 text-[17px] font-bold tracking-[-.03em] text-[#17131f]">{t(feature.title, language)}</h3><p className="mt-3 text-[13px] font-medium leading-5 text-[#30283b]">{t(feature.text, language)}</p></div>)}
            </div>
            <div className="reveal mt-16 rounded-[28px] bg-[#d7eee8] p-6 sm:p-8">
              <p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#6d35d8]">{isFrench ? 'Une expérience, trois repères' : 'One experience, three principles'}</p>
              <h3 className="mt-4 text-3xl font-semibold tracking-[-.05em] sm:text-4xl">{isFrench ? 'Pensé pour une Afrique connectée.' : 'Built for a connected Africa.'}</h3>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { title: { fr: 'Simplicité', en: 'Simplicity' }, text: { fr: 'Des choix clairs, sans détour.', en: 'Clear choices, no detours.' } },
                  { title: { fr: 'Rapidité', en: 'Speed' }, text: { fr: 'Un parcours court et lisible.', en: 'A short, readable journey.' } },
                  { title: { fr: 'Interopérabilité', en: 'Interoperability' }, text: { fr: 'Des réseaux qui peuvent mieux dialoguer.', en: 'Networks that can speak more clearly.' } },
                ].map((principle) => <div key={principle.title.fr} className="rounded-2xl border border-[#211d2c]/10 bg-[#f7f3e9]/55 p-4"><h4 className="text-[15px] font-bold">{t(principle.title, language)}</h4><p className="mt-2 text-[13px] leading-5 text-[#5e5766]">{t(principle.text, language)}</p></div>)}
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="bg-[#211d2c] px-5 py-24 text-[#fbf8ef] sm:px-8 sm:py-32">
          <div className="mx-auto max-w-[1240px]">
            <div className="reveal grid gap-12 lg:grid-cols-[.75fr_1.25fr] lg:gap-24">
              <div><h2 className="mt-0 max-w-[500px] text-5xl font-extrabold leading-[.9] tracking-[-.075em] text-[#fbf8ef] sm:text-7xl lg:text-8xl">{isFrench ? <>Un passage<br /><em className="font-serif font-normal text-[#9adacb]">simple.</em></> : <>One clear<br /><em className="font-serif font-normal text-[#9adacb]">passage.</em></>}</h2><p className="mt-8 max-w-[360px] text-[16px] font-semibold leading-7 text-[#f4edff] sm:text-[17px]">{isFrench ? 'Le réseau ne devrait jamais être votre problème. SendFlow rend chaque étape visible, du premier clic au dernier.' : 'The network should never be your problem. SendFlow makes every step visible, from first click to last.'}</p></div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[{ n: '01', title: { fr: 'Choisissez', en: 'Choose' }, text: { fr: 'Votre pays, votre réseau, votre destination.', en: 'Your country, your network, your destination.' }, icon: Globe2, art: chooseStepArt }, { n: '02', title: { fr: 'Vérifiez', en: 'Check' }, text: { fr: 'Le montant et le chemin, sans surprise.', en: 'The amount and the path, no surprises.' }, icon: Sparkles, art: checkStepArt }, { n: '03', title: { fr: 'Envoyez', en: 'Send' }, text: { fr: 'Un dernier regard. Puis, c’est parti.', en: 'One last look. Then, it moves.' }, icon: ArrowDownRight, art: sendStepArt }].map((step) => <div key={step.n} className="group grid min-h-[210px] grid-cols-[.78fr_1.22fr] items-center gap-3 rounded-[24px] border border-[#fbf8ef]/15 bg-[#2b2638] p-4 transition-colors hover:border-[#9adacb]/60 sm:p-5"><div className="flex h-full items-center justify-center rounded-[18px] bg-[#211d2c]/55 p-2"><img src={step.art} alt="" className="h-28 w-full object-contain sm:h-32" /></div><div className="min-w-0"><div className="flex items-start justify-between gap-2"><span className="text-[11px] font-bold text-[#9adacb]">{step.n}</span><step.icon size={18} className="shrink-0 text-[#e8cd4d] transition-transform group-hover:rotate-12" /></div><h3 className="mt-10 text-xl font-bold tracking-[-.04em] text-[#fbf8ef]">{t(step.title, language)}</h3><p className="mt-3 text-[13px] font-medium leading-5 text-[#e5dff0]">{t(step.text, language)}</p></div></div>)}</div>
             </div>
             <div className="reveal mt-12 overflow-hidden rounded-[28px] border border-[#fbf8ef]/15 bg-[#2b2638] p-4 sm:p-6">
               <div className="grid items-center gap-2 sm:grid-cols-[1.25fr_.75fr]">
                 <img src={howItWorksSectionArt} alt={isFrench ? 'Parcours de transfert en trois étapes' : 'Three-step transfer journey'} className="mx-auto h-48 w-full object-contain sm:h-64" />
                 <BrandedCharacter src={howPersonArt} alt={isFrench ? 'Personne SendFlow qui guide le parcours de transfert' : 'SendFlow person guiding the transfer journey'} className="h-48 sm:h-64" />
               </div>
             </div>
             <div className="reveal mt-20 grid items-center gap-8 border-t border-[#fbf8ef]/15 pt-7 sm:grid-cols-[1fr_auto]"><div className="flex items-center gap-4"><div className="flex -space-x-2"><span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#211d2c] bg-[#e8cd4d] text-[10px] font-bold">CI</span><span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#211d2c] bg-[#9adacb] text-[10px] font-bold">SN</span><span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#211d2c] bg-[#b69de5] text-[10px] font-bold">GH</span></div><p className="text-[12px] text-[#bcb6c5]">{isFrench ? 'Une idée née entre plusieurs rives.' : 'An idea born between several shores.'}</p></div><span className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#e8cd4d]">{isFrench ? 'Pensé pour une Afrique connectée' : 'Built for a connected Africa'}</span></div>
          </div>
        </section>

        <section id="features" className="px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-[1240px]">
            <div className="reveal flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
              <div>
                <h2 className="mt-0 max-w-[760px] text-5xl font-extrabold leading-[.9] tracking-[-.075em] text-[#17131f] sm:text-7xl lg:text-8xl">
                  {isFrench ? (
                    <>Votre argent,<br /><em className="font-serif font-normal text-[#5b21b6]">sans frontières mentales.</em></>
                  ) : (
                    <>Your money,<br /><em className="font-serif font-normal text-[#5b21b6]">without mental borders.</em></>
                  )}
                </h2>
              </div>
              <p className="max-w-[320px] text-[15px] font-semibold leading-7 text-[#30283b] sm:text-[17px]">{isFrench ? 'Explorez la couverture et les connexions qui donnent vie à SendFlow.' : 'Explore the coverage and connections that bring SendFlow to life.'}</p>
             </div>
             <div className="reveal mt-12 grid gap-4 sm:grid-cols-2">
               <div className="overflow-hidden rounded-[28px] border border-[#2d2535]/10 bg-[#fbf8ef] shadow-[0_18px_50px_rgba(58,38,83,.07)]">
                 <div className="grid items-center gap-1 p-4 sm:grid-cols-[1.15fr_.85fr] sm:p-5">
                   <img src={internationalSectionArt} alt={isFrench ? 'Transferts internationaux autour de l’Afrique' : 'International transfers around Africa'} className="h-52 w-full object-contain sm:h-60" />
                   <BrandedCharacter src={internationalPersonArt} alt={isFrench ? 'Personne SendFlow pour les transferts internationaux' : 'SendFlow person for international transfers'} className="h-52 sm:h-60" />
                 </div>
               </div>
               <div className="overflow-hidden rounded-[28px] border border-[#2d2535]/10 bg-[#d7eee8] shadow-[0_18px_50px_rgba(58,38,83,.07)]">
                 <div className="grid items-center gap-1 p-4 sm:grid-cols-[1.15fr_.85fr] sm:p-5">
                   <img src={coverageSectionArt} alt={isFrench ? 'Couverture africaine de SendFlow' : 'SendFlow African coverage'} className="h-52 w-full object-contain sm:h-60" />
                   <BrandedCharacter src={coveragePersonArt} alt={isFrench ? 'Ambassadrice SendFlow pour la couverture africaine' : 'SendFlow ambassador for African coverage'} className="h-52 sm:h-60" />
                 </div>
               </div>
             </div>
             <div id="international" className="reveal mt-12 grid gap-4 lg:grid-cols-[.82fr_1.18fr]">
              <div className="rounded-[28px] bg-[#e8cd4d] p-6 sm:p-8"><div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[.14em]">{isFrench ? 'Couverture SendFlow' : 'SendFlow coverage'}</span><span className="rounded-full bg-[#211d2c]/10 px-3 py-1 text-[10px] font-bold">{countries.length} pays</span></div><div className="mt-10 text-[clamp(3.5rem,8vw,6.5rem)] font-extrabold leading-[.8] tracking-[-.09em]">{countries.length}<span className="font-serif font-normal text-[#6d35d8]">.</span></div><p className="mt-6 max-w-[280px] text-[15px] font-semibold leading-6 text-[#211d2c]/85">{isFrench ? 'Des connexions pensées pour accompagner vos transferts.' : 'Connections designed to support your transfers.'}</p><div className="mt-10 flex flex-wrap gap-2">{countries.map((country) => <button key={country.code} onClick={() => setSelectedCountry(country)} className={`rounded-full border px-3 py-2 text-[11px] font-bold transition-all ${selectedCountry.code === country.code ? 'border-[#211d2c] bg-[#211d2c] text-[#fbf8ef]' : 'border-[#211d2c]/20 hover:border-[#211d2c]'}`} data-testid={`button-country-${country.code}`}><span className="mr-1">{country.flag}</span>{country.code}</button>)}</div></div>
              <div className="rounded-[28px] border border-[#2d2535]/10 bg-[#fbf8ef] p-6 shadow-[0_15px_45px_rgba(58,38,83,.06)] sm:p-8">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#8d8792]">{isFrench ? 'Opérateurs disponibles' : 'Available operators'}</p>
                    <h3 className="mt-2 text-3xl font-semibold tracking-[-.06em]">{selectedCountry.name}</h3>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-[11px] font-bold" style={{ backgroundColor: selectedCountry.tone }}>{selectedCountry.code}</span>
                </div>
                <div className="mt-10 space-y-3">{displayNetworks.map((network, index) => <OperatorRow key={network} network={network} index={index} total={displayNetworks.length} />)}</div>
                <div className="mt-9 flex items-center gap-2 border-t border-[#2d2535]/10 pt-5 text-[11px] text-[#8d8792]"><Check size={14} className="text-[#6d35d8]" /> {isFrench ? 'Logos publics affichés lorsqu’ils sont disponibles · Pas de transaction' : 'Public logos shown when available · No transaction'}</div>
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="overflow-hidden px-5 py-12 sm:px-8 sm:py-20">
          <div className="mx-auto grid max-w-[1240px] items-center gap-14 lg:grid-cols-[.9fr_1.1fr]">
            <div className="reveal relative min-h-[380px] sm:min-h-[480px]">
               <img src={securitySectionArt} alt={isFrench ? 'Protection et sécurité des transferts' : 'Transfer protection and security'} className="absolute bottom-0 left-[1%] z-10 h-[220px] w-[220px] object-contain object-center sm:left-[2%] sm:h-[360px] sm:w-[360px]" />
               <div className="absolute bottom-0 right-[5%] z-20 h-[300px] w-[300px] sm:right-[3%] sm:h-[460px] sm:w-[460px]">
                 <img src={securityGuardianArt} alt={isFrench ? 'Gardien 3D de la sécurité SendFlow' : '3D SendFlow security guardian'} className="h-full w-full object-contain object-center" />
               </div>
               <div className="absolute left-1/2 top-[-2%] z-30 flex w-max max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-3 rounded-full border-2 border-[#6d35d8]/25 bg-white px-4 py-2.5 shadow-[0_12px_28px_rgba(80,40,170,.2)] sm:top-[-1%] sm:gap-4 sm:px-6 sm:py-3.5">
                 <img src={sendflowMark} alt="" className="h-10 w-10 object-contain sm:h-14 sm:w-14" />
                 <img src={sendflowWordmark} alt="SendFlow" className="h-8 w-auto object-contain sm:h-12" />
               </div>
               <div className="security-ground-shadow absolute bottom-[1%] left-1/2 z-0 h-12 w-64 -translate-x-1/2 sm:h-16 sm:w-[390px]" />
              <div className="absolute left-[30%] top-[34%] flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#6d35d8] text-[#fbf8ef] shadow-[0_18px_35px_rgba(109,53,216,.25)] sm:h-32 sm:w-32"><LockKeyhole size={34} strokeWidth={1.5} /></div>
              <div className="absolute bottom-[4%] left-[3%] rounded-2xl bg-[#211d2c] px-4 py-3 text-[11px] text-[#fbf8ef] shadow-lg"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#9adacb]" />{isFrench ? 'En contrôle' : 'In control'}</div>
            </div>
            <div className="reveal"><h2 className="mt-0 max-w-[760px] text-5xl font-extrabold leading-[.9] tracking-[-.075em] text-[#17131f] sm:text-7xl lg:text-8xl">{isFrench ? <>Chaque étape<br /><em className="font-serif font-normal text-[#5b21b6]">à découvert.</em></> : <>Every step,<br /><em className="font-serif font-normal text-[#5b21b6]">in the clear.</em></>}</h2><p className="mt-8 max-w-[520px] text-[17px] font-semibold leading-7 text-[#30283b] sm:text-[19px]">{isFrench ? 'Le calme vient de ce que l’on comprend. SendFlow rend les détails lisibles, les choix explicites et le contrôle toujours à portée de main.' : 'Calm comes from understanding. SendFlow makes details readable, choices explicit, and control always within reach.'}</p><div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-[#6d35d8]/15 bg-[#fbf8ef]/50 p-4"><LockKeyhole size={18} className="text-[#6d35d8]" /><h3 className="mt-7 text-[14px] font-bold">{isFrench ? 'Détails visibles' : 'Visible details'}</h3><p className="mt-2 text-[12px] font-medium leading-5 text-[#30283b]">{isFrench ? 'Comprendre avant de confirmer.' : 'Understand before you confirm.'}</p></div><div className="rounded-2xl border border-[#6d35d8]/15 bg-[#fbf8ef]/50 p-4"><ShieldCheck size={18} className="text-[#6d35d8]" /><h3 className="mt-7 text-[14px] font-bold">{isFrench ? 'Pensé privé' : 'Privacy-minded'}</h3><p className="mt-2 text-[12px] font-medium leading-5 text-[#30283b]">{isFrench ? 'Moins de données, plus de sérénité.' : 'Less data, more peace of mind.'}</p></div></div></div>
          </div>
        </section>

        <section id="about" className="overflow-hidden border-b border-[#2d2535]/10 py-6"><div className="marquee-track flex w-max items-center gap-10 whitespace-nowrap text-[11px] font-bold uppercase tracking-[.16em] text-[#8d8792]"><span>Mobile Money, made human</span><span className="text-[#6d35d8]">·</span><span>Du réseau à la destination</span><span className="text-[#6d35d8]">·</span><span>Mobile Money, made human</span><span className="text-[#6d35d8]">·</span><span>Du réseau à la destination</span><span className="text-[#6d35d8]">·</span><span>Mobile Money, made human</span></div></section>

        <section id="faq" className="px-5 py-24 sm:px-8 sm:py-32"><div className="mx-auto grid max-w-[1040px] gap-14 lg:grid-cols-[.7fr_1.3fr]"><div className="reveal"><h2 className="mt-0 text-6xl font-extrabold leading-[.88] tracking-[-.075em] text-[#17131f] sm:text-8xl">{isFrench ? <>Vous avez<br /><em className="font-serif font-normal text-[#5b21b6]">raison.</em></> : <>Good<br /><em className="font-serif font-normal text-[#5b21b6]">questions.</em></>}</h2><p className="mt-8 max-w-[300px] text-[16px] font-semibold leading-7 text-[#30283b]">{isFrench ? 'Une idée nouvelle mérite des réponses simples.' : 'A new idea deserves simple answers.'}</p></div><div className="reveal space-y-2">{faqs.map((faq, index) => <div key={index} className="border-b border-[#2d2535]/15"><button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between py-5 text-left text-[16px] font-bold tracking-[-.025em] text-[#17131f]" data-testid={`button-faq-${index}`}><span>{t(faq.q, language)}</span><ChevronDown size={18} className={`shrink-0 text-[#6d35d8] transition-transform ${openFaq === index ? 'rotate-180' : ''}`} /></button><div className={`grid transition-[grid-template-rows] duration-300 ${openFaq === index ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}><div className="overflow-hidden"><p className="pb-5 pr-8 text-[14px] font-medium leading-6 text-[#30283b]">{t(faq.a, language)}</p></div></div></div>)}</div></div></section>

        <section id="join" className="px-5 pb-24 sm:px-8 sm:pb-32"><div className="reveal relative mx-auto max-w-[1240px] overflow-hidden rounded-[32px] bg-[#6d35d8] px-6 py-14 text-[#fbf8ef] sm:px-14 sm:py-20"><div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-[#fbf8ef]/20" /><div className="absolute -right-2 -top-10 h-48 w-48 rounded-full border border-[#fbf8ef]/15" /><div className="relative max-w-[680px]"><p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#e8cd4d]">The next move</p><h2 className="mt-5 text-6xl font-extrabold leading-[.86] tracking-[-.08em] sm:text-8xl">{isFrench ? <>Prêt·e à faire<br /><em className="font-serif font-normal text-[#e8cd4d]">bouger les choses ?</em></> : <>Ready to<br /><em className="font-serif font-normal text-[#e8cd4d]">move things?</em></>}</h2><p className="mt-8 max-w-[500px] text-[17px] font-semibold leading-7 text-[#f4edff]">{isFrench ? 'Recevez les prochaines nouvelles de SendFlow. Pas de bruit, juste les avancées.' : 'Get the next SendFlow updates. No noise, just progress.'}</p><form onSubmit={(event) => { event.preventDefault(); if (email) setSubmitted(true); }} className="mt-8 flex max-w-[480px] flex-col gap-2 sm:flex-row"><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder={isFrench ? 'votre@email.com' : 'your@email.com'} className="min-w-0 flex-1 rounded-full border border-[#fbf8ef]/20 bg-[#fbf8ef]/10 px-5 py-3.5 text-[13px] outline-none placeholder:text-[#d5c8f0] focus:border-[#e8cd4d]" data-testid="input-email" /><button type="submit" className="rounded-full bg-[#e8cd4d] px-5 py-3.5 text-[13px] font-bold text-[#211d2c] transition-transform hover:-translate-y-0.5" data-testid="button-submit-email">{submitted ? <><Check className="mr-1 inline" size={14} />{isFrench ? 'C’est noté' : 'You’re on it'}</> : <>{isFrench ? 'Me tenir au courant' : 'Keep me posted'} <ArrowRight className="ml-1 inline" size={14} /></>}</button></form><p className="mt-4 text-[11px] font-medium text-[#e5dff0]">{isFrench ? 'Démo uniquement · Aucun engagement' : 'Demo only · No commitment'}</p></div></div></section>
        <section id="download" className="px-5 pb-24 sm:px-8 sm:pb-32">
          <div className="reveal relative mx-auto max-w-[1240px] overflow-hidden rounded-[32px] bg-[#6d35d8] px-6 py-14 text-[#fbf8ef] sm:px-14 sm:py-20">
            <p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#e8cd4d]">{isFrench ? 'Le prochain mouvement' : 'The next move'}</p>
            <h2 className="mt-5 max-w-[820px] text-6xl font-extrabold leading-[.86] tracking-[-.08em] sm:text-8xl">{isFrench ? <>Votre prochain transfert<br /><em className="font-serif font-normal text-[#e8cd4d]">commence ici.</em></> : <>Your next transfer<br /><em className="font-serif font-normal text-[#e8cd4d]">starts here.</em></>}</h2>
            <p className="mt-8 max-w-[540px] text-[17px] font-semibold leading-7 text-[#f4edff]">{isFrench ? 'Téléchargez bientôt l’application SendFlow et simplifiez vos transferts entre réseaux.' : 'Download the SendFlow app soon and simplify transfers across networks.'}</p>
            <button onClick={() => setSubmitted(true)} className="mt-8 rounded-full bg-[#e8cd4d] px-5 py-3.5 text-[13px] font-bold text-[#211d2c] transition-transform hover:-translate-y-0.5" data-testid="button-download-placeholder">{isFrench ? 'Télécharger l’application' : 'Download the app'} <ArrowRight className="ml-2 inline" size={15} /></button>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-xl border border-[#fbf8ef]/25 px-3 py-2 text-[11px] font-semibold text-[#f4edff]">Google Play · bientôt</span>
              <span className="rounded-xl border border-[#fbf8ef]/25 px-3 py-2 text-[11px] font-semibold text-[#f4edff]">App Store · bientôt</span>
            </div>
             <div className="mt-10 grid items-end gap-1 sm:grid-cols-[1.1fr_.9fr] lg:absolute lg:right-8 lg:top-1/2 lg:mt-0 lg:w-[430px] lg:-translate-y-1/2">
               <img src={downloadSectionArt} alt={isFrench ? 'Application mobile SendFlow' : 'SendFlow mobile app'} className="h-48 w-full object-contain sm:h-60" />
               <BrandedCharacter src={downloadPersonArt} alt={isFrench ? 'Personne SendFlow avec l’application mobile' : 'SendFlow person with the mobile app'} className="h-48 sm:h-60" />
             </div>
          </div>
        </section>
      </main>

      <SendFlowFooter isFrench={isFrench} onNavigate={goTo} />
      <footer className="bg-[#211d2c] px-5 py-12 text-[#fbf8ef] sm:px-8 sm:py-16"><div className="mx-auto max-w-[1240px]"><div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_.6fr_.6fr_.8fr]"><div><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8cd4d] text-[#211d2c]"><ArrowDownRight size={17} strokeWidth={2.5} /></span><span className="text-[17px] font-bold tracking-[-.045em]">sendflow<span className="text-[#e8cd4d]">.</span></span></div><p className="mt-6 max-w-[280px] text-[13px] leading-6 text-[#bcb6c5]">{isFrench ? 'Une vision plus calme des mouvements d’argent en Afrique.' : 'A calmer vision for moving money across Africa.'}</p></div><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#9adacb]">{isFrench ? 'Explorer' : 'Explore'}</p><div className="mt-5 flex flex-col gap-3 text-[13px] text-[#bcb6c5]">{navItems.slice(0, 3).map((item) => <button key={item.id} onClick={() => goTo(item.id)} className="w-fit transition-colors hover:text-[#e8cd4d]" data-testid={`link-footer-${item.id}`}>{t(item.label, language)}</button>)}</div></div><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#9adacb]">{isFrench ? 'Projet' : 'Project'}</p><div className="mt-5 flex flex-col gap-3 text-[13px] text-[#bcb6c5]"><button onClick={() => goTo('security')} className="w-fit hover:text-[#e8cd4d]" data-testid="link-footer-security">{isFrench ? 'Notre approche' : 'Our approach'}</button><button onClick={() => goTo('faq')} className="w-fit hover:text-[#e8cd4d]" data-testid="link-footer-faq">{isFrench ? 'Questions' : 'Questions'}</button><button onClick={() => goTo('join')} className="w-fit hover:text-[#e8cd4d]" data-testid="link-footer-join">{isFrench ? 'Contact' : 'Contact'}</button></div></div><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#9adacb]">{isFrench ? 'Statut' : 'Status'}</p><div className="mt-5 flex items-center gap-2 text-[13px] text-[#bcb6c5]"><span className="h-2 w-2 rounded-full bg-[#9adacb]" />{isFrench ? 'Démo en évolution' : 'Demo in progress'}</div><button onClick={() => setLanguage(isFrench ? 'en' : 'fr')} className="mt-5 flex items-center gap-2 text-[12px] font-semibold text-[#e8cd4d]" data-testid="button-footer-language"><Globe2 size={14} /> {isFrench ? 'English version' : 'Version française'}</button></div></div><div className="mt-14 flex flex-col justify-between gap-4 border-t border-[#fbf8ef]/15 pt-5 text-[10px] text-[#8d8792] sm:flex-row"><span>© 2025 SendFlow Studio. {isFrench ? 'Projet conceptuel.' : 'Concept project.'}</span><span className="flex gap-4"><span>{isFrench ? 'Confidentialité' : 'Privacy'}</span><span>{isFrench ? 'Mentions' : 'Legal'}</span></span></div></div></footer>
    </div>
  );
}

export default App;