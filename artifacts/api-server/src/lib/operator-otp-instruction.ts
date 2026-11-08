export type OperatorOtpInstructionPolicy = {
  requiresOtp: boolean;
  otpCommand: string | null;
};

export function getConfiguredOtpCommand(
  policy: OperatorOtpInstructionPolicy | null | undefined,
  amountMinor?: number,
): string | null {
  if (!policy?.requiresOtp || !policy.otpCommand) return null;
  if (!policy.otpCommand.includes("{amount}")) return policy.otpCommand;
  if (amountMinor === undefined) return policy.otpCommand;
  if (!Number.isSafeInteger(amountMinor) || (amountMinor ?? 0) < 1) return null;

  const resolved = policy.otpCommand.replace("{amount}", String(amountMinor));
  return /^[*#][0-9*#]{1,38}#$/.test(resolved) ? resolved : null;
}
