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
  // Defence in depth: a pending case can never expose an approved limit even
  // if an older server process writes Approved without knowing about the hold.
  return verification?.reconciliationRequired && verification.status === "Approved"
    ? { ...verification, status: "In Review" }
    : verification;
}
