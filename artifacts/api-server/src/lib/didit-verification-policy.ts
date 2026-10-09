export const ACTIVE_DIDIT_VERIFICATION_STATUSES = [
  "Not Started",
  "Awaiting User",
  "In Progress",
  "In Review",
  "Resubmitted",
] as const;

export function isReusableDiditVerificationStatus(status: string) {
  return status === "Approved" || ACTIVE_DIDIT_VERIFICATION_STATUSES.includes(
    status as (typeof ACTIVE_DIDIT_VERIFICATION_STATUSES)[number],
  );
}
