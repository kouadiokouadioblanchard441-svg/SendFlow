/**
 * Exact Mobile Money channel names published in PayDunya's channel list:
 * https://developers.paydunya.com/doc/FR/introduction#section-8
 *
 * This is a capability map only. It does not assign payment routes or assert
 * that a particular merchant account has enabled the channel.
 */
const operatorChannels: Readonly<Record<string, string>> = {
  "BJ:mtn-bj": "mtn-benin",
  "BJ:moov-bj": "moov-benin",
  "BJ:celtiis-bj": "celtiis-cash",
  "BF:orange-bf": "orange-money-burkina",
  "BF:moov-bf": "moov-burkina-faso",
  "CI:orange-ci": "orange-money-ci",
  "CI:wave-ci": "wave-ci",
  "CI:mtn-ci": "mtn-ci",
  "CI:moov-ci": "moov-ci",
  "CI:djamo-ci": "djamo-ci",
  "SN:orange-sn": "orange-money-senegal",
  "SN:wave-sn": "wave-senegal",
  "SN:free-sn": "free-money-senegal",
  "SN:expresso-sn": "expresso-sn",
  "SN:wizall-sn": "wizall-senegal",
  "TG:togocom-tg": "t-money-togo",
  "TG:moov-tg": "moov-togo",
  "ML:orange-ml": "orange-money-mali",
  "ML:moov-ml": "moov-ml",
  "CM:mtn-cm": "mtn-cameroun",
};

export function paydunyaChannelForOperator(countryCode: string, operatorId: string): string | null {
  const channel = operatorChannels[`${countryCode.toUpperCase()}:${operatorId.toLowerCase()}`];
  return channel || null;
}

export function isPaydunyaChannel(channel: string): boolean {
  return Object.values(operatorChannels).some((candidate) => candidate === channel && candidate.length > 0);
}
