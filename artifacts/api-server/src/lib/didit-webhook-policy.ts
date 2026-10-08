export const DIDIT_STATUS_UPDATED_WEBHOOK_TYPE = "status.updated";

export function isDiditStatusUpdateEvent(
  eventType: unknown,
): eventType is typeof DIDIT_STATUS_UPDATED_WEBHOOK_TYPE {
  return eventType === DIDIT_STATUS_UPDATED_WEBHOOK_TYPE;
}

export function isExpectedDiditWebhookEnvironment(
  receivedEnvironment: unknown,
  configuredEnvironment: string | undefined,
) {
  const expectedEnvironment = configuredEnvironment?.trim().toLowerCase();
  return (
    (expectedEnvironment === "sandbox" || expectedEnvironment === "live") &&
    receivedEnvironment === expectedEnvironment
  );
}
