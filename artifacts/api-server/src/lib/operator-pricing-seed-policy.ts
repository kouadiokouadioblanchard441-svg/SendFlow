type RuntimeEnvironment = {
  SENDFLOW_DATABASE_TARGET?: string;
};

export function shouldSeedOperatorPricingCatalog(
  environment: RuntimeEnvironment = process.env,
): boolean {
  return environment.SENDFLOW_DATABASE_TARGET === "development"
    || environment.SENDFLOW_DATABASE_TARGET === "production";
}
