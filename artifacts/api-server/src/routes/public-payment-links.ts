import {
  and,
  isNull,
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
  GetPublicPaymentLinkAttemptStatusHeader,
  GetPublicPaymentLinkAttemptStatusParams,
  GetPublicPaymentLinkAttemptStatusResponse,
  QuotePublicPaymentLinkBody,
  QuotePublicPaymentLinkParams,
  QuotePublicPaymentLinkResponse,
  StartPublicPaymentLinkAttemptBody,
  StartPublicPaymentLinkAttemptParams,
  StartPublicPaymentLinkAttemptResponse,
} from "@workspace/api-zod";
import { Router, type IRouter, type Request, type RequestHandler } from "express";
import { consumePublicPaymentLinkQuota } from "../data/payment-link-quota";
import { loadPaymentLimits } from "../data/payment-limits";
import { getCustomerSession } from "../lib/customer-session";
import { flagFromCountryCode } from "../lib/operator-pricing-catalog";
import { isReplitPaymentTestHost } from "../lib/replit-payment-test-access-policy";
import {
  isPaymentLinkSimulationAllowed,
  parseLinkFlowPayerAmount,
  PaymentLinkInputError,
} from "../services/payment-links";
import { operatorLogoUrl } from "../services/operator-logo";
import { calculateTransferQuoteAmounts } from "../lib/transfer-quote-policy";
import { getAggregatorRouteScopeKey } from "./aggregator-catalog";
import { feexpayChannelForOperator, feexpayCountries } from "../providers/feexpay/catalog";
import { isLinkFlowPaymentExecutionEnabled } from "../services/linkflow-payment-policy";
import {
  getLinkFlowPaymentAttemptStatus,
  LinkFlowPaymentError,
  startLinkFlowPaymentAttempt,
} from "../services/linkflow-payment-execution";

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
  deletedAt: Date | null;
};

async function findPublicLink(
  token: string,
  options: { includeDeleted?: boolean } = {},
): Promise<PublicLinkRow | undefined> {
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
    deletedAt: customerPaymentLinksTable.deletedAt,
  }).from(customerPaymentLinksTable)
    .where(options.includeDeleted
      ? eq(customerPaymentLinksTable.publicToken, token)
      : and(
          eq(customerPaymentLinksTable.publicToken, token),
          isNull(customerPaymentLinksTable.deletedAt),
        ))
    .limit(1);

  return link;
}

function isPublicLinkExpired(link: PublicLinkRow) {
  return link.expiresAt !== null && link.expiresAt.getTime() <= Date.now();
}

function expiredPublicPaymentLinkResponse(link: PublicLinkRow) {
  return GetPublicPaymentLinkResponse.parse({
    state: "expired",
    merchantName: link.linkName?.trim() || "SendFlow",
    description: "",
    currency: link.currency,
    currencyDecimals: ["XOF", "XAF"].includes(link.currency) ? 0 : 2,
    amountMinor: link.amountMinor,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    remainingUses: null,
    imagePath: null,
    countries: [],
    paymentAvailable: false,
    simulationAvailable: false,
  });
}

function hasPublicLinkReachedUseLimit(link: PublicLinkRow) {
  return link.maximumUses !== null && link.usageCount >= link.maximumUses;
}

async function findUsablePublicLink(token: string): Promise<PublicLinkRow | undefined> {
  const link = await findPublicLink(token);
  if (!link || link.status !== "active" || isPublicLinkExpired(link) ||
    hasPublicLinkReachedUseLimit(link)) return undefined;
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
        item.operatorId === operator.operatorId && item.categoryId === "linkflow",
      );
      if (rate?.feePercent === null || rate?.feePercent === undefined ||
        !Number.isFinite(rate.feePercent) || rate.feePercent < 0 || rate.feePercent > 100) return [];
       if (link.amountMinor > 0 && !calculateTransferQuoteAmounts(link.amountMinor, rate.feePercent, false)) return [];
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

export async function getPublicPaymentLinkChoices(publicToken: string) {
  const link = await findUsablePublicLink(publicToken);
  if (!link) return null;
  return loadAvailableChoices(link);
}

async function loadPreviewCatalogChoices(link: PublicLinkRow) {
  // The authorized Replit viewer may inspect the full country/operator catalog.
  // Quotes and payment attempts still use loadAvailableChoices and its live gates.
  if (link.currency !== "XOF" || link.paymentMethod === "card") return [];

  const [countries, operators] = await Promise.all([
    db.select().from(countriesTable),
    db.select().from(operatorCatalogTable),
  ]);
  const operatorsByCountry = new Map<string, typeof operators>();
  for (const operator of operators) {
    const countryCode = operator.countryCode.toLowerCase();
    const countryOperators = operatorsByCountry.get(countryCode) ?? [];
    countryOperators.push(operator);
    operatorsByCountry.set(countryCode, countryOperators);
  }

  return countries.map((country) => {
    const countryCode = country.countryCode.toLowerCase();
    const catalogOperators = operatorsByCountry.get(countryCode) ?? [];
    return {
      code: countryCode,
      name: country.countryName,
      flag: flagFromCountryCode(countryCode),
      phonePrefix: country.phonePrefix,
      minPhoneDigits: country.minPhoneDigits,
      maxPhoneDigits: country.maxPhoneDigits,
      operators: catalogOperators
        .map((operator) => ({
          id: operator.operatorId,
          name: operator.name,
          initials: operator.initials.trim().slice(0, 12) || operator.name.trim().slice(0, 12) || "OP",
          logoUrl: operatorLogoUrl(operator.operatorId, operator.version, Boolean(operator.logoData)),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, "fr")),
    };
  }).sort((left, right) => left.name.localeCompare(right.name, "fr"));
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
    const link = await findPublicLink(parsed.data.token, { includeDeleted: true });
    if (!link) {
      res.status(404).json(errorUnavailable);
      return;
    }
    if (link.deletedAt) {
      res.json(expiredPublicPaymentLinkResponse(link));
      return;
    }
    if (link.status !== "active" || hasPublicLinkReachedUseLimit(link)) {
      res.status(404).json(errorUnavailable);
      return;
    }
    if (isPublicLinkExpired(link)) {
      res.json(expiredPublicPaymentLinkResponse(link));
      return;
    }
    let simulationAvailable = false;
    if (isReplitPaymentTestHost()) {
      const session = await getCustomerSession(req, { touchLastSeen: false });
      simulationAvailable = Boolean(
        session
        && session.userId === link.userId
        && isPaymentLinkSimulationAllowed(session),
      );
    }
    const countries = simulationAvailable
      ? await loadPreviewCatalogChoices(link)
      : await loadAvailableChoices(link);
    const response = {
      state: "active" as const,
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
      // Explicitly disabled by default and restricted to the production Plesk
      // runtime. Replit's shared-database viewer stays simulation-only.
      paymentAvailable: isLinkFlowPaymentExecutionEnabled(),
      simulationAvailable,
    };
    res.json(GetPublicPaymentLinkResponse.parse(response));
  } catch (error) {
    req.log.error({ err: error }, "Public payment-link details could not be loaded");
    res.status(503).json({ error: "Les informations du lien sont momentanément indisponibles." });
  }
});

router.post("/public/payment-links/:token/attempts", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, private");
  const parsedParams = StartPublicPaymentLinkAttemptParams.safeParse(req.params);
  const parsedBody = StartPublicPaymentLinkAttemptBody.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Les informations de paiement sont invalides." });
    return;
  }
  try {
    if (!await consumePublicPaymentLinkQuota(clientAddress(req), "attempt")) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Trop de demandes de paiement. Réessayez dans une minute." });
      return;
    }
    const result = await startLinkFlowPaymentAttempt(parsedParams.data.token, parsedBody.data);
    res.json(StartPublicPaymentLinkAttemptResponse.parse(result));
  } catch (error) {
    if (error instanceof LinkFlowPaymentError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "Public LinkFlow payment attempt could not be started");
    res.status(503).json({ error: "Le paiement est momentanément indisponible. Aucun résultat définitif n’a été confirmé." });
  }
});

router.get("/public/payment-link-attempts/:attemptId", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, private");
  const parsedParams = GetPublicPaymentLinkAttemptStatusParams.safeParse(req.params);
  const parsedHeader = GetPublicPaymentLinkAttemptStatusHeader.safeParse({
    "X-LinkFlow-Attempt-Token": req.get("X-LinkFlow-Attempt-Token"),
  });
  if (!parsedParams.success || !parsedHeader.success) {
    res.status(404).json({ error: "Cette demande de paiement n’est pas disponible." });
    return;
  }
  try {
    if (!await consumePublicPaymentLinkQuota(clientAddress(req), "poll")) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Trop de vérifications du paiement. Réessayez dans une minute." });
      return;
    }
    const result = await getLinkFlowPaymentAttemptStatus(
      parsedParams.data.attemptId,
      parsedHeader.data["X-LinkFlow-Attempt-Token"],
    );
    res.json(GetPublicPaymentLinkAttemptStatusResponse.parse(result));
  } catch (error) {
    if (error instanceof LinkFlowPaymentError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "Public LinkFlow payment status could not be refreshed");
    res.status(503).json({ error: "La vérification est momentanément indisponible. Réessayez sans relancer le paiement." });
  }
});

const handlePublicPaymentLinkQuote: RequestHandler = async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, private");
  const parsed = QuotePublicPaymentLinkParams.safeParse(req.params);
  const parsedBody = req.method === "POST"
    ? QuotePublicPaymentLinkBody.safeParse(req.body)
    : { success: true as const, data: {} };
  if (!parsed.success || !parsedBody.success) {
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
        eq(operatorPricingRatesTable.categoryId, "linkflow"),
      ))
      .limit(1);
    if (rate?.feePercent === null || rate?.feePercent === undefined) {
      res.status(400).json({ error: "Le tarif de ce réseau n’est pas disponible." });
      return;
    }
    let amountMinor: number;
    try {
      amountMinor = parseLinkFlowPayerAmount(
        "amount" in parsedBody.data ? parsedBody.data.amount : undefined,
        link.amountMinor,
        link.currency,
        await loadPaymentLimits(),
      );
    } catch (error) {
      if (error instanceof PaymentLinkInputError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
    const amounts = calculateTransferQuoteAmounts(amountMinor, rate.feePercent, false);
    if (!amounts) {
      res.status(400).json({ error: "Le tarif de ce réseau n’est pas disponible." });
      return;
    }
    res.json(QuotePublicPaymentLinkResponse.parse({
      currency: "XOF",
      amountMinor,
      totalMinor: amounts.totalDebitMinor,
      operatorId: parsed.data.operatorId,
    }));
  } catch (error) {
    req.log.error({ err: error }, "Public payment-link quote could not be calculated");
    res.status(503).json({ error: "Le tarif est momentanément indisponible." });
  }
};

router.get("/public/payment-links/:token/quote/:countryCode/:operatorId", handlePublicPaymentLinkQuote);
router.post("/public/payment-links/:token/quote/:countryCode/:operatorId", handlePublicPaymentLinkQuote);

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
