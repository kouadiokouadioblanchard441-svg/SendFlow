import { Router, type IRouter } from "express";
import {
  CreateCustomerTransferQuoteBody,
  CreateCustomerTransferQuoteResponse,
} from "@workspace/api-zod";
import { calculateCustomerTransferQuote, TransferQuoteError } from "../services/transfer-quote";
import { loadTransferQuoteDependencies } from "../data/transfer-quote";
import {
  getMonthlyIncomingPolicy,
  monthlyIncomingOutgoingBlockedMessage,
} from "../data/unverified-incoming-policy";
import { consumeTransferQuoteQuota } from "../data/transfer-quote-quota";
import { requireCustomerSession } from "../lib/customer-session";

const router: IRouter = Router();

router.post("/me/transfer-quote", async (req, res): Promise<void> => {
  const session = await requireCustomerSession(req, res, true);
  if (!session) return;
  res.setHeader("Cache-Control", "no-store, private");

  try {
    if (!await consumeTransferQuoteQuota(session.userId)) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Trop de demandes de devis. Réessayez dans une minute." });
      return;
    }
    const parsed = CreateCustomerTransferQuoteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Vérifiez les informations du transfert." });
      return;
    }
    if (parsed.data.kind !== "deposit") {
      const incomingPolicy = await getMonthlyIncomingPolicy(session.userId);
      if (incomingPolicy.outgoingBlocked) {
        res.status(403).json({
          code: incomingPolicy.blockCode,
          error: monthlyIncomingOutgoingBlockedMessage(incomingPolicy),
        });
        return;
      }
    }
    const quote = await calculateCustomerTransferQuote(
      session.userId, parsed.data, await loadTransferQuoteDependencies(),
    );
    res.json(CreateCustomerTransferQuoteResponse.parse(quote));
  } catch (error) {
    if (error instanceof TransferQuoteError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    req.log.error({ err: error, userId: session.userId }, "Customer transfer quote failed");
    res.status(503).json({ error: "Les tarifs sont momentanément indisponibles." });
  }
});

export default router;
