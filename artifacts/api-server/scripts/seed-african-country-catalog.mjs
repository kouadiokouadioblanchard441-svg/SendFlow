import { pathToFileURL } from "node:url";

export const AFRICAN_COUNTRIES = [
  { countryCode: "dz", countryName: "Algérie", phonePrefix: "+213", minPhoneDigits: 8, maxPhoneDigits: 9 },
  { countryCode: "ao", countryName: "Angola", phonePrefix: "+244", minPhoneDigits: 9, maxPhoneDigits: 9 },
  { countryCode: "bj", countryName: "Bénin", phonePrefix: "+229", minPhoneDigits: 10, maxPhoneDigits: 10 },
  { countryCode: "bw", countryName: "Botswana", phonePrefix: "+267", minPhoneDigits: 7, maxPhoneDigits: 10 },
  { countryCode: "bf", countryName: "Burkina Faso", phonePrefix: "+226", minPhoneDigits: 8, maxPhoneDigits: 8 },
  { countryCode: "bi", countryName: "Burundi", phonePrefix: "+257", minPhoneDigits: 8, maxPhoneDigits: 8 },
  { countryCode: "cv", countryName: "Cap-Vert", phonePrefix: "+238", minPhoneDigits: 7, maxPhoneDigits: 7 },
  { countryCode: "cm", countryName: "Cameroun", phonePrefix: "+237", minPhoneDigits: 9, maxPhoneDigits: 9 },
  { countryCode: "cf", countryName: "République centrafricaine", phonePrefix: "+236", minPhoneDigits: 8, maxPhoneDigits: 8 },
  { countryCode: "td", countryName: "Tchad", phonePrefix: "+235", minPhoneDigits: 8, maxPhoneDigits: 8 },
  { countryCode: "km", countryName: "Comores", phonePrefix: "+269", minPhoneDigits: 7, maxPhoneDigits: 7 },
  { countryCode: "cg", countryName: "Congo-Brazzaville", phonePrefix: "+242", minPhoneDigits: 9, maxPhoneDigits: 9 },
  { countryCode: "cd", countryName: "Congo-Kinshasa", phonePrefix: "+243", minPhoneDigits: 7, maxPhoneDigits: 10 },
  { countryCode: "ci", countryName: "Côte d’Ivoire", phonePrefix: "+225", minPhoneDigits: 10, maxPhoneDigits: 10 },
  { countryCode: "dj", countryName: "Djibouti", phonePrefix: "+253", minPhoneDigits: 8, maxPhoneDigits: 8 },
  { countryCode: "eg", countryName: "Égypte", phonePrefix: "+20", minPhoneDigits: 8, maxPhoneDigits: 10 },
  { countryCode: "gq", countryName: "Guinée équatoriale", phonePrefix: "+240", minPhoneDigits: 9, maxPhoneDigits: 9 },
  { countryCode: "er", countryName: "Érythrée", phonePrefix: "+291", minPhoneDigits: 7, maxPhoneDigits: 7 },
  { countryCode: "sz", countryName: "Eswatini", phonePrefix: "+268", minPhoneDigits: 8, maxPhoneDigits: 9 },
  { countryCode: "et", countryName: "Éthiopie", phonePrefix: "+251", minPhoneDigits: 9, maxPhoneDigits: 9 },
  { countryCode: "ga", countryName: "Gabon", phonePrefix: "+241", minPhoneDigits: 7, maxPhoneDigits: 8 },
  { countryCode: "gm", countryName: "Gambie", phonePrefix: "+220", minPhoneDigits: 7, maxPhoneDigits: 9 },
  { countryCode: "gh", countryName: "Ghana", phonePrefix: "+233", minPhoneDigits: 8, maxPhoneDigits: 9 },
  { countryCode: "gn", countryName: "Guinée", phonePrefix: "+224", minPhoneDigits: 8, maxPhoneDigits: 9 },
  { countryCode: "gw", countryName: "Guinée-Bissau", phonePrefix: "+245", minPhoneDigits: 7, maxPhoneDigits: 9 },
  { countryCode: "ke", countryName: "Kenya", phonePrefix: "+254", minPhoneDigits: 7, maxPhoneDigits: 10 },
  { countryCode: "ls", countryName: "Lesotho", phonePrefix: "+266", minPhoneDigits: 8, maxPhoneDigits: 8 },
  { countryCode: "lr", countryName: "Liberia", phonePrefix: "+231", minPhoneDigits: 7, maxPhoneDigits: 9 },
  { countryCode: "ly", countryName: "Libye", phonePrefix: "+218", minPhoneDigits: 9, maxPhoneDigits: 9 },
  { countryCode: "mg", countryName: "Madagascar", phonePrefix: "+261", minPhoneDigits: 9, maxPhoneDigits: 9 },
  { countryCode: "mw", countryName: "Malawi", phonePrefix: "+265", minPhoneDigits: 7, maxPhoneDigits: 9 },
  { countryCode: "ml", countryName: "Mali", phonePrefix: "+223", minPhoneDigits: 8, maxPhoneDigits: 8 },
  { countryCode: "mr", countryName: "Mauritanie", phonePrefix: "+222", minPhoneDigits: 8, maxPhoneDigits: 8 },
  { countryCode: "mu", countryName: "Maurice", phonePrefix: "+230", minPhoneDigits: 7, maxPhoneDigits: 10 },
  { countryCode: "ma", countryName: "Maroc", phonePrefix: "+212", minPhoneDigits: 9, maxPhoneDigits: 9 },
  { countryCode: "mz", countryName: "Mozambique", phonePrefix: "+258", minPhoneDigits: 8, maxPhoneDigits: 9 },
  { countryCode: "na", countryName: "Namibie", phonePrefix: "+264", minPhoneDigits: 8, maxPhoneDigits: 9 },
  { countryCode: "ne", countryName: "Niger", phonePrefix: "+227", minPhoneDigits: 8, maxPhoneDigits: 8 },
  { countryCode: "ng", countryName: "Nigeria", phonePrefix: "+234", minPhoneDigits: 10, maxPhoneDigits: 12 },
  { countryCode: "rw", countryName: "Rwanda", phonePrefix: "+250", minPhoneDigits: 8, maxPhoneDigits: 9 },
  { countryCode: "st", countryName: "Sao Tomé-et-Principe", phonePrefix: "+239", minPhoneDigits: 7, maxPhoneDigits: 7 },
  { countryCode: "sn", countryName: "Sénégal", phonePrefix: "+221", minPhoneDigits: 9, maxPhoneDigits: 9 },
  { countryCode: "sc", countryName: "Seychelles", phonePrefix: "+248", minPhoneDigits: 7, maxPhoneDigits: 7 },
  { countryCode: "sl", countryName: "Sierra Leone", phonePrefix: "+232", minPhoneDigits: 8, maxPhoneDigits: 8 },
  { countryCode: "so", countryName: "Somalie", phonePrefix: "+252", minPhoneDigits: 6, maxPhoneDigits: 9 },
  { countryCode: "za", countryName: "Afrique du Sud", phonePrefix: "+27", minPhoneDigits: 6, maxPhoneDigits: 10 },
  { countryCode: "ss", countryName: "Soudan du Sud", phonePrefix: "+211", minPhoneDigits: 9, maxPhoneDigits: 9 },
  { countryCode: "sd", countryName: "Soudan", phonePrefix: "+249", minPhoneDigits: 9, maxPhoneDigits: 9 },
  { countryCode: "tz", countryName: "Tanzanie", phonePrefix: "+255", minPhoneDigits: 9, maxPhoneDigits: 9 },
  { countryCode: "tg", countryName: "Togo", phonePrefix: "+228", minPhoneDigits: 8, maxPhoneDigits: 8 },
  { countryCode: "tn", countryName: "Tunisie", phonePrefix: "+216", minPhoneDigits: 8, maxPhoneDigits: 8 },
  { countryCode: "ug", countryName: "Ouganda", phonePrefix: "+256", minPhoneDigits: 9, maxPhoneDigits: 9 },
  { countryCode: "zm", countryName: "Zambie", phonePrefix: "+260", minPhoneDigits: 9, maxPhoneDigits: 9 },
  { countryCode: "zw", countryName: "Zimbabwe", phonePrefix: "+263", minPhoneDigits: 7, maxPhoneDigits: 10 },
].map((country) => ({
  ...country,
  enabled: true,
  depositEnabled: false,
  interNetworkEnabled: false,
  internationalEnabled: false,
}));

export function assertPleskProductionEnvironment(environment) {
  if (
    environment.NODE_ENV !== "production" ||
    environment.SENDFLOW_DATABASE_TARGET !== "production" ||
    environment.REPL_ID
  ) {
    throw new Error("Country catalog seeding is allowed only in the Plesk production runtime.");
  }
  if (!environment.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required; SUPABASE_DATABASE_URL is not used by this script.");
  }
  if (!environment.DATABASE_CA_CERT?.trim()) {
    throw new Error("DATABASE_CA_CERT is required for verified Supabase TLS.");
  }
}

export function createProductionDatabaseOptions(environment) {
  assertPleskProductionEnvironment(environment);

  let url;
  try {
    url = new URL(environment.DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
      throw new Error("Invalid database configuration.");
    }
    if (["disable", "allow"].includes(url.searchParams.get("sslmode") ?? "")) {
      throw new Error("An insecure database TLS mode is not allowed.");
    }
  } catch {
    throw new Error("Plesk production database configuration is invalid.");
  }

  const servername = url.hostname;
  url.searchParams.delete("sslmode");
  url.searchParams.delete("ssl");
  url.searchParams.delete("uselibpqcompat");

  return {
    connectionString: url.toString(),
    ssl: {
      ca: environment.DATABASE_CA_CERT,
      rejectUnauthorized: true,
      servername,
    },
    max: 1,
    connectionTimeoutMillis: 5000,
  };
}

const INSERT_COUNTRIES_SQL = `
  INSERT INTO public.sf_countries
    (country_code, country_name, phone_prefix, min_phone_digits, max_phone_digits,
     enabled, deposit_enabled, inter_network_enabled, international_enabled,
     created_by, updated_by)
  SELECT incoming.country_code, incoming.country_name, incoming.phone_prefix,
         incoming.min_phone_digits, incoming.max_phone_digits, incoming.enabled,
         incoming.deposit_enabled, incoming.inter_network_enabled,
         incoming.international_enabled, 'system:migration', 'system:migration'
  FROM unnest(
    $1::varchar[], $2::varchar[], $3::varchar[], $4::integer[], $5::integer[],
    $6::boolean[], $7::boolean[], $8::boolean[], $9::boolean[]
  ) AS incoming(
    country_code, country_name, phone_prefix, min_phone_digits, max_phone_digits,
    enabled, deposit_enabled, inter_network_enabled, international_enabled
  )
  ON CONFLICT (country_code) DO NOTHING
`;

export async function seedAfricanCountryCatalog(environment = process.env) {
  const options = createProductionDatabaseOptions(environment);
  const { Pool } = await import("pg");
  const pool = new Pool(options);
  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SET LOCAL statement_timeout = '10s'");

    const arrays = [
      "countryCode",
      "countryName",
      "phonePrefix",
      "minPhoneDigits",
      "maxPhoneDigits",
      "enabled",
      "depositEnabled",
      "interNetworkEnabled",
      "internationalEnabled",
    ].map((key) => AFRICAN_COUNTRIES.map((country) => country[key]));

    const inserted = await client.query(INSERT_COUNTRIES_SQL, arrays);
    const verified = await client.query(
      "SELECT count(*)::integer AS count FROM public.sf_countries WHERE country_code = ANY($1::varchar[])",
      [AFRICAN_COUNTRIES.map((country) => country.countryCode)],
    );
    if (verified.rows[0]?.count !== AFRICAN_COUNTRIES.length) {
      throw new Error("Country catalog verification did not find all expected countries.");
    }

    await client.query("COMMIT");
    return { inserted: inserted.rowCount ?? 0, present: verified.rows[0].count };
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original error category; never log connection details.
      }
    }
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await seedAfricanCountryCatalog();
    console.log(`Country catalog seed verified: ${result.present} African countries; ${result.inserted} newly inserted.`);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "configuration-or-migration-error";
    console.error(`Country catalog seed stopped safely (${code}). No connection values or row data were logged.`);
    process.exitCode = 1;
  }
}
