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

// Sources: docs.didit.me/integration/verification-statuses and
// help.didit.me/verification-sessions/session-statuses (AML/manual reopen).
// Webhooks may skip intermediate steps; only a strictly newer signed record
// timestamp can reopen a decision. Dispatch timestamps cannot establish order.
const TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  "Not Started": ["Awaiting User", "In Progress", "Resubmitted", "In Review", "Approved", "Declined", "Expired", "Abandoned", "Kyc Expired"],
  "Awaiting User": ["In Progress", "Resubmitted", "In Review", "Approved", "Declined", "Expired", "Abandoned", "Kyc Expired"],
  "In Progress": ["Awaiting User", "Resubmitted", "In Review", "Approved", "Declined", "Expired", "Abandoned", "Kyc Expired"],
  "Resubmitted": ["Awaiting User", "In Review", "Approved", "Declined", "Expired", "Abandoned", "Kyc Expired"],
  "In Review": ["Resubmitted", "Approved", "Declined", "Expired", "Abandoned", "Kyc Expired"],
  "Approved": ["In Review", "Declined", "Resubmitted", "Kyc Expired"],
  "Declined": ["Resubmitted", "In Review"],
  "Expired": [],
  "Abandoned": [],
  "Kyc Expired": ["In Review", "Resubmitted"],
};

export function canApplyDiditStatusTransition(
  current: string, incoming: string, incomingTime?: Date | null, previousTime?: Date | null,
): boolean {
  if (!Object.hasOwn(TRANSITIONS, current) || !Object.hasOwn(TRANSITIONS, incoming)) return false;
  if (previousTime && (!incomingTime || incomingTime < previousTime)) return false;
  if (current !== incoming && incoming === "Approved" && previousTime
    && incomingTime!.getTime() <= previousTime.getTime()) return false;
  if (["Declined", "Kyc Expired"].includes(current) && incoming === "Approved") {
    return !!incomingTime && !!previousTime && incomingTime > previousTime;
  }
  return current === incoming || TRANSITIONS[current]!.includes(incoming);
}
