// Bundle with esbuild as for the other operational scripts. Never started by
// the web server. Invoking --run authorizes billed/live provider reads.
import { db, pool, eq, asc, identityVerificationsTable as table } from "@workspace/db";
import { reconcileIdentityVerification } from "../src/services/identity-reconciliation";

try {
  const pending = await db.select({ id: table.id, requestedAt: table.reconciliationRequestedAt })
    .from(table).where(eq(table.reconciliationRequired, true))
    .orderBy(asc(table.reconciliationRequestedAt)).limit(100);
  if (pending.length) console.error(JSON.stringify({
    code: "IDENTITY_RECONCILIATION_REQUIRED", count: pending.length,
    oldestAt: pending[0].requestedAt, // No session/customer IDs or evidence.
  }));
  if (!process.argv.includes("--run")) {
    // Suitable for scheduled monitoring: nonzero while work remains.
    process.exitCode = pending.length ? 2 : 0;
  } else {
    if (process.env.NODE_ENV !== "production") throw new Error("Production runtime required");
    for (const item of pending) {
      try {
        const outcome = await reconcileIdentityVerification(item.id);
        if (outcome === "superseded") process.exitCode = 2;
      } catch {
        console.error(JSON.stringify({ code: "IDENTITY_RECONCILIATION_FAILED" }));
        process.exitCode = 1;
      }
    }
    // A bounded batch is not success if additional pending work exists.
    const remaining = await db.select({ id: table.id }).from(table)
      .where(eq(table.reconciliationRequired, true)).limit(1);
    if (remaining.length && !process.exitCode) process.exitCode = 2;
  }
} catch {
  console.error(JSON.stringify({ code: "IDENTITY_RECONCILIATION_UNAVAILABLE" }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
