/**
 * Technical coverage, not merchant entitlements or SendFlow activation flags.
 * Source: https://docs.feexpay.me/?section=api-rest-integrations&version=v2
 * and ?section=services-payout&version=v2 (official Postman export, 2026-10-22).
 * Sandbox coverage is deliberately narrower than production coverage.
 */
export type FeexpayCountryCode = "BJ" | "BF" | "CI" | "SN" | "TG" | "CG";
export type FeexpayCurrency = "XOF" | "XAF";
export interface FeexpayChannel {
  id: string;
  countryCode: FeexpayCountryCode;
  operator: string;
  payinPath: string;
  payoutPath: string | null;
  payoutNetwork?: string;
  requiresOtp?: boolean;
  sandbox: boolean;
}

export const feexpayCountries = [
  { countryCode: "BJ", countryName: "Bénin", currency: "XOF", phonePrefix: "229" },
  { countryCode: "BF", countryName: "Burkina Faso", currency: "XOF", phonePrefix: "226" },
  { countryCode: "CI", countryName: "Côte d’Ivoire", currency: "XOF", phonePrefix: "225" },
  { countryCode: "SN", countryName: "Sénégal", currency: "XOF", phonePrefix: "221" },
  { countryCode: "TG", countryName: "Togo", currency: "XOF", phonePrefix: "228" },
  { countryCode: "CG", countryName: "Congo-Brazzaville", currency: "XAF", phonePrefix: "242" },
] as const;

const payin = "/api/transactions/public/requesttopay/";
const payout = "/api/payouts/public/";
export const feexpayChannels: readonly FeexpayChannel[] = [
  { id: "mtn-bj", countryCode: "BJ", operator: "MTN", payinPath: `${payin}mtn`, payoutPath: `${payout}transfer/global`, payoutNetwork: "MTN", sandbox: true },
  { id: "moov-bj", countryCode: "BJ", operator: "Moov", payinPath: `${payin}moov`, payoutPath: `${payout}transfer/global`, payoutNetwork: "MOOV", sandbox: true },
  { id: "celtiis-bj", countryCode: "BJ", operator: "Celtiis", payinPath: `${payin}celtiis_bj`, payoutPath: `${payout}celtiis_bj`, payoutNetwork: "CELTIIS BJ", sandbox: true },
  { id: "coris-bj", countryCode: "BJ", operator: "Coris", payinPath: `${payin}coris`, payoutPath: null, requiresOtp: true, sandbox: false },
  { id: "moov-bf", countryCode: "BF", operator: "Moov", payinPath: `${payin}moov_bf`, payoutPath: `${payout}moov_bf`, sandbox: false },
  { id: "orange-bf", countryCode: "BF", operator: "Orange", payinPath: `${payin}orange_bf`, payoutPath: `${payout}orange_bf`, requiresOtp: true, sandbox: false },
  { id: "wave-bf", countryCode: "BF", operator: "Wave", payinPath: `${payin}wave_bf`, payoutPath: `${payout}wave_bf`, requiresOtp: true, sandbox: false },
  { id: "mtn-ci", countryCode: "CI", operator: "MTN", payinPath: `${payin}mtn_ci`, payoutPath: `${payout}mtn_ci`, sandbox: true },
  { id: "moov-ci", countryCode: "CI", operator: "Moov", payinPath: `${payin}moov_ci`, payoutPath: `${payout}moov_ci`, sandbox: true },
  { id: "orange-ci", countryCode: "CI", operator: "Orange", payinPath: `${payin}orange_ci`, payoutPath: `${payout}orange_ci`, sandbox: true },
  { id: "wave-ci", countryCode: "CI", operator: "Wave", payinPath: `${payin}wave_ci`, payoutPath: `${payout}wave_ci`, sandbox: true },
  { id: "orange-sn", countryCode: "SN", operator: "Orange", payinPath: `${payin}orange_sn`, payoutPath: `${payout}orange_sn`, requiresOtp: true, sandbox: true },
  { id: "free-sn", countryCode: "SN", operator: "Free", payinPath: `${payin}free_sn`, payoutPath: `${payout}free_sn`, sandbox: true },
  { id: "wave-sn", countryCode: "SN", operator: "Wave", payinPath: `${payin}wave_sn`, payoutPath: `${payout}wave_sn`, sandbox: true },
  { id: "togocom-tg", countryCode: "TG", operator: "Togocom", payinPath: `${payin}togocom_tg`, payoutPath: `${payout}togo`, payoutNetwork: "TOGOCOM TG", sandbox: true },
  { id: "moov-tg", countryCode: "TG", operator: "Moov", payinPath: `${payin}moov_tg`, payoutPath: `${payout}togo`, payoutNetwork: "MOOV TG", sandbox: true },
  { id: "mtn-cg", countryCode: "CG", operator: "MTN", payinPath: `${payin}mtn_cg`, payoutPath: `${payout}mtn_cg`, sandbox: true },
];

/** Explicit identities, never fuzzy matching on editable display names. */
export function sendflowOperatorId(channel: FeexpayChannel): string {
  if (channel.id === "togocom-tg") return "tmoney-tg";
  if (channel.id === "moov-tg") return "flooz-tg";
  return channel.id;
}

export function feexpayChannelForOperator(countryCode: string, operatorId: string) {
  return feexpayChannels.find((channel) =>
    channel.countryCode.toLowerCase() === countryCode &&
    sendflowOperatorId(channel) === operatorId,
  );
}

export function feexpayOperations(channel: FeexpayChannel) {
  // The catalog has one inter-network switch for both sender and recipient.
  // Keep payin-only Coris deposit-only until eligibility can distinguish roles.
  return channel.payoutPath
    ? ["deposit", "inter-network", "international"] as const
    : ["deposit"] as const;
}

export function getFeexpayCoverage() {
  return feexpayCountries.map((country) => ({
    countryCode: country.countryCode,
    countryName: country.countryName,
    currency: country.currency,
    applicationSupported: country.currency === "XOF",
    payinOperators: feexpayChannels.filter((channel) => channel.countryCode === country.countryCode).map((channel) => channel.operator),
    payoutOperators: feexpayChannels.filter((channel) => channel.countryCode === country.countryCode && channel.payoutPath !== null).map((channel) => channel.operator),
  }));
}
