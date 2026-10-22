import { db, desc, eq, identityVerificationsTable } from "@workspace/db";

/** Never revive an old approval after a newer verification has superseded it. */
export async function loadLatestIdentityVerification(
  userId: string,
  database: Pick<typeof db, "select"> = db,
) {
  const [verification] = await database.select().from(identityVerificationsTable)
    .where(eq(identityVerificationsTable.userId, userId))
    .orderBy(desc(identityVerificationsTable.createdAt), desc(identityVerificationsTable.id))
    .limit(1);
  return verification;
}
