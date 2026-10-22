import { and, eq, or, sql, usersTable, replitPaymentTestAccessTable } from "@workspace/db";
import { activePreviewAccountCondition } from "./preview-account-condition";
import { isReplitPaymentTestHost } from "./replit-payment-test-access-policy";

export { isPaymentTestSessionForSharedNeon, isReplitPaymentTestHost } from "./replit-payment-test-access-policy";

export function activeReplitPaymentTestAccountCondition(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (!isReplitPaymentTestHost(environment)) return sql`false`;
  return and(
    eq(usersTable.status, "active"),
    sql`${usersTable.phoneVerifiedAt} IS NOT NULL`,
    sql`exists (
      select 1 from ${replitPaymentTestAccessTable}
      where ${replitPaymentTestAccessTable.userId} = ${usersTable.id}
        and ${replitPaymentTestAccessTable.state} = 'active'
    )`,
  );
}

export function sharedNeonCustomerCondition(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (environment.SENDFLOW_DATABASE_TARGET !== "shared-neon") return undefined;
  return or(
    activePreviewAccountCondition(),
    activeReplitPaymentTestAccountCondition(environment),
  );
}
