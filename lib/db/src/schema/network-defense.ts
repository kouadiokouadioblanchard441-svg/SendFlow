import { check, index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const networkDefenseTable = pgTable("sf_network_defense", {
  id: uuid("id").defaultRandom().primaryKey(),
  ipAddress: varchar("ip_address",{length:45}).notNull().unique(),
  requestWindowAt: timestamp("request_window_at",{withTimezone:true}).notNull().defaultNow(),
  requestCount: integer("request_count").notNull().default(0),
  probeWindowAt: timestamp("probe_window_at",{withTimezone:true}).notNull().defaultNow(),
  probeCount: integer("probe_count").notNull().default(0),
  blockedUntil: timestamp("blocked_until",{withTimezone:true}),
  blockedAt: timestamp("blocked_at",{withTimezone:true}),
  banCount: integer("ban_count").notNull().default(0),
  rule: varchar("rule",{length:32}),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
  index("sf_network_defense_expiry_idx").on(t.updatedAt),
  check("sf_network_defense_request_count_check",sql`${t.requestCount}>=0`),
  check("sf_network_defense_probe_count_check",sql`${t.probeCount}>=0`),
  check("sf_network_defense_ban_count_check",sql`${t.banCount}>=0`),
  check("sf_network_defense_version_check",sql`${t.version}>0`),
  check("sf_network_defense_ip_address_check",sql`${t.ipAddress}=host(${t.ipAddress}::inet)`),
]);
export const networkDefenseAllowlistTable=pgTable("sf_network_defense_allowlist",{
  id:uuid("id").defaultRandom().primaryKey(),
  ipAddress:varchar("ip_address",{length:45}).notNull().unique(),
  reason:varchar("reason",{length:500}).notNull(),
  createdBy:text("created_by").notNull(),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  revokedBy:text("revoked_by"),
  revokedAt:timestamp("revoked_at",{withTimezone:true}),
  version:integer("version").notNull().default(1),
},t=>[
  check("sf_network_defense_allowlist_reason_check",sql`length(trim(${t.reason})) BETWEEN 3 AND 500`),
  check("sf_network_defense_allowlist_version_check",sql`${t.version}>0`),
  check("sf_network_defense_allowlist_check",sql`(${t.revokedAt} IS NULL)=(${t.revokedBy} IS NULL)`),
  check("sf_network_defense_allowlist_ip_address_check",sql`${t.ipAddress}=host(${t.ipAddress}::inet)`),
]);
export const networkDefenseEventsTable=pgTable("sf_network_defense_events",{
  id:uuid("id").defaultRandom().primaryKey(),
  ipAddress:varchar("ip_address",{length:45}).notNull(),
  action:varchar("action",{length:32}).notNull(),
  rule:varchar("rule",{length:32}).notNull(),
  blockedUntil:timestamp("blocked_until",{withTimezone:true}),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
  index("sf_network_defense_events_created_idx").on(t.createdAt),
  check("sf_network_defense_events_action_check",sql`${t.action} IN ('automatic_block','admin_release')`),
]);
