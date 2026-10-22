type Environment = Readonly<Record<string, string | undefined>>;

export function isReplitPaymentTestHost(environment: Environment = process.env) {
  return environment.SENDFLOW_DATABASE_TARGET === "shared-neon"
    && environment.FEEXPAY_EXECUTION_HOST === "replit";
}

export function isPaymentTestSessionForSharedNeon(
  session: { paymentTestAccount: boolean },
  environment: Environment = process.env,
) {
  return environment.SENDFLOW_DATABASE_TARGET === "shared-neon" && session.paymentTestAccount;
}
