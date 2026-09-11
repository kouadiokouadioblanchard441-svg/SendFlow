import type { ReactNode } from 'react';
import { Link } from 'wouter';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';

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

function LegalSection({ number, title, children }: LegalSectionProps) {
  return (
    <section className="scroll-mt-28 border-t border-[#2d2535]/10 pt-8">
      <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#6d35d8]">{number}</p>
      <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-[-.04em] text-[#17131f] sm:text-3xl">{title}</h2>
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
          <Link href="/" className="flex items-center gap-2" aria-label="Retour à SendFlow">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-[#6d35d8]/20">
              <img src={sendflowMark} alt="" className="h-8 w-7 object-contain" />
            </span>
            <img src={sendflowWordmark} alt="SendFlow" className="h-6 w-auto object-contain" />
          </Link>
          <Link
            href="/"
            className="inline-flex min-w-[164px] items-center justify-center rounded-full border border-[#6d35d8] bg-[#6d35d8] px-5 py-2.5 text-center text-[12px] font-extrabold text-white shadow-[0_8px_18px_rgba(109,53,216,.2)] transition-all hover:border-[#5421b8] hover:bg-[#5421b8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d35d8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f3e9]"
          >
            Retour à l’accueil
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
            <Link href="/" className="text-[#e8cd4d] hover:underline">Accueil</Link>
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
        <p>Les informations publiées peuvent être modifiées, suspendues ou retirées sans préavis lorsqu’une correction, une évolution réglementaire, une contrainte de partenaire ou un impératif de sécurité le justifie. La disponibilité du site vitrine ne garantit pas la disponibilité d’un futur service de transfert.</p>
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
  return (
    <LegalLayout
      eyebrow="SendFlow · Confidentialité"
      title="Politique de confidentialité"
      intro="Cette politique explique quelles données SendFlow peut traiter, pourquoi elles sont utilisées, avec qui elles peuvent être partagées, combien de temps elles sont conservées et comment exercer vos droits."
      supportEmail={supportEmail}
    >
      <LegalSection number="01" title="Responsable du traitement">
        <p>Le responsable du traitement présenté dans cette politique est <strong>Flow Digital SARL</strong>, opérateur de la marque SendFlow, établi à Abidjan, Cocody Riviera Palmeraie, Côte d’Ivoire.</p>
        <p>Pour toute question relative aux données personnelles, vous pouvez contacter <a className="font-bold text-[#5b21b6] underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>. Lorsqu’un partenaire exécute directement une opération de paiement, il peut agir comme responsable indépendant ou responsable conjoint pour certaines données et présenter sa propre politique.</p>
      </LegalSection>

      <LegalSection number="02" title="Périmètre de la politique">
        <p>Cette politique s’applique au site SendFlow, à l’application, aux parcours de transfert, au suivi des opérations, aux formulaires de contact, aux communications liées au service et aux pages publiques associées.</p>
        <p>Elle ne remplace pas la politique d’un opérateur mobile money, d’une banque, d’un prestataire de paiement, d’un hébergeur ou d’un autre partenaire qui collecte directement des informations dans son propre environnement. Avant de confirmer un transfert, consultez les informations affichées par le partenaire concerné.</p>
      </LegalSection>

      <LegalSection number="03" title="Catégories de données collectées">
        <p>Selon le parcours utilisé, SendFlow peut traiter les catégories suivantes :</p>
        <LegalBulletList>
          <li><strong>Identité et contact :</strong> nom, prénom, numéro de téléphone, adresse électronique, pays de résidence et préférences de communication.</li>
          <li><strong>Données de compte :</strong> identifiant, informations de connexion, historique de consentement, paramètres de sécurité et statut du compte.</li>
          <li><strong>Données de transfert :</strong> pays, réseau, bénéficiaire, montant, devise, référence, statut, date, frais affichés et informations nécessaires au rapprochement.</li>
          <li><strong>Données de vérification :</strong> justificatifs, informations de connaissance client, origine des fonds et éléments de conformité lorsque la loi ou un partenaire l’exige.</li>
          <li><strong>Données techniques :</strong> adresse IP, type d’appareil, système, version de l’application, identifiants techniques, journaux d’erreur et événements de sécurité.</li>
          <li><strong>Données de support :</strong> contenu d’une demande, pièces jointes envoyées volontairement, correspondances et informations utiles à la résolution.</li>
          <li><strong>Données de navigation :</strong> pages consultées, préférences, langue, consentements et informations de session nécessaires au fonctionnement.</li>
        </LegalBulletList>
        <p>SendFlow ne demande pas de mot de passe bancaire, de code PIN mobile money ou de code OTP par courrier électronique. Ne communiquez jamais ces informations à un agent qui les réclamerait en dehors d’un écran sécurisé du partenaire.</p>
      </LegalSection>

      <LegalSection number="04" title="Origine des données">
        <p>Les données peuvent être fournies directement par vous, générées lors de l’utilisation du service, reçues d’un opérateur ou d’un partenaire avec lequel vous avez demandé l’exécution d’un transfert, ou collectées automatiquement depuis votre appareil et votre navigateur.</p>
        <p>Si vous saisissez les informations d’un bénéficiaire, vous devez vous assurer que vous avez le droit de les utiliser pour le transfert demandé et, lorsque cela est nécessaire, l’informer du traitement.</p>
      </LegalSection>

      <LegalSection number="05" title="Finalités et bases de traitement">
        <p>Les données sont utilisées pour fournir et sécuriser SendFlow, notamment pour :</p>
        <LegalBulletList>
          <li>créer et gérer un compte, vérifier une identité et répondre à une demande ;</li>
          <li>préparer, transmettre, suivre, rapprocher ou résoudre une opération demandée ;</li>
          <li>afficher les réseaux, pays, frais, statuts et informations utiles au parcours ;</li>
          <li>prévenir la fraude, détecter les comportements abusifs et protéger les utilisateurs ;</li>
          <li>respecter les obligations légales, réglementaires, judiciaires et de conservation ;</li>
          <li>assurer le support, traiter les réclamations et améliorer la fiabilité du produit ;</li>
          <li>mesurer l’usage du site et corriger les erreurs, lorsque cela est autorisé et configuré ;</li>
          <li>envoyer des communications commerciales lorsque vous y avez consenti ou lorsque la loi le permet avec une possibilité de retrait.</li>
        </LegalBulletList>
        <p>Selon le traitement, la base peut être l’exécution d’un service demandé, le respect d’une obligation légale, votre consentement, la protection des intérêts essentiels ou l’intérêt légitime de sécurité et d’amélioration du service. La base exacte peut dépendre du pays et du rôle du partenaire.</p>
      </LegalSection>

      <LegalSection number="06" title="Données de paiement et données financières">
        <p>SendFlow peut afficher ou transmettre des informations nécessaires à un transfert, mais ne doit pas être considéré comme le coffre-fort de vos données bancaires. Les coordonnées de carte, codes secrets et identifiants sensibles sont en principe traités par le prestataire de paiement ou l’opérateur concerné, selon son propre environnement.</p>
        <p>Lorsque Flow Digital SARL reçoit une référence, un statut ou une information de rapprochement, elle l’utilise pour fournir le service, le support, la prévention de la fraude et les obligations de preuve. Les informations financières ne sont pas utilisées pour vendre des profils publicitaires personnalisés.</p>
      </LegalSection>

      <LegalSection number="07" title="Partage avec les partenaires et prestataires">
        <p>Les données peuvent être communiquées uniquement dans la mesure nécessaire à une finalité déterminée, notamment aux catégories suivantes :</p>
        <LegalBulletList>
          <li>opérateurs de mobile money, banques, établissements de paiement et prestataires qui exécutent ou vérifient l’opération ;</li>
          <li>prestataires techniques d’hébergement, de stockage, de sécurité, de messagerie, de support et de supervision ;</li>
          <li>prestataires de vérification d’identité, de lutte contre la fraude et de conformité ;</li>
          <li>conseils professionnels, auditeurs et assureurs soumis à une obligation de confidentialité ;</li>
          <li>autorités administratives, judiciaires ou réglementaires lorsqu’une demande légale l’exige.</li>
        </LegalBulletList>
        <p>Les prestataires techniques doivent recevoir des instructions et des accès limités à leurs besoins. Une liste nominative des prestataires utilisés pour la version commercialisée devra être ajoutée avant le lancement, avec leurs rôles, pays de traitement et liens de confidentialité.</p>
      </LegalSection>

      <LegalSection number="08" title="Transferts internationaux">
        <p>Les données peuvent être traitées dans un pays différent de celui où vous utilisez SendFlow lorsque les partenaires ou prestataires techniques y sont établis. Avant un transfert international, Flow Digital SARL doit évaluer le cadre applicable, les garanties contractuelles, les mesures de sécurité et les obligations d’information.</p>
        <p>Les partenaires de paiement peuvent appliquer leurs propres règles de localisation, de conservation et de communication. Lorsque cela est requis, des informations complémentaires seront présentées dans l’écran du parcours ou dans la politique du partenaire.</p>
      </LegalSection>

      <LegalSection number="09" title="Conservation des données">
        <p>Les données sont conservées pendant la durée nécessaire à la finalité pour laquelle elles ont été collectées, puis supprimées, anonymisées ou archivées lorsque la loi impose une conservation plus longue.</p>
        <LegalBulletList>
          <li>les données de compte sont conservées pendant la relation, puis pendant la période nécessaire à la gestion des demandes et litiges ;</li>
          <li>les données de transfert peuvent être conservées pendant les durées imposées par la comptabilité, la preuve, la lutte contre le blanchiment, la fiscalité et les partenaires ;</li>
          <li>les journaux de sécurité sont conservés pendant une durée proportionnée à la prévention et à l’analyse des incidents ;</li>
          <li>les demandes de support sont conservées le temps de traiter la demande puis selon les besoins de preuve et de qualité ;</li>
          <li>les consentements sont conservés afin de pouvoir démontrer la date, le contenu et le retrait éventuel du choix.</li>
        </LegalBulletList>
        <p>Les durées exactes seront documentées dans le registre interne de Flow Digital SARL et pourront varier selon le produit, le pays et le partenaire qui intervient dans le transfert.</p>
      </LegalSection>

      <LegalSection number="10" title="Sécurité et confidentialité">
        <p>Flow Digital SARL met en place des mesures techniques et organisationnelles raisonnables : contrôle des accès, limitation des habilitations, chiffrement lorsque disponible, journalisation, sauvegardes, séparation des environnements, surveillance des incidents et sensibilisation des personnes autorisées.</p>
        <p>Aucun service connecté à Internet n’est totalement exempt de risque. Vous devez utiliser un appareil à jour, protéger votre téléphone et votre messagerie, activer les mécanismes de sécurité disponibles et signaler immédiatement toute suspicion de compromission.</p>
      </LegalSection>

      <LegalSection number="11" title="Cookies et technologies similaires">
        <p>SendFlow peut utiliser des cookies ou technologies similaires nécessaires à la session, à la sécurité, à la mémorisation de la langue et au fonctionnement du site. Des outils de mesure d’audience ou de diagnostic ne doivent être activés que dans le respect des choix requis par la réglementation applicable.</p>
        <p>Vous pouvez configurer votre navigateur pour limiter certains cookies. La désactivation d’un cookie strictement nécessaire peut empêcher le fonctionnement d’un formulaire, d’une session ou d’une mesure de sécurité.</p>
      </LegalSection>

      <LegalSection number="12" title="Vos droits">
        <p>Selon la loi applicable à votre situation, vous pouvez demander l’accès à vos données, leur rectification, leur mise à jour, leur suppression lorsque cela est possible, la limitation d’un traitement, l’opposition à certains usages, le retrait d’un consentement ou une copie des informations vous concernant.</p>
        <p>Pour exercer un droit, écrivez à {contactEmail} en indiquant votre nom, le moyen de vous répondre, l’objet précis de la demande et, si nécessaire, les éléments permettant de retrouver le compte. Flow Digital SARL peut demander une vérification d’identité raisonnable pour éviter de communiquer des données à la mauvaise personne.</p>
        <p>Une demande peut être limitée ou refusée lorsque la conservation est imposée par la loi, lorsque l’exercice du droit porterait atteinte aux droits d’une autre personne, lorsqu’une enquête de fraude est en cours ou lorsque le partenaire est le responsable compétent pour le traitement concerné. Une explication sera fournie dans la mesure permise.</p>
      </LegalSection>

      <LegalSection number="13" title="Mineurs">
        <p>SendFlow n’est pas destiné aux personnes qui ne peuvent pas légalement utiliser un service financier ou de transfert. Nous ne cherchons pas à collecter volontairement les données d’un mineur sans le cadre et l’autorisation requis.</p>
        <p>Si vous pensez qu’un mineur nous a transmis des informations, contactez-nous afin que nous puissions vérifier la situation et prendre les mesures appropriées, sous réserve des obligations de conservation et de preuve.</p>
      </LegalSection>

      <LegalSection number="14" title="Décisions automatisées et profilage">
        <p>Des contrôles automatisés peuvent contribuer à détecter une anomalie, une fraude ou un risque de conformité. Ces contrôles ne doivent pas être interprétés comme une décision définitive sur votre personne sans examen ou procédure prévue par le partenaire compétent lorsque la loi l’exige.</p>
        <p>SendFlow n’utilise pas les données de transfert pour créer un profil publicitaire de vos habitudes financières. Toute évolution importante de cette pratique devra faire l’objet d’une information et, si nécessaire, d’un consentement.</p>
      </LegalSection>

      <LegalSection number="15" title="Violation de données et notifications">
        <p>En cas d’incident susceptible d’affecter des données personnelles, Flow Digital SARL applique une procédure d’analyse, de confinement, de correction et de notification. Les autorités, partenaires et personnes concernées peuvent être informés lorsque la loi ou le niveau de risque le requiert.</p>
        <p>Les notifications officielles seront effectuées par un canal vérifiable. Méfiez-vous des messages qui demandent un code secret, une somme urgente ou une copie non nécessaire d’un document.</p>
      </LegalSection>

      <LegalSection number="16" title="Mise à jour de la politique">
        <p>Cette politique peut être modifiée pour refléter une nouvelle fonctionnalité, un nouveau partenaire, une évolution réglementaire ou une amélioration de nos pratiques. La date de la dernière version est indiquée ci-dessous.</p>
        <p>Si une modification est importante, un avis peut être affiché sur le site ou dans l’application, et un consentement spécifique peut être demandé lorsque la loi l’exige.</p>
      </LegalSection>

      <LegalSection number="17" title="Références réglementaires indicatives">
        <p>Le traitement des données peut notamment être encadré, selon le contexte, par les textes ivoiriens relatifs à la protection des données à caractère personnel, aux transactions électroniques, par les règles de l’UEMOA et par les obligations imposées aux établissements et partenaires de paiement.</p>
        <p>Les références précises, l’autorité compétente, les formalités, les bases de transfert et les durées de conservation doivent être confirmées lors de l’audit juridique du produit réel. Cette page ne constitue pas une déclaration exhaustive de conformité.</p>
      </LegalSection>

      <LegalSection number="18" title="Date et contact">
        <p>Version de travail publiée le <strong>10 septembre 2026</strong>. Pour toute question, demande de droit ou réclamation relative à la confidentialité : <a className="font-bold text-[#5b21b6] underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>
      </LegalSection>
    </LegalLayout>
  );
}