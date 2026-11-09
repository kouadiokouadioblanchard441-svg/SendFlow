import { adminAuditLogsTable, db, type AdminAuditAction, type AdminAuditResourceType } from "@workspace/db";
import { currentAdminAuditContext } from "./admin-audit-context";

type AdminAuditEntry = {
  adminUserId: string;
  action: AdminAuditAction;
  resourceType: AdminAuditResourceType;
  resourceId: string;
  reason?: string;
  amountMinor?: number;
  currency?: string;
  sessionId?: string;
  ipHash?: string;
  userAgentHash?: string;
  outcome?: "success" | "failure" | "denied" | "revoked";
};

type AuditDatabase = Pick<typeof db, "insert">;

export async function recordAdminAudit(entry: AdminAuditEntry, database: AuditDatabase = db) {
  const context = currentAdminAuditContext();
  const [created] = await database
    .insert(adminAuditLogsTable)
    .values({
      ...entry,
      sessionId: entry.sessionId ?? context?.sessionId,
      ipHash: entry.ipHash ?? context?.ipHash,
      userAgentHash: entry.userAgentHash ?? context?.userAgentHash,
    })
    .returning({ id: adminAuditLogsTable.id });

  if (!created) {
    throw new Error("Administrator audit entry was not created");
  }
}