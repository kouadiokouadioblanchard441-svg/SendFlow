import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("NEON_DATABASE_URL or DATABASE_URL must be set");
}

const pool = new Pool({ connectionString });

const media = [
  ["brand-mark", "brand", "artifacts/sendflow/src/assets/sendflow-mark-original.png", "image/png", "Logo symbole SendFlow", "SendFlow symbol logo"],
  ["brand-wordmark", "brand", "artifacts/sendflow/src/assets/sendflow-wordmark-original.png", "image/png", "Logo texte SendFlow", "SendFlow wordmark"],
  ["hero-placeholder", "illustration", "artifacts/sendflow/src/assets/generated_images/sendflow-hero-placeholder.png", "image/png", "Illustration de réseaux connectés", "Connected network illustration"],
  ["hero-globe", "illustration", "artifacts/sendflow/src/assets/generated_images/sendflow-earth-globe-transparent.png", "image/png", "Globe terrestre animé", "Animated earth globe"],
  ["hero-global-connection", "illustration", "attached_assets/file_000000003d2481f8a4200aa758aa64b9_1789047674015.png", "image/png", "Homme devant un globe reliant l’Afrique et l’Europe", "Man in front of a globe connecting Africa and Europe"],
  ["network-section-art", "illustration", "artifacts/sendflow/src/assets/generated_images/sendflow-section-network-3d-transparent.png", "image/png", "Réseaux de paiement interconnectés", "Interconnected payment networks"],
  ["how-it-works-art", "illustration", "artifacts/sendflow/src/assets/generated_images/sendflow-section-how-it-works-3d-transparent.png", "image/png", "Parcours SendFlow en trois étapes", "Three-step SendFlow journey"],
  ["international-section-art", "illustration", "artifacts/sendflow/src/assets/generated_images/sendflow-section-international-3d-transparent.png", "image/png", "Transferts internationaux", "International transfers"],
  ["security-section-art", "illustration", "artifacts/sendflow/src/assets/generated_images/sendflow-section-security-3d-transparent.png", "image/png", "Protection des transferts", "Transfer protection"],
  ["security-guardian", "illustration", "artifacts/sendflow/src/assets/generated_images/sendflow-security-guardian-3d-transparent.png", "image/png", "Gardien de la sécurité SendFlow", "SendFlow security guardian"],
  ["coverage-section-art", "illustration", "artifacts/sendflow/src/assets/generated_images/sendflow-section-coverage-3d-transparent.png", "image/png", "Couverture africaine SendFlow", "SendFlow African coverage"],
  ["download-section-art", "illustration", "artifacts/sendflow/src/assets/generated_images/sendflow-section-download-3d-transparent.png", "image/png", "Téléchargement de l’application", "App download"],
  ["network-person", "character", "artifacts/sendflow/src/assets/generated_images/sendflow-network-person-3d-transparent.png", "image/png", "Personnage SendFlow et réseaux", "SendFlow character and networks"],
  ["how-person", "character", "artifacts/sendflow/src/assets/generated_images/sendflow-how-person-3d-transparent.png", "image/png", "Personnage SendFlow pour le parcours", "SendFlow character for the journey"],
  ["international-person", "character", "artifacts/sendflow/src/assets/generated_images/sendflow-international-person-3d-transparent.png", "image/png", "Personnage SendFlow pour l’international", "SendFlow character for international transfers"],
  ["coverage-person", "character", "artifacts/sendflow/src/assets/generated_images/sendflow-coverage-person-3d-transparent.png", "image/png", "Personnage SendFlow pour la couverture", "SendFlow character for coverage"],
  ["download-person", "character", "artifacts/sendflow/src/assets/generated_images/sendflow-download-person-3d-transparent.png", "image/png", "Personnage SendFlow pour le téléchargement", "SendFlow character for the download section"],
  ["step-choose", "illustration", "artifacts/sendflow/src/assets/generated_images/sendflow-step-choose-3d-transparent.png", "image/png", "Étape choisir", "Choose step"],
  ["step-check", "illustration", "artifacts/sendflow/src/assets/generated_images/sendflow-step-check-3d-transparent.png", "image/png", "Étape vérifier", "Check step"],
  ["step-send", "illustration", "artifacts/sendflow/src/assets/generated_images/sendflow-step-send-3d-transparent.png", "image/png", "Étape envoyer", "Send step"],
  ["operator-ticker", "operator-strip", "artifacts/sendflow/src/assets/operator-logos_(1)_1789039877510.png", "image/png", "Logos des opérateurs partenaires", "Partner operator logos"],
  ["operator-orange", "operator", "artifacts/sendflow/src/assets/operator-logos/operator-logo-01.png", "image/png", "Logo Orange", "Orange logo"],
  ["operator-moov", "operator", "artifacts/sendflow/src/assets/operator-logos/operator-logo-02.png", "image/png", "Logo Moov Africa", "Moov Africa logo"],
  ["operator-wave", "operator", "artifacts/sendflow/src/assets/operator-logos/operator-logo-03.png", "image/png", "Logo Wave", "Wave logo"],
  ["operator-airtel", "operator", "artifacts/sendflow/src/assets/operator-logos/operator-logo-04.png", "image/png", "Logo Airtel", "Airtel logo"],
  ["operator-mtn", "operator", "artifacts/sendflow/src/assets/operator-logos/operator-logo-momo-mtn.png", "image/png", "Logo MTN Mobile Money", "MTN Mobile Money logo"],
  ["operator-free", "operator", "artifacts/sendflow/src/assets/operator-logos/operator-logo-07.png", "image/png", "Logo Free", "Free logo"],
  ["operator-mixx", "operator", "artifacts/sendflow/src/assets/operator-logos/operator-logo-08.png", "image/png", "Logo Mixx", "Mixx logo"],
  ["operator-mpesa", "operator", "artifacts/sendflow/src/assets/operator-logos/operator-logo-09.png", "image/png", "Logo M-Pesa", "M-Pesa logo"],
  ["icon-cross-network", "icon", "artifacts/sendflow/src/assets/sendflow-icon-cross-network.svg", "image/svg+xml", "Icône transfert inter-réseaux", "Cross-network transfer icon"],
  ["icon-international", "icon", "artifacts/sendflow/src/assets/sendflow-icon-international-transfer.svg", "image/svg+xml", "Icône transfert international", "International transfer icon"],
  ["icon-tracking", "icon", "artifacts/sendflow/src/assets/sendflow-icon-transaction-tracking.svg", "image/svg+xml", "Icône suivi des transactions", "Transaction tracking icon"],
  ["icon-simple", "icon", "artifacts/sendflow/src/assets/sendflow-icon-simple-experience.svg", "image/svg+xml", "Icône expérience simple", "Simple experience icon"],
  ["icon-visible-details", "icon", "artifacts/sendflow/src/assets/sendflow-icon-visible-details.svg", "image/svg+xml", "Icône détails visibles", "Visible details icon"],
  ["icon-private", "icon", "artifacts/sendflow/src/assets/sendflow-icon-private.svg", "image/svg+xml", "Icône confidentialité", "Privacy icon"],
];

const countries = [
  ["CI", "Côte d’Ivoire", "Ivory Coast", "🇨🇮", ["Orange", "MTN", "Moov Africa", "Wave"]],
  ["BJ", "Bénin", "Benin", "🇧🇯", ["MTN", "Moov Africa"]],
  ["TG", "Togo", "Togo", "🇹🇬", ["T-Money", "Moov Africa"]],
  ["CM", "Cameroun", "Cameroon", "🇨🇲", ["MTN", "Orange"]],
  ["BF", "Burkina Faso", "Burkina Faso", "🇧🇫", ["Orange", "Moov Africa", "Wave", "Telecel Faso"]],
  ["CV", "Cap-Vert", "Cape Verde", "🇨🇻", ["CVMóvel", "Unitel T+"]],
  ["GM", "Gambie", "The Gambia", "🇬🇲", ["Africell", "QCell", "Comium"]],
  ["GN", "Guinée", "Guinea", "🇬🇳", ["Orange", "MTN", "Cellcom"]],
  ["GW", "Guinée-Bissau", "Guinea-Bissau", "🇬🇼", ["Orange", "MTN"]],
  ["LR", "Liberia", "Liberia", "🇱🇷", ["Lonestar Cell MTN", "Orange", "Africell"]],
  ["ML", "Mali", "Mali", "🇲🇱", ["Orange", "Moov Africa", "Telecel Mali"]],
  ["MR", "Mauritanie", "Mauritania", "🇲🇷", ["Mauritel", "Mattel", "Chinguitel"]],
  ["NE", "Niger", "Niger", "🇳🇪", ["Airtel", "Moov Africa", "Zamani Telecom"]],
  ["NG", "Nigeria", "Nigeria", "🇳🇬", ["MTN", "Airtel", "Glo", "9mobile"]],
  ["SL", "Sierra Leone", "Sierra Leone", "🇸🇱", ["Africell", "Orange", "QCell"]],
  ["SN", "Sénégal", "Senegal", "🇸🇳", ["Orange", "Free", "Moov Africa", "Expresso", "Wave"]],
  ["GH", "Ghana", "Ghana", "🇬🇭", ["MTN", "Telecel", "AT"]],
  ["KE", "Kenya", "Kenya", "🇰🇪", ["Safaricom", "Airtel", "Telkom"]],
];

const operatorMeta = {
  Orange: ["operator-orange", "#ff7900", "#ffffff"],
  MTN: ["operator-mtn", "#ffca05", "#17131f"],
  "Moov Africa": ["operator-moov", "#e83e8c", "#ffffff"],
  Wave: ["operator-wave", "#1769ff", "#ffffff"],
  Airtel: ["operator-airtel", "#e4002b", "#ffffff"],
  Free: ["operator-free", "#111827", "#ffffff"],
  "M-Pesa": ["operator-mpesa", "#f2f2f2", "#17131f"],
};

const sections = [
  ["hero", "hero", 1, null, null, "L’argent circule. Les réseaux aussi.", "Money moves. Networks do too.", "SendFlow simplifie vos transferts d’argent entre différents réseaux de paiement, localement et au-delà des frontières.", "SendFlow simplifies money transfers across different payment networks, locally and across borders.", "hero-global-connection"],
  ["networks", "network", 2, null, null, "Plusieurs réseaux. Une seule destination.", "Many networks. One destination.", "Envoyer de l’argent ne devrait pas dépendre du réseau utilisé par votre proche.", "Sending money should not depend on the network your loved one uses.", "network-section-art"],
  ["how-it-works", "process", 3, null, null, "Un passage simple.", "One clear passage.", "SendFlow rend chaque étape visible, du premier clic au dernier.", "SendFlow makes every step visible, from first click to last.", "how-it-works-art"],
  ["international", "coverage", 4, null, null, "Votre argent, sans frontières mentales.", "Your money, without mental borders.", "Explorez la couverture et les connexions qui donnent vie à SendFlow.", "Explore the coverage and connections that bring SendFlow to life.", "international-section-art"],
  ["security", "security", 5, null, null, "Chaque étape à découvert.", "Every step, in the clear.", "Le calme vient de ce que l’on comprend.", "Calm comes from understanding.", "security-section-art"],
  ["operators", "operators", 6, null, null, "Des opérateurs qui parlent mieux.", "Networks that speak clearly.", "Les principaux réseaux de paiement disponibles en Afrique.", "The main payment networks available across Africa.", "operator-ticker"],
  ["faq", "faq", 7, null, null, "Vous avez raison.", "Good questions.", "Une idée nouvelle mérite des réponses simples.", "A new idea deserves simple answers.", null],
  ["join", "cta", 8, "The next move", "The next move", "Prêt·e à faire bouger les choses ?", "Ready to move things?", "Recevez les prochaines nouvelles de SendFlow. Pas de bruit, juste les avancées.", "Get the next SendFlow updates. No noise, just progress.", "download-section-art"],
];

const features = [
  ["cross-network", "feature", 1, "Transfert inter-réseaux", "Cross-network transfers", "Relier les réseaux sans demander au bénéficiaire de changer ses habitudes.", "Connect networks without asking recipients to change their habits.", "icon-cross-network", null],
  ["international-transfer", "feature", 2, "Transfert international", "International transfers", "Explorer les chemins possibles entre pays africains, lorsque disponibles.", "Explore possible routes across African countries where available.", "icon-international", null],
  ["tracking", "feature", 3, "Suivi des transactions", "Transaction tracking", "Voir où en est chaque étape avant de confirmer.", "See where each step stands before confirming.", "icon-tracking", null],
  ["simple-experience", "feature", 4, "Expérience simple", "Simple experience", "Moins de friction, plus de confiance dans chaque choix.", "Less friction, more confidence in every choice.", "icon-simple", null],
  ["simplicity", "principle", 5, "Simplicité", "Simplicity", "Des choix clairs, sans détour.", "Clear choices, no detours.", null, "how-person"],
  ["speed", "principle", 6, "Rapidité", "Speed", "Un parcours court et lisible.", "A short, readable journey.", null, "international-person"],
  ["interoperability", "principle", 7, "Interopérabilité", "Interoperability", "Des réseaux qui peuvent mieux dialoguer.", "Networks that can speak more clearly.", null, "network-person"],
  ["choose", "step", 8, "Choisissez", "Choose", "Votre pays, votre réseau, votre destination.", "Your country, your network, your destination.", "step-choose", null],
  ["check", "step", 9, "Vérifiez", "Check", "Le montant et le chemin, sans surprise.", "The amount and the path, no surprises.", "step-check", null],
  ["send", "step", 10, "Envoyez", "Send", "Un dernier regard. Puis, c’est parti.", "One last look. Then, it moves.", "step-send", null],
];

const faqs = [
  ["Qu’est-ce que SendFlow ?", "What is SendFlow?", "SendFlow simplifie les transferts d’argent entre réseaux Mobile Money avec un parcours clair, rapide et lisible.", "SendFlow simplifies money transfers between Mobile Money networks with a clear, fast, and easy-to-follow journey."],
  ["Quels réseaux sont disponibles ?", "Which networks are available?", "La couverture SendFlow réunit les principaux opérateurs disponibles dans les pays couverts.", "SendFlow coverage brings together the main operators available in supported countries."],
  ["Puis-je transférer vers un autre pays ?", "Can I transfer to another country?", "Oui, lorsque les conditions locales et les réseaux partenaires le permettent.", "Yes, where local conditions and partner networks allow it."],
  ["Comment suivre un transfert ?", "How do I track a transfer?", "SendFlow affiche chaque étape, de la vérification à la confirmation.", "SendFlow shows every step from review to confirmation."],
  ["SendFlow possède-t-il un wallet ?", "Does SendFlow have a wallet?", "Non. SendFlow agit comme une couche de connexion entre réseaux, et non comme un wallet.", "No. SendFlow acts as a connection layer between networks, not as a wallet."],
];

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
  ["language.switch", "navigation", "Passer en anglais", "Switch to French"],
  ["footer.company", "footer", "Flow Digital SARL", "Flow Digital SARL"],
  ["footer.location", "footer", "Côte d’Ivoire · Abidjan, Cocody Riviera Palmeraie", "Côte d’Ivoire · Abidjan, Cocody Riviera Palmeraie"],
  ["footer.demo", "footer", "Démo uniquement · Aucun engagement", "Demo only · No commitment"],
];

const legalPages = [
  ["mentions-legales", "Mentions légales", "Legal notice", "Cette page présente l’identité de l’éditeur de SendFlow et les informations de publication.", "This page presents SendFlow’s publisher identity and publication information."],
  ["conditions-utilisation", "Conditions générales d’utilisation", "Terms of use", "Les présentes conditions encadrent l’accès au site, à l’application et aux fonctionnalités SendFlow.", "These terms govern access to the site, app, and SendFlow features."],
  ["confidentialite", "Politique de confidentialité", "Privacy policy", "Cette politique décrit les données traitées par le site et le projet SendFlow.", "This policy describes the data processed by the SendFlow site and project."],
];

async function upsertMedia(client) {
  for (const [slug, kind, sourcePath, mimeType, altFr, altEn] of media) {
    await client.query(
      `INSERT INTO landing_media (slug, kind, source_path, mime_type, alt_fr, alt_en)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (slug) DO UPDATE SET kind = EXCLUDED.kind, source_path = EXCLUDED.source_path,
         mime_type = EXCLUDED.mime_type, alt_fr = EXCLUDED.alt_fr, alt_en = EXCLUDED.alt_en,
         updated_at = NOW()`,
      [slug, kind, sourcePath, mimeType, altFr, altEn],
    );
  }
}

async function seed(client) {
  await upsertMedia(client);

  for (const [slug, kind, orderIndex, eyebrowFr, eyebrowEn, titleFr, titleEn, bodyFr, bodyEn, imageKey] of sections) {
    await client.query(
      `INSERT INTO landing_sections
        (slug, kind, order_index, eyebrow_fr, eyebrow_en, title_fr, title_en, body_fr, body_en, image_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (slug) DO UPDATE SET kind=EXCLUDED.kind, order_index=EXCLUDED.order_index,
         eyebrow_fr=EXCLUDED.eyebrow_fr, eyebrow_en=EXCLUDED.eyebrow_en, title_fr=EXCLUDED.title_fr,
         title_en=EXCLUDED.title_en, body_fr=EXCLUDED.body_fr, body_en=EXCLUDED.body_en,
         image_key=EXCLUDED.image_key, updated_at=NOW()`,
      [slug, kind, orderIndex, eyebrowFr, eyebrowEn, titleFr, titleEn, bodyFr, bodyEn, imageKey],
    );
  }

  for (const [slug, group, orderIndex, titleFr, titleEn, bodyFr, bodyEn, iconKey, imageKey] of features) {
    await client.query(
      `INSERT INTO landing_features
        (slug, "group", order_index, title_fr, title_en, body_fr, body_en, icon_key, image_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (slug) DO UPDATE SET "group"=EXCLUDED."group", order_index=EXCLUDED.order_index,
         title_fr=EXCLUDED.title_fr, title_en=EXCLUDED.title_en, body_fr=EXCLUDED.body_fr,
         body_en=EXCLUDED.body_en, icon_key=EXCLUDED.icon_key, image_key=EXCLUDED.image_key,
         updated_at=NOW()`,
      [slug, group, orderIndex, titleFr, titleEn, bodyFr, bodyEn, iconKey, imageKey],
    );
  }

  for (const [orderIndex, [questionFr, questionEn, answerFr, answerEn]] of faqs.entries()) {
    await client.query(
      `INSERT INTO landing_faqs (order_index, question_fr, question_en, answer_fr, answer_en)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (order_index) DO UPDATE SET question_fr=EXCLUDED.question_fr,
         question_en=EXCLUDED.question_en, answer_fr=EXCLUDED.answer_fr, answer_en=EXCLUDED.answer_en,
         updated_at=NOW()`,
      [orderIndex + 1, questionFr, questionEn, answerFr, answerEn],
    );
  }

  for (const [orderIndex, [code, nameFr, nameEn, flag]] of countries.entries()) {
    await client.query(
      `INSERT INTO landing_countries (code, name_fr, name_en, flag, tone, order_index)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (code) DO UPDATE SET name_fr=EXCLUDED.name_fr, name_en=EXCLUDED.name_en,
         flag=EXCLUDED.flag, tone=EXCLUDED.tone, order_index=EXCLUDED.order_index, updated_at=NOW()`,
      [code, nameFr, nameEn, flag, "#dbeaff", orderIndex + 1],
    );
  }

  const networks = [...new Set(countries.flatMap(([, , , , countryNetworks]) => countryNetworks))];
  for (const network of networks) {
    const [logoKey, background, foreground] = operatorMeta[network] ?? [null, "#6d35d8", "#ffffff"];
    const slug = network.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await client.query(
      `INSERT INTO landing_operators (slug, name, logo_key, background, foreground)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, logo_key=EXCLUDED.logo_key,
         background=EXCLUDED.background, foreground=EXCLUDED.foreground, updated_at=NOW()`,
      [slug, network, logoKey, background, foreground],
    );
  }

  const countryIds = new Map((await client.query("SELECT id, code FROM landing_countries")).rows.map((row) => [row.code, row.id]));
  const operatorIds = new Map((await client.query("SELECT id, name FROM landing_operators")).rows.map((row) => [row.name, row.id]));

  for (const [code, , , , countryNetworks] of countries) {
    for (const [orderIndex, network] of countryNetworks.entries()) {
      await client.query(
        `INSERT INTO landing_country_operators (country_id, operator_id, order_index)
         VALUES ($1,$2,$3)
         ON CONFLICT (country_id, operator_id) DO UPDATE SET order_index=EXCLUDED.order_index`,
        [countryIds.get(code), operatorIds.get(network), orderIndex + 1],
      );
    }
  }

  const globeBadges = [
    ["Orange", 54, 39, 1],
    ["MTN", 37, 9, 2],
    ["Wave", 97, 32, 3],
    ["Moov Africa", 91, 83, 4],
    ["Airtel", 54, 93, 5],
  ];
  for (const [network, positionX, positionY, orderIndex] of globeBadges) {
    await client.query(
      `INSERT INTO landing_globe_badges (operator_id, position_x, position_y, order_index)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (order_index) DO UPDATE SET operator_id=EXCLUDED.operator_id,
         position_x=EXCLUDED.position_x, position_y=EXCLUDED.position_y, updated_at=NOW()`,
      [operatorIds.get(network), positionX, positionY, orderIndex],
    );
  }

  for (const [contentKey, group, fr, en] of content) {
    for (const [locale, value] of [["fr", fr], ["en", en]]) {
      await client.query(
        `INSERT INTO landing_content (content_key, locale, "group", value)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (content_key, locale) DO UPDATE SET "group"=EXCLUDED."group",
           value=EXCLUDED.value, updated_at=NOW()`,
        [contentKey, locale, group, value],
      );
    }
  }

  for (const [slug, titleFr, titleEn, introFr, introEn] of legalPages) {
    await client.query(
      `INSERT INTO legal_pages (slug, title_fr, title_en, intro_fr, intro_en)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (slug) DO UPDATE SET title_fr=EXCLUDED.title_fr, title_en=EXCLUDED.title_en,
         intro_fr=EXCLUDED.intro_fr, intro_en=EXCLUDED.intro_en, updated_at=NOW()`,
      [slug, titleFr, titleEn, introFr, introEn],
    );
  }
}

try {
  await seed(pool);
  const counts = await pool.query(`
    SELECT 'landing_media' AS table_name, COUNT(*)::int AS count FROM landing_media
    UNION ALL SELECT 'landing_content', COUNT(*)::int FROM landing_content
    UNION ALL SELECT 'landing_sections', COUNT(*)::int FROM landing_sections
    UNION ALL SELECT 'landing_features', COUNT(*)::int FROM landing_features
    UNION ALL SELECT 'landing_faqs', COUNT(*)::int FROM landing_faqs
    UNION ALL SELECT 'landing_countries', COUNT(*)::int FROM landing_countries
    UNION ALL SELECT 'landing_operators', COUNT(*)::int FROM landing_operators
    UNION ALL SELECT 'landing_country_operators', COUNT(*)::int FROM landing_country_operators
    UNION ALL SELECT 'landing_globe_badges', COUNT(*)::int FROM landing_globe_badges
    UNION ALL SELECT 'legal_pages', COUNT(*)::int FROM legal_pages
  `);
  for (const row of counts.rows) console.log(`${row.table_name}: ${row.count}`);
} finally {
  await pool.end();
}