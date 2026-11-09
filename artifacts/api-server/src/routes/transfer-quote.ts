import { Router, type IRouter } from "express";
import {
  CreateCustomerTransferQuoteBody,
  CreateCustomerTransferQuoteResponse,
} from "@workspace/api-zod";
import { calculateCustomerTransferQuote, TransferQuoteError } from "../services/transfer-quote";
import { loadTransferQuoteDependencies } from "../data/transfer-quote";
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
