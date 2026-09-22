import { adminAuditLogsTable, db, type AdminAuditAction, type AdminAuditResourceType } from "@workspace/db";

type AdminAuditEntry = {
  adminUserId: string;
  action: AdminAuditAction;
  resourceType: AdminAuditResourceType;
  resourceId: string;
};

export async function recordAdminAudit(entry: AdminAuditEntry) {
  const [created] = await db
    .insert(adminAuditLogsTable)
    .values(entry)
    .returning({ id: adminAuditLogsTable.id });

  if (!created) {
    throw new Error("Administrator audit entry was not created");
  }
}