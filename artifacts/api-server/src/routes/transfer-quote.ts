import { Router, type IRouter } from "express";
import {
  db,
  eq,
  operatorCatalogTable,
  operatorPricingRatesTable,
} from "@workspace/db";
import {
  CreateCustomerTransferQuoteBody,
  CreateCustomerTransferQuoteResponse,
} from "@workspace/api-zod";
import { pricingCountryCatalog } from "../lib/operator-pricing-catalog";
import { calculateTransferQuoteAmounts } from "../lib/transfer-quote-policy";
import { requireCustomerSession } from "../lib/customer-session";

const router: IRouter = Router();
const MAX_SAFE_MINOR = Number.MAX_SAFE_INTEGER;

function phoneMatchesCountry(phone: string, countryCode: string) {
  const country = pricingCountryCatalog.find(
    (item) => item.countryCode.toLowerCase() === countryCode.toLowerCase(),
  );
  return !!country && phone.startsWith(country.phonePrefix);
}

router.post("/me/transfer-quote", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;

  const parsed = CreateCustomerTransferQuoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Vérifiez les informations du transfert." });
    return;
  }

  const input = parsed.data;
  const isDeposit = input.kind === "deposit";
  const isInterNetwork = input.kind === "inter-network";
  const isInternational = input.kind === "international";
  if (
    (isDeposit && (!input.sourceOperatorId || !input.senderPhone || input.destinationOperatorId)) ||
    (isInterNetwork && (
      !input.sourceOperatorId
      || !input.destinationOperatorId
      || !input.senderPhone
      || !input.recipientPhone
      || input.sourceOperatorId === input.destinationOperatorId
    )) ||
    (isInternational && (
      !input.destinationOperatorId
      || !input.destinationCountryCode
      || !input.recipientPhone
      || input.senderPhone
    ))
  ) {
    res.status(400).json({ error: "Les opérateurs et numéros ne correspondent pas au type de transfert." });
    return;
  }

  try {
    const [operators, rates] = await Promise.all([
      db.select().from(operatorCatalogTable).where(eq(operatorCatalogTable.enabled, true)),
      db.select().from(operatorPricingRatesTable),
    ]);
    const operatorById = new Map(operators.map((operator) => [operator.operatorId, operator]));
    const source = input.sourceOperatorId ? operatorById.get(input.sourceOperatorId) : undefined;
    const destination = input.destinationOperatorId
      ? operatorById.get(input.destinationOperatorId)
      : undefined;

    let pricedOperator = isInternational ? destination : source;
    const categoryId = input.kind;
    if (
      (isDeposit && (!source || source.countryCode.toLowerCase() !== "ci"))
      || (isInterNetwork && (
        !source
        || !destination
        || source.countryCode.toLowerCase() !== "ci"
        || destination.countryCode.toLowerCase() !== "ci"
      ))
      || (isInternational && (
        !destination
        || destination.countryCode.toLowerCase() !== input.destinationCountryCode?.toLowerCase()
      ))
      || (input.senderPhone && source && !phoneMatchesCountry(input.senderPhone, source.countryCode))
      || (isInterNetwork && input.recipientPhone && destination
        && !phoneMatchesCountry(input.recipientPhone, destination.countryCode))
      || (isInternational && input.recipientPhone && destination
        && !phoneMatchesCountry(input.recipientPhone, destination.countryCode))
    ) {
      res.status(400).json({ error: "Opérateur ou numéro non compatible avec ce transfert." });
      return;
    }

    if (!pricedOperator) {
      res.status(400).json({ error: "Opérateur indisponible." });
      return;
    }
    const rate = rates.find(
      (candidate) => candidate.operatorId === pricedOperator!.operatorId
        && candidate.categoryId === categoryId,
    );
    if (!rate || rate.feePercent === null || !Number.isFinite(rate.feePercent)
      || rate.feePercent < 0 || rate.feePercent > 100) {
      res.status(400).json({ error: "Les frais de ce transfert ne sont pas configurés." });
      return;
    }

    const amounts = calculateTransferQuoteAmounts(
      input.amountMinor,
      rate.feePercent,
      input.senderPaysFees,
    );
    if (!amounts || amounts.totalDebitMinor > MAX_SAFE_MINOR) {
      res.status(400).json({ error: "Le montant ou les frais dépassent les limites autorisées." });
      return;
    }

    res.setHeader("Cache-Control", "no-store, private");
    res.json(CreateCustomerTransferQuoteResponse.parse({
      kind: input.kind,
      currency: "XOF",
      amountMinor: input.amountMinor,
      ...amounts,
      senderPaysFees: input.senderPaysFees,
      feePercent: rate.feePercent,
      pricingVersion: rate.version,
    }));
  } catch (error) {
    req.log.error({ err: error, userId: session.userId }, "Customer transfer quote failed");
    res.status(503).json({ error: "Les tarifs sont momentanément indisponibles." });
  }
});

export default router;
