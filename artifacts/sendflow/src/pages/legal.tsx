import type { ReactNode } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';
import { useLocation } from 'wouter';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import { avatarBank } from '@/lib/avatar-bank';

const legalCompanyDetails = {
  name: 'Flow Digital SARL',
  legalForm: 'Société à responsabilité limitée',
  address: 'Côte d’Ivoire, Abidjan, Cocody Riviera Palmeraie',
  email: 'support@sendflow.studio',
} as const;

type LegalSectionProps = {
  number: string;
  title: string;
  children: ReactNode;
};

export type LegalPageProps = {
  supportEmail?: string | null;
};

function normalizeSupportEmail(value?: string | null): string {
  return value?.trim() || legalCompanyDetails.email;
}

function toRomanNumeral(value: string): string {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 3999) return value;

  const numerals: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let remaining = number;
  let result = '';

  numerals.forEach(([unit, numeral]) => {
    while (remaining >= unit) {
      result += numeral;
      remaining -= unit;
    }
  });

  return result;
}

function LegalSection({ number, title, children }: LegalSectionProps) {
  return (
    <section className="scroll-mt-28 border-t border-[#2d2535]/10 pt-8" data-section-number={toRomanNumeral(number)}>
      <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#6d35d8]">{number}</p>
      <h2 data-section-number={toRomanNumeral(number)} className="mt-3 text-2xl font-extrabold leading-tight tracking-[-.04em] text-[#17131f] sm:text-3xl">{title}</h2>
      <div className="mt-5 space-y-4 text-[15px] leading-7 text-[#40384c]">{children}</div>
    </section>
  );
}

function LegalBulletList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-[#6d35d8]">{children}</ul>;
}

function LegalNotice() {
  return (
    <div className="rounded-2xl border border-[#e8cd4d]/70 bg-[#fff8d9] px-5 py-4 text-[13px] leading-6 text-[#5b4810] shadow-[0_10px_24px_rgba(80,60,10,.06)]">
      <strong className="font-extrabold">Document informatif à faire valider :</strong> cette page constitue une base de travail générale pour le projet SendFlow. Elle ne remplace pas un audit ni un avis juridique personnalisé. Les obligations applicables doivent être confirmées avec un conseil qualifié en Côte d’Ivoire et dans chaque pays où le service sera effectivement déployé.
    </div>
  );
}

function LegalLayout({ title, eyebrow, intro, supportEmail, children }: { title: string; eyebrow: string; intro: string; supportEmail?: string | null; children: ReactNode }) {
  const contactEmail = normalizeSupportEmail(supportEmail);
  return (
    <div className="min-h-screen bg-[#f7f3e9] text-[#17131f]">
      <header className="sticky top-0 z-40 border-b border-[#2d2535]/10 bg-[#f7f3e9]/90 px-5 py-4 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-[1060px] items-center justify-between gap-4">
          <Link href="/sign-in" className="flex items-center gap-2" aria-label="Retour à SendFlow">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-[#6d35d8]/20">
              <img src={sendflowMark} alt="" className="h-8 w-7 object-contain" />
            </span>
            <img src={sendflowWordmark} alt="SendFlow" className="h-6 w-auto object-contain" />
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex min-w-[164px] items-center justify-center rounded-full border border-[#6d35d8] bg-[#6d35d8] px-5 py-2.5 text-center text-[12px] font-extrabold text-white shadow-[0_8px_18px_rgba(109,53,216,.2)] transition-all hover:border-[#5421b8] hover:bg-[#5421b8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d35d8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f3e9]"
          >
            Retour à la connexion
          </Link>
        </div>
      </header>

      <main className="px-5 py-12 sm:px-8 sm:py-20">
        <article className="mx-auto max-w-[900px]">
          <div className="mb-10 max-w-[760px]">
            <p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-[#6d35d8]">{eyebrow}</p>
            <h1 className="mt-4 text-5xl font-extrabold leading-[.9] tracking-[-.075em] text-[#17131f] sm:text-7xl">{title}</h1>
            <p className="mt-7 text-[17px] font-semibold leading-7 text-[#40384c]">{intro}</p>
          </div>

          <LegalNotice />

          <div className="mt-12 space-y-12">
            {children}
          </div>
        </article>
      </main>

      <footer className="border-t border-[#2d2535]/10 bg-[#211d2c] px-5 py-10 text-[#fbf8ef] sm:px-8">
        <div className="mx-auto flex max-w-[900px] flex-col gap-6 text-[12px] sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[470px] leading-5 text-[#c9c0d6]">Flow Digital SARL · Côte d’Ivoire · Abidjan, Cocody Riviera Palmeraie</p>
          <div className="flex flex-wrap gap-4 font-bold">
            <Link href="/sign-in" className="text-[#e8cd4d] hover:underline">Connexion</Link>
            <Link href="/conditions-utilisation" className="hover:text-[#e8cd4d]">Conditions</Link>
            <Link href="/confidentialite" className="hover:text-[#e8cd4d]">Confidentialité</Link>
            <Link href="/mentions-legales" className="hover:text-[#e8cd4d]">Mentions légales</Link>
            <a href={`mailto:${contactEmail}`} className="hover:text-[#e8cd4d]">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PrivacyLayout({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const heroAvatars = avatarBank.slice(0, 5);

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    setLocation('/sign-in');
  };

  return (
    <div className="sendflow-privacy-page">
      <header className="sendflow-privacy-header">
        <div className="sendflow-privacy-topbar">
          <button type="button" className="sendflow-privacy-icon-button" onClick={handleBack} aria-label="Retour">
            <ArrowLeft size={24} strokeWidth={1.9} />
          </button>
          <h1>Politique de confidentialité</h1>
          <button type="button" className="sendflow-privacy-icon-button is-refresh" onClick={() => window.location.reload()} aria-label="Actualiser la page">
            <RefreshCw size={23} strokeWidth={2.1} />
          </button>
        </div>

        <div className="sendflow-privacy-brandbar">
          <Link href="/sign-in" className="sendflow-privacy-brand" aria-label="Retour à SendFlow">
            <img src={sendflowMark} alt="" />
            <img src={sendflowWordmark} alt="SendFlow" />
          </Link>
          <Link href="/sign-up" className="sendflow-privacy-download">Télécharger l&apos;app</Link>
        </div>
      </header>

      <main className="sendflow-privacy-main">
        <article className="sendflow-privacy-article">
          <div className="sendflow-privacy-hero">
            <div className="sendflow-privacy-hero-copy">
              <p className="sendflow-privacy-eyebrow">SendFlow · Données personnelles</p>
              <h2 className="sendflow-privacy-title">Politique de confidentialité</h2>
              <p className="sendflow-privacy-date">Version de travail · 10 septembre 2026</p>
              <p className="sendflow-privacy-lead">Une explication claire de la manière dont SendFlow utilise, protège et conserve les informations nécessaires à ses services.</p>
            </div>
            <div className="sendflow-privacy-avatar-cloud" aria-hidden="true">
              {heroAvatars.map((avatar, index) => (
                <img key={avatar.id} src={avatar.src} alt="" className={`is-avatar-${index + 1}`} />
              ))}
            </div>
          </div>

          <div className="sendflow-privacy-notice">
            <span className="sendflow-privacy-notice-mark" aria-hidden="true">i</span>
            <p><strong>À retenir :</strong> SendFlow ne vous demandera jamais votre code PIN, votre mot de passe ou votre code OTP par e-mail ou par message.</p>
          </div>

          <div className="sendflow-privacy-content">{children}</div>
        </article>
      </main>
    </div>
  );
}

export function LegalMentionsPage({ supportEmail }: LegalPageProps) {
  const contactEmail = normalizeSupportEmail(supportEmail);
  return (
    <LegalLayout
      eyebrow="SendFlow · Éditeur"
      title="Mentions légales"
      intro="Cette page présente l’identité de l’éditeur de SendFlow, les informations de publication, les règles d’utilisation du site et les responsabilités liées aux contenus et aux services proposés."
      supportEmail={supportEmail}
    >
      <LegalSection number="01" title="Éditeur du site">
        <p>Le site SendFlow est édité par <strong>{legalCompanyDetails.name}</strong>, société de droit ivoirien, exploitant la marque et le projet technologique SendFlow.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#e6def3] bg-white px-5 py-4 shadow-[0_10px_30px_rgba(58,38,83,.05)]">
            <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#6d35d8]">Dénomination</p>
            <p className="mt-2 text-[15px] font-bold leading-6 text-[#211d2c]">{legalCompanyDetails.name}</p>
          </div>
          <div className="rounded-2xl border border-[#e6def3] bg-white px-5 py-4 shadow-[0_10px_30px_rgba(58,38,83,.05)]">
            <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#6d35d8]">Forme juridique</p>
            <p className="mt-2 text-[15px] font-bold leading-6 text-[#211d2c]">{legalCompanyDetails.legalForm}</p>
          </div>
          <div className="rounded-2xl border border-[#e6def3] bg-white px-5 py-4 shadow-[0_10px_30px_rgba(58,38,83,.05)]">
            <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#6d35d8]">Siège social</p>
            <p className="mt-2 text-[15px] font-bold leading-6 text-[#211d2c]">{legalCompanyDetails.address}</p>
          </div>
          <div className="rounded-2xl border border-[#e6def3] bg-white px-5 py-4 shadow-[0_10px_30px_rgba(58,38,83,.05)]">
            <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#6d35d8]">Adresse électronique</p>
            <a className="mt-2 block break-all text-[15px] font-bold leading-6 text-[#5b21b6] underline decoration-[#cbb6f3] underline-offset-4" href={`mailto:${contactEmail}`} data-testid="link-legal-support-email">{contactEmail}</a>
          </div>
        </div>
      </LegalSection>

      <LegalSection number="02" title="Directeur de la publication">
        <p><strong>Directeur de la publication :</strong> à compléter avec le nom et la qualité de la personne légalement désignée par Flow Digital SARL.</p>
        <p>La désignation du directeur de la publication doit être vérifiée au regard de la forme sociale de l’éditeur, du pays de publication, des règles applicables aux communications électroniques et de l’organisation réelle de Flow Digital SARL.</p>
      </LegalSection>

      <LegalSection number="03" title="Hébergement et infrastructure technique">
        <p>Le site SendFlow est déployé sur une infrastructure technique dont l’hébergeur, l’adresse et les coordonnées doivent être reportés ici à partir du contrat ou de la facture d’hébergement en production.</p>
        <div className="rounded-2xl border border-[#2d2535]/10 bg-white px-5 py-5 text-[14px] leading-7 shadow-[0_10px_30px_rgba(58,38,83,.05)]">
          <p><strong>Hébergeur :</strong> à confirmer avant publication définitive</p>
          <p><strong>Adresse de l’hébergeur :</strong> à confirmer</p>
          <p><strong>Téléphone / contact juridique :</strong> à confirmer</p>
          <p><strong>Région ou pays de stockage :</strong> à confirmer selon l’architecture effectivement déployée</p>
        </div>
        <p>Les coordonnées de l’hébergeur ne doivent pas être devinées à partir d’un outil de développement, d’un fournisseur temporaire ou d’une adresse technique. Elles doivent correspondre à l’infrastructure qui sert réellement le site au public.</p>
      </LegalSection>

      <LegalSection number="04" title="Objet du site">
        <p>SendFlow présente une solution technologique conçue pour simplifier la compréhension, la préparation et le suivi de transferts d’argent entre réseaux de paiement et opérateurs de mobile money, en Afrique et, lorsque cela est disponible, entre plusieurs pays.</p>
        <p>Les pages publiques peuvent contenir des informations de présentation, des illustrations, des démonstrations, des cartes de couverture, des indications de réseaux et des formulaires de contact. Une démonstration ou une indication de couverture ne constitue pas une promesse de disponibilité commerciale, de délai ou de prix.</p>
      </LegalSection>

      <LegalSection number="05" title="Statut de SendFlow et services réglementés">
        <p>Sauf mention contraire dans une convention ou un parcours particulier, SendFlow est une interface technologique et ne se présente pas comme une banque, un établissement de monnaie électronique, un opérateur de télécommunications ou un service autonome de conservation de fonds.</p>
        <p>Les opérations de paiement, de transfert, de change, de conservation, de remise des fonds ou de vérification peuvent relever d’un opérateur, d’une banque, d’un établissement de paiement ou d’un autre partenaire autorisé dans le territoire concerné. Le partenaire réellement impliqué doit être identifié dans les conditions du parcours avant une mise en production.</p>
        <p>Aucune mention présente sur le site ne doit être interprétée comme une déclaration d’agrément de Flow Digital SARL. Les autorisations, licences, partenariats et obligations applicables doivent être confirmés séparément avant l’ouverture commerciale.</p>
      </LegalSection>

      <LegalSection number="06" title="Accès et disponibilité">
        <p>Flow Digital SARL s’efforce de maintenir un site accessible, sécurisé et à jour. L’accès peut toutefois être interrompu pour maintenance, mise à niveau, correction d’un risque, panne, indisponibilité d’un fournisseur, incident de réseau, décision d’une autorité ou événement indépendant de la volonté de l’éditeur.</p>
        <p>Les informations publiées peuvent être modifiées, suspendues ou retirées sans préavis lorsqu’une correction, une évolution réglementaire, une contrainte de partenaire ou un impératif de sécurité le justifie. La disponibilité de l’application peut dépendre de contraintes techniques, réglementaires ou liées aux partenaires de paiement.</p>
      </LegalSection>

      <LegalSection number="07" title="Propriété intellectuelle">
        <p>La structure du site, les textes, la marque SendFlow, le nom Flow Digital, les logos, les éléments graphiques, les illustrations, les animations, les interfaces, les composants logiciels et les bases de données sont protégés par les règles applicables de propriété intellectuelle.</p>
        <p>Sauf mention d’un titulaire différent, ces éléments appartiennent à Flow Digital SARL ou sont utilisés avec l’autorisation de leur titulaire. Toute reproduction, représentation, adaptation, extraction, réutilisation, diffusion ou exploitation commerciale sans autorisation écrite préalable est interdite.</p>
        <p>Les noms et logos d’opérateurs, banques, réseaux ou partenaires éventuellement visibles sur le site restent la propriété de leurs titulaires respectifs. Leur présence sert uniquement à décrire une compatibilité, une illustration ou un environnement possible et ne crée pas nécessairement un partenariat commercial.</p>
      </LegalSection>

      <LegalSection number="08" title="Images, illustrations et contenus de tiers">
        <p>Les visuels utilisés sur SendFlow peuvent être des créations originales, des éléments commandés, des ressources sous licence ou des contenus fournis par un partenaire. Les crédits et licences doivent être conservés dans le dossier de production et ajoutés sur cette page lorsqu’une licence l’exige.</p>
        <p>Les marques, pictogrammes, drapeaux, logos d’opérateurs et références à des services tiers ne signifient pas que ces tiers valident le contenu du site. Toute erreur de représentation ou demande de retrait peut être adressée à {contactEmail} avec le lien concerné et les justificatifs utiles.</p>
      </LegalSection>

      <LegalSection number="09" title="Responsabilité éditoriale">
        <p>Flow Digital SARL s’efforce de présenter des informations compréhensibles et actualisées. Toutefois, les informations de couverture, de réseau, de disponibilité, de prix, de délai ou de réglementation peuvent évoluer et dépendent parfois d’un partenaire ou d’une autorité.</p>
        <p>Les contenus du site ne constituent pas un conseil financier, juridique, fiscal, bancaire ou réglementaire. Ils ne remplacent pas la lecture des conditions d’un opérateur, d’une banque ou d’un prestataire de paiement, ni l’avis d’un professionnel qualifié.</p>
        <p>L’utilisateur reste responsable de la vérification des informations avant toute décision, inscription ou opération. Les dommages résultant d’une utilisation d’une information ancienne, incomplète ou destinée à une autre zone géographique doivent être appréciés conformément aux règles impératives applicables et aux conditions d’utilisation de SendFlow.</p>
      </LegalSection>

      <LegalSection number="10" title="Liens externes et réseaux sociaux">
        <p>Le site peut contenir des liens vers des sites, plateformes ou réseaux sociaux exploités par des tiers. Flow Digital SARL ne contrôle pas leurs contenus, leurs conditions, leurs cookies, leurs pratiques de sécurité ou leur disponibilité.</p>
        <p>L’ouverture d’un lien externe relève de la responsabilité de l’utilisateur. La présence d’un lien ne vaut ni recommandation générale, ni garantie, ni certification du service tiers. Les utilisateurs doivent consulter les politiques et conditions du site qu’ils visitent.</p>
      </LegalSection>

      <LegalSection number="11" title="Données personnelles">
        <p>Les traitements de données personnelles liés au site et au projet SendFlow sont décrits dans la <Link href="/confidentialite" className="font-bold text-[#5b21b6] underline">Politique de confidentialité</Link>. Les utilisateurs peuvent également consulter les <Link href="/conditions-utilisation" className="font-bold text-[#5b21b6] underline">Conditions générales d’utilisation</Link> pour comprendre les règles applicables à l’utilisation du service.</p>
        <p>Pour exercer une demande ou signaler une difficulté relative aux données personnelles, écrivez à {contactEmail}. Les informations de l’autorité compétente, les formalités et les délais doivent être confirmés par Flow Digital SARL selon le cadre juridique effectivement applicable à la date du lancement.</p>
      </LegalSection>

      <LegalSection number="12" title="Signalement d’un contenu ou d’un comportement illicite">
        <p>Tout utilisateur peut signaler un contenu manifestement illicite, une usurpation de marque, une atteinte à un droit, une tentative de fraude ou un usage abusif du site en écrivant à {contactEmail}.</p>
        <p>Le signalement doit préciser l’identité et le moyen de contact du demandeur, l’adresse ou la référence du contenu, une description précise des faits, les raisons du signalement et tout document utile. Un signalement incomplet peut retarder l’analyse. Flow Digital SARL peut demander des informations complémentaires et transmettre le dossier à un partenaire ou à une autorité lorsque la loi l’exige.</p>
      </LegalSection>

      <LegalSection number="13" title="Droit applicable et juridiction">
        <p>La page de mentions légales est rédigée en français et s’inscrit dans le cadre juridique de l’éditeur établi en Côte d’Ivoire, sous réserve des règles impératives applicables à l’utilisateur, au pays de consultation et aux services de paiement proposés par un partenaire.</p>
        <p>Les réclamations doivent d’abord être adressées à Flow Digital SARL à l’adresse {contactEmail}. À défaut de résolution amiable, les juridictions compétentes d’Abidjan peuvent être saisies, sous réserve des règles impératives de compétence et de protection des consommateurs.</p>
      </LegalSection>

      <LegalSection number="14" title="Mise à jour des mentions">
        <p>Les présentes mentions doivent être maintenues à jour à chaque changement d’identité de l’éditeur, de siège, de directeur de publication, d’hébergeur, de marque, de modèle de service ou de statut réglementaire.</p>
        <p>Les informations affichées sur cette page sont regroupées dans une structure éditable afin de pouvoir être remplacées proprement lorsque les données officielles et les informations de production seront disponibles.</p>
        <p><strong>Version de travail publiée le 10 septembre 2026.</strong></p>
      </LegalSection>
    </LegalLayout>
  );
}

export function TermsPage({ supportEmail }: LegalPageProps) {
  const contactEmail = normalizeSupportEmail(supportEmail);
  return (
    <LegalLayout
      eyebrow="SendFlow · Conditions"
      title="Conditions générales d’utilisation"
      intro="Les présentes conditions encadrent l’accès au site, à l’application et aux fonctionnalités SendFlow proposées par Flow Digital SARL. Elles expliquent ce que SendFlow fait, ce qu’il ne fait pas, les responsabilités de chacun et les règles applicables aux transferts."
      supportEmail={supportEmail}
    >
      <LegalSection number="01" title="Identification de l’éditeur">
        <p>SendFlow est une marque et une solution technologique développées par <strong>Flow Digital SARL</strong>, société établie en Côte d’Ivoire, dont l’adresse officielle de contact est : Abidjan, Cocody Riviera Palmeraie, Côte d’Ivoire.</p>
        <p>Pour toute question relative aux présentes conditions, à l’utilisation du service ou à une réclamation, l’utilisateur peut écrire à <a className="font-bold text-[#5b21b6] underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>. Les informations d’immatriculation, d’agrément et de représentation des partenaires de paiement seront ajoutées ou précisées avant l’ouverture commerciale du service concerné.</p>
      </LegalSection>

      <LegalSection number="02" title="Objet et champ d’application">
        <p>SendFlow fournit une interface numérique destinée à simplifier la compréhension et l’initiation de transferts d’argent entre réseaux de paiement et opérateurs de mobile money, localement ou, lorsque cela est disponible, entre plusieurs pays.</p>
        <p>Les présentes conditions s’appliquent au site, à l’application, aux interfaces de suivi, aux formulaires, aux notifications et à toute fonctionnalité associée à SendFlow. Des conditions particulières peuvent s’appliquer à un pays, à un opérateur, à une banque, à un prestataire de paiement ou à une campagne spécifique. En cas de contradiction, les conditions particulières du service concerné prévalent pour l’opération correspondante.</p>
      </LegalSection>

      <LegalSection number="03" title="Acceptation des conditions">
        <p>L’accès au site et l’utilisation d’une fonctionnalité SendFlow signifient que l’utilisateur a lu et compris les présentes conditions. Lorsqu’un consentement explicite est demandé, l’utilisateur doit l’exprimer avant de poursuivre.</p>
        <p>Si l’utilisateur n’accepte pas ces conditions, il doit cesser d’utiliser le service. L’absence de lecture effective d’une clause ne prive pas celle-ci de son effet lorsque l’utilisateur a pu accéder au document avant l’utilisation du service.</p>
      </LegalSection>

      <LegalSection number="04" title="Description du service et limites de SendFlow">
        <p>SendFlow est une couche technologique de connexion, d’information et de suivi. Sauf indication contraire affichée pour un parcours précis, SendFlow n’est ni une banque, ni un établissement de monnaie électronique, ni un opérateur de télécommunication, ni un wallet autonome.</p>
        <p>La conservation des fonds, l’exécution du paiement, la conversion de devises, la vérification d’identité et la mise à disposition des fonds peuvent être réalisées par des partenaires agréés. L’identité de ces partenaires, leurs conditions, leurs frais et leurs obligations réglementaires peuvent varier selon le pays, le réseau et le montant.</p>
        <LegalBulletList>
          <li>SendFlow ne garantit pas que tous les réseaux ou corridors seront disponibles à tout moment.</li>
          <li>Une indication de disponibilité, de délai ou de frais est susceptible de changer avant la confirmation finale.</li>
          <li>Le statut affiché par SendFlow dépend des informations reçues des partenaires et peut connaître un délai de synchronisation.</li>
          <li>Les conditions du partenaire peuvent compléter ou remplacer certaines informations générales présentées sur SendFlow.</li>
        </LegalBulletList>
      </LegalSection>

      <LegalSection number="05" title="Éligibilité et utilisation personnelle">
        <p>Le service est destiné aux personnes capables de conclure un contrat selon le droit qui leur est applicable. En principe, l’utilisation d’une fonctionnalité de transfert est réservée aux personnes âgées d’au moins 18 ans, sauf si une réglementation locale prévoit une règle différente et que le partenaire l’autorise expressément.</p>
        <p>L’utilisateur déclare fournir des informations exactes, à jour et complètes. Il ne doit pas utiliser l’identité, le téléphone, le compte, le portefeuille ou les moyens d’un tiers sans autorisation valable. Une utilisation professionnelle, commerciale ou pour le compte d’une autre personne peut être soumise à une convention distincte.</p>
      </LegalSection>

      <LegalSection number="06" title="Création, sécurité et responsabilité du compte">
        <p>Lorsqu’un compte est nécessaire, l’utilisateur est responsable de la confidentialité de ses identifiants, codes, appareils et moyens de récupération. Il doit signaler sans délai tout accès non autorisé, perte de téléphone, détournement de carte SIM ou activité inhabituelle.</p>
        <p>L’utilisateur ne doit pas partager ses codes de validation, contourner une mesure de sécurité, permettre à une autre personne de se connecter à son compte ou utiliser un appareil compromis. Flow Digital SARL peut demander une nouvelle authentification ou suspendre temporairement un accès lorsqu’une activité présente un risque pour l’utilisateur, les partenaires ou le système.</p>
      </LegalSection>

      <LegalSection number="07" title="Instructions de transfert, frais et confirmation">
        <p>Avant de confirmer une opération, l’utilisateur doit vérifier le bénéficiaire, le pays, le réseau, le montant, la devise, les frais, le taux appliqué lorsqu’il est affiché et le montant estimé reçu. Une confirmation donnée avec des informations erronées peut être irréversible.</p>
        <p>Les frais et taux sont affichés lorsqu’ils sont connus au moment du parcours. Ils peuvent comprendre des frais SendFlow, des frais de partenaire, des frais de réseau, des frais de change ou des taxes imposées par la réglementation applicable. Toute retenue ou variation imposée par un opérateur ou une banque peut affecter le montant reçu.</p>
        <p>Une demande d’annulation, de correction ou de remboursement doit être adressée dès que possible. Elle n’est pas garantie lorsque le transfert a déjà été accepté, débité, remis au bénéficiaire ou rendu irréversible par le partenaire.</p>
      </LegalSection>

      <LegalSection number="08" title="Vérification d’identité, lutte contre la fraude et obligations réglementaires">
        <p>Pour protéger les utilisateurs et respecter les exigences applicables aux services de paiement, les partenaires peuvent demander des informations d’identification, des justificatifs, l’origine des fonds, la relation avec le bénéficiaire ou le motif de l’opération.</p>
        <p>L’utilisateur s’engage à répondre honnêtement aux demandes de vérification et à ne pas fractionner, déguiser ou organiser une opération pour contourner un seuil, une restriction ou une procédure de contrôle. SendFlow et ses partenaires peuvent retarder, refuser, bloquer ou signaler une opération lorsqu’un contrôle de conformité, de sanctions, de fraude ou de lutte contre le blanchiment le justifie.</p>
        <p>Les parcours peuvent être soumis aux règles applicables en Côte d’Ivoire, dans l’espace UEMOA, aux instructions des autorités compétentes, aux exigences des établissements partenaires et aux règles du pays d’envoi ou de destination. Le respect de ces règles ne constitue pas une garantie que l’opération sera autorisée.</p>
      </LegalSection>

      <LegalSection number="09" title="Utilisations interdites">
        <p>Il est interdit d’utiliser SendFlow pour une activité illégale, frauduleuse, trompeuse ou portant atteinte aux droits d’autrui. Sont notamment interdits :</p>
        <LegalBulletList>
          <li>le financement du terrorisme, le blanchiment de capitaux, la fraude fiscale ou la dissimulation de l’origine des fonds ;</li>
          <li>les escroqueries, fausses collectes, usurpations d’identité, faux bénéficiaires ou demandes de paiement trompeuses ;</li>
          <li>le contournement de sanctions, embargos, limites, contrôles géographiques ou procédures de vérification ;</li>
          <li>l’utilisation de robots, le scraping, le test de charge abusif, l’injection de code ou toute tentative de compromettre le service ;</li>
          <li>la revente, la sous-licence, la copie ou l’exploitation commerciale d’une interface SendFlow sans autorisation écrite ;</li>
          <li>l’envoi de contenus illicites, haineux, menaçants, diffamatoires ou portant atteinte à la vie privée.</li>
        </LegalBulletList>
      </LegalSection>

      <LegalSection number="10" title="Propriété intellectuelle">
        <p>La marque SendFlow, ses noms, logos, textes, interfaces, illustrations, animations, composants, bases de données, logiciels et éléments graphiques sont protégés par les règles applicables de propriété intellectuelle. Ils appartiennent à Flow Digital SARL ou sont utilisés avec l’autorisation de leurs titulaires.</p>
        <p>Une licence personnelle, limitée, non exclusive, non transférable et révocable est accordée à l’utilisateur pour accéder au service et l’utiliser conformément aux présentes conditions. Aucun droit de propriété n’est transféré par l’utilisation du site ou de l’application.</p>
      </LegalSection>

      <LegalSection number="11" title="Données, confidentialité et communications">
        <p>Les données personnelles sont traitées conformément à la <Link href="/confidentialite" className="font-bold text-[#5b21b6] underline">Politique de confidentialité SendFlow</Link>. L’utilisateur doit consulter ce document avant d’utiliser un parcours qui implique la collecte d’informations personnelles, financières, d’identité ou de bénéficiaire.</p>
        <p>En utilisant le service, l’utilisateur peut recevoir des communications nécessaires à la sécurité, à la confirmation, au suivi, à la résolution d’un incident ou à l’évolution du service. Les communications commerciales sont traitées selon les choix disponibles et la réglementation applicable.</p>
      </LegalSection>

      <LegalSection number="12" title="Disponibilité, maintenance et sécurité">
        <p>Flow Digital SARL met en œuvre des mesures raisonnables pour maintenir un service accessible et protéger ses systèmes. Toutefois, une disponibilité permanente ne peut être garantie. Des interruptions peuvent résulter d’une maintenance, d’une panne, d’un incident de réseau, d’un opérateur, d’un partenaire, d’une autorité, d’un événement de force majeure ou d’un risque de sécurité.</p>
        <p>Il est interdit de désactiver les mécanismes de sécurité ou de considérer l’absence d’alerte comme une garantie d’absence de vulnérabilité. Tout incident suspect doit être signalé à {contactEmail} avec suffisamment d’informations pour permettre une analyse, sans transmettre de mot de passe ou de code secret.</p>
      </LegalSection>

      <LegalSection number="13" title="Suspension, fermeture et résiliation">
        <p>L’utilisateur peut cesser d’utiliser SendFlow à tout moment. Flow Digital SARL ou un partenaire peut suspendre ou limiter l’accès si cela est nécessaire pour protéger l’utilisateur, respecter une obligation légale, prévenir une fraude, traiter un impayé, répondre à une demande d’autorité ou constater une violation des présentes conditions.</p>
        <p>Lorsque la loi et la sécurité le permettent, l’utilisateur peut être informé du motif général de la mesure. Certaines informations ne peuvent toutefois pas être communiquées lorsqu’elles concernent un signalement, une enquête, une mesure de lutte contre la fraude ou une obligation de confidentialité.</p>
      </LegalSection>

      <LegalSection number="14" title="Responsabilité et limites">
        <p>Les présentes conditions ne limitent pas les droits impératifs dont bénéficie un consommateur ni les responsabilités qui ne peuvent légalement être exclues. Dans la mesure permise par la loi, Flow Digital SARL ne répond pas des pertes résultant d’une information fournie par l’utilisateur, d’un bénéficiaire erroné, d’un partage de code, d’un appareil compromis, d’un réseau indisponible ou d’un acte d’un partenaire indépendant.</p>
        <p>Flow Digital SARL ne garantit pas un délai fixe, un taux, un montant reçu ou la réussite d’une opération lorsque ces éléments dépendent d’un partenaire, d’un opérateur, d’une banque, d’une autorité, d’un contrôle de conformité ou d’un événement extérieur.</p>
        <p>La responsabilité de Flow Digital SARL, lorsqu’elle est légalement engagée, est évaluée au regard du dommage direct, prévisible et prouvé, sous réserve des plafonds, exclusions et règles impératives applicables. Les dommages indirects, pertes d’opportunité, pertes de données non imputables à Flow Digital SARL ou préjudices commerciaux sont exclus dans la mesure autorisée par la loi.</p>
      </LegalSection>

      <LegalSection number="15" title="Modifications des conditions">
        <p>Flow Digital SARL peut modifier les présentes conditions pour tenir compte d’une évolution du service, de la sécurité, des partenaires, de la réglementation ou de la jurisprudence. La date de mise à jour est indiquée en haut de la page.</p>
        <p>Pour une modification importante, un avis peut être affiché dans l’application, envoyé par un canal disponible ou présenté avant la prochaine utilisation. La poursuite de l’utilisation après l’entrée en vigueur de la modification vaut acceptation, sauf lorsque la loi impose un consentement distinct.</p>
      </LegalSection>

      <LegalSection number="16" title="Droit applicable, réclamations et règlement des différends">
        <p>Les présentes conditions sont interprétées selon le droit applicable en Côte d’Ivoire, sous réserve des règles impératives protectrices de l’utilisateur et des conditions particulières du partenaire qui exécute une opération.</p>
        <p>Avant toute procédure, l’utilisateur est invité à contacter le support afin de permettre une analyse amiable. Une réclamation doit préciser l’identité du demandeur, la date concernée, la référence disponible, l’objet de la demande et le résultat attendu. Ne transmettez jamais un mot de passe, un code OTP ou une clé secrète.</p>
        <p>À défaut de résolution amiable, les juridictions compétentes d’Abidjan peuvent être saisies, sous réserve des règles impératives relatives à la protection des consommateurs et des mécanismes de réclamation propres aux partenaires agréés.</p>
      </LegalSection>

      <LegalSection number="17" title="Références réglementaires indicatives">
        <p>Le cadre du service peut notamment être concerné par les textes ivoiriens relatifs à la protection des données à caractère personnel et aux transactions électroniques, par les règles et instructions applicables dans l’espace UEMOA, par les exigences de la BCEAO et par les obligations de lutte contre le blanchiment et le financement du terrorisme applicables aux partenaires.</p>
        <p>Cette liste est indicative et ne constitue pas une certification de conformité. Les textes, autorités compétentes, agréments, contrats partenaires et obligations peuvent varier selon le pays, le produit et le rôle exact de Flow Digital SARL. Une revue juridique et réglementaire devra être menée avant le lancement commercial.</p>
      </LegalSection>

      <LegalSection number="18" title="Date et version">
        <p>Version de travail publiée le <strong>10 septembre 2026</strong>. Flow Digital SARL conservera un historique des versions et indiquera la date de la dernière mise à jour sur cette page.</p>
      </LegalSection>
    </LegalLayout>
  );
}

export function PrivacyPage({ supportEmail }: LegalPageProps) {
  const contactEmail = normalizeSupportEmail(supportEmail);
  const contactAvatars = avatarBank.slice(4, 8);

  return (
    <PrivacyLayout>
      <LegalSection number="01" title="Qui est responsable de vos données ?">
        <p><strong>Flow Digital SARL</strong>, opérateur de la marque SendFlow, est le responsable du traitement présenté dans cette politique. La société est établie à Abidjan, Cocody Riviera Palmeraie, en Côte d’Ivoire.</p>
        <p>Pour toute question sur vos informations personnelles, vous pouvez écrire à <a className="font-bold text-[#5b21b6] underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>. Lorsqu’un opérateur, une banque ou un autre partenaire intervient directement dans une opération, il peut également être responsable de certains traitements réalisés dans son propre environnement.</p>
      </LegalSection>

      <LegalSection number="02" title="Quand cette politique s’applique-t-elle ?">
        <p>Cette politique concerne le site SendFlow, l’application, les parcours de transfert, le suivi des opérations, les formulaires de contact et les communications liées au service.</p>
        <p>Elle complète, mais ne remplace pas, les documents publiés par un opérateur mobile money, une banque ou un prestataire de paiement qui recueille directement des informations. Avant de confirmer une opération, prenez connaissance des informations présentées par le partenaire concerné.</p>
      </LegalSection>

      <LegalSection number="03" title="Quelles informations pouvons-nous recueillir ?">
        <p>Les informations traitées dépendent des fonctionnalités que vous utilisez et des exigences applicables à l’opération. Elles peuvent notamment comprendre :</p>
        <LegalBulletList>
          <li><strong>Informations d’identité et de contact :</strong> nom, prénom, numéro de téléphone, adresse e-mail, pays de résidence et préférences de communication ;</li>
          <li><strong>Informations de compte :</strong> identifiant, paramètres de sécurité, consentements, statut du compte et données nécessaires à la connexion ;</li>
          <li><strong>Informations liées aux transferts :</strong> pays, réseau, bénéficiaire, montant, devise, frais affichés, référence, date et statut ;</li>
          <li><strong>Informations de conformité :</strong> justificatifs, origine des fonds ou éléments de connaissance client lorsqu’un contrôle est requis ;</li>
          <li><strong>Informations techniques :</strong> appareil, système, version de l’application, adresse IP, journaux d’erreur et événements de sécurité ;</li>
          <li><strong>Échanges avec le support :</strong> demandes, correspondances et pièces jointes que vous choisissez de nous transmettre.</li>
        </LegalBulletList>
      </LegalSection>

      <LegalSection number="04" title="Comment ces informations arrivent-elles jusqu’à nous ?">
        <p>Vous pouvez nous transmettre des informations lorsque vous créez un compte, complétez un formulaire, ajoutez un bénéficiaire ou contactez l’assistance. D’autres données sont générées automatiquement lorsque vous consultez le service ou utilisez une fonctionnalité.</p>
        <p>Nous pouvons aussi recevoir des informations d’un opérateur ou d’un partenaire lorsque vous lui demandez d’exécuter, de vérifier ou de rapprocher une opération. Si vous saisissez les coordonnées d’un bénéficiaire, vous devez disposer du droit de les utiliser et l’informer du traitement lorsque la réglementation l’exige.</p>
      </LegalSection>

      <LegalSection number="05" title="Pourquoi utilisons-nous vos données ?">
        <p>Nous utilisons les informations nécessaires pour faire fonctionner SendFlow de façon utile et sécurisée, notamment pour :</p>
        <LegalBulletList>
          <li>ouvrir et administrer un compte, répondre à une demande et assurer la continuité du service ;</li>
          <li>préparer, transmettre, suivre, rapprocher ou résoudre une opération demandée ;</li>
          <li>présenter les pays, réseaux, frais, statuts et informations utiles à votre parcours ;</li>
          <li>détecter les comportements anormaux, limiter la fraude et protéger les comptes ;</li>
          <li>répondre aux obligations légales, réglementaires, comptables et judiciaires ;</li>
          <li>traiter les demandes d’assistance, les réclamations et les incidents ;</li>
          <li>améliorer la fiabilité, l’accessibilité et la sécurité de nos produits ;</li>
          <li>envoyer des communications commerciales uniquement lorsque le cadre applicable et vos choix le permettent.</li>
        </LegalBulletList>
        <p>La base utilisée dépend du traitement : service demandé, obligation légale, consentement, intérêt légitime de sécurité ou protection d’une personne. Elle peut également varier selon le pays et le rôle du partenaire.</p>
      </LegalSection>

      <LegalSection number="06" title="Informations financières et opérations de paiement">
        <p>SendFlow peut afficher ou transmettre les informations nécessaires à un transfert. Les coordonnées de carte, codes secrets et identifiants sensibles doivent toutefois rester dans l’environnement sécurisé du prestataire qui les traite directement.</p>
        <p>Une référence, un statut, un montant ou une information de rapprochement peut être conservé pour confirmer le service, répondre au support, prévenir la fraude et respecter les obligations de preuve. Ces informations ne sont pas utilisées pour créer des profils publicitaires fondés sur vos habitudes financières.</p>
      </LegalSection>

      <LegalSection number="07" title="Avec qui pouvons-nous partager certaines informations ?">
        <p>Un partage n’est effectué que lorsqu’il est nécessaire à une finalité précise, avec des accès limités à ce qui est utile. Les destinataires peuvent appartenir aux catégories suivantes :</p>
        <LegalBulletList>
          <li>opérateurs mobile money, banques, établissements de paiement et prestataires qui exécutent ou contrôlent l’opération ;</li>
          <li>prestataires techniques chargés de l’hébergement, du stockage, de la sécurité, de la messagerie ou de la supervision ;</li>
          <li>partenaires de vérification d’identité, de prévention de la fraude et de conformité ;</li>
          <li>conseils, auditeurs ou assureurs soumis à une obligation de confidentialité ;</li>
          <li>autorités administratives, judiciaires ou réglementaires lorsqu’une demande légale le justifie.</li>
        </LegalBulletList>
        <p>Les prestataires recevant ces informations doivent respecter des consignes de confidentialité, de sécurité et de limitation d’accès. La liste détaillée des partenaires retenus pour la version commerciale devra être confirmée avant le lancement.</p>
      </LegalSection>

      <LegalSection number="08" title="Où et combien de temps conservons-nous vos données ?">
        <p>Selon les partenaires utilisés, certaines informations peuvent être traitées dans un pays différent de celui où vous utilisez SendFlow. Flow Digital SARL doit alors examiner le cadre applicable, les garanties contractuelles et les mesures de protection à mettre en place.</p>
        <LegalBulletList>
          <li>les données de compte sont conservées pendant la relation, puis le temps nécessaire au traitement des demandes et des litiges ;</li>
          <li>les informations de transfert peuvent être gardées pendant les durées imposées par la preuve, la comptabilité, la fiscalité et la lutte contre le blanchiment ;</li>
          <li>les journaux de sécurité sont conservés pendant une période proportionnée à l’analyse des incidents ;</li>
          <li>les demandes de support et les consentements sont conservés pour assurer le suivi et démontrer les choix effectués.</li>
        </LegalBulletList>
        <p>À l’issue de la période utile, les informations sont supprimées, anonymisées ou archivées lorsque la loi impose une conservation plus longue.</p>
      </LegalSection>

      <LegalSection number="09" title="Comment protégeons-nous vos informations ?">
        <p>Nous prévoyons des mesures techniques et organisationnelles proportionnées aux risques : gestion des habilitations, limitation des accès, journalisation, sauvegardes, séparation des environnements, surveillance des incidents et sensibilisation des personnes autorisées.</p>
        <p>La sécurité dépend aussi de votre appareil et de vos habitudes. Utilisez un téléphone à jour, protégez votre messagerie, ne partagez jamais vos codes et signalez rapidement toute perte, tentative de fraude ou activité inhabituelle.</p>
      </LegalSection>

      <div className="sendflow-privacy-people-card">
        <div className="sendflow-privacy-people-avatars" aria-hidden="true">
          {contactAvatars.map((avatar) => (
            <img key={avatar.id} src={avatar.src} alt="" />
          ))}
        </div>
        <div>
          <p className="sendflow-privacy-people-eyebrow">Une question sur vos données ?</p>
          <h3>Notre équipe peut vous orienter vers le bon canal.</h3>
          <p>Ne transmettez jamais de code secret dans une demande d’assistance. Utilisez uniquement l’adresse officielle indiquée dans cette politique.</p>
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </div>
      </div>

      <LegalSection number="10" title="Quels sont vos droits ?">
        <p>Selon la réglementation applicable à votre situation, vous pouvez demander l’accès à vos informations, leur correction, leur mise à jour, leur suppression lorsqu’elle est possible, la limitation d’un traitement, l’opposition à certains usages, le retrait d’un consentement ou une copie des données concernées.</p>
        <p>Pour exercer un droit, écrivez à <a className="font-bold text-[#5b21b6] underline" href={`mailto:${contactEmail}`}>{contactEmail}</a> en précisant l’objet de votre demande, le moyen de vous répondre et, si nécessaire, les éléments permettant de retrouver votre compte. Une vérification raisonnable peut être demandée pour protéger vos informations.</p>
        <p>Une demande peut être limitée lorsque la loi impose une conservation, protège les droits d’une autre personne, concerne une enquête de fraude ou relève directement d’un partenaire. Nous expliquerons la réponse dans la mesure permise.</p>
      </LegalSection>

      <LegalSection number="11" title="Cookies, profilage et mineurs">
        <p>SendFlow peut utiliser des cookies ou technologies similaires nécessaires à la session, à la sécurité, à la langue et au fonctionnement du site. Les outils de mesure ou de diagnostic doivent respecter les choix requis par la réglementation applicable.</p>
        <p>Des contrôles automatisés peuvent aider à repérer une anomalie, une fraude ou un risque de conformité. Ils ne doivent pas être considérés comme une décision définitive sans l’examen ou la procédure prévus par le cadre applicable.</p>
        <p>SendFlow n’est pas destiné aux personnes qui ne peuvent pas légalement utiliser un service financier ou de transfert. Si vous pensez qu’un mineur nous a transmis des informations, contactez-nous afin que la situation puisse être examinée.</p>
      </LegalSection>

      <LegalSection number="12" title="Contact, incidents et mises à jour">
        <p>En cas d’incident susceptible d’affecter des informations personnelles, Flow Digital SARL applique une procédure d’analyse, de confinement, de correction et de notification lorsque la loi ou le niveau de risque le requiert. Les communications officielles utilisent un canal vérifiable.</p>
        <p>Cette politique peut évoluer pour refléter une nouvelle fonctionnalité, un nouveau partenaire, une évolution réglementaire ou une amélioration de nos pratiques. La version actuelle a été publiée le <strong>10 septembre 2026</strong>.</p>
        <p>Pour une question, une demande de droit ou une réclamation relative à la confidentialité, contactez <a className="font-bold text-[#5b21b6] underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>. Cette page est une base de travail qui devra être revue par un conseil juridique avant tout lancement financier.</p>
      </LegalSection>
    </PrivacyLayout>
  );
}