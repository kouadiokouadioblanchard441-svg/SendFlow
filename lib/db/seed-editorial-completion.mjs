import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("NEON_DATABASE_URL or DATABASE_URL must be set");

const pool = new Pool({ connectionString: databaseUrl });

const content = [
  ["nav.home", "navigation", "Accueil", "Home"],
  ["nav.features", "navigation", "Fonctionnalités", "Features"],
  ["nav.how", "navigation", "Comment ça marche", "How it works"],
  ["nav.international", "navigation", "International", "International"],
  ["nav.security", "navigation", "Sécurité", "Security"],
  ["nav.about", "navigation", "À propos", "About"],
  ["cta.download", "cta", "Télécharger l’application", "Download the app"],
  ["cta.discover", "cta", "Découvrir SendFlow", "Discover SendFlow"],
  ["cta.newsletter", "cta", "Me tenir au courant", "Keep me posted"],
  ["cta.newsletter.note", "cta", "Démo uniquement · Aucun engagement", "Demo only · No commitment"],
  ["cta.nextMove", "cta", "Le prochain mouvement", "The next move"],
  ["cta.download.title", "cta", "Votre prochain transfert\ncommence ici.", "Your next transfer\nstarts here."],
  ["cta.download.body", "cta", "Téléchargez bientôt l’application SendFlow et simplifiez vos transferts entre réseaux.", "Download the SendFlow app soon and simplify transfers across networks."],
  ["footer.product.africa", "footer", "SendFlow Afrique", "SendFlow Africa"],
  ["footer.product.europe", "footer", "SendFlow Europe", "SendFlow Europe"],
  ["footer.product.business", "footer", "SendFlow Business", "SendFlow Business"],
  ["footer.referral", "footer", "Parrainage", "Referral"],
  ["footer.address.title", "footer", "Nos adresses", "Our offices"],
  ["footer.address.country", "footer", "Côte d’Ivoire", "Côte d’Ivoire"],
  ["footer.address.value", "footer", "Abidjan, Cocody Riviera Palmeraie", "Abidjan, Cocody Riviera Palmeraie"],
  ["footer.legal.disclaimer", "footer", "SendFlow est une solution de technologie financière développée par Flow Digital SARL. Nous ne sommes pas une banque ; nos services s’appuient sur des partenaires agréés.", "SendFlow is a financial technology solution developed by Flow Digital SARL. We are not a bank; our services rely on licensed partners."],
  ["footer.legal.partners", "footer", "Les services de paiement SendFlow sont proposés via des partenaires agréés dans les territoires où le service est disponible, conformément aux règles locales.", "SendFlow payment services are offered through licensed partners in territories where the service is available, in accordance with local rules."],
  ["footer.legal.short", "footer", "SendFlow est une solution de technologie financière développée par Flow Digital SARL.", "SendFlow is a financial technology solution developed by Flow Digital SARL."],
  ["features.principles.kicker", "features", "Une expérience, trois repères", "One experience, three principles"],
  ["features.principles.title", "features", "Pensé pour une Afrique connectée.", "Built for a connected Africa."],
  ["security.title", "security", "Chaque étape\nà découvert.", "Every step,\nin the clear."],
  ["security.body", "security", "Le calme vient de ce que l’on comprend. SendFlow rend les détails lisibles, les choix explicites et le contrôle toujours à portée de main.", "Calm comes from understanding. SendFlow makes details readable, choices explicit, and control always within reach."],
  ["security.visible.title", "security", "Détails visibles", "Visible details"],
  ["security.visible.body", "security", "Comprendre avant de confirmer.", "Understand before you confirm."],
  ["security.private.title", "security", "Pensé privé", "Privacy-minded"],
  ["security.private.body", "security", "Moins de données, plus de sérénité.", "Less data, more peace of mind."],
  ["join.kicker", "cta", "The next move", "The next move"],
  ["join.title", "cta", "Prêt·e à faire bouger les choses ?", "Ready to move things?"],
  ["join.body", "cta", "Recevez les prochaines nouvelles de SendFlow. Pas de bruit, juste les avancées.", "Get the next SendFlow updates. No noise, just progress."],
  ["about.hero.kicker", "about", "L’histoire derrière SendFlow", "The story behind SendFlow"],
  ["about.hero.title", "about", "L’argent circule mieux quand les gens se comprennent.", "Money moves better when people understand each other."],
  ["about.hero.intro", "about", "SendFlow est né d’une intuition simple : la technologie financière ne devrait pas ajouter de distance. Elle devrait rendre les liens plus directs, les choix plus lisibles et les transferts plus humains.", "SendFlow was born from a simple intuition: financial technology should not add distance. It should make connections more direct, choices clearer, and transfers more human."],
  ["about.hero.founderCta", "about", "Rencontrer le fondateur", "Meet the founder"],
  ["about.hero.missionCta", "about", "Notre raison d’être", "Our reason why"],
  ["about.mission.kicker", "about", "Une conviction concrète", "A practical conviction"],
  ["about.mission.title", "about", "Rendre la simplicité accessible à tous.", "Make simplicity accessible to everyone."],
  ["about.mission.label", "about", "Notre mission", "Our mission"],
  ["about.vision.label", "about", "Notre vision", "Our vision"],
  ["about.path.kicker", "about", "Le chemin", "The path"],
  ["about.path.title", "about", "Une idée qui a pris racine dans le réel.", "An idea rooted in real life."],
  ["about.path.intro", "about", "Pas de raccourci spectaculaire. Un apprentissage patient : écouter, comprendre les contraintes, puis construire quelque chose qui tient.", "No spectacular shortcut. A patient practice: listen, understand the constraints, then build something that holds."],
  ["about.benefits.kicker", "about", "Ce que SendFlow rend possible", "What SendFlow makes possible"],
  ["about.benefits.title", "about", "Moins de friction. Plus de mouvement.", "Less friction. More movement."],
  ["about.founder.kicker", "about", "À l’origine du mouvement", "At the origin of the movement"],
  ["about.founder.title", "about", "Le visage derrière le produit.", "The person behind the product."],
  ["about.cta.kicker", "about", "La suite s’écrit ensemble", "The next chapter is shared"],
  ["about.cta.title", "about", "Prêt à faire circuler les possibles ?", "Ready to keep possibilities moving?"],
  ["about.cta.button", "about", "Découvrir SendFlow", "Discover SendFlow"],
  ["about.card.tagline", "about", "Tout circule.", "Keep it moving."],
  ["about.feature.start.title", "about", "Un seul point de départ", "One starting point"],
  ["about.feature.start.body", "about", "Choisissez un pays, un réseau et un bénéficiaire depuis un parcours pensé pour être compris du premier coup.", "Choose a country, a network, and a recipient through a journey designed to be understood at first glance."],
  ["about.feature.trust.title", "about", "Une confiance lisible", "Trust you can read"],
  ["about.feature.trust.body", "about", "Les informations essentielles restent visibles : qui reçoit, combien, quand et où en est le transfert.", "The essentials stay visible: who receives, how much, when, and where the transfer stands."],
  ["about.feature.borders.title", "about", "Des frontières moins lourdes", "Lighter borders"],
  ["about.feature.borders.body", "about", "SendFlow rapproche les réseaux locaux pour que la distance géographique ne dicte plus la distance humaine.", "SendFlow brings local networks closer so geography does not dictate human distance."],
  ["about.footer.tagline", "about", "Des liens qui avancent.", "Connections in motion."],
  ["about.footer.initiative", "about", "Une initiative Flow Digital SARL.", "An initiative by Flow Digital SARL."],
];

const legalSections = {
  "mentions-legales": [
    [1, "Éditeur du site", "Site publisher", "Le site SendFlow est édité par Flow Digital SARL, société de droit ivoirien exploitant la marque et le projet technologique SendFlow.", "The SendFlow site is published by Flow Digital SARL, an Ivorian company operating the SendFlow brand and technology project."],
    [2, "Hébergement et infrastructure", "Hosting and infrastructure", "Les informations relatives à l’hébergeur, à son adresse et à la région de stockage doivent être confirmées à partir de l’infrastructure de production avant publication définitive.", "Hosting, address, and storage-region details must be confirmed from the production infrastructure before final publication."],
    [3, "Objet et responsabilité", "Purpose and responsibility", "SendFlow présente une solution technologique de préparation et de suivi de transferts entre réseaux de paiement. Les informations de couverture, de disponibilité et de réglementation peuvent évoluer.", "SendFlow presents technology for preparing and tracking transfers between payment networks. Coverage, availability, and regulatory information may change."],
    [4, "Mise à jour", "Updates", "Les informations légales doivent être maintenues à jour à chaque changement d’identité, de siège, d’hébergeur, de marque, de modèle de service ou de statut réglementaire.", "Legal information must be kept current whenever the publisher, address, host, brand, service model, or regulatory status changes."],
  ],
  "conditions-utilisation": [
    [1, "Identification de l’éditeur", "Publisher identification", "SendFlow est une marque et une solution technologique développées par Flow Digital SARL, établie en Côte d’Ivoire. Les coordonnées officielles sont celles affichées dans le panel éditorial.", "SendFlow is a brand and technology solution developed by Flow Digital SARL, established in Côte d’Ivoire. Official contact details are maintained in the editorial panel."],
    [2, "Description du service", "Service description", "SendFlow est une couche technologique de connexion, d’information et de suivi. Elle n’est ni une banque, ni un établissement de monnaie électronique, ni un wallet autonome, sauf mention contraire dans un parcours précis.", "SendFlow is a technology layer for connection, information, and tracking. It is not a bank, electronic-money institution, or standalone wallet unless a specific flow says otherwise."],
    [3, "Instructions et sécurité", "Instructions and security", "Avant de confirmer une opération, l’utilisateur doit vérifier le bénéficiaire, le pays, le réseau, le montant, la devise, les frais et le montant estimé reçu. Les codes secrets ne doivent jamais être communiqués au support.", "Before confirming an operation, users must check the recipient, country, network, amount, currency, fees, and estimated amount received. Secret codes must never be shared with support."],
    [4, "Modifications et réclamations", "Changes and complaints", "Les conditions peuvent évoluer avec le service, les partenaires et la réglementation. Toute réclamation doit être adressée au support avec les informations nécessaires, sans mot de passe, code OTP ou clé secrète.", "Terms may change with the service, partners, and regulations. Complaints should be sent to support with the necessary information, never with a password, OTP, or secret key."],
  ],
  confidentialite: [
    [1, "Responsable du traitement", "Data controller", "Le responsable du traitement présenté dans cette politique est Flow Digital SARL, opérateur de la marque SendFlow, établi à Abidjan, Côte d’Ivoire.", "The controller described in this policy is Flow Digital SARL, operator of the SendFlow brand, established in Abidjan, Côte d’Ivoire."],
    [2, "Catégories de données", "Data categories", "Selon le parcours, SendFlow peut traiter des données de contact, de compte, de transfert, de vérification, de support, de navigation et des données techniques nécessaires à la sécurité.", "Depending on the flow, SendFlow may process contact, account, transfer, verification, support, navigation, and technical data needed for security."],
    [3, "Finalités et partenaires", "Purposes and partners", "Les données servent à fournir le service, suivre les opérations, prévenir la fraude, assurer le support, améliorer la fiabilité et respecter les obligations légales. Les partenaires reçoivent uniquement les informations nécessaires à leur rôle.", "Data is used to provide the service, track operations, prevent fraud, support users, improve reliability, and meet legal duties. Partners receive only information needed for their role."],
    [4, "Droits et conservation", "Rights and retention", "Les personnes peuvent demander l’accès, la rectification, la mise à jour ou la suppression de leurs données lorsque la loi le permet. Les données sont conservées pendant la durée nécessaire ou imposée par les obligations applicables.", "People may request access, correction, updating, or deletion where allowed by law. Data is kept for as long as needed or required by applicable obligations."],
  ],
};

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE landing_site_settings SET company_name = COALESCE(NULLIF(company_name, ''), 'Flow Digital SARL'), legal_form = COALESCE(NULLIF(legal_form, ''), 'Société à responsabilité limitée'), legal_address = COALESCE(NULLIF(legal_address, ''), 'Côte d’Ivoire, Abidjan, Cocody Riviera Palmeraie'), legal_email = COALESCE(NULLIF(legal_email, ''), support_email), footer_address_flag = COALESCE(NULLIF(footer_address_flag, ''), '🇨🇮'), footer_address_country = COALESCE(NULLIF(footer_address_country, ''), 'Côte d’Ivoire'), footer_address = COALESCE(NULLIF(footer_address, ''), 'Abidjan, Cocody Riviera Palmeraie'), regulator_name_fr = COALESCE(NULLIF(regulator_name_fr, ''), 'Régulateur à confirmer'), regulator_name_en = COALESCE(NULLIF(regulator_name_en, ''), 'Regulator to be confirmed')`);
    await client.query(`UPDATE landing_countries SET hero_position_x = CASE code WHEN 'CI' THEN 7 WHEN 'BJ' THEN 78 WHEN 'TG' THEN 95 WHEN 'CM' THEN 34 ELSE hero_position_x END, hero_position_y = CASE code WHEN 'CI' THEN 53 WHEN 'BJ' THEN 24 WHEN 'TG' THEN 54 WHEN 'CM' THEN 84 ELSE hero_position_y END WHERE hero_position_x IS NULL OR hero_position_y IS NULL`);

    for (const [key, group, fr, en] of content) {
      for (const [locale, value] of [["fr", fr], ["en", en]]) {
        await client.query(`INSERT INTO landing_content (content_key, locale, "group", value) VALUES ($1, $2, $3, $4) ON CONFLICT (content_key, locale) DO NOTHING`, [key, locale, group, value]);
      }
    }

    for (const [slug, sections] of Object.entries(legalSections)) {
      const page = await client.query("SELECT id FROM legal_pages WHERE slug = $1 LIMIT 1", [slug]);
      if (!page.rows[0]) continue;
      const existing = await client.query("SELECT 1 FROM legal_sections WHERE page_id = $1 LIMIT 1", [page.rows[0].id]);
      if (existing.rowCount) continue;
      for (const [sectionNumber, titleFr, titleEn, bodyFr, bodyEn] of sections) {
        await client.query(`INSERT INTO legal_sections (page_id, section_number, title_fr, title_en, body_fr, body_en, order_index) VALUES ($1,$2,$3,$4,$5,$6,$2)`, [page.rows[0].id, sectionNumber, titleFr, titleEn, bodyFr, bodyEn]);
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
