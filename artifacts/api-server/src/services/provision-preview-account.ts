import { randomUUID } from "node:crypto";
import {
  db, eq, or, sql, usersTable, walletsTable, customerCredentialsTable,
  previewAccessTable, adminAuditLogsTable,
} from "@workspace/db";
import { SignInCustomerBody } from "@workspace/api-zod";
import { hashCustomerSecret } from "../lib/customer-auth-crypto";
import { toPreviewPasswordHash } from "../lib/preview-credential-policy";
import { createSensitiveDataLookupIndex, encryptSensitiveData } from "../lib/sensitive-data-crypto";

// CLI-only service. Not imported by any public route, and never runs at startup.
export async function provisionPreviewAccount(phone: string, password: string) {
  const parsed = SignInCustomerBody.safeParse({ phone, password });
  if (!parsed.success || password.length < 8) throw new Error("Invalid preview credentials");
  const passwordHash = toPreviewPasswordHash(await hashCustomerSecret(password));
  const phoneHash = createSensitiveDataLookupIndex(parsed.data.phone, "user-phone");
  return db.transaction(async (tx) => {
    // Serialize provisioning and refuse replacing users or the existing grant.
    await tx.execute(sql`select pg_advisory_xact_lock(731204, 1)`);
    if ((await tx.select({ slot: previewAccessTable.slot }).from(previewAccessTable).limit(1)).length) {
      throw new Error("A preview account is already provisioned; no replacement was made");
    }
    const [existing] = await tx.select({ id: usersTable.id }).from(usersTable).where(or(
      eq(usersTable.phoneLookupHash, phoneHash), eq(usersTable.phone, parsed.data.phone),
    )).limit(1);
    if (existing) throw new Error("The chosen number is already in use; no account was changed");
    const userId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await tx.insert(usersTable).values({
      id: userId, phone: encryptSensitiveData(parsed.data.phone, "user-phone"),
      phoneLookupHash: phoneHash, phoneVerifiedAt: null,
      displayName: encryptSensitiveData("Visualisation", "user-name"),
      countryCode: parsed.data.phone.startsWith("+225") ? "CI" : null,
    });
    await tx.insert(customerCredentialsTable).values({
      userId, passwordHash,
      // Records the owner's authorization for an internal viewing account,
      // NOT a claim of accepted customer terms or a verified identity.
      privacyAcceptedAt: now, privacyPolicyVersion: "internal-preview-authorization-v1",
    });
    await tx.insert(walletsTable).values({ userId, balanceMinor: 0 });
    await tx.insert(previewAccessTable).values({ slot: 1, userId, expiresAt, createdAt: now });
    await tx.insert(adminAuditLogsTable).values({
      adminUserId: "system:preview-provisioning", action: "provision_preview_account",
      resourceType: "preview_access", resourceId: userId,
      reason: "Owner-authorized internal viewer; no customer terms or phone verification asserted",
    });
    return { expiresAt };
  });
}
