import { sql, previewAccessTable, usersTable } from "@workspace/db";

// Correlated SQL authorization: no non-viewer customer row is returned.
// An absent table is an error, never permission to fall back to normal users.
export function activePreviewAccountCondition() {
  return sql`exists (
    select 1 from ${previewAccessTable}
    where ${previewAccessTable.slot} = 1
      and ${previewAccessTable.userId} = ${usersTable.id}
      and ${previewAccessTable.revokedAt} is null
      and ${previewAccessTable.expiresAt} > now()
  )`;
}
