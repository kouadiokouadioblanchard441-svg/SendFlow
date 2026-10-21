const sensitiveNames = [
  "password", "pin", "otp", "code", "token", "apiKey", "secret",
  "accessToken", "refreshToken", "sessionToken", "sessionSecret",
  "phone", "email", "fullName", "displayName", "birthDate",
  "providerMessage", "diagnosticMessage", "authorization", "cookie",
  "DIDIT_API_KEY", "DIDIT_WEBHOOK_SECRET", "ESMS_API_KEY",
  "SESSION_SECRET", "CUSTOMER_PII_ENCRYPTION_KEY", "NEON_DATABASE_URL_PRODUCTION",
];

export const sensitiveLogPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
  "req.body",
  "body",
  ...sensitiveNames.flatMap(name => [name, `*.${name}`, `*.*.${name}`]),
];

export function safeErrorForLog(error: unknown): { type: string; errorCode?: string } {
  const summary: { type: string; errorCode?: string } = { type: "Error" };
  if (typeof error !== "object" || error === null) return summary;
  try {
    // Read data properties only, never arbitrary getters or Error.toJSON().
    const code = Object.getOwnPropertyDescriptor(error, "code")?.value;
    if (
      typeof code === "string" &&
      /^(?:[A-Z0-9]{5}|ERR_[A-Z_]{1,64})$/.test(code)
    ) summary.errorCode = code;
  } catch {
    // Proxies and malformed thrown objects must not break the logger.
  }
  return summary;
}

// pino-http supplies its own default error serializer; pass this explicitly
// there as well as on the base logger so raw errors cannot be reintroduced.
export const errorLogSerializers = {
  err: safeErrorForLog,
  error: safeErrorForLog,
};
