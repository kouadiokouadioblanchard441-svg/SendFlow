import {
  and,
  asc,
  customerIdentityUploadsTable,
  db,
  eq,
  isNull,
  lt,
} from "@workspace/db";
import { getIdentityUploadCleanupCutoffs } from "../lib/identity-verification-policy";
import { deletePrivateIdentityObject } from "../lib/identity-verification-storage";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 50;

export type IdentityUploadCleanupLogger = {
  info: (bindings: Record<string, unknown>, message: string) => void;
  warn: (bindings: Record<string, unknown>, message: string) => void;
  error: (bindings: Record<string, unknown>, message: string) => void;
};

export async function cleanupExpiredIdentityUploads(now = new Date()) {
  const { expiredBefore, createdBefore } = getIdentityUploadCleanupCutoffs(now);
  const candidates = await db.select({
    id: customerIdentityUploadsTable.id,
    objectPath: customerIdentityUploadsTable.objectPath,
  }).from(customerIdentityUploadsTable)
    .where(and(
      isNull(customerIdentityUploadsTable.requestId),
      lt(customerIdentityUploadsTable.expiresAt, expiredBefore),
      lt(customerIdentityUploadsTable.createdAt, createdBefore),
    ))
    .orderBy(asc(customerIdentityUploadsTable.createdAt))
    .limit(CLEANUP_BATCH_SIZE);

  let deleted = 0;
  let failed = 0;
  for (const upload of candidates) {
    try {
      // A missing object is expected for tickets that were never uploaded.
      await deletePrivateIdentityObject(upload.objectPath);
      const [removed] = await db.delete(customerIdentityUploadsTable)
        .where(and(
          eq(customerIdentityUploadsTable.id, upload.id),
          isNull(customerIdentityUploadsTable.requestId),
          lt(customerIdentityUploadsTable.expiresAt, expiredBefore),
          lt(customerIdentityUploadsTable.createdAt, createdBefore),
        ))
        .returning({ id: customerIdentityUploadsTable.id });
      if (removed) deleted += 1;
    } catch {
      failed += 1;
    }
  }

  return { deleted, failed };
}

export function startIdentityVerificationUploadCleanup(logger: IdentityUploadCleanupLogger) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await cleanupExpiredIdentityUploads();
      if (result.deleted || result.failed) {
        logger.info(result, "Expired identity upload cleanup finished");
      }
    } catch {
      logger.error({ failure: "identity-upload-cleanup" }, "Expired identity upload cleanup failed");
    } finally {
      running = false;
    }
  };

  void run();
  const interval = setInterval(() => void run(), CLEANUP_INTERVAL_MS);
  interval.unref();
  return () => clearInterval(interval);
}
