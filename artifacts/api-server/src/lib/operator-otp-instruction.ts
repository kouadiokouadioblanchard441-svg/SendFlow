export type OperatorOtpInstructionPolicy = {
  requiresOtp: boolean;
  otpCommand: string | null;
};

export function getConfiguredOtpCommand(
  policy: OperatorOtpInstructionPolicy | null | undefined,
): string | null {
  return policy?.requiresOtp ? policy.otpCommand : null;
}
