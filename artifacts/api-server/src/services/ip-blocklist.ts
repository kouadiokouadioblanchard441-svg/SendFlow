import {
  and, db, desc, eq, ipBlocklistTable, isNull, sql, adminAuditLogsTable,
} from "@workspace/db";
import { isBlockableIp, normalizeIp } from "@workspace/db/ip-access-policy";

export class IpBlockError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

function auditReason(reason: string) {
  const clean = reason.trim();
  if (clean.length < 3 || clean.length > 500 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(clean)) {
    throw new IpBlockError("Un motif de 3 à 500 caractères est obligatoire.", 400);
  }
  return clean;
}

export function ipBlockResponse(row: typeof ipBlocklistTable.$inferSelect) {
  return { ...row, blockedAt: row.blockedAt.toISOString(), revokedAt: row.revokedAt?.toISOString() ?? null };
}

export async function listIpBlocks(page: number) {
  const pageSize = 50;
  const rows = await db.select().from(ipBlocklistTable)
    .orderBy(desc(ipBlocklistTable.blockedAt), desc(ipBlocklistTable.id))
    .limit(pageSize + 1).offset((page - 1) * pageSize);
  return { items: rows.slice(0, pageSize).map(ipBlockResponse), page, pageSize, hasMore: rows.length > pageSize };
}

export async function createIpBlock(actor: string, requestedIp: string, reason: string, actorIp: string | null) {
  if (!actor) throw new IpBlockError("Autorisation administrateur requise.", 403);
  const ipAddress = normalizeIp(requestedIp);
  if (!ipAddress || !isBlockableIp(ipAddress)) {
    throw new IpBlockError("Indiquez une IPv4 ou IPv6 publique, sans port ni plage CIDR.", 400);
  }
  if (!actorIp || !normalizeIp(actorIp)) throw new IpBlockError("Votre adresse réseau ne peut pas être vérifiée.", 409);
  if (ipAddress === normalizeIp(actorIp)) throw new IpBlockError("Vous ne pouvez pas bloquer votre propre adresse IP.", 409);
  const cleanReason = auditReason(reason);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(ipBlocklistTable).values({ ipAddress, reason: cleanReason, blockedBy: actor })
      .onConflictDoUpdate({
        target: ipBlocklistTable.ipAddress,
        set: {
          reason: cleanReason, blockedBy: actor, blockedAt: new Date(),
          revokedAt: null, revokedBy: null, version: sql`${ipBlocklistTable.version} + 1`,
        },
        setWhere: sql`${ipBlocklistTable.revokedAt} IS NOT NULL`,
      }).returning();
    if (!row) throw new IpBlockError("Cette adresse est déjà bloquée.", 409);
    await tx.insert(adminAuditLogsTable).values({
      adminUserId: actor, action: "block_ip", resourceType: "ip_block", resourceId: row.id, reason: cleanReason,
    });
    return ipBlockResponse(row);
  });
}

export async function revokeIpBlock(actor: string, id: string, version: number, reason: string) {
  if (!actor) throw new IpBlockError("Autorisation administrateur requise.", 403);
  const cleanReason = auditReason(reason);
  return db.transaction(async (tx) => {
    const [row] = await tx.update(ipBlocklistTable).set({
      revokedBy: actor, revokedAt: new Date(), version: sql`${ipBlocklistTable.version} + 1`,
    }).where(and(eq(ipBlocklistTable.id, id), eq(ipBlocklistTable.version, version), isNull(ipBlocklistTable.revokedAt))).returning();
    if (!row) throw new IpBlockError("Le blocage a changé. Actualisez la liste.", 409);
    await tx.insert(adminAuditLogsTable).values({
      adminUserId: actor, action: "unblock_ip", resourceType: "ip_block", resourceId: row.id, reason: cleanReason,
    });
    return ipBlockResponse(row);
  });
}
