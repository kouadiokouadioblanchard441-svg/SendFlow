import { useState } from 'react';
import type { CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleDot,
  Compass,
  Globe2,
  GraduationCap,
  HeartHandshake,
  Instagram,
  Linkedin,
  Quote,
  Sparkles,
  Target,
  UserRound,
  Zap,
} from 'lucide-react';
import { SiGmail } from 'react-icons/si';
import sendflowMark from '@assets/sendflow-mark-original.png';
import founderPortrait from '@assets/file_00000000d41881f4b07497287b39201e_1789085205545.png';
import crossNetworkIcon from '../assets/sendflow-icon-cross-network.svg';
import internationalTransferIcon from '../assets/sendflow-icon-international-transfer.svg';
import visibleDetailsIcon from '../assets/sendflow-icon-visible-details.svg';

export type AboutLocale = 'fr' | 'en';

export type FounderProfile = {
  name: string;
  role: string;
  photoUrl?: string | null;
  shortBio: string;
  story: string;
  vision: string;
  mission: string;
  education: string;
  linkedinUrl?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  xUrl?: string | null;
};

export type AboutPageProps = {
  locale: AboutLocale;
  profile: FounderProfile;
  content?: Array<{ contentKey: string; locale: string; value: string; isVisible: boolean }>;
  onBackHome: () => void;
  onToggleLocale?: () => void;
};

type Copy = {
  fr: string;
  en: string;
};

const copy = (value: Copy, locale: AboutLocale) => value[locale];

const editorialFallbacks: Record<string, Copy> = {
  'about.hero.kicker': { fr: 'L’histoire derrière SendFlow', en: 'The story behind SendFlow' },
  'about.hero.title': { fr: 'L’argent circule mieux quand les gens se comprennent.', en: 'Money moves better when people understand each other.' },
  'about.hero.intro': { fr: 'SendFlow est né d’une intuition simple : la technologie financière ne devrait pas ajouter de distance. Elle devrait rendre les liens plus directs, les choix plus lisibles et les transferts plus humains.', en: 'SendFlow was born from a simple intuition: financial technology should not add distance. It should make connections more direct, choices clearer, and transfers more human.' },
  'about.hero.founderCta': { fr: 'Rencontrer le fondateur', en: 'Meet the founder' },
  'about.hero.missionCta': { fr: 'Notre raison d’être', en: 'Our reason why' },
  'about.mission.kicker': { fr: 'Une conviction concrète', en: 'A practical conviction' },
  'about.mission.title': { fr: 'Rendre la simplicité accessible à tous.', en: 'Make simplicity accessible to everyone.' },
  'about.mission.label': { fr: 'Notre mission', en: 'Our mission' },
  'about.vision.label': { fr: 'Notre vision', en: 'Our vision' },
  'about.path.kicker': { fr: 'Le chemin', en: 'The path' },
  'about.path.title': { fr: 'Une idée qui a pris racine dans le réel.', en: 'An idea rooted in real life.' },
  'about.path.intro': { fr: 'Pas de raccourci spectaculaire. Un apprentissage patient : écouter, comprendre les contraintes, puis construire quelque chose qui tient.', en: 'No spectacular shortcut. A patient practice: listen, understand the constraints, then build something that holds.' },
  'about.benefits.kicker': { fr: 'Ce que SendFlow rend possible', en: 'What SendFlow makes possible' },
  'about.benefits.title': { fr: 'Moins de friction. Plus de mouvement.', en: 'Less friction. More movement.' },
  'about.founder.kicker': { fr: 'À l’origine du mouvement', en: 'At the origin of the movement' },
  'about.founder.title': { fr: 'Le visage derrière le produit.', en: 'The person behind the product.' },
  'about.cta.kicker': { fr: 'La suite s’écrit ensemble', en: 'The next chapter is shared' },
  'about.cta.title': { fr: 'Prêt à faire circuler les possibles ?', en: 'Ready to keep possibilities moving?' },
  'about.cta.button': { fr: 'Découvrir SendFlow', en: 'Discover SendFlow' },
  'about.card.tagline': { fr: 'Tout circule.', en: 'Keep it moving.' },
  'about.feature.start.title': { fr: 'Un seul point de départ', en: 'One starting point' },
  'about.feature.start.body': { fr: 'Choisissez un pays, un réseau et un bénéficiaire depuis un parcours pensé pour être compris du premier coup.', en: 'Choose a country, a network, and a recipient through a journey designed to be understood at first glance.' },
  'about.feature.trust.title': { fr: 'Une confiance lisible', en: 'Trust you can read' },
  'about.feature.trust.body': { fr: 'Les informations essentielles restent visibles : qui reçoit, combien, quand et où en est le transfert.', en: 'The essentials stay visible: who receives, how much, when, and where the transfer stands.' },
  'about.feature.borders.title': { fr: 'Des frontières moins lourdes', en: 'Lighter borders' },
  'about.feature.borders.body': { fr: 'SendFlow rapproche les réseaux locaux pour que la distance géographique ne dicte plus la distance humaine.', en: 'SendFlow brings local networks closer so geography does not dictate human distance.' },
  'about.footer.tagline': { fr: 'Des liens qui avancent.', en: 'Connections in motion.' },
  'about.footer.initiative': { fr: 'Une initiative Flow Digital SARL.', en: 'An initiative by Flow Digital SARL.' },
};

const colors = {
  ivory: '#f7f3e9',
  paper: '#fffdf7',
  violet: '#6d35d8',
  violetDark: '#4d269d',
  yellow: '#e8cd4d',
  navy: '#211d2c',
  navySoft: '#514b5d',
  mint: '#9adacb',
  mintPale: '#e2f3ee',
  line: '#ded7cc',
} as const;

const sectionKicker = 'mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em]';

function FounderPhoto({ profile }: { profile: FounderProfile }) {
  const [hasImageError, setHasImageError] = useState(false);
  const imageUrl = profile.photoUrl || founderPortrait;
  const initials = profile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  if (hasImageError) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-[#6d35d8] p-8"
        aria-label={profile.name}
      >
        <div className="flex h-36 w-36 items-center justify-center rounded-full border-[10px] border-[#9adacb] bg-[#e8cd4d] text-5xl font-bold tracking-[-0.08em] text-[#211d2c] shadow-[0_18px_0_rgba(33,29,44,.15)] sm:h-48 sm:w-48 sm:text-6xl">
          {initials || <UserRound size={62} strokeWidth={1.5} />}
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={profile.name}
      className="h-full w-full object-cover"
      style={{ objectPosition: '50% 24%' }}
      onError={() => setHasImageError(true)}
    />
  );
}

function Mark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#fffdf7] shadow-[0_5px_14px_rgba(33,29,44,.12)] ring-1 ring-[#1769ff]/25 ${className}`}>
      <img src={sendflowMark} alt="" className="h-9 w-9 object-contain" />
    </span>
  );
}

function Feature({
  icon: Icon,
  iconAlt,
  title,
  description,
}: {
  icon: string;
  iconAlt: string;
  title: string;
  description: string;
}) {
  return (
    <article className="group rounded-[26px] border p-6 transition-transform duration-300 hover:-translate-y-1" style={{ borderColor: colors.line, backgroundColor: colors.paper }}>
      <div className="mb-8 flex h-28 w-full items-center justify-center overflow-hidden rounded-2xl border bg-[#f7f3e9] px-3 py-2" style={{ borderColor: colors.line }}>
        <img src={Icon} alt={iconAlt} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]" />
      </div>
      <h3 className="font-serif text-[28px] leading-none tracking-[-0.04em]" style={{ color: colors.navy }}>
        {title}
      </h3>
      <p className="mt-4 text-sm leading-6" style={{ color: colors.navySoft }}>
        {description}
      </p>
    </article>
  );
}

export function AboutPage({ locale, profile, content = [], onBackHome, onToggleLocale }: AboutPageProps) {
  const isFrench = locale === 'fr';
  const t = (value: Copy) => {
    const key = Object.entries(editorialFallbacks).find(([, fallback]) => fallback.fr === value.fr && fallback.en === value.en)?.[0];
    const override = key ? content.find((item) => item.contentKey === key && item.locale === locale && item.isVisible) : undefined;
    return override?.value ?? copy(value, locale);
  };

  const storySteps = [
    {
      year: t({ fr: 'Le déclic', en: 'The spark' }),
      title: t({ fr: 'Observer avant de construire', en: 'Observe before building' }),
      body: t({
        fr: 'Sur le terrain, une question revenait : pourquoi envoyer de l’argent devait-il encore demander autant d’explications, de confiance et de patience ?',
        en: 'In the field, one question kept coming back: why should sending money still require so much explanation, trust, and patience?',
      }),
    },
    {
      year: t({ fr: 'Le virage', en: 'The turn' }),
      title: t({ fr: 'De la finance-comptabilité à la tech', en: 'From finance & accounting to tech' }),
      body: t({
        fr: 'Avec une formation en finance-comptabilité, notre fondateur a appris à regarder les chiffres, les risques et les détails. Puis il a choisi de mettre cette rigueur au service d’un produit numérique utile.',
        en: 'With a background in finance and accounting, our founder learned to look at numbers, risk, and detail. Then he chose to put that discipline behind a useful digital product.',
      }),
    },
    {
      year: t({ fr: 'Aujourd’hui', en: 'Today' }),
      title: t({ fr: 'Relier les réseaux, rapprocher les personnes', en: 'Connect networks, bring people closer' }),
      body: t({
        fr: 'SendFlow transforme la complexité des réseaux Mobile Money en un parcours simple : choisir, vérifier, envoyer. Une petite interface, pour une grande liberté de mouvement.',
        en: 'SendFlow turns Mobile Money network complexity into a simple journey: choose, review, send. A small interface for a greater freedom of movement.',
      }),
    },
  ];

  const benefits = [
    t({ fr: 'Comprendre chaque étape avant de confirmer', en: 'Understand every step before confirming' }),
    t({ fr: 'Passer d’un réseau à l’autre sans jargon', en: 'Move between networks without jargon' }),
    t({ fr: 'Garder une trace claire de chaque transfert', en: 'Keep a clear record of every transfer' }),
    t({ fr: 'Envoyer avec une confiance construite dans les détails', en: 'Send with confidence built into the details' }),
  ];

  return (
    <main className="noise min-h-[100dvh]" style={{ backgroundColor: colors.ivory, color: colors.navy }}>
      <header className="sticky top-0 z-30 border-b backdrop-blur-md" style={{ borderColor: 'rgba(222,215,204,.8)', backgroundColor: 'rgba(247,243,233,.88)' }}>
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-8 lg:px-12">
          <button
            type="button"
            onClick={onBackHome}
            className="group inline-flex items-center gap-3 text-left"
            aria-label={t({ fr: 'Retour à l’accueil', en: 'Back home' })}
          >
            <Mark />
            <span className="hidden text-sm font-bold tracking-[-0.03em] sm:inline">SendFlow</span>
          </button>
          <button
            type="button"
            onClick={onBackHome}
            className="link-underline inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] transition-opacity hover:opacity-70"
          >
            <ArrowLeft size={15} />
            {t({ fr: 'Retour à l’accueil', en: 'Back home' })}
          </button>
          {onToggleLocale && (
            <button
              type="button"
              onClick={onToggleLocale}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border bg-[#fffdf7] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] shadow-[0_4px_12px_rgba(33,29,44,.05)] transition-colors hover:bg-white"
              style={{ borderColor: colors.line, color: colors.navy }}
              aria-label={isFrench ? 'Passer en anglais' : 'Switch to French'}
            >
              <span aria-hidden="true" className="text-base leading-none">
                {isFrench ? '🇫🇷' : '🇬🇧'}
              </span>
              <span>{isFrench ? 'FR' : 'EN'}</span>
            </button>
          )}
        </div>
      </header>

      <section className="relative overflow-hidden border-b" style={{ borderColor: colors.line }}>
        <div className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full border-[34px] border-[#9adacb]/60 sm:h-[500px] sm:w-[500px]" />
        <div className="pointer-events-none absolute -bottom-28 left-[42%] h-56 w-56 rounded-full bg-[#e8cd4d]/45 blur-3xl" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:gap-20 lg:px-12 lg:pt-28">
          <div className="rise max-w-3xl">
            <div className={sectionKicker} style={{ color: colors.violet }}>
              <Sparkles size={14} />
              {t({ fr: 'L’histoire derrière SendFlow', en: 'The story behind SendFlow' })}
            </div>
            <h1 className="max-w-4xl font-serif text-[clamp(3.8rem,10vw,8.5rem)] leading-[0.84] tracking-[-0.065em]" style={{ color: colors.navy }}>
              {t({ fr: 'L’argent circule mieux quand les gens se comprennent.', en: 'Money moves better when people understand each other.' })}
            </h1>
            <p className="mt-8 max-w-xl text-base leading-7 sm:text-lg" style={{ color: colors.navySoft }}>
              {t({
                fr: 'SendFlow est né d’une intuition simple : la technologie financière ne devrait pas ajouter de distance. Elle devrait rendre les liens plus directs, les choix plus lisibles et les transferts plus humains.',
                en: 'SendFlow was born from a simple intuition: financial technology should not add distance. It should make connections more direct, choices clearer, and transfers more human.',
              })}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="#founder"
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5"
                style={{ backgroundColor: colors.violet, color: colors.paper }}
              >
                {t({ fr: 'Rencontrer le fondateur', en: 'Meet the founder' })}
                <ArrowRight size={16} />
              </a>
              <a
                href="#mission"
                className="inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-bold transition-colors hover:bg-[#fffdf7]"
                style={{ borderColor: colors.line, color: colors.navy }}
              >
                {t({ fr: 'Notre raison d’être', en: 'Our reason why' })}
                <ChevronDown size={16} />
              </a>
            </div>
          </div>

          <div className="relative mx-auto flex min-h-[330px] w-full max-w-[470px] items-center justify-center sm:min-h-[450px]">
            <div className="absolute h-[240px] w-[240px] rounded-full border border-[#6d35d8]/25 sm:h-[350px] sm:w-[350px]" />
            <div className="absolute h-[180px] w-[180px] rounded-full bg-[#9adacb]/50 sm:h-[270px] sm:w-[270px]" />
            <div className="float-art relative flex h-[165px] w-[235px] rotate-[-7deg] flex-col justify-between rounded-[26px] p-6 shadow-[0_26px_50px_rgba(33,29,44,.18)] sm:h-[200px] sm:w-[290px] sm:p-7" style={{ backgroundColor: colors.navy }}>
              <div className="flex items-center justify-between text-[#fffdf7]">
                <span className="text-xs font-bold uppercase tracking-[0.15em]">SendFlow</span>
                <Globe2 size={20} strokeWidth={1.5} />
              </div>
              <div>
                <div className="mb-2 h-1.5 w-20 rounded-full bg-[#e8cd4d]" />
                <p className="font-serif text-3xl leading-none text-[#fffdf7] sm:text-4xl">
                  {t({ fr: 'Tout circule.', en: 'Keep it moving.' })}
                </p>
              </div>
            </div>
            <div className="absolute right-[6%] top-[16%] flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8cd4d] shadow-[0_12px_22px_rgba(33,29,44,.14)] sm:right-[12%] sm:top-[13%]">
              <ArrowRight size={21} />
            </div>
            <div className="absolute bottom-[13%] left-[5%] flex h-14 w-14 items-center justify-center rounded-full bg-[#6d35d8] text-[#fffdf7] shadow-[0_12px_22px_rgba(33,29,44,.16)] sm:bottom-[18%] sm:left-[7%]">
              <HeartHandshake size={23} strokeWidth={1.7} />
            </div>
          </div>
        </div>
      </section>

      <section id="mission" className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr] lg:gap-24">
          <div>
            <div className={sectionKicker} style={{ color: colors.violet }}>
              <Target size={14} />
              {t({ fr: 'Une conviction concrète', en: 'A practical conviction' })}
            </div>
            <h2 className="max-w-md font-serif text-5xl leading-[0.93] tracking-[-0.06em] sm:text-6xl" style={{ color: colors.navy }}>
              {t({ fr: 'Rendre la simplicité accessible à tous.', en: 'Make simplicity accessible to everyone.' })}
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="border-t-2 pt-5" style={{ borderColor: colors.violet }}>
              <span className="font-serif text-4xl" style={{ color: colors.violet }}>01</span>
              <h3 className="mt-5 text-lg font-bold">{t({ fr: 'Notre mission', en: 'Our mission' })}</h3>
              <p className="mt-3 text-sm leading-6" style={{ color: colors.navySoft }}>
                {profile.mission}
              </p>
            </div>
            <div className="border-t-2 pt-5" style={{ borderColor: colors.mint }}>
              <span className="font-serif text-4xl" style={{ color: colors.violet }}>02</span>
              <h3 className="mt-5 text-lg font-bold">{t({ fr: 'Notre vision', en: 'Our vision' })}</h3>
              <p className="mt-3 text-sm leading-6" style={{ color: colors.navySoft }}>
                {profile.vision}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y" style={{ borderColor: colors.line, backgroundColor: colors.paper }}>
        <div className="mx-auto grid w-full max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[.8fr_1.2fr] lg:gap-28 lg:px-12">
          <div>
            <div className={sectionKicker} style={{ color: colors.violet }}>
              <Compass size={14} />
              {t({ fr: 'Le chemin', en: 'The path' })}
            </div>
            <h2 className="max-w-sm font-serif text-5xl leading-[0.92] tracking-[-0.06em] sm:text-6xl" style={{ color: colors.navy }}>
              {t({ fr: 'Une idée qui a pris racine dans le réel.', en: 'An idea rooted in real life.' })}
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-6" style={{ color: colors.navySoft }}>
              {t({
                fr: 'Pas de raccourci spectaculaire. Un apprentissage patient : écouter, comprendre les contraintes, puis construire quelque chose qui tient.',
                en: 'No spectacular shortcut. A patient practice: listen, understand the constraints, then build something that holds.',
              })}
            </p>
          </div>
          <div className="relative space-y-10 pl-8 sm:pl-14">
            <div className="absolute bottom-3 left-[10px] top-3 w-px sm:left-[26px]" style={{ backgroundColor: colors.line }} />
            {storySteps.map((step, index) => (
              <article key={step.year} className="relative">
                <span className="absolute -left-[32px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-4 sm:-left-[56px]" style={{ borderColor: colors.paper, backgroundColor: index === 1 ? colors.yellow : colors.violet }}>
                  <CircleDot size={8} className="text-transparent" />
                </span>
                <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: colors.violet }}>{step.year}</p>
                <h3 className="mt-2 font-serif text-3xl leading-none tracking-[-0.04em]" style={{ color: colors.navy }}>{step.title}</h3>
                <p className="mt-3 max-w-xl text-sm leading-6" style={{ color: colors.navySoft }}>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="mb-10 max-w-2xl">
          <div className={sectionKicker} style={{ color: colors.violet }}>
            <Zap size={14} />
            {t({ fr: 'Ce que SendFlow rend possible', en: 'What SendFlow makes possible' })}
          </div>
          <h2 className="font-serif text-5xl leading-[0.9] tracking-[-0.06em] sm:text-6xl" style={{ color: colors.navy }}>
            {t({ fr: 'Moins de friction. Plus de mouvement.', en: 'Less friction. More movement.' })}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Feature
            icon={crossNetworkIcon}
            iconAlt={t({ fr: 'Icône SendFlow représentant des réseaux connectés', en: 'SendFlow icon representing connected networks' })}
            title={t({ fr: 'Un seul point de départ', en: 'One starting point' })}
            description={t({
              fr: 'Choisissez un pays, un réseau et un bénéficiaire depuis un parcours pensé pour être compris du premier coup.',
              en: 'Choose a country, a network, and a recipient through a journey designed to be understood at first glance.',
            })}
          />
          <Feature
            icon={visibleDetailsIcon}
            iconAlt={t({ fr: 'Icône SendFlow représentant des informations visibles et vérifiées', en: 'SendFlow icon representing visible and verified information' })}
            title={t({ fr: 'Une confiance lisible', en: 'Trust you can read' })}
            description={t({
              fr: 'Les informations essentielles restent visibles : qui reçoit, combien, quand et où en est le transfert.',
              en: 'The essentials stay visible: who receives, how much, when, and where the transfer stands.',
            })}
          />
          <Feature
            icon={internationalTransferIcon}
            iconAlt={t({ fr: 'Icône SendFlow représentant un transfert international', en: 'SendFlow icon representing an international transfer' })}
            title={t({ fr: 'Des frontières moins lourdes', en: 'Lighter borders' })}
            description={t({
              fr: 'SendFlow rapproche les réseaux locaux pour que la distance géographique ne dicte plus la distance humaine.',
              en: 'SendFlow brings local networks closer so geography does not dictate human distance.',
            })}
          />
        </div>
      </section>

      <section className="border-y" style={{ borderColor: colors.line, backgroundColor: colors.mintPale }}>
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1fr_.8fr] lg:items-center lg:px-12">
          <div>
            <div className={sectionKicker} style={{ color: colors.violet }}>
              <Check size={14} />
              {t({ fr: 'Le bénéfice au quotidien', en: 'The everyday benefit' })}
            </div>
            <h2 className="max-w-xl font-serif text-5xl leading-[0.9] tracking-[-0.06em] sm:text-6xl" style={{ color: colors.navy }}>
              {t({ fr: 'Une technologie qui s’efface quand elle fait bien son travail.', en: 'Technology that disappears when it does its job well.' })}
            </h2>
          </div>
          <ul className="space-y-4">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3 border-b pb-4 text-sm font-medium leading-6" style={{ borderColor: 'rgba(33,29,44,.16)', color: colors.navy }}>
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: colors.violet, color: colors.paper }}>
                  <Check size={12} strokeWidth={3} />
                </span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="founder" className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className={sectionKicker} style={{ color: colors.violet }}>
              <UserRound size={14} />
              {t({ fr: 'À l’origine du mouvement', en: 'At the origin of the movement' })}
            </div>
            <h2 className="font-serif text-5xl leading-[0.9] tracking-[-0.06em] sm:text-6xl" style={{ color: colors.navy }}>
              {t({ fr: 'Le visage derrière le produit.', en: 'The person behind the product.' })}
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-6" style={{ color: colors.navySoft }}>{profile.shortBio}</p>
        </div>

        <div className="grid overflow-hidden rounded-[30px] border lg:grid-cols-[.82fr_1.18fr]" style={{ borderColor: colors.line, backgroundColor: colors.paper }}>
          <div className="relative h-[280px] sm:h-[360px] lg:h-[390px] lg:self-start">
            <FounderPhoto profile={profile} />
            <div className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] shadow-sm" style={{ backgroundColor: colors.yellow, color: colors.navy }}>
              <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-white p-0.5">
                <img src={sendflowMark} alt="" className="h-full w-full object-contain" />
              </span>
              SendFlow
            </div>
          </div>
          <div className="flex flex-col justify-between p-7 sm:p-10 lg:p-14">
            <div>
              <Quote size={28} style={{ color: colors.violet }} />
              <blockquote className="mt-6 max-w-2xl font-serif text-3xl leading-[1.02] tracking-[-0.04em] sm:text-4xl" style={{ color: colors.navy }}>
                “{profile.story}”
              </blockquote>
              <div className="mt-8">
                <h3 className="text-xl font-bold tracking-[-0.03em]">{profile.name}</h3>
                <p className="mt-1 text-sm" style={{ color: colors.violet }}>{profile.role}</p>
                <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: colors.navySoft }}>
                  <GraduationCap size={15} />
                  {profile.education}
                </div>
              </div>
            </div>
            <div className="mt-10 flex flex-wrap justify-center gap-3 border-t pt-6 sm:justify-start" style={{ borderColor: colors.line }}>
              {profile.linkedinUrl && (
                <a
                  href={profile.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-colors hover:bg-[#f7f3e9]"
                  style={{ borderColor: colors.line, color: colors.navy }}
                >
                  <Linkedin size={16} />
                  LinkedIn
                </a>
              )}
              {profile.websiteUrl && (
                <a
                  href={profile.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-colors hover:bg-[#f7f3e9]"
                  style={{ borderColor: colors.line, color: colors.navy }}
                >
                  <Globe2 size={16} />
                  Site
                </a>
              )}
              {profile.instagramUrl && (
                <a
                  href={profile.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-colors hover:bg-[#f7f3e9]"
                  style={{ borderColor: colors.line, color: colors.navy }}
                >
                  <Instagram size={16} />
                  Instagram
                </a>
              )}
              {profile.xUrl && (
                <a
                  href={profile.xUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-colors hover:bg-[#f7f3e9]"
                  style={{ borderColor: colors.line, color: colors.navy }}
                >
                  <span className="text-sm font-black leading-none">X</span>
                  X
                </a>
              )}
              {profile.email && (
                <a
                  href={`mailto:${profile.email}`}
                  className="inline-flex min-w-[214px] items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5"
                  style={{ backgroundColor: colors.violet, color: colors.paper }}
                >
                  <SiGmail size={18} color="#EA4335" aria-hidden="true" />
                  {t({ fr: 'Écrire au fondateur', en: 'Email the founder' })}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-12 sm:px-8 lg:px-12">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[30px] px-6 py-14 sm:px-12 sm:py-20 lg:px-20" style={{ backgroundColor: colors.navy }}>
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[26px] border-[#6d35d8]/70" />
          <div className="pointer-events-none absolute bottom-[-80px] right-[26%] h-44 w-44 rounded-full bg-[#9adacb]/35 blur-2xl" />
          <div className="relative flex flex-col items-start justify-between gap-9 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <div className={sectionKicker} style={{ color: colors.yellow }}>
                <BriefcaseBusiness size={14} />
                {t({ fr: 'La suite s’écrit ensemble', en: 'The next chapter is shared' })}
              </div>
              <h2 className="font-serif text-5xl leading-[0.9] tracking-[-0.06em] text-[#fffdf7] sm:text-7xl">
                {t({ fr: 'Prêt à faire circuler les possibles ?', en: 'Ready to keep possibilities moving?' })}
              </h2>
            </div>
            <button
              type="button"
              onClick={onBackHome}
              className="group inline-flex shrink-0 items-center gap-3 rounded-full px-6 py-4 text-sm font-bold text-[#fffdf7] transition-colors transition-transform hover:-translate-y-1 hover:bg-[#4d269d]"
              style={{ backgroundColor: colors.violet }}
            >
              {t({ fr: 'Découvrir SendFlow', en: 'Discover SendFlow' })}
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 pb-8 pt-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12" style={{ color: colors.navySoft }}>
        <div className="flex items-center gap-2">
          <Mark className="h-7 w-7 text-[10px]" />
          <span>SendFlow · {t({ fr: 'Des liens qui avancent.', en: 'Connections in motion.' })}</span>
        </div>
        <span>{t({ fr: 'Une initiative Flow Digital SARL.', en: 'An initiative by Flow Digital SARL.' })}</span>
      </footer>
    </main>
  );
}

export default AboutPage;