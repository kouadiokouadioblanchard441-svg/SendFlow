import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("NEON_DATABASE_URL or DATABASE_URL must be set");
}

const pool = new Pool({ connectionString });

const values = [
  "Fondateur de SendFlow",
  "Fondateur & CEO",
  "Founder & CEO",
  "Un profil finance-comptabilité devenu bâtisseur de produits numériques, avec une conviction : la technologie doit clarifier les mouvements d’argent.",
  "A finance and accounting profile turned digital product builder, with one conviction: technology should make money movement clearer.",
  "Je viens de la finance-comptabilité, un univers qui apprend à regarder les chiffres, les risques et les détails. En me lançant dans la tech, j’ai voulu transformer cette rigueur en une expérience concrète : aider les personnes à envoyer de l’argent entre réseaux sans se perdre dans la complexité.",
  "I come from finance and accounting, a world that teaches you to look at numbers, risk, and detail. Moving into tech, I wanted to turn that discipline into a concrete experience: helping people send money across networks without getting lost in complexity.",
  "Faire de chaque transfert un parcours compréhensible, fiable et ouvert, où les réseaux rapprochent les personnes au lieu de créer de nouvelles frontières.",
  "Make every transfer understandable, reliable, and open, so networks bring people closer instead of creating new borders.",
  "Formation en finance-comptabilité · Côte d’Ivoire",
  "Finance & accounting background · Côte d’Ivoire",
  "Connecter les réseaux de paiement et les personnes qui les utilisent, sans imposer la complexité technique à ceux qui veulent simplement aider, recevoir ou avancer.",
  "Connect payment networks and the people who use them, without placing technical complexity on those who simply want to help, receive, or move forward.",
  null,
  "",
  "hello@sendflow.studio",
];

try {
  await pool.query(
    `INSERT INTO landing_founder_profile
      (name, role_fr, role_en, short_bio_fr, short_bio_en, story_fr, story_en, vision_fr, vision_en, education_fr, education_en, mission_fr, mission_en, photo_key, linkedin_url, email)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
     WHERE NOT EXISTS (SELECT 1 FROM landing_founder_profile)`,
    values,
  );
  console.log("Founder profile ensured.");
} finally {
  await pool.end();
}