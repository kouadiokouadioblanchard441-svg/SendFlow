import { createHash, randomBytes } from "node:crypto";
import {
  and,
  customerPaymentLinkAttemptsTable,
  customerPaymentLinksTable,
  countriesTable,
  db,
  eq,
  inArray,
  isNull,
  operatorCatalogTable,
  operatorPricingRatesTable,
  paymentAggregatorRoutesTable,
  paymentAggregatorsTable,
  paymentAttemptsTable,
  paymentConfirmationsTable,
  paymentLimitsTable,
  paymentIntentsTable,
  sql,
  transactionsTable,
  usersTable,
  walletsTable,
  walletLedgerTable,
} from "@workspace/db";
import {
  createSensitiveDataLookupIndex,
  decryptSensitiveData,
  decryptSensitiveDataIfEncrypted,
  encryptSensitiveData,
} from "../lib/sensitive-data-crypto";
import { isSharedNeonPreview } from "../lib/shared-neon-preview-guard";
import { calculateTransferQuoteAmounts } from "../lib/transfer-quote-policy";
import { FeexpayClient, type FeexpayReceipt } from "../providers/feexpay/client";
import { feexpayChannelForOperator, feexpayCountries } from "../providers/feexpay/catalog";
import { getAggregatorRouteScopeKey } from "../routes/aggregator-catalog";
import { parseLinkFlowPayerAmount } from "./payment-links";
import { enqueueDeveloperPaymentEvent } from "./developer-webhook-outbox";
import {
  buildLinkFlowRequestHash,
  deriveLinkFlowPollToken,
  hashLinkFlowPollToken,
  isLinkFlowPaymentExecutionEnabled,
  resolveInitialProviderState,
  resolveVerifiedProviderState,
  toProviderPhoneNumber,
  type LinkFlowPublicState,
} from "./linkflow-payment-policy";

export class LinkFlowPaymentError extends Error {
  readonly statusCode: 400 | 404 | 409 | 429 | 503;
  constructor(statusCode: 400 | 404 | 409 | 429 | 503, message: string) {
    super(message);
    this.name = "LinkFlowPaymentError";
    this.statusCode = statusCode;
  }
}

export type StartLinkFlowPaymentInput = {
  amount?: string;
  countryCode: string;
  operatorId: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  idempotencyKey: string;
};

export type PublicLinkFlowPaymentStatus = {
  attemptId: string;
  state: LinkFlowPublicState;
  merchantName: string;
  amountMinor: number;
  currency: "XOF";
  currencyDecimals: 0;
  ussdCode: string | null;
  returnUrl: string | null;
};

export type PublicLinkFlowPaymentCreated = PublicLinkFlowPaymentStatus & {
  pollToken: string;
};

type LinkForPayment = {
  id: string;
  userId: string;
  publicToken: string;
  linkName: string | null;
  currency: string;
  amountMinor: number;
  paymentMethod: string;
  expiresAt: Date | null;
  maximumUses: number | null;
  usageCount: number;
  status: string;
  deletedAt: Date | null;
  returnUrl: string | null;
};

type AttemptBundle = {
  mapping: typeof customerPaymentLinkAttemptsTable.$inferSelect;
  intent: typeof paymentIntentsTable.$inferSelect;
  attempt: typeof paymentAttemptsTable.$inferSelect;
  transaction: typeof transactionsTable.$inferSelect;
  returnUrl: string | null;
};

const activeAttemptStates = ["prepared", "dispatching", "pending", "uncertain", "succeeded"] as const;
const activeIntentStates = ["created", "collecting", "uncertain"] as const;
const referencePattern = /^[A-Z0-9]{12,30}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeReturnUrl(value: string | null, state: LinkFlowPublicState): string | null {
  if (state !== "succeeded" || !value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function publicState(intentState: string, attemptStatus: string): LinkFlowPublicState {
  if (intentState === "succeeded") return "succeeded";
  if (intentState === "failed") return "failed";
  if (intentState === "uncertain" || attemptStatus === "uncertain") return "uncertain";
  return "waiting";
}

function asPublicStatus(bundle: AttemptBundle): PublicLinkFlowPaymentStatus {
  const state = publicState(bundle.intent.state, bundle.attempt.status);
  return {
    attemptId: bundle.mapping.id,
    state,
    merchantName: bundle.mapping.merchantName,
    amountMinor: bundle.intent.senderTotalMinor,
    currency: "XOF",
    currencyDecimals: 0,
    ussdCode: bundle.mapping.ussdCode,
    returnUrl: safeReturnUrl(bundle.returnUrl, state),
  };
}

async function findLinkForPayment(token: string): Promise<LinkForPayment | undefined> {
  const query = db.select({
    id: customerPaymentLinksTable.id,
    userId: customerPaymentLinksTable.userId,
    publicToken: customerPaymentLinksTable.publicToken,
    linkName: customerPaymentLinksTable.linkName,
    currency: customerPaymentLinksTable.currency,
    amountMinor: customerPaymentLinksTable.amountMinor,
    paymentMethod: customerPaymentLinksTable.paymentMethod,
    expiresAt: customerPaymentLinksTable.expiresAt,
    maximumUses: customerPaymentLinksTable.maximumUses,
    usageCount: customerPaymentLinksTable.usageCount,
    status: customerPaymentLinksTable.status,
    deletedAt: customerPaymentLinksTable.deletedAt,
    returnUrl: customerPaymentLinksTable.returnUrl,
  }).from(customerPaymentLinksTable).where(and(
    eq(customerPaymentLinksTable.publicToken, token),
    isNull(customerPaymentLinksTable.deletedAt),
  )).limit(1);
  const [link] = await query;
  return link;
}

async function resolveChannel(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], link: LinkForPayment, input: StartLinkFlowPaymentInput) {
  if (link.currency !== "XOF" || link.paymentMethod === "card") {
    throw new LinkFlowPaymentError(400, "Ce moyen de paiement n’est pas disponible pour ce lien.");
  }
  const [paymentLimits] = await tx.select().from(paymentLimitsTable)
    .where(eq(paymentLimitsTable.id, "global")).limit(1);
  if (!paymentLimits) throw new Error("Payment limits have not been initialized");
  let amountMinor: number;
  try {
    amountMinor = parseLinkFlowPayerAmount(input.amount, link.amountMinor, link.currency, paymentLimits);
  } catch (error) {
    throw new LinkFlowPaymentError(400, error instanceof Error ? error.message : "Le montant saisi est invalide.");
  }
  const countryCode = input.countryCode.toLowerCase();
  const [country] = await tx.select().from(countriesTable)
    .where(eq(countriesTable.countryCode, countryCode)).limit(1);
  const [operator] = await tx.select().from(operatorCatalogTable).where(and(
    eq(operatorCatalogTable.countryCode, countryCode),
    eq(operatorCatalogTable.operatorId, input.operatorId),
  )).limit(1);
  if (!country?.enabled || !country.depositEnabled || !operator?.enabled || !operator.depositEnabled) {
    throw new LinkFlowPaymentError(400, "Ce pays ou ce réseau n’est pas disponible pour ce lien.");
  }
  const providerCountry = feexpayCountries.find((item) =>
    item.countryCode.toLowerCase() === countryCode && item.currency === "XOF");
  const channel = feexpayChannelForOperator(countryCode, input.operatorId);
  if (!providerCountry || !channel || channel.requiresOtp) {
    throw new LinkFlowPaymentError(400, "Ce réseau ne permet pas ce paiement LinkFlow.");
  }
  const [operatorRoute] = await tx.select().from(paymentAggregatorRoutesTable).where(and(
    eq(paymentAggregatorRoutesTable.operation, "deposit"),
    eq(paymentAggregatorRoutesTable.scopeType, "operator"),
    eq(paymentAggregatorRoutesTable.scopeKey, getAggregatorRouteScopeKey("operator", countryCode, input.operatorId)),
  )).limit(1);
  const [countryRoute] = await tx.select().from(paymentAggregatorRoutesTable).where(and(
    eq(paymentAggregatorRoutesTable.operation, "deposit"),
    eq(paymentAggregatorRoutesTable.scopeType, "country"),
    eq(paymentAggregatorRoutesTable.scopeKey, getAggregatorRouteScopeKey("country", countryCode, null)),
  )).limit(1);
  const [aggregator] = await tx.select().from(paymentAggregatorsTable)
    .where(eq(paymentAggregatorsTable.code, operatorRoute?.aggregatorCode ?? countryRoute?.aggregatorCode ?? ""))
    .limit(1);
  if (!aggregator?.enabled || aggregator.code !== "feexpay") {
    throw new LinkFlowPaymentError(400, "Ce réseau n’est pas disponible pour ce lien.");
  }
  const [rate] = await tx.select().from(operatorPricingRatesTable).where(and(
    eq(operatorPricingRatesTable.operatorId, operator.operatorId),
    eq(operatorPricingRatesTable.categoryId, "linkflow"),
  )).limit(1);
  if (rate?.feePercent == null) {
    throw new LinkFlowPaymentError(400, "Le tarif de ce réseau n’est pas disponible.");
  }
  const amounts = calculateTransferQuoteAmounts(amountMinor, rate.feePercent, false);
  if (!amounts) throw new LinkFlowPaymentError(400, "Le tarif de ce réseau n’est pas disponible.");

  const prefixDigits = country.phonePrefix.replace(/\D/g, "");
  const normalizedPhone = toProviderPhoneNumber(input.phoneNumber);
  const nationalDigits = normalizedPhone.startsWith(prefixDigits)
    ? normalizedPhone.slice(prefixDigits.length)
    : "";
  if (!nationalDigits || normalizedPhone.length < 8 || normalizedPhone.length > 15 ||
    nationalDigits.length < country.minPhoneDigits || nationalDigits.length > country.maxPhoneDigits) {
    throw new LinkFlowPaymentError(400, "Le numéro ne correspond pas au pays sélectionné.");
  }

  return {
    country,
    operator,
    channel,
    amountMinor,
    amounts,
    normalizedPhone,
    ussdCode: operator.ussdCodeOverride ?? country.ussdCode ?? null,
  };
}

async function loadAttemptBundle(attemptId: string, pollTokenHash: string, lock = false) {
  const [mapping] = await db.select().from(customerPaymentLinkAttemptsTable).where(and(
    eq(customerPaymentLinkAttemptsTable.id, attemptId),
    eq(customerPaymentLinkAttemptsTable.pollTokenHash, pollTokenHash),
  )).limit(1);
  if (!mapping) return undefined;
  const [intent] = await db.select().from(paymentIntentsTable)
    .where(eq(paymentIntentsTable.id, mapping.intentId)).limit(1);
  if (!intent) return undefined;
  const [attempt] = await db.select().from(paymentAttemptsTable).where(and(
    eq(paymentAttemptsTable.intentId, intent.id),
    eq(paymentAttemptsTable.direction, "payin"),
  )).limit(1);
  if (!attempt) return undefined;
  const [transaction] = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.id, intent.transactionId)).limit(1);
  if (!transaction) return undefined;
  const [link] = await db.select({ returnUrl: customerPaymentLinksTable.returnUrl })
    .from(customerPaymentLinksTable).where(eq(customerPaymentLinksTable.id, mapping.paymentLinkId)).limit(1);
  if (!link) return undefined;
  if (!lock) return { mapping, intent, attempt, transaction, returnUrl: link.returnUrl } satisfies AttemptBundle;
  return db.transaction(async (tx) => {
    const [lockedMapping] = await tx.select().from(customerPaymentLinkAttemptsTable)
      .where(and(
        eq(customerPaymentLinkAttemptsTable.id, mapping.id),
        eq(customerPaymentLinkAttemptsTable.pollTokenHash, pollTokenHash),
      )).for("update").limit(1);
    if (!lockedMapping) return undefined;
    const [lockedIntent] = await tx.select().from(paymentIntentsTable)
      .where(eq(paymentIntentsTable.id, lockedMapping.intentId)).for("update").limit(1);
    if (!lockedIntent) return undefined;
    const [lockedAttempt] = await tx.select().from(paymentAttemptsTable).where(and(
      eq(paymentAttemptsTable.intentId, lockedIntent.id),
      eq(paymentAttemptsTable.direction, "payin"),
    )).for("update").limit(1);
    if (!lockedAttempt) return undefined;
    const [lockedTransaction] = await tx.select().from(transactionsTable)
      .where(eq(transactionsTable.id, lockedIntent.transactionId)).for("update").limit(1);
    if (!lockedTransaction) return undefined;
    const [lockedLink] = await tx.select({ returnUrl: customerPaymentLinksTable.returnUrl })
      .from(customerPaymentLinksTable).where(eq(customerPaymentLinksTable.id, lockedMapping.paymentLinkId)).limit(1);
    if (!lockedLink) return undefined;
    return {
      mapping: lockedMapping,
      intent: lockedIntent,
      attempt: lockedAttempt,
      transaction: lockedTransaction,
      returnUrl: lockedLink.returnUrl,
    } satisfies AttemptBundle;
  });
}

async function setDispatchUncertain(attemptId: string, intentId: string) {
  await db.transaction(async (tx) => {
    const [attempt] = await tx.select().from(paymentAttemptsTable)
      .where(eq(paymentAttemptsTable.id, attemptId)).for("update").limit(1);
    const [intent] = await tx.select().from(paymentIntentsTable)
      .where(eq(paymentIntentsTable.id, intentId)).for("update").limit(1);
    if (!attempt || !intent || ["succeeded", "failed"].includes(intent.state)) return;
    if (attempt.status === "dispatching") {
      await tx.update(paymentAttemptsTable).set({ status: "uncertain", updatedAt: new Date() })
        .where(eq(paymentAttemptsTable.id, attempt.id));
    }
    if (intent.state === "collecting") {
      await tx.update(paymentIntentsTable).set({ state: "uncertain", updatedAt: new Date() })
        .where(eq(paymentIntentsTable.id, intent.id));
    }
  });
}

async function dispatchPreparedAttempt(attemptId: string) {
  const prepared = await db.transaction(async (tx) => {
    const [attempt] = await tx.select().from(paymentAttemptsTable)
      .where(eq(paymentAttemptsTable.id, attemptId)).for("update").limit(1);
    if (!attempt) return undefined;
    const [intent] = await tx.select().from(paymentIntentsTable)
      .where(eq(paymentIntentsTable.id, attempt.intentId)).for("update").limit(1);
    if (!intent || intent.state === "succeeded" || intent.state === "failed") return undefined;
    if (attempt.status !== "prepared") {
      return { kind: "already_dispatched" as const };
    }
    if (intent.state === "created") {
      await tx.update(paymentIntentsTable).set({ state: "collecting", updatedAt: new Date() })
        .where(eq(paymentIntentsTable.id, intent.id));
    }
    const [claimed] = await tx.update(paymentAttemptsTable).set({
      status: "dispatching",
      updatedAt: new Date(),
    }).where(and(
      eq(paymentAttemptsTable.id, attempt.id),
      eq(paymentAttemptsTable.status, "prepared"),
    )).returning();
    if (!claimed) return { kind: "already_dispatched" as const };
    const [transaction] = await tx.select().from(transactionsTable)
      .where(eq(transactionsTable.id, intent.transactionId)).limit(1);
    if (!transaction) throw new Error("Payment transaction is missing");
    return {
      kind: "claimed" as const,
      attempt: claimed,
      intent,
      transaction,
    };
  });
  if (!prepared || prepared.kind !== "claimed") return;

  let receipt: FeexpayReceipt | null = null;
  try {
    const phone = decryptSensitiveData(prepared.transaction.senderPhone, "transaction-sender-phone");
    receipt = await new FeexpayClient().initiate("payin", {
      channelId: prepared.attempt.channelId,
      amountMinor: prepared.attempt.amountMinor,
      currency: "XOF",
      phoneNumber: toProviderPhoneNumber(phone),
      operationReference: prepared.attempt.operationReference,
    });
  } catch {
    await setDispatchUncertain(prepared.attempt.id, prepared.intent.id);
    return;
  }

  if (!receipt.reference || !referencePattern.test(prepared.attempt.operationReference)) {
    await setDispatchUncertain(prepared.attempt.id, prepared.intent.id);
    return;
  }
  const providerReferenceHash = createSensitiveDataLookupIndex(receipt.reference, "provider-reference");
  const encryptedProviderReference = encryptSensitiveData(receipt.reference, "provider-reference");
  await db.transaction(async (tx) => {
    const [attempt] = await tx.select().from(paymentAttemptsTable)
      .where(eq(paymentAttemptsTable.id, prepared.attempt.id)).for("update").limit(1);
    if (!attempt || attempt.status !== "dispatching") return;
    const [transaction] = await tx.select().from(transactionsTable)
      .where(eq(transactionsTable.id, prepared.intent.transactionId)).for("update").limit(1);
    if (!transaction) throw new Error("Payment transaction is missing");
    await tx.update(transactionsTable).set({
      providerReference: encryptedProviderReference,
      providerReferenceLookupHash: providerReferenceHash,
      updatedAt: new Date(),
    }).where(eq(transactionsTable.id, transaction.id));
    await tx.update(paymentAttemptsTable).set({
      providerReference: encryptedProviderReference,
      providerReferenceHash,
      status: "pending",
      updatedAt: new Date(),
    }).where(eq(paymentAttemptsTable.id, attempt.id));
  });
  // The POST acknowledgement itself is never used to mark success or failure.
  resolveInitialProviderState(receipt);
}

export async function startLinkFlowPaymentAttempt(
  publicToken: string,
  input: StartLinkFlowPaymentInput,
): Promise<PublicLinkFlowPaymentCreated> {
  if (!isLinkFlowPaymentExecutionEnabled()) {
    throw new LinkFlowPaymentError(503, "Le paiement en ligne est momentanément indisponible.");
  }
  if (!uuidPattern.test(input.idempotencyKey)) {
    throw new LinkFlowPaymentError(400, "La demande de paiement est invalide.");
  }

  const link = await findLinkForPayment(publicToken);
  const now = Date.now();
  if (!link || link.status !== "active" || (link.expiresAt && link.expiresAt.getTime() <= now) ||
    (link.maximumUses !== null && link.usageCount >= link.maximumUses)) {
    throw new LinkFlowPaymentError(404, "Ce lien de paiement n’est pas disponible.");
  }
  const prepared = await db.transaction(async (tx) => {
    const [lockedLink] = await tx.select({
      id: customerPaymentLinksTable.id,
      userId: customerPaymentLinksTable.userId,
      publicToken: customerPaymentLinksTable.publicToken,
      linkName: customerPaymentLinksTable.linkName,
      currency: customerPaymentLinksTable.currency,
      amountMinor: customerPaymentLinksTable.amountMinor,
      paymentMethod: customerPaymentLinksTable.paymentMethod,
      expiresAt: customerPaymentLinksTable.expiresAt,
      maximumUses: customerPaymentLinksTable.maximumUses,
      usageCount: customerPaymentLinksTable.usageCount,
      status: customerPaymentLinksTable.status,
      deletedAt: customerPaymentLinksTable.deletedAt,
      returnUrl: customerPaymentLinksTable.returnUrl,
    }).from(customerPaymentLinksTable).where(and(
      eq(customerPaymentLinksTable.id, link.id),
      isNull(customerPaymentLinksTable.deletedAt),
    )).for("update").limit(1);
    if (!lockedLink || lockedLink.status !== "active" ||
      (lockedLink.expiresAt && lockedLink.expiresAt.getTime() <= Date.now()) ||
      (lockedLink.maximumUses !== null && lockedLink.usageCount >= lockedLink.maximumUses)) {
      throw new LinkFlowPaymentError(404, "Ce lien de paiement n’est pas disponible.");
    }
    const channelContext = await resolveChannel(tx, lockedLink, input);
    const requestHash = buildLinkFlowRequestHash({
      ...input,
      linkId: lockedLink.id,
      phoneNumber: channelContext.normalizedPhone,
      amountMinor: channelContext.amountMinor,
    });
    const [existing] = await tx.select().from(customerPaymentLinkAttemptsTable).where(and(
      eq(customerPaymentLinkAttemptsTable.paymentLinkId, lockedLink.id),
      eq(customerPaymentLinkAttemptsTable.idempotencyKey, input.idempotencyKey),
    )).limit(1);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new LinkFlowPaymentError(409, "Cette demande a déjà été utilisée avec d’autres informations.");
      }
      return {
        kind: "existing" as const,
        mappingId: existing.id,
        intentId: existing.intentId,
        requestKey: existing.idempotencyKey,
      };
    }

    const payerPhoneHash = createSensitiveDataLookupIndex(channelContext.normalizedPhone, "transaction-sender-phone");
    const [unresolved] = await tx.select({ id: customerPaymentLinkAttemptsTable.id })
      .from(customerPaymentLinkAttemptsTable)
      .innerJoin(paymentIntentsTable, eq(paymentIntentsTable.id, customerPaymentLinkAttemptsTable.intentId))
      .innerJoin(paymentAttemptsTable, and(
        eq(paymentAttemptsTable.intentId, paymentIntentsTable.id),
        eq(paymentAttemptsTable.direction, "payin"),
      ))
      .innerJoin(transactionsTable, eq(transactionsTable.id, paymentIntentsTable.transactionId))
      .where(and(
        eq(customerPaymentLinkAttemptsTable.paymentLinkId, lockedLink.id),
        eq(transactionsTable.senderPhoneLookupHash, payerPhoneHash),
        inArray(paymentAttemptsTable.status, activeAttemptStates),
        inArray(paymentIntentsTable.state, activeIntentStates),
      )).limit(1);
    if (unresolved) {
      throw new LinkFlowPaymentError(409, "Une demande de paiement est déjà en cours pour ce numéro. Ne recommencez pas le paiement.");
    }

    const reservedUses = await tx.select({ id: customerPaymentLinkAttemptsTable.id })
      .from(customerPaymentLinkAttemptsTable)
      .innerJoin(paymentIntentsTable, eq(paymentIntentsTable.id, customerPaymentLinkAttemptsTable.intentId))
      .innerJoin(paymentAttemptsTable, and(
        eq(paymentAttemptsTable.intentId, paymentIntentsTable.id),
        eq(paymentAttemptsTable.direction, "payin"),
      ))
      .where(and(
        eq(customerPaymentLinkAttemptsTable.paymentLinkId, lockedLink.id),
        inArray(paymentAttemptsTable.status, activeAttemptStates),
        inArray(paymentIntentsTable.state, activeIntentStates),
      ));
    if (lockedLink.maximumUses !== null &&
      lockedLink.usageCount + reservedUses.length >= lockedLink.maximumUses) {
      throw new LinkFlowPaymentError(409, "Une autre demande utilise déjà la dernière place de ce lien.");
    }

    const [merchant] = await tx.select({
      id: usersTable.id,
      status: usersTable.status,
      phone: usersTable.phone,
      phoneVerifiedAt: usersTable.phoneVerifiedAt,
    }).from(usersTable).where(eq(usersTable.id, lockedLink.userId)).for("update").limit(1);
    const [wallet] = await tx.select().from(walletsTable)
      .where(eq(walletsTable.userId, lockedLink.userId)).for("update").limit(1);
    if (!merchant || merchant.status !== "active" || !merchant.phoneVerifiedAt || !merchant.phone ||
      !wallet || wallet.status !== "active" || wallet.currency !== "XOF") {
      throw new LinkFlowPaymentError(503, "Le portefeuille du marchand n’est pas prêt à recevoir ce paiement.");
    }
    const merchantPhone = merchant.phone
      ? decryptSensitiveDataIfEncrypted(merchant.phone, "user-phone")
      : null;
    if (!merchantPhone || !/^\+[1-9][0-9]{7,14}$/.test(merchantPhone)) {
      throw new LinkFlowPaymentError(503, "Le compte du marchand ne peut pas recevoir ce paiement.");
    }

    const operationReference = randomBytes(15).toString("hex").toUpperCase();
    const transactionIdempotencyKey = `linkflow:${lockedLink.id}:${input.idempotencyKey}`;
    const requestKey = input.idempotencyKey;
    const merchantName = lockedLink.linkName?.trim() || "SendFlow";
    const pollToken = deriveLinkFlowPollToken(lockedLink.id, requestKey);
    const [transaction] = await tx.insert(transactionsTable).values({
      userId: lockedLink.userId,
      kind: "deposit",
      status: "pending",
      fromOperator: input.operatorId,
      toOperator: null,
      senderPhone: encryptSensitiveData(channelContext.normalizedPhone, "transaction-sender-phone"),
      senderPhoneLookupHash: payerPhoneHash,
      recipientPhone: encryptSensitiveData(merchantPhone, "transaction-recipient-phone"),
      recipientPhoneLookupHash: createSensitiveDataLookupIndex(merchantPhone, "transaction-recipient-phone"),
      currency: "XOF",
      amountMinor: channelContext.amountMinor,
      feeMinor: channelContext.amounts.feeMinor,
      reference: operationReference,
      providerReference: null,
      providerReferenceLookupHash: null,
      idempotencyKey: transactionIdempotencyKey,
    }).returning();
    if (!transaction) throw new Error("LinkFlow transaction was not created");

    const [intent] = await tx.insert(paymentIntentsTable).values({
      transactionId: transaction.id,
      providerCode: "feexpay",
      requestHash,
      kind: "deposit",
      currency: "XOF",
      amountMinor: channelContext.amountMinor,
      feeMinor: channelContext.amounts.feeMinor,
      feePayer: "recipient",
      senderTotalMinor: channelContext.amountMinor,
      recipientTotalMinor: channelContext.amounts.recipientAmountMinor,
      state: "created",
      ledgerEntryId: null,
    }).returning();
    if (!intent) throw new Error("LinkFlow payment intent was not created");

    const [mapping] = await tx.insert(customerPaymentLinkAttemptsTable).values({
      paymentLinkId: lockedLink.id,
      intentId: intent.id,
      idempotencyKey: requestKey,
      requestHash,
      pollTokenHash: hashLinkFlowPollToken(pollToken),
      merchantName,
      payerFirstNameEncrypted: encryptSensitiveData(input.firstName.trim().normalize("NFKC"), "linkflow-payer-name"),
      payerLastNameEncrypted: encryptSensitiveData(input.lastName.trim().normalize("NFKC"), "linkflow-payer-name"),
      ussdCode: channelContext.ussdCode,
    }).returning();
    if (!mapping) throw new Error("LinkFlow public payment handle was not created");

    const [attempt] = await tx.insert(paymentAttemptsTable).values({
      intentId: intent.id,
      direction: "payin",
      countryCode: input.countryCode.toLowerCase(),
      channelId: channelContext.channel.id,
      operationReference,
      amountMinor: channelContext.amountMinor,
      currency: "XOF",
      status: "prepared",
      providerReference: null,
      providerReferenceHash: null,
      finalConfirmationId: null,
      dispatchedAt: null,
    }).returning();
    if (!attempt) throw new Error("LinkFlow provider attempt was not created");

    return {
      kind: "created" as const,
      mappingId: mapping.id,
      intentId: intent.id,
      attemptId: attempt.id,
      requestKey,
      pollToken,
    };
  });

  let mappingId: string;
  let requestKey: string;
  let pollToken: string;
  if (prepared.kind === "existing") {
    mappingId = prepared.mappingId;
    requestKey = prepared.requestKey;
    pollToken = deriveLinkFlowPollToken(link.id, requestKey);
    const existing = await loadAttemptBundle(mappingId, hashLinkFlowPollToken(pollToken));
    if (!existing) throw new LinkFlowPaymentError(503, "La demande de paiement est momentanément indisponible.");
    if (existing.attempt.status === "prepared") await dispatchPreparedAttempt(existing.attempt.id);
  } else {
    mappingId = prepared.mappingId;
    requestKey = prepared.requestKey;
    pollToken = prepared.pollToken;
    await dispatchPreparedAttempt(prepared.attemptId);
  }
  const bundle = await loadAttemptBundle(mappingId, hashLinkFlowPollToken(pollToken));
  if (!bundle) throw new LinkFlowPaymentError(503, "La demande de paiement est momentanément indisponible.");
  return { ...asPublicStatus(bundle), pollToken };
}

async function updateNonFinalAttempt(
  bundle: AttemptBundle,
  state: "waiting" | "uncertain",
) {
  await db.transaction(async (tx) => {
    const [attempt] = await tx.select().from(paymentAttemptsTable)
      .where(eq(paymentAttemptsTable.id, bundle.attempt.id)).for("update").limit(1);
    const [intent] = await tx.select().from(paymentIntentsTable)
      .where(eq(paymentIntentsTable.id, bundle.intent.id)).for("update").limit(1);
    if (!attempt || !intent || ["succeeded", "failed"].includes(intent.state) ||
      ["succeeded", "failed"].includes(attempt.status)) return;

    const desiredAttemptStatus = state === "waiting" ? "pending" : "uncertain";
    if (attempt.status !== desiredAttemptStatus &&
      ["dispatching", "pending", "uncertain"].includes(attempt.status)) {
      await tx.update(paymentAttemptsTable).set({
        status: desiredAttemptStatus,
        updatedAt: new Date(),
      }).where(eq(paymentAttemptsTable.id, attempt.id));
    }
    const desiredIntentState = state === "waiting" ? "collecting" : "uncertain";
    if (intent.state !== desiredIntentState &&
      ["created", "collecting", "uncertain"].includes(intent.state)) {
      await tx.update(paymentIntentsTable).set({
        state: desiredIntentState,
        updatedAt: new Date(),
      }).where(eq(paymentIntentsTable.id, intent.id));
    }
  });
}

async function retryWalletSettlement(bundle: AttemptBundle) {
  return db.transaction(async (tx) => {
    const [mapping] = await tx.select().from(customerPaymentLinkAttemptsTable)
      .where(eq(customerPaymentLinkAttemptsTable.id, bundle.mapping.id)).for("update").limit(1);
    if (!mapping) return false;
    const [intent] = await tx.select().from(paymentIntentsTable)
      .where(eq(paymentIntentsTable.id, mapping.intentId)).for("update").limit(1);
    if (!intent) return false;
    if (intent.state === "succeeded") return true;
    if (intent.state === "failed") return false;
    const [attempt] = await tx.select().from(paymentAttemptsTable).where(and(
      eq(paymentAttemptsTable.intentId, intent.id),
      eq(paymentAttemptsTable.direction, "payin"),
    )).for("update").limit(1);
    const [transaction] = await tx.select().from(transactionsTable)
      .where(eq(transactionsTable.id, intent.transactionId)).for("update").limit(1);
    const [link] = await tx.select().from(customerPaymentLinksTable)
      .where(eq(customerPaymentLinksTable.id, mapping.paymentLinkId)).for("update").limit(1);
    if (!attempt || !transaction || !link || attempt.status !== "succeeded" ||
      !attempt.finalConfirmationId || transaction.status !== "pending") return false;

    const [merchant] = await tx.select({
      id: usersTable.id,
      status: usersTable.status,
      phoneVerifiedAt: usersTable.phoneVerifiedAt,
    }).from(usersTable).where(eq(usersTable.id, transaction.userId)).for("update").limit(1);
    const [wallet] = await tx.select().from(walletsTable)
      .where(eq(walletsTable.userId, transaction.userId)).for("update").limit(1);
    if (!merchant || merchant.status !== "active" || !merchant.phoneVerifiedAt ||
      !wallet || wallet.status !== "active" || wallet.currency !== intent.currency) {
      if (intent.state !== "uncertain") {
        await tx.update(paymentIntentsTable).set({ state: "uncertain", updatedAt: new Date() })
          .where(eq(paymentIntentsTable.id, intent.id));
      }
      return false;
    }

    if (link.maximumUses !== null && link.usageCount >= link.maximumUses) {
      if (intent.state !== "uncertain") {
        await tx.update(paymentIntentsTable).set({ state: "uncertain", updatedAt: new Date() })
          .where(eq(paymentIntentsTable.id, intent.id));
      }
      return false;
    }
    const balanceAfterMinor = wallet.balanceMinor + intent.recipientTotalMinor;
    if (!Number.isSafeInteger(balanceAfterMinor) || balanceAfterMinor < 0) {
      if (intent.state !== "uncertain") {
        await tx.update(paymentIntentsTable).set({ state: "uncertain", updatedAt: new Date() })
          .where(eq(paymentIntentsTable.id, intent.id));
      }
      return false;
    }
    const [ledgerEntry] = await tx.insert(walletLedgerTable).values({
      walletId: wallet.id,
      userId: transaction.userId,
      direction: "credit",
      amountMinor: intent.recipientTotalMinor,
      balanceBeforeMinor: wallet.balanceMinor,
      balanceAfterMinor,
      currency: intent.currency,
      reason: `Paiement LinkFlow confirmé ${attempt.operationReference}`,
      adminUserId: "system:linkflow",
      idempotencyKey: `payment:${intent.id}:credit`,
    }).returning();
    if (!ledgerEntry) throw new Error("LinkFlow wallet credit was not recorded");
    await tx.update(walletsTable).set({ balanceMinor: balanceAfterMinor, updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));
    await tx.update(paymentIntentsTable).set({
      state: "succeeded",
      ledgerEntryId: ledgerEntry.id,
      updatedAt: new Date(),
    }).where(eq(paymentIntentsTable.id, intent.id));
    await tx.update(transactionsTable).set({ status: "succeeded", updatedAt: new Date() })
      .where(eq(transactionsTable.id, transaction.id));
    const [incremented] = await tx.update(customerPaymentLinksTable).set({
      usageCount: sql`${customerPaymentLinksTable.usageCount} + 1`,
      updatedAt: new Date(),
    }).where(and(
      eq(customerPaymentLinksTable.id, link.id),
      sql`${customerPaymentLinksTable.maximumUses} is null OR ${customerPaymentLinksTable.usageCount} < ${customerPaymentLinksTable.maximumUses}`,
    )).returning({ id: customerPaymentLinksTable.id });
    if (!incremented) throw new Error("LinkFlow use reservation could not be consumed");
    if (link.source === "api") {
      await enqueueDeveloperPaymentEvent(tx, {
        paymentLinkId: link.id,
        eventType: "payment.succeeded",
        attemptId: attempt.id,
        transactionId: transaction.id,
        amountMinor: attempt.amountMinor,
        currency: attempt.currency,
        occurredAt: new Date(),
      });
    }
    return true;
  });
}

async function finalizeVerifiedStatus(bundle: AttemptBundle, receipt: FeexpayReceipt) {
  const outcome = resolveVerifiedProviderState(receipt, {
    reference: bundle.attempt.providerReference
      ? decryptSensitiveData(bundle.attempt.providerReference, "provider-reference")
      : "",
    amountMinor: bundle.attempt.amountMinor,
    currency: "XOF",
    shopId: process.env.FEEXPAY_SHOP_ID ?? "",
    channelId: bundle.attempt.channelId,
  });
  if (outcome === "waiting" || outcome === "uncertain") {
    await updateNonFinalAttempt(bundle, outcome);
    return;
  }

  await db.transaction(async (tx) => {
    const [mapping] = await tx.select().from(customerPaymentLinkAttemptsTable)
      .where(eq(customerPaymentLinkAttemptsTable.id, bundle.mapping.id)).for("update").limit(1);
    if (!mapping) return;
    const [intent] = await tx.select().from(paymentIntentsTable)
      .where(eq(paymentIntentsTable.id, mapping.intentId)).for("update").limit(1);
    if (!intent || ["succeeded", "failed"].includes(intent.state)) return;
    const [attempt] = await tx.select().from(paymentAttemptsTable).where(and(
      eq(paymentAttemptsTable.intentId, intent.id),
      eq(paymentAttemptsTable.direction, "payin"),
    )).for("update").limit(1);
    const [transaction] = await tx.select().from(transactionsTable)
      .where(eq(transactionsTable.id, intent.transactionId)).for("update").limit(1);
    if (!attempt || !transaction || !attempt.providerReferenceHash ||
      !attempt.providerReference || attempt.status === "succeeded" || attempt.status === "failed") return;
    const providerReference = decryptSensitiveData(attempt.providerReference, "provider-reference");
    if (providerReference !== receipt.reference ||
      receipt.amountMinor !== attempt.amountMinor || receipt.currency !== attempt.currency) {
      if (attempt.status !== "uncertain") {
        await tx.update(paymentAttemptsTable).set({ status: "uncertain", updatedAt: new Date() })
          .where(eq(paymentAttemptsTable.id, attempt.id));
      }
      if (intent.state !== "uncertain") {
        await tx.update(paymentIntentsTable).set({ state: "uncertain", updatedAt: new Date() })
          .where(eq(paymentIntentsTable.id, intent.id));
      }
      return;
    }

    const providerStatus = outcome === "succeeded" ? "succeeded" : "failed";
    const eventFingerprint = createHash("sha256").update([
      attempt.id, providerStatus, attempt.providerReferenceHash,
      String(receipt.amountMinor), receipt.currency,
    ].join(":")).digest("hex");
    const now = new Date();
    const encryptedPayload = encryptSensitiveData(JSON.stringify({
      provider: "feexpay",
      direction: "payin",
      reference: receipt.reference,
      status: receipt.status,
      amountMinor: receipt.amountMinor,
      currency: receipt.currency,
      observedAt: now.toISOString(),
    }), "payment-confirmation-payload");
    const [confirmation] = await tx.insert(paymentConfirmationsTable).values({
      attemptId: attempt.id,
      eventFingerprint,
      source: "provider_status",
      providerStatus,
      providerReferenceHash: attempt.providerReferenceHash,
      amountMinor: receipt.amountMinor!,
      currency: receipt.currency!,
      encryptedPayload,
      verifiedAt: now,
    }).returning();
    if (!confirmation) throw new Error("LinkFlow provider confirmation was not recorded");

    await tx.update(paymentAttemptsTable).set({
      status: providerStatus,
      finalConfirmationId: confirmation.id,
      updatedAt: now,
    }).where(eq(paymentAttemptsTable.id, attempt.id));
    if (providerStatus === "failed") {
      await tx.update(paymentIntentsTable).set({ state: "failed", updatedAt: now })
        .where(eq(paymentIntentsTable.id, intent.id));
      await tx.update(transactionsTable).set({ status: "failed", updatedAt: now })
        .where(eq(transactionsTable.id, transaction.id));
      const [link] = await tx.select({
        source: customerPaymentLinksTable.source,
      }).from(customerPaymentLinksTable)
        .where(eq(customerPaymentLinksTable.id, mapping.paymentLinkId))
        .limit(1);
      if (link?.source === "api") {
        await enqueueDeveloperPaymentEvent(tx, {
          paymentLinkId: mapping.paymentLinkId,
          eventType: "payment.failed",
          attemptId: attempt.id,
          transactionId: transaction.id,
          amountMinor: attempt.amountMinor,
          currency: attempt.currency,
          occurredAt: now,
        });
      }
      return;
    }

    // The provider confirms collection here; the public success screen waits
    // for this same transaction to credit the merchant's net wallet amount.
    await tx.update(transactionsTable).set({ updatedAt: now })
      .where(eq(transactionsTable.id, transaction.id));
  });

  const refreshed = await loadAttemptBundle(bundle.mapping.id, bundle.mapping.pollTokenHash);
  if (refreshed?.attempt.status === "succeeded" && refreshed.intent.state !== "succeeded") {
    await retryWalletSettlement(refreshed);
  }
}

async function refreshLinkFlowPaymentAttemptStatus(
  attemptId: string,
  tokenHash: string,
): Promise<PublicLinkFlowPaymentStatus> {
  if (isSharedNeonPreview()) {
    throw new LinkFlowPaymentError(503, "La vérification du paiement n’est pas disponible dans cet environnement.");
  }
  if (!uuidPattern.test(attemptId) || !/^[a-f0-9]{64}$/.test(tokenHash)) {
    throw new LinkFlowPaymentError(404, "Cette demande de paiement n’est pas disponible.");
  }
  const bundle = await loadAttemptBundle(attemptId, tokenHash);
  if (!bundle) throw new LinkFlowPaymentError(404, "Cette demande de paiement n’est pas disponible.");
  const currentState = publicState(bundle.intent.state, bundle.attempt.status);
  if (currentState === "succeeded" || currentState === "failed") return asPublicStatus(bundle);

  if (bundle.attempt.status === "succeeded" && bundle.attempt.finalConfirmationId) {
    await retryWalletSettlement(bundle);
    const afterSettlement = await loadAttemptBundle(attemptId, tokenHash);
    if (!afterSettlement) throw new LinkFlowPaymentError(404, "Cette demande de paiement n’est pas disponible.");
    return asPublicStatus(afterSettlement);
  }

  if (!bundle.attempt.providerReference || !bundle.attempt.providerReferenceHash ||
    !bundle.attempt.dispatchedAt) {
    return asPublicStatus(bundle);
  }
  let receipt: FeexpayReceipt;
  try {
    const reference = decryptSensitiveData(bundle.attempt.providerReference, "provider-reference");
    receipt = await new FeexpayClient().getStatus("payin", reference);
  } catch {
    // A status timeout or provider error is not a final failure.
    return asPublicStatus(bundle);
  }
  await finalizeVerifiedStatus(bundle, receipt);
  const refreshed = await loadAttemptBundle(attemptId, tokenHash);
  if (!refreshed) throw new LinkFlowPaymentError(404, "Cette demande de paiement n’est pas disponible.");
  return asPublicStatus(refreshed);
}

export async function getLinkFlowPaymentAttemptStatus(
  attemptId: string,
  pollToken: string,
): Promise<PublicLinkFlowPaymentStatus> {
  if (!/^[a-f0-9]{64}$/.test(pollToken)) {
    throw new LinkFlowPaymentError(404, "Cette demande de paiement n’est pas disponible.");
  }
  return refreshLinkFlowPaymentAttemptStatus(attemptId, hashLinkFlowPollToken(pollToken));
}

/** Server-to-server polling after the developer session owner was authorized. */
export async function getLinkFlowPaymentAttemptStatusByMappingId(
  attemptId: string,
): Promise<PublicLinkFlowPaymentStatus> {
  if (!uuidPattern.test(attemptId)) {
    throw new LinkFlowPaymentError(404, "Cette demande de paiement n’est pas disponible.");
  }
  const [mapping] = await db.select({
    id: customerPaymentLinkAttemptsTable.id,
    pollTokenHash: customerPaymentLinkAttemptsTable.pollTokenHash,
  }).from(customerPaymentLinkAttemptsTable)
    .where(eq(customerPaymentLinkAttemptsTable.id, attemptId))
    .limit(1);
  if (!mapping) throw new LinkFlowPaymentError(404, "Cette demande de paiement n’est pas disponible.");
  return refreshLinkFlowPaymentAttemptStatus(mapping.id, mapping.pollTokenHash);
}
