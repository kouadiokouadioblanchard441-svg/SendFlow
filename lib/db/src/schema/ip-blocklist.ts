import { check, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const ipBlocklistTable = pgTable("sf_ip_blocklist", {
  id: uuid("id").defaultRandom().primaryKey(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull().unique(),
  reason: varchar("reason", { length: 500 }).notNull(),
  blockedBy: text("blocked_by").notNull(),
  blockedAt: timestamp("blocked_at", { withTimezone: true }).notNull().defaultNow(),
  revokedBy: text("revoked_by"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
}, (t) => [
  check("sf_ip_blocklist_positive_version", sql`${t.version} > 0`),
  check("sf_ip_blocklist_revocation_pair", sql`(${t.revokedAt} IS NULL) = (${t.revokedBy} IS NULL)`),
  check("sf_ip_blocklist_host", sql`${t.ipAddress} = host(${t.ipAddress}::inet) AND masklen(${t.ipAddress}::inet) = CASE family(${t.ipAddress}::inet) WHEN 4 THEN 32 ELSE 128 END`),
]);
