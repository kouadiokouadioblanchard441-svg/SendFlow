import { isMatchingPayoutSettlementEvidence } from "./payout-policy.ts";
import { feexpayChannelForOperator } from "../providers/feexpay/catalog.ts";
import type { FeexpayReceipt } from "../providers/feexpay/client.ts";
import {
  createSensitiveDataLookupIndex,
  decryptSensitiveData,
} from "../lib/sensitive-data-crypto.ts";

type PayoutSettlementRequest = {
  id: string;
  executionReferenceEncrypted: string | null;
  beneficiaryPhoneEncrypted: string;
  beneficiaryPhoneHash: string;
  beneficiaryAmountMinor: number;
  currency: string;
  countryCode: string;
  operatorId: string;
};

type PayoutSettlementAttempt = {
  executionReferenceHash: string | null;
  expectedExecutionAccountHash: string;
  expectedExecutionChannelId: string;
};

export function resolveVerifiedFinalStatus(
  payout: PayoutSettlementRequest,
  attempt: PayoutSettlementAttempt,
  receipt: FeexpayReceipt,
) {
  if (receipt.status === "PENDING" ||
    !attempt.executionReferenceHash ||
    !payout.executionReferenceEncrypted ||
    receipt.verifiedStatusOperation !== "payout" ||
    receipt.amountMinor !== payout.beneficiaryAmountMinor ||
    (receipt.currency !== undefined && receipt.currency !== payout.currency) ||
    feexpayChannelForOperator(payout.countryCode, payout.operatorId)?.id !==
      attempt.expectedExecutionChannelId) return false;
  const expectedReference = decryptSensitiveData(
    payout.executionReferenceEncrypted,
    "provider-reference",
    { authenticatedContext: payout.id },
  );
  if (receipt.reference !== expectedReference ||
    createSensitiveDataLookupIndex(expectedReference, "provider-reference") !==
      attempt.executionReferenceHash) return false;
  const phone = decryptSensitiveData(payout.beneficiaryPhoneEncrypted, "payout-beneficiary-phone", {
    authenticatedContext: payout.id,
  }).replace(/\D/g, "");
  if (receipt.phoneNumber !== undefined && receipt.phoneNumber !== phone) return false;
  const expected = {
    executionReferenceHash: attempt.executionReferenceHash,
    beneficiaryAmountMinor: payout.beneficiaryAmountMinor,
    currency: payout.currency,
    countryCode: payout.countryCode,
    operatorId: payout.operatorId,
    beneficiaryPhoneHash: payout.beneficiaryPhoneHash,
    expectedExecutionAccountHash: attempt.expectedExecutionAccountHash,
    expectedExecutionChannelId: attempt.expectedExecutionChannelId,
  };
  const evidence = {
    executionReferenceHash: attempt.executionReferenceHash,
    executionStatus: receipt.status === "SUCCESSFUL" ? "SUCCEEDED" as const : "FAILED" as const,
    amountMinor: receipt.amountMinor,
    currency: payout.currency,
    countryCode: payout.countryCode,
    operatorId: payout.operatorId,
    beneficiaryPhoneHash: payout.beneficiaryPhoneHash,
    executionAccountHash: attempt.expectedExecutionAccountHash,
    executionChannelId: attempt.expectedExecutionChannelId,
    operation: "payout",
    verificationPassed: true,
  };
  return isMatchingPayoutSettlementEvidence(
    expected,
    evidence,
    evidence.executionStatus,
  );
}
