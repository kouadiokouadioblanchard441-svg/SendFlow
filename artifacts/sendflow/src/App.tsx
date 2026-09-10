import { useEffect, useMemo, useState } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ArrowDownRight, ArrowRight, Check, ChevronDown, Globe2, LockKeyhole, Menu, Play, ShieldCheck, Sparkles, X } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import sendflowWordmark from '@assets/sendflow-wordmark.png';

const queryClient = new QueryClient();

type Language = 'fr' | 'en';
type Copy = { fr: string; en: string };
const t = (copy: Copy, language: Language) => copy[language];

const navItems = [
  { id: 'top', label: { fr: 'Accueil', en: 'Home' } },
  { id: 'features-cards', label: { fr: 'Fonctionnalités', en: 'Features' } },
  { id: 'how', label: { fr: 'Comment ça marche', en: 'How it works' } },
  { id: 'international', label: { fr: 'International', en: 'International' } },
  { id: 'security', label: { fr: 'Sécurité', en: 'Security' } },
  { id: 'about', label: { fr: 'À propos', en: 'About' } },
];

const countries = [
  { name: 'Côte d’Ivoire', code: 'CI', networks: ['Réseau A', 'Réseau B', 'Réseau C'], flag: 'CI', tone: '#dbeaff' },
  { name: 'Sénégal', code: 'SN', networks: ['Réseau A', 'Réseau B', 'Réseau C'], flag: 'SN', tone: '#dbeaff' },
  { name: 'Ghana', code: 'GH', networks: ['Réseau A', 'Réseau B', 'Réseau C'], flag: 'GH', tone: '#dbeaff' },
  { name: 'Kenya', code: 'KE', networks: ['Réseau A', 'Réseau B'], flag: 'KE', tone: '#dbeaff' },
];

const faqs: { q: Copy; a: Copy }[] = [
  { q: { fr: 'Qu’est-ce que SendFlow ?', en: 'What is SendFlow?' }, a: { fr: 'SendFlow est une expérience de démonstration qui imagine une manière plus claire de transférer de l’argent entre réseaux Mobile Money. Elle ne traite aucun paiement réel.', en: 'SendFlow is a demo experience imagining a clearer way to move money between Mobile Money networks. It does not process real payments.' } },
  { q: { fr: 'Quels réseaux sont disponibles ?', en: 'Which networks are available?' }, a: { fr: 'La couverture présentée est illustrative. Choisissez un pays dans la démo pour explorer quelques réseaux Mobile Money de démonstration.', en: 'The coverage shown is illustrative. Choose a country in the demo to explore a few illustrative Mobile Money networks.' } },
  { q: { fr: 'Puis-je transférer vers un autre pays ?', en: 'Can I transfer to another country?' }, a: { fr: 'Le transfert international fait partie de la vision SendFlow, lorsque la couverture et les conditions locales le permettent. Cette page ne traite aucun paiement réel.', en: 'International transfers are part of the SendFlow vision where coverage and local conditions allow. This page does not process real payments.' } },
  { q: { fr: 'Comment suivre un transfert ?', en: 'How do I track a transfer?' }, a: { fr: 'Le concept prévoit un suivi clair de chaque étape, de la vérification à la confirmation, avec un statut lisible pour le bénéficiaire et l’expéditeur.', en: 'The concept includes clear step-by-step tracking from review to confirmation, with a readable status for sender and recipient.' } },
  { q: { fr: 'SendFlow possède-t-il un wallet ?', en: 'Does SendFlow have a wallet?' }, a: { fr: 'Non. SendFlow est présenté ici comme une couche de connexion entre réseaux, pas comme un wallet. Aucun compte financier n’est créé dans cette démo.', en: 'No. SendFlow is presented as a connection layer between networks, not as a wallet. This demo creates no financial account.' } },
];

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Switch>
            <Route path="/" component={LandingPage} />
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
    return () => observer.disconnect();
  }, []);

  const isFrench = language === 'fr';
  const displayNetworks = useMemo(() => selectedCountry.networks, [selectedCountry]);

  const goTo = (id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const downloadBrief = () => {
    const brief = `SendFlow\n\nUne vision plus calme des mouvements d’argent en Afrique.\n\nDémo conceptuelle — aucun paiement réel.\n\nParcours exploré : ${selectedCountry.name}\nRéseaux : ${selectedCountry.networks.join(', ')}\n\nsendflow.studio`;
    const blob = new Blob([brief], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sendflow-demo-brief.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="noise min-h-[100dvh] bg-[#f7f3e9] text-[#211d2c]">
      <header className="fixed inset-x-0 top-0 z-40 px-4 pt-4 sm:px-8 sm:pt-6">
        <nav className="mx-auto flex max-w-[1240px] items-center justify-between rounded-full border border-[#2d2535]/10 bg-[#f7f3e9]/85 px-4 py-3 backdrop-blur-md sm:px-5">
          <button onClick={() => goTo('top')} className="flex items-center gap-2" data-testid="button-logo">
            <img src={sendflowWordmark} alt="SendFlow" className="h-7 w-auto object-contain" />
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
            <img src={sendflowWordmark} alt="SendFlow" className="h-8 w-auto object-contain" />
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
        <section className="relative overflow-hidden px-5 pb-20 pt-36 sm:px-8 sm:pb-28 sm:pt-44">
          <div className="absolute -right-32 top-24 h-[430px] w-[430px] rounded-full bg-[#d4f0e9] opacity-70 blur-3xl" />
          <div className="mx-auto grid max-w-[1240px] items-center gap-14 lg:grid-cols-[1.04fr_.96fr] lg:gap-8">
            <div className="relative z-10 max-w-[680px]">
              <div className="rise flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.17em] text-[#6d35d8]"><span className="h-2 w-2 rounded-full bg-[#6d35d8]" />{isFrench ? 'La finance, sans le bruit' : 'Finance, without the noise'}</div>
              <h1 className="rise delay-1 mt-6 max-w-[700px] text-[clamp(3.45rem,8.5vw,7.2rem)] font-semibold leading-[.9] tracking-[-.085em]">{isFrench ? <>L’argent circule.<br /><em className="font-serif font-normal text-[#6d35d8]">Les réseaux</em> aussi.</> : <>Money moves.<br /><em className="font-serif font-normal text-[#6d35d8]">Networks</em> do too.</>}</h1>
              <p className="rise delay-2 mt-8 max-w-[465px] text-[16px] leading-7 text-[#5e5766] sm:text-[18px]">{isFrench ? 'SendFlow simplifie vos transferts d’argent entre différents réseaux de paiement, localement et au-delà des frontières.' : 'SendFlow simplifies money transfers across different payment networks, locally and across borders.'}</p>
              <div className="rise delay-3 mt-9 flex flex-wrap items-center gap-3">
                <button onClick={() => goTo('join')} className="rounded-full bg-[#6d35d8] px-5 py-3.5 text-[13px] font-bold text-[#fbf8ef] shadow-[0_12px_24px_rgba(109,53,216,.2)] transition-all hover:-translate-y-1 hover:bg-[#5822c3]" data-testid="button-hero-download">{isFrench ? 'Télécharger l’application' : 'Download the app'} <ArrowRight className="ml-2 inline" size={15} /></button>
                <button onClick={() => goTo('features')} className="rounded-full border border-[#2d2535]/20 px-5 py-3.5 text-[13px] font-bold text-[#211d2c] transition-all hover:-translate-y-1 hover:border-[#6d35d8] hover:text-[#6d35d8]" data-testid="button-hero-discover"><Play className="mr-2 inline" size={14} fill="currentColor" />{isFrench ? 'Découvrir SendFlow' : 'Discover SendFlow'}</button>
              </div>
              <p className="mt-5 text-[11px] text-[#8d8792]">{isFrench ? 'Démo conceptuelle · Aucun paiement réel' : 'Concept demo · No real payments'}</p>
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
          <div className="mx-auto mt-18 max-w-[1240px] border-t border-[#2d2535]/10 pt-5">
            <div className="flex flex-wrap items-center gap-x-7 gap-y-3 text-[11px] font-semibold text-[#8d8792]"><span>{isFrench ? 'Pensé pour les mouvements qui comptent' : 'Built for the moves that matter'}</span><span className="h-1 w-1 rounded-full bg-[#6d35d8]" /><span>Abidjan</span><span>Dakar</span><span>Accra</span><span>Nairobi</span></div>
          </div>
        </section>

        <section id="features-cards" className="px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-[1240px]">
            <div className="reveal max-w-[720px]">
              <p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#6d35d8]">01 / {isFrench ? 'Le point de départ' : 'The starting point'}</p>
              <h2 className="mt-5 text-4xl font-semibold leading-[.96] tracking-[-.065em] sm:text-6xl">{isFrench ? <>Plusieurs réseaux.<br /><em className="font-serif font-normal text-[#6d35d8]">Une seule destination.</em></> : <>Many networks.<br /><em className="font-serif font-normal text-[#6d35d8]">One destination.</em></>}</h2>
              <p className="mt-6 max-w-[520px] text-[15px] leading-7 text-[#5e5766]">{isFrench ? 'Envoyer de l’argent ne devrait pas dépendre du réseau utilisé par votre proche. SendFlow imagine un passage plus simple, plus lisible et plus direct.' : 'Sending money should not depend on the network your loved one uses. SendFlow imagines a simpler, clearer, more direct path.'}</p>
            </div>
            <div className="reveal mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: { fr: 'Transfert inter-réseaux', en: 'Cross-network transfers' }, text: { fr: 'Relier les réseaux sans demander au bénéficiaire de changer ses habitudes.', en: 'Connect networks without asking recipients to change their habits.' }, icon: ArrowRight },
                { title: { fr: 'Transfert international', en: 'International transfers' }, text: { fr: 'Explorer les chemins possibles entre pays africains, lorsque disponibles.', en: 'Explore possible routes across African countries where available.' }, icon: Globe2 },
                { title: { fr: 'Suivi des transactions', en: 'Transaction tracking' }, text: { fr: 'Voir où en est chaque étape avant de confirmer.', en: 'See where each step stands before confirming.' }, icon: Check },
                { title: { fr: 'Expérience simple', en: 'Simple experience' }, text: { fr: 'Moins de friction, plus de confiance dans chaque choix.', en: 'Less friction, more confidence in every choice.' }, icon: Sparkles },
              ].map((feature) => <div key={feature.title.fr} className="group min-h-[220px] rounded-[24px] border border-[#2d2535]/10 bg-[#fbf8ef] p-5 shadow-[0_15px_45px_rgba(58,38,83,.05)] transition-transform hover:-translate-y-1 sm:p-6"><feature.icon className="text-[#6d35d8] transition-transform group-hover:rotate-12" size={21} /><h3 className="mt-16 text-[17px] font-semibold tracking-[-.03em]">{t(feature.title, language)}</h3><p className="mt-3 text-[13px] leading-5 text-[#5e5766]">{t(feature.text, language)}</p></div>)}
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
              <div><p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#e8cd4d]">01 / {isFrench ? 'Le chemin' : 'The path'}</p><h2 className="mt-5 max-w-[360px] text-4xl font-semibold leading-[.96] tracking-[-.065em] sm:text-6xl">{isFrench ? <>Un passage<br /><em className="font-serif font-normal text-[#9adacb]">simple.</em></> : <>One clear<br /><em className="font-serif font-normal text-[#9adacb]">passage.</em></>}</h2><p className="mt-7 max-w-[310px] text-[15px] leading-7 text-[#bcb6c5]">{isFrench ? 'Le réseau ne devrait jamais être votre problème. SendFlow rend chaque étape visible, du premier clic au dernier.' : 'The network should never be your problem. SendFlow makes every step visible, from first click to last.'}</p></div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[{ n: '01', title: { fr: 'Choisissez', en: 'Choose' }, text: { fr: 'Votre pays, votre réseau, votre destination.', en: 'Your country, your network, your destination.' }, icon: Globe2 }, { n: '02', title: { fr: 'Vérifiez', en: 'Check' }, text: { fr: 'Le montant et le chemin, sans surprise.', en: 'The amount and the path, no surprises.' }, icon: Sparkles }, { n: '03', title: { fr: 'Envoyez', en: 'Send' }, text: { fr: 'Un dernier regard. Puis, c’est parti.', en: 'One last look. Then, it moves.' }, icon: ArrowDownRight }].map((step) => <div key={step.n} className="group rounded-[24px] border border-[#fbf8ef]/15 bg-[#2b2638] p-5 transition-colors hover:border-[#9adacb]/60 sm:p-6"><div className="flex items-start justify-between"><span className="text-[11px] font-bold text-[#9adacb]">{step.n}</span><step.icon size={19} className="text-[#e8cd4d] transition-transform group-hover:rotate-12" /></div><h3 className="mt-20 text-xl font-semibold tracking-[-.04em]">{t(step.title, language)}</h3><p className="mt-3 text-[13px] leading-5 text-[#bcb6c5]">{t(step.text, language)}</p></div>)}</div>
            </div>
            <div className="reveal mt-20 grid items-center gap-8 border-t border-[#fbf8ef]/15 pt-7 sm:grid-cols-[1fr_auto]"><div className="flex items-center gap-4"><div className="flex -space-x-2"><span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#211d2c] bg-[#e8cd4d] text-[10px] font-bold">CI</span><span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#211d2c] bg-[#9adacb] text-[10px] font-bold">SN</span><span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#211d2c] bg-[#b69de5] text-[10px] font-bold">GH</span></div><p className="text-[12px] text-[#bcb6c5]">{isFrench ? 'Une idée née entre plusieurs rives.' : 'An idea born between several shores.'}</p></div><span className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#e8cd4d]">A demo, not a promise</span></div>
          </div>
        </section>

        <section id="features" className="px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-[1240px]">
            <div className="reveal flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#6d35d8]">02 / {isFrench ? 'Voir plus loin' : 'See further'}</p><h2 className="mt-4 max-w-[650px] text-4xl font-semibold leading-[.96] tracking-[-.065em] sm:text-6xl">{isFrench ? <>Votre argent,<br /><em className="font-serif font-normal text-[#6d35d8]">sans frontières mentales.</em></> : <>Your money,<br /><em className="font-serif font-normal text-[#6d35d8]">without mental borders.</em></>}</h2></div><p className="max-w-[280px] text-[14px] leading-6 text-[#5e5766]">{isFrench ? 'Explorez une couverture fictive et les connexions qui donnent vie à SendFlow.' : 'Explore illustrative coverage and the connections that bring SendFlow to life.'}</p></div>
            <div id="international" className="reveal mt-12 grid gap-4 lg:grid-cols-[.82fr_1.18fr]">
              <div className="rounded-[28px] bg-[#e8cd4d] p-6 sm:p-8"><div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[.14em]">{isFrench ? 'Couverture démo' : 'Demo coverage'}</span><span className="rounded-full bg-[#211d2c]/10 px-3 py-1 text-[10px] font-bold">{countries.length} pays</span></div><div className="mt-10 text-[clamp(3.5rem,8vw,6.5rem)] font-semibold leading-[.8] tracking-[-.09em]">4<span className="font-serif font-normal text-[#6d35d8]">.</span></div><p className="mt-6 max-w-[240px] text-[14px] leading-6 text-[#211d2c]/70">{isFrench ? 'Des premiers chemins pour tester une idée plus vaste.' : 'First paths to test a bigger idea.'}</p><div className="mt-10 flex flex-wrap gap-2">{countries.map((country) => <button key={country.code} onClick={() => setSelectedCountry(country)} className={`rounded-full border px-3 py-2 text-[11px] font-bold transition-all ${selectedCountry.code === country.code ? 'border-[#211d2c] bg-[#211d2c] text-[#fbf8ef]' : 'border-[#211d2c]/20 hover:border-[#211d2c]'}`} data-testid={`button-country-${country.code}`}>{country.code}</button>)}</div></div>
              <div className="rounded-[28px] border border-[#2d2535]/10 bg-[#fbf8ef] p-6 shadow-[0_15px_45px_rgba(58,38,83,.06)] sm:p-8"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#8d8792]">{isFrench ? 'Chemin actif' : 'Active path'}</p><h3 className="mt-2 text-3xl font-semibold tracking-[-.06em]">{selectedCountry.name}</h3></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl text-[11px] font-bold" style={{ backgroundColor: selectedCountry.tone }}>{selectedCountry.code}</span></div><div className="mt-10 space-y-3">{displayNetworks.map((network, index) => <div key={network} className="flex items-center gap-3"><span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#f0ece3] text-[10px] font-bold text-[#6d35d8]">{index + 1}{index < displayNetworks.length - 1 && <span className="absolute left-1/2 top-8 h-3 w-px bg-[#d6d0c7]" />}</span><div className="flex-1 rounded-xl border border-[#2d2535]/10 px-4 py-3 text-[13px] font-semibold">{network}</div>{index < displayNetworks.length - 1 && <ArrowRight size={15} className="text-[#b1abb4]" />}</div>)}</div><div className="mt-9 flex items-center gap-2 border-t border-[#2d2535]/10 pt-5 text-[11px] text-[#8d8792]"><Check size={14} className="text-[#6d35d8]" /> {isFrench ? 'Parcours illustratif · Pas de transaction' : 'Illustrative path · No transaction'}</div></div>
            </div>
          </div>
        </section>

        <section id="security" className="overflow-hidden bg-[#d7eee8] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto grid max-w-[1240px] items-center gap-14 lg:grid-cols-[.9fr_1.1fr]">
            <div className="reveal relative min-h-[300px]">
              <div className="absolute left-[12%] top-[15%] h-[210px] w-[210px] rounded-full border border-[#6d35d8]/25 sm:h-[290px] sm:w-[290px]" />
              <div className="absolute left-[20%] top-[23%] h-[165px] w-[165px] rounded-full border border-[#6d35d8]/25 sm:h-[225px] sm:w-[225px]" />
              <div className="absolute left-[30%] top-[34%] flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#6d35d8] text-[#fbf8ef] shadow-[0_18px_35px_rgba(109,53,216,.25)] sm:h-32 sm:w-32"><LockKeyhole size={34} strokeWidth={1.5} /></div>
              <div className="float-art absolute right-[9%] top-[8%] rounded-2xl bg-[#fbf8ef] p-4 shadow-lg"><ShieldCheck className="text-[#6d35d8]" size={24} /><span className="mt-2 block text-[10px] font-bold">{isFrench ? 'visible' : 'visible'}</span></div>
              <div className="absolute bottom-[4%] left-[3%] rounded-2xl bg-[#211d2c] px-4 py-3 text-[11px] text-[#fbf8ef] shadow-lg"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#9adacb]" />{isFrench ? 'En contrôle' : 'In control'}</div>
            </div>
            <div className="reveal"><p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#6d35d8]">03 / {isFrench ? 'La confiance' : 'Trust'}</p><h2 className="mt-5 max-w-[600px] text-4xl font-semibold leading-[.94] tracking-[-.065em] sm:text-6xl">{isFrench ? <>Chaque étape<br /><em className="font-serif font-normal text-[#6d35d8]">à découvert.</em></> : <>Every step,<br /><em className="font-serif font-normal text-[#6d35d8]">in the clear.</em></>}</h2><p className="mt-7 max-w-[450px] text-[16px] leading-7 text-[#5e5766]">{isFrench ? 'Le calme vient de ce que l’on comprend. SendFlow rend les détails lisibles, les choix explicites et le contrôle toujours à portée de main.' : 'Calm comes from understanding. SendFlow makes details readable, choices explicit, and control always within reach.'}</p><div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-[#6d35d8]/15 bg-[#fbf8ef]/50 p-4"><LockKeyhole size={18} className="text-[#6d35d8]" /><h3 className="mt-7 text-[14px] font-bold">{isFrench ? 'Détails visibles' : 'Visible details'}</h3><p className="mt-2 text-[12px] leading-5 text-[#5e5766]">{isFrench ? 'Comprendre avant de confirmer.' : 'Understand before you confirm.'}</p></div><div className="rounded-2xl border border-[#6d35d8]/15 bg-[#fbf8ef]/50 p-4"><ShieldCheck size={18} className="text-[#6d35d8]" /><h3 className="mt-7 text-[14px] font-bold">{isFrench ? 'Pensé privé' : 'Privacy-minded'}</h3><p className="mt-2 text-[12px] leading-5 text-[#5e5766]">{isFrench ? 'Moins de données, plus de sérénité.' : 'Less data, more peace of mind.'}</p></div></div></div>
          </div>
        </section>

        <section id="about" className="overflow-hidden border-b border-[#2d2535]/10 py-6"><div className="marquee-track flex w-max items-center gap-10 whitespace-nowrap text-[11px] font-bold uppercase tracking-[.16em] text-[#8d8792]"><span>Mobile Money, made human</span><span className="text-[#6d35d8]">·</span><span>Du réseau à la destination</span><span className="text-[#6d35d8]">·</span><span>Mobile Money, made human</span><span className="text-[#6d35d8]">·</span><span>Du réseau à la destination</span><span className="text-[#6d35d8]">·</span><span>Mobile Money, made human</span></div></section>

        <section id="faq" className="px-5 py-24 sm:px-8 sm:py-32"><div className="mx-auto grid max-w-[1040px] gap-14 lg:grid-cols-[.7fr_1.3fr]"><div className="reveal"><p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#6d35d8]">04 / {isFrench ? 'Les détails' : 'The details'}</p><h2 className="mt-5 text-5xl font-semibold leading-[.92] tracking-[-.07em] sm:text-7xl">{isFrench ? <>Vous avez<br /><em className="font-serif font-normal text-[#6d35d8]">raison.</em></> : <>Good<br /><em className="font-serif font-normal text-[#6d35d8]">questions.</em></>}</h2><p className="mt-7 max-w-[260px] text-[14px] leading-6 text-[#5e5766]">{isFrench ? 'Une idée nouvelle mérite des réponses simples.' : 'A new idea deserves simple answers.'}</p></div><div className="reveal space-y-2">{faqs.map((faq, index) => <div key={index} className="border-b border-[#2d2535]/15"><button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between py-5 text-left text-[16px] font-semibold tracking-[-.025em]" data-testid={`button-faq-${index}`}><span>{t(faq.q, language)}</span><ChevronDown size={18} className={`shrink-0 text-[#6d35d8] transition-transform ${openFaq === index ? 'rotate-180' : ''}`} /></button><div className={`grid transition-[grid-template-rows] duration-300 ${openFaq === index ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}><div className="overflow-hidden"><p className="pb-5 pr-8 text-[13px] leading-6 text-[#5e5766]">{t(faq.a, language)}</p></div></div></div>)}</div></div></section>

        <section id="join" className="px-5 pb-24 sm:px-8 sm:pb-32"><div className="reveal relative mx-auto max-w-[1240px] overflow-hidden rounded-[32px] bg-[#6d35d8] px-6 py-14 text-[#fbf8ef] sm:px-14 sm:py-20"><div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-[#fbf8ef]/20" /><div className="absolute -right-2 -top-10 h-48 w-48 rounded-full border border-[#fbf8ef]/15" /><div className="relative max-w-[620px]"><p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#e8cd4d]">The next move</p><h2 className="mt-5 text-5xl font-semibold leading-[.9] tracking-[-.07em] sm:text-7xl">{isFrench ? <>Prêt·e à faire<br /><em className="font-serif font-normal text-[#e8cd4d]">bouger les choses ?</em></> : <>Ready to<br /><em className="font-serif font-normal text-[#e8cd4d]">move things?</em></>}</h2><p className="mt-7 max-w-[440px] text-[15px] leading-6 text-[#e7dcfb]">{isFrench ? 'Recevez les prochaines nouvelles de SendFlow. Pas de bruit, juste les avancées.' : 'Get the next SendFlow updates. No noise, just progress.'}</p><form onSubmit={(event) => { event.preventDefault(); if (email) setSubmitted(true); }} className="mt-8 flex max-w-[480px] flex-col gap-2 sm:flex-row"><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder={isFrench ? 'votre@email.com' : 'your@email.com'} className="min-w-0 flex-1 rounded-full border border-[#fbf8ef]/20 bg-[#fbf8ef]/10 px-5 py-3.5 text-[13px] outline-none placeholder:text-[#d5c8f0] focus:border-[#e8cd4d]" data-testid="input-email" /><button type="submit" className="rounded-full bg-[#e8cd4d] px-5 py-3.5 text-[13px] font-bold text-[#211d2c] transition-transform hover:-translate-y-0.5" data-testid="button-submit-email">{submitted ? <><Check className="mr-1 inline" size={14} />{isFrench ? 'C’est noté' : 'You’re on it'}</> : <>{isFrench ? 'Me tenir au courant' : 'Keep me posted'} <ArrowRight className="ml-1 inline" size={14} /></>}</button></form><p className="mt-4 text-[10px] text-[#d5c8f0]">{isFrench ? 'Démo uniquement · Aucun engagement' : 'Demo only · No commitment'}</p></div></div></section>
        <section id="download" className="px-5 pb-24 sm:px-8 sm:pb-32">
          <div className="reveal relative mx-auto max-w-[1240px] overflow-hidden rounded-[32px] bg-[#6d35d8] px-6 py-14 text-[#fbf8ef] sm:px-14 sm:py-20">
            <p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#e8cd4d]">{isFrench ? 'Le prochain mouvement' : 'The next move'}</p>
            <h2 className="mt-5 max-w-[760px] text-5xl font-semibold leading-[.9] tracking-[-.07em] sm:text-7xl">{isFrench ? <>Votre prochain transfert<br /><em className="font-serif font-normal text-[#e8cd4d]">commence ici.</em></> : <>Your next transfer<br /><em className="font-serif font-normal text-[#e8cd4d]">starts here.</em></>}</h2>
            <p className="mt-7 max-w-[480px] text-[15px] leading-6 text-[#e7dcfb]">{isFrench ? 'Téléchargez bientôt l’application SendFlow et simplifiez vos transferts entre réseaux.' : 'Download the SendFlow app soon and simplify transfers across networks.'}</p>
            <button onClick={() => setSubmitted(true)} className="mt-8 rounded-full bg-[#e8cd4d] px-5 py-3.5 text-[13px] font-bold text-[#211d2c] transition-transform hover:-translate-y-0.5" data-testid="button-download-placeholder">{isFrench ? 'Télécharger l’application' : 'Download the app'} <ArrowRight className="ml-2 inline" size={15} /></button>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-xl border border-[#fbf8ef]/25 px-3 py-2 text-[11px] font-semibold text-[#f4edff]">Google Play · bientôt</span>
              <span className="rounded-xl border border-[#fbf8ef]/25 px-3 py-2 text-[11px] font-semibold text-[#f4edff]">App Store · bientôt</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#211d2c] px-5 py-12 text-[#fbf8ef] sm:px-8 sm:py-16"><div className="mx-auto max-w-[1240px]"><div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_.6fr_.6fr_.8fr]"><div><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8cd4d] text-[#211d2c]"><ArrowDownRight size={17} strokeWidth={2.5} /></span><span className="text-[17px] font-bold tracking-[-.045em]">sendflow<span className="text-[#e8cd4d]">.</span></span></div><p className="mt-6 max-w-[280px] text-[13px] leading-6 text-[#bcb6c5]">{isFrench ? 'Une vision plus calme des mouvements d’argent en Afrique.' : 'A calmer vision for moving money across Africa.'}</p></div><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#9adacb]">{isFrench ? 'Explorer' : 'Explore'}</p><div className="mt-5 flex flex-col gap-3 text-[13px] text-[#bcb6c5]">{navItems.slice(0, 3).map((item) => <button key={item.id} onClick={() => goTo(item.id)} className="w-fit transition-colors hover:text-[#e8cd4d]" data-testid={`link-footer-${item.id}`}>{t(item.label, language)}</button>)}</div></div><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#9adacb]">{isFrench ? 'Projet' : 'Project'}</p><div className="mt-5 flex flex-col gap-3 text-[13px] text-[#bcb6c5]"><button onClick={() => goTo('security')} className="w-fit hover:text-[#e8cd4d]" data-testid="link-footer-security">{isFrench ? 'Notre approche' : 'Our approach'}</button><button onClick={() => goTo('faq')} className="w-fit hover:text-[#e8cd4d]" data-testid="link-footer-faq">{isFrench ? 'Questions' : 'Questions'}</button><button onClick={() => goTo('join')} className="w-fit hover:text-[#e8cd4d]" data-testid="link-footer-join">{isFrench ? 'Contact' : 'Contact'}</button></div></div><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#9adacb]">{isFrench ? 'Statut' : 'Status'}</p><div className="mt-5 flex items-center gap-2 text-[13px] text-[#bcb6c5]"><span className="h-2 w-2 rounded-full bg-[#9adacb]" />{isFrench ? 'Démo en évolution' : 'Demo in progress'}</div><button onClick={() => setLanguage(isFrench ? 'en' : 'fr')} className="mt-5 flex items-center gap-2 text-[12px] font-semibold text-[#e8cd4d]" data-testid="button-footer-language"><Globe2 size={14} /> {isFrench ? 'English version' : 'Version française'}</button></div></div><div className="mt-14 flex flex-col justify-between gap-4 border-t border-[#fbf8ef]/15 pt-5 text-[10px] text-[#8d8792] sm:flex-row"><span>© 2025 SendFlow Studio. {isFrench ? 'Projet conceptuel.' : 'Concept project.'}</span><span className="flex gap-4"><span>{isFrench ? 'Confidentialité' : 'Privacy'}</span><span>{isFrench ? 'Mentions' : 'Legal'}</span></span></div></div></footer>
    </div>
  );
}

export default App;