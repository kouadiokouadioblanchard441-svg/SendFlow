import { adminAuditLogsTable, db, type AdminAuditAction, type AdminAuditResourceType } from "@workspace/db";

type AdminAuditEntry = {
  adminUserId: string;
  action: AdminAuditAction;
  resourceType: AdminAuditResourceType;
  resourceId: string;
  reason?: string;
  amountMinor?: number;
  currency?: string;
};

type AuditDatabase = Pick<typeof db, "insert">;

export async function recordAdminAudit(entry: AdminAuditEntry, database: AuditDatabase = db) {
  const [created] = await database
    .insert(adminAuditLogsTable)
    .values(entry)
    .returning({ id: adminAuditLogsTable.id });

  if (!created) {
    throw new Error("Administrator audit entry was not created");
  }
}