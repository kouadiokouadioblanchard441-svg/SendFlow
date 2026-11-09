import { db, eq, paymentLimitsTable } from "@workspace/db";
import type { PaymentLimitValues } from "../services/payment-limits-policy";

export const PAYMENT_LIMITS_ID = "global";

export async function loadPaymentLimits(): Promise<PaymentLimitValues> {
  const [record] = await db.select().from(paymentLimitsTable)
    .where(eq(paymentLimitsTable.id, PAYMENT_LIMITS_ID)).limit(1);
  if (!record) throw new Error("Payment limits have not been initialized");

  return {
    minimumDepositMinor: record.minimumDepositMinor,
    minimumPayoutMinor: record.minimumPayoutMinor,
    maximumPayoutDailyMinor: record.maximumPayoutDailyMinor,
    minimumInterNetworkMinor: record.minimumInterNetworkMinor,
    maximumTransferMinor: record.maximumTransferMinor,
    maximumPayinMinor: record.maximumPayinMinor,
    maximumUnverifiedIncomingMinor: record.maximumUnverifiedIncomingMinor,
    maximumVerifiedIncomingMinor: record.maximumVerifiedIncomingMinor,
  };
}
