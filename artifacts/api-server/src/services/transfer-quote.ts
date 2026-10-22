import { calculateTransferQuoteAmounts } from "../lib/transfer-quote-policy.ts";

export type TransferQuoteInput = {
  kind: "deposit" | "inter-network" | "international";
  amountMinor: number;
  senderPaysFees: boolean;
  sourceOperatorId?: string;
  destinationOperatorId?: string;
  destinationCountryCode?: string;
  senderPhone?: string;
  recipientPhone?: string;
};

export type QuoteDependencies = {
  operators: ReadonlyArray<{ operatorId: string; countryCode: string }>;
  rates: ReadonlyArray<{
    operatorId: string; categoryId: string; feePercent: number | null; version: number;
  }>;
  countries: ReadonlyArray<{ countryCode: string; phonePrefix: string }>;
  remainingMonthlyAmount(userId: string): Promise<number>;
};

export class TransferQuoteError extends Error {
  readonly statusCode: 400 | 409;
  constructor(statusCode: 400 | 409, message: string) {
    super(message);
    this.name = "TransferQuoteError";
    this.statusCode = statusCode;
  }
}

/** A quote is a read-only estimate, never a funds reservation or payment approval. */
export async function calculateCustomerTransferQuote(
  authenticatedUserId: string,
  input: TransferQuoteInput,
  dependencies: QuoteDependencies,
) {
  const invalid = (message: string): never => { throw new TransferQuoteError(400, message); };
  if (!authenticatedUserId) throw new Error("Authenticated customer is required");
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0
    || typeof input.senderPaysFees !== "boolean") {
    invalid("Montant ou choix de frais invalide.");
  }
  const isDeposit = input.kind === "deposit";
  const isInterNetwork = input.kind === "inter-network";
  const isInternational = input.kind === "international";
  if ((!isDeposit && !isInterNetwork && !isInternational)
    || (isDeposit && (!input.sourceOperatorId || !input.senderPhone || input.destinationOperatorId))
    || (isInterNetwork && (!input.sourceOperatorId || !input.destinationOperatorId
      || !input.senderPhone || !input.recipientPhone
      || input.sourceOperatorId === input.destinationOperatorId))
    || (isInternational && (!input.destinationOperatorId || !input.destinationCountryCode
      || !input.recipientPhone || input.senderPhone || input.sourceOperatorId))) {
    invalid("Les opérateurs et numéros ne correspondent pas au type de transfert.");
  }
  const source = dependencies.operators.find((o) => o.operatorId === input.sourceOperatorId);
  const destination = dependencies.operators.find((o) => o.operatorId === input.destinationOperatorId);
  const phoneMatches = (phone: string, countryCode: string) => {
    const country = dependencies.countries.find(
      (c) => c.countryCode.toLowerCase() === countryCode.toLowerCase(),
    );
    return !!country && phone.startsWith(country.phonePrefix);
  };
  if ((isDeposit && (!source || source.countryCode.toLowerCase() !== "ci"))
    || (isInterNetwork && (!source || !destination
      || source.countryCode.toLowerCase() !== "ci" || destination.countryCode.toLowerCase() !== "ci"))
    || (isInternational && (!destination
      || destination.countryCode.toLowerCase() !== input.destinationCountryCode?.toLowerCase()))
    || (input.senderPhone && source && !phoneMatches(input.senderPhone, source.countryCode))
    || (input.recipientPhone && destination && !phoneMatches(input.recipientPhone, destination.countryCode))) {
    invalid("Opérateur ou numéro non compatible avec ce transfert.");
  }
  const pricedOperator = isInternational ? destination : source;
  if (!pricedOperator) invalid("Opérateur indisponible.");
  const rate = dependencies.rates.find((r) =>
    r.operatorId === pricedOperator!.operatorId && r.categoryId === input.kind);
  if (!rate || rate.feePercent === null || !Number.isFinite(rate.feePercent)
    || rate.feePercent < 0 || rate.feePercent > 100) {
    invalid("Les frais de ce transfert ne sont pas configurés.");
  }
  const amounts = calculateTransferQuoteAmounts(input.amountMinor, rate!.feePercent!, input.senderPaysFees);
  if (!amounts) invalid("Le montant ou les frais dépassent les limites autorisées.");
  if (!isDeposit) {
    const remaining = await dependencies.remainingMonthlyAmount(authenticatedUserId);
    if (!Number.isSafeInteger(remaining) || remaining < 0) throw new Error("Invalid server account limit");
    if (input.amountMinor > remaining) {
      throw new TransferQuoteError(409, `Ce transfert dépasse votre plafond mensuel restant de ${remaining} FCFA.`);
    }
  }
  return {
    kind: input.kind, currency: "XOF" as const, amountMinor: input.amountMinor,
    ...amounts!, senderPaysFees: input.senderPaysFees,
    feePercent: rate!.feePercent!, pricingVersion: rate!.version,
  };
}
