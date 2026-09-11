import { useState } from 'react';
import { Link } from 'wouter';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';

type LegalPage = {
  slug: string;
  titleFr: string;
  titleEn: string;
  introFr: string;
  introEn: string;
};

type LegalSection = {
  sectionNumber: number;
  titleFr: string;
  titleEn: string;
  bodyFr: string;
  bodyEn: string;
};

type LegalSettings = {
  companyName: string;
  legalForm: string;
  legalAddress: string;
  legalEmail: string;
};

export function EditableLegalPage({
  page,
  sections,
  settings,
}: {
  page: LegalPage;
  sections: LegalSection[];
  settings: LegalSettings | null;
}) {
  const [locale, setLocale] = useState<'fr' | 'en'>('fr');
  const isFrench = locale === 'fr';
  const companyName = settings?.companyName || 'Flow Digital SARL';
  const address = settings?.legalAddress || 'Côte d’Ivoire, Abidjan, Cocody Riviera Palmeraie';
  const email = settings?.legalEmail || 'support@sendflow.studio';
  const title = isFrench ? page.titleFr : page.titleEn;
  const intro = isFrench ? page.introFr : page.introEn;

  return (
    <div className="min-h-screen bg-[#f7f3e9] text-[#17131f]">
      <header className="sticky top-0 z-40 border-b border-[#2d2535]/10 bg-[#f7f3e9]/90 px-5 py-4 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-[1060px] items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2" aria-label="Retour à SendFlow">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-[#6d35d8]/20"><img src={sendflowMark} alt="" className="h-8 w-7 object-contain" /></span>
            <img src={sendflowWordmark} alt="SendFlow" className="h-6 w-auto object-contain" />
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setLocale(isFrench ? 'en' : 'fr')} className="rounded-full border border-[#6d35d8]/25 bg-white px-3 py-2 text-[11px] font-bold">{isFrench ? 'EN' : 'FR'}</button>
            <Link href="/" className="inline-flex min-w-[164px] items-center justify-center rounded-full bg-[#6d35d8] px-5 py-2.5 text-center text-[12px] font-extrabold text-white">Retour à l’accueil</Link>
          </div>
        </div>
      </header>
      <main className="px-5 py-12 sm:px-8 sm:py-20">
        <article className="mx-auto max-w-[900px]">
          <div className="mb-10 max-w-[760px]">
            <p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-[#6d35d8]">SendFlow · {isFrench ? 'Document légal' : 'Legal document'}</p>
            <h1 className="mt-4 whitespace-pre-line text-5xl font-extrabold leading-[.9] tracking-[-.075em] sm:text-7xl">{title}</h1>
            <p className="mt-7 text-[17px] font-semibold leading-7 text-[#40384c]">{intro}</p>
          </div>
          <div className="rounded-2xl border border-[#e8cd4d]/70 bg-[#fff8d9] px-5 py-4 text-[13px] leading-6 text-[#5b4810]">
            <strong>{isFrench ? 'Document informatif à faire valider :' : 'Informational document to be reviewed:'}</strong>{' '}
            {isFrench ? 'Cette page constitue une base éditoriale administrable et doit être validée avant le lancement commercial.' : 'This page is an editable editorial baseline and must be reviewed before commercial launch.'}
          </div>
          <div className="mt-12 space-y-12">
            {sections.map((section) => (
              <section key={`${section.sectionNumber}-${section.titleFr}`} className="border-t border-[#2d2535]/10 pt-8">
                <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#6d35d8]">{String(section.sectionNumber).padStart(2, '0')}</p>
                <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-[-.04em] sm:text-3xl">{isFrench ? section.titleFr : section.titleEn}</h2>
                <div className="mt-5 space-y-4 text-[15px] leading-7 text-[#40384c]">
                  {(isFrench ? section.bodyFr : section.bodyEn).split(/\n{2,}/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-12 border-t border-[#2d2535]/10 pt-6 text-sm leading-6 text-[#40384c]">
            <p><strong>{companyName}</strong> · {settings?.legalForm || 'Société à responsabilité limitée'}</p>
            <p>{address}</p>
            <a href={`mailto:${email}`} className="font-bold text-[#5b21b6] underline">{email}</a>
          </div>
        </article>
      </main>
      <footer className="border-t border-[#2d2535]/10 bg-[#211d2c] px-5 py-10 text-[#fbf8ef] sm:px-8">
        <div className="mx-auto flex max-w-[900px] flex-wrap gap-4 text-[12px]">
          <Link href="/" className="text-[#e8cd4d]">Accueil</Link>
          <Link href="/conditions-utilisation">Conditions</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
        </div>
      </footer>
    </div>
  );
}
