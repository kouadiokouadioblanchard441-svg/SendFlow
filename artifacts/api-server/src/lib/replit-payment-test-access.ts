import { and, eq, or, sql, usersTable, replitPaymentTestAccessTable } from "@workspace/db";
import { isSharedNeonPreview } from "./shared-neon-preview-guard";
import { activePreviewAccountCondition } from "./preview-account-condition";

export function isReplitPaymentTestHost(environment: Readonly<Record<string, string | undefined>> = process.env) {
  return environment.SENDFLOW_DATABASE_TARGET === "shared-neon"
    && environment.FEEXPAY_EXECUTION_HOST === "replit";
}

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
  if (!isSharedNeonPreview(environment)) return undefined;
  return or(
    activePreviewAccountCondition(),
    activeReplitPaymentTestAccountCondition(environment),
  );
}

export function isPaymentTestSessionForSharedNeon(session: { userId: string; paymentTestAccount: boolean }) {
  return isSharedNeonPreview() && session.paymentTestAccount;
}
