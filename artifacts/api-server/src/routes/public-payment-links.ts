import {
  and,
  countriesTable,
  customerPaymentLinksTable,
  db,
  eq,
  operatorCatalogTable,
  operatorPricingRatesTable,
  paymentAggregatorRoutesTable,
  paymentAggregatorsTable,
} from "@workspace/db";
import {
  GetPublicPaymentLinkParams,
  GetPublicPaymentLinkResponse,
  QuotePublicPaymentLinkParams,
  QuotePublicPaymentLinkResponse,
} from "@workspace/api-zod";
import { Router, type IRouter, type Request } from "express";
import { consumePublicPaymentLinkQuota } from "../data/payment-link-quota";
import { getCustomerSession } from "../lib/customer-session";
import { flagFromCountryCode } from "../lib/operator-pricing-catalog";
import { isReplitPaymentTestHost } from "../lib/replit-payment-test-access-policy";
import { isPaymentLinkSimulationAllowed } from "../services/payment-links";
import { operatorLogoUrl } from "../services/operator-logo";
import { calculateTransferQuoteAmounts } from "../lib/transfer-quote-policy";
import { getAggregatorRouteScopeKey } from "./aggregator-catalog";
import { feexpayChannelForOperator, feexpayCountries } from "../providers/feexpay/catalog";

const router: IRouter = Router();
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const errorUnavailable = { error: "Ce lien de paiement est indisponible." };

type PublicLinkRow = {
  id: string;
  userId: string;
  publicToken: string;
  linkName: string | null;
  currency: string;
  amountMinor: number;
  description: string;
  paymentMethod: string;
  expiresAt: Date | null;
  maximumUses: number | null;
  usageCount: number;
  status: string;
  imageData: Buffer | null;
};

async function findUsablePublicLink(token: string): Promise<PublicLinkRow | undefined> {
  if (!tokenPattern.test(token)) return undefined;
  const [link] = await db.select({
    id: customerPaymentLinksTable.id,
    userId: customerPaymentLinksTable.userId,
    publicToken: customerPaymentLinksTable.publicToken,
    linkName: customerPaymentLinksTable.linkName,
    currency: customerPaymentLinksTable.currency,
    amountMinor: customerPaymentLinksTable.amountMinor,
    description: customerPaymentLinksTable.description,
    paymentMethod: customerPaymentLinksTable.paymentMethod,
    expiresAt: customerPaymentLinksTable.expiresAt,
    maximumUses: customerPaymentLinksTable.maximumUses,
    usageCount: customerPaymentLinksTable.usageCount,
    status: customerPaymentLinksTable.status,
    imageData: customerPaymentLinksTable.imageData,
  }).from(customerPaymentLinksTable)
    .where(eq(customerPaymentLinksTable.publicToken, token))
    .limit(1);

  if (!link || link.status !== "active" ||
    (link.expiresAt !== null && link.expiresAt.getTime() <= Date.now()) ||
    (link.maximumUses !== null && link.usageCount >= link.maximumUses)) return undefined;
  return link;
}

async function loadAvailableChoices(link: PublicLinkRow) {
  if (link.currency !== "XOF" || link.paymentMethod === "card") return [];

  const [countries, operators, rates, routes, aggregators] = await Promise.all([
    db.select().from(countriesTable),
    db.select().from(operatorCatalogTable),
    db.select().from(operatorPricingRatesTable),
    db.select().from(paymentAggregatorRoutesTable)
      .where(eq(paymentAggregatorRoutesTable.operation, "deposit")),
    db.select().from(paymentAggregatorsTable),
  ]);
  const enabledAggregators = new Set(
    aggregators.filter((aggregator) => aggregator.enabled).map((aggregator) => aggregator.code),
  );
  if (!enabledAggregators.has("feexpay")) return [];

  const routeByScope = new Map(
    routes.map((route) => [`${route.scopeType}:${route.scopeKey}`, route.aggregatorCode]),
  );
  const choices = countries.flatMap((country) => {
    const countryCode = country.countryCode.toLowerCase();
    const providerCountry = feexpayCountries.find((item) =>
      item.countryCode.toLowerCase() === countryCode && item.currency === "XOF",
    );
    if (!country.enabled || !country.depositEnabled || !providerCountry) return [];

    const countryScope = getAggregatorRouteScopeKey("country", countryCode, null);
    const countryAggregator = routeByScope.get(`country:${countryScope}`) ?? null;
    const availableOperators = operators.flatMap((operator) => {
      if (operator.countryCode.toLowerCase() !== countryCode ||
        !operator.enabled || !operator.depositEnabled) return [];
      const channel = feexpayChannelForOperator(countryCode, operator.operatorId);
      if (!channel || channel.requiresOtp) return [];
      const operatorScope = getAggregatorRouteScopeKey("operator", countryCode, operator.operatorId);
      const operatorAggregator = routeByScope.get(`operator:${operatorScope}`) ?? null;
      const effectiveAggregator = operatorAggregator ?? countryAggregator;
      if (effectiveAggregator !== "feexpay") return [];

      const rate = rates.find((item) =>
        item.operatorId === operator.operatorId && item.categoryId === "deposit",
      );
      if (rate?.feePercent === null || rate?.feePercent === undefined ||
        !Number.isFinite(rate.feePercent) || rate.feePercent < 0 || rate.feePercent > 100) return [];
       if (!calculateTransferQuoteAmounts(link.amountMinor, rate.feePercent, false)) return [];
      return [{
        id: operator.operatorId,
        name: operator.name,
        initials: operator.initials.trim().slice(0, 12) || operator.name.trim().slice(0, 12) || "OP",
        logoUrl: operatorLogoUrl(operator.operatorId, operator.version, Boolean(operator.logoData)),
      }];
    }).sort((left, right) => left.name.localeCompare(right.name, "fr"));

    return availableOperators.length ? [{
      code: countryCode,
      name: country.countryName,
      flag: flagFromCountryCode(countryCode),
      phonePrefix: country.phonePrefix,
      minPhoneDigits: country.minPhoneDigits,
      maxPhoneDigits: country.maxPhoneDigits,
      operators: availableOperators,
    }] : [];
  });
  return choices.sort((left, right) => left.name.localeCompare(right.name, "fr"));
}

function clientAddress(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

router.get("/public/payment-links/:token", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, private");
  const parsed = GetPublicPaymentLinkParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(404).json(errorUnavailable);
    return;
  }

  try {
    if (!await consumePublicPaymentLinkQuota(clientAddress(req), "read")) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Trop de consultations de ce lien. Réessayez dans une minute." });
      return;
    }
    const link = await findUsablePublicLink(parsed.data.token);
    if (!link) {
      res.status(404).json(errorUnavailable);
      return;
    }
    const countries = await loadAvailableChoices(link);
    let simulationAvailable = false;
    if (isReplitPaymentTestHost()) {
      const session = await getCustomerSession(req, { touchLastSeen: false });
      simulationAvailable = Boolean(
        session
        && session.userId === link.userId
        && isPaymentLinkSimulationAllowed(session),
      );
    }
    const response = {
      merchantName: link.linkName?.trim() || "SendFlow",
      description: link.description,
      currency: link.currency,
      currencyDecimals: ["XOF", "XAF"].includes(link.currency) ? 0 : 2,
      amountMinor: link.amountMinor,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      remainingUses: link.maximumUses === null ? null : link.maximumUses - link.usageCount,
      imagePath: link.imageData
        ? `/api/public/payment-links/${link.publicToken}/image`
        : null,
      countries,
      // Deliberately fail closed: the server-side settlement lifecycle is not
      // complete yet, so no public page may trigger a real provider charge.
      paymentAvailable: false,
      simulationAvailable,
    };
    res.json(GetPublicPaymentLinkResponse.parse(response));
  } catch (error) {
    req.log.error({ err: error }, "Public payment-link details could not be loaded");
    res.status(503).json({ error: "Les informations du lien sont momentanément indisponibles." });
  }
});

router.get("/public/payment-links/:token/quote/:countryCode/:operatorId", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, private");
  const parsed = QuotePublicPaymentLinkParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Le pays ou le réseau sélectionné est invalide." });
    return;
  }

  try {
    if (!await consumePublicPaymentLinkQuota(clientAddress(req), "quote")) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Trop de demandes de tarif. Réessayez dans une minute." });
      return;
    }
    const link = await findUsablePublicLink(parsed.data.token);
    if (!link) {
      res.status(404).json(errorUnavailable);
      return;
    }
    if (link.currency !== "XOF" || link.paymentMethod === "card") {
      res.status(400).json({ error: "Ce moyen de paiement n’est pas disponible pour ce lien." });
      return;
    }

    const choices = await loadAvailableChoices(link);
    const country = choices.find((item) => item.code === parsed.data.countryCode);
    if (!country || !country.operators.some((operator) => operator.id === parsed.data.operatorId)) {
      res.status(400).json({ error: "Ce pays ou ce réseau n’est pas disponible pour ce lien." });
      return;
    }
    const [rate] = await db.select({ feePercent: operatorPricingRatesTable.feePercent })
      .from(operatorPricingRatesTable)
      .where(and(
        eq(operatorPricingRatesTable.operatorId, parsed.data.operatorId),
        eq(operatorPricingRatesTable.categoryId, "deposit"),
      ))
      .limit(1);
    if (rate?.feePercent === null || rate?.feePercent === undefined) {
      res.status(400).json({ error: "Le tarif de ce réseau n’est pas disponible." });
      return;
    }
    const amounts = calculateTransferQuoteAmounts(link.amountMinor, rate.feePercent, false);
    if (!amounts) {
      res.status(400).json({ error: "Le tarif de ce réseau n’est pas disponible." });
      return;
    }
    res.json(QuotePublicPaymentLinkResponse.parse({
      currency: "XOF",
      amountMinor: link.amountMinor,
      totalMinor: amounts.totalDebitMinor,
      operatorId: parsed.data.operatorId,
    }));
  } catch (error) {
    req.log.error({ err: error }, "Public payment-link quote could not be calculated");
    res.status(503).json({ error: "Le tarif est momentanément indisponible." });
  }
});

router.get("/public/payment-links/:token/image", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!tokenPattern.test(req.params.token)) {
    res.status(404).end();
    return;
  }
  try {
    if (!await consumePublicPaymentLinkQuota(clientAddress(req), "image")) {
      res.setHeader("Retry-After", "60");
      res.status(429).end();
      return;
    }
    const link = await findUsablePublicLink(req.params.token);
    if (!link?.imageData) {
      res.status(404).end();
      return;
    }
    res.type("image/webp").send(link.imageData);
  } catch (error) {
    req.log.error({ err: error }, "Public payment-link image could not be loaded");
    res.status(503).end();
  }
});

export default router;
