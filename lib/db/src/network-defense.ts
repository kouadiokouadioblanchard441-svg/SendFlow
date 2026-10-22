// Server only. The database serializes counters across API and website workers.
import type { IncomingMessage } from "node:http";
import { pool } from "./client.ts";
import { isBlockableIp } from "./ip-access-policy.ts";
import { classifyNetworkRequest, NETWORK_DEFENSE_POLICY as policy } from "./network-defense-policy.ts";

export { NETWORK_DEFENSE_POLICY, classifyNetworkRequest } from "./network-defense-policy.ts";
export type DefenseDecision = { allowed: boolean; status: number };

export async function evaluateNetworkDefense(req: IncomingMessage, ip: string): Promise<DefenseDecision> {
  const kind = classifyNetworkRequest(req.url);
  // Manual block is checked separately FIRST. Exceptions never bypass it or auth.
  const previous = await pool.query({
    text: `SELECT EXISTS(SELECT 1 FROM public.sf_network_defense_allowlist WHERE ip_address=$1 AND revoked_at IS NULL) AS trusted,
      EXISTS(SELECT 1 FROM public.sf_network_defense
        WHERE ip_address=$1 AND (blocked_at IS NOT NULL OR blocked_until IS NOT NULL)) AS blocked`,
    values: [ip],
  });
  if (previous.rows[0].blocked) return { allowed: false, status: 403 };
  if (previous.rows[0].trusted) return { allowed: true, status: 200 };
  // Infrastructure/health are still subject to manual/active automatic blocks,
  // but do not accumulate abuse counters or create bans against the proxy.
  if (!isBlockableIp(ip) || req.url?.split("?")[0] === "/api/healthz") {
    return { allowed: kind !== "probe", status: kind === "probe" ? 403 : 200 };
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout='2s'; SET LOCAL lock_timeout='1s'");
    // Serialize detection with exception creation; a committed ban cannot be
    // bypassed by adding an exception. Only the audited release operation clears it.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[ip]);
    const locked=await client.query(`SELECT
      EXISTS(SELECT 1 FROM public.sf_network_defense WHERE ip_address=$1
        AND (blocked_at IS NOT NULL OR blocked_until IS NOT NULL)) AS blocked,
      EXISTS(SELECT 1 FROM public.sf_network_defense_allowlist WHERE ip_address=$1 AND revoked_at IS NULL) AS trusted`,[ip]);
    if(locked.rows[0].blocked || locked.rows[0].trusted) {
      await client.query("COMMIT");
      return {allowed:!locked.rows[0].blocked,status:locked.rows[0].blocked?403:200};
    }
    const counted = await client.query(`INSERT INTO public.sf_network_defense
      (ip_address,request_count,probe_count) VALUES($1,1,$2)
      ON CONFLICT(ip_address) DO UPDATE SET
        request_count = CASE WHEN sf_network_defense.request_window_at <= statement_timestamp()-interval '1 minute'
          THEN 1 ELSE LEAST(sf_network_defense.request_count+1,1000000) END,
        request_window_at = CASE WHEN sf_network_defense.request_window_at <= statement_timestamp()-interval '1 minute'
          THEN statement_timestamp() ELSE sf_network_defense.request_window_at END,
        probe_count = CASE WHEN sf_network_defense.probe_window_at <= statement_timestamp()-interval '10 minutes'
          THEN $2 ELSE LEAST(sf_network_defense.probe_count+$2,1000000) END,
        probe_window_at = CASE WHEN sf_network_defense.probe_window_at <= statement_timestamp()-interval '10 minutes'
          THEN statement_timestamp() ELSE sf_network_defense.probe_window_at END,
        updated_at = statement_timestamp()
      RETURNING id,request_count,probe_count,ban_count`,
    [ip, kind === "probe" ? 1 : 0]);
    const row = counted.rows[0];
    let blocked = false;
    // Row lock is held until commit: parallel requests cannot double-create bans.
    if (row.probe_count >= policy.probesPerTenMinutes || row.request_count > policy.requestsPerMinute) {
      const rule = row.probe_count >= policy.probesPerTenMinutes ? "reconnaissance" : "request_flood";
      await client.query(`UPDATE public.sf_network_defense SET
        blocked_at=statement_timestamp(),blocked_until=NULL,ban_count=ban_count+1,
        version=version+1,rule=$2,request_count=0,probe_count=0,request_window_at=statement_timestamp(),
        probe_window_at=statement_timestamp()
        WHERE id=$1`,[row.id,rule]);
      await client.query(`INSERT INTO public.sf_network_defense_events(ip_address,action,rule)
        VALUES($1,'automatic_block',$2)`,[ip,rule]);
      blocked = true;
    }
    await client.query("COMMIT");
    return blocked
      ? { allowed: false, status: kind === "probe" ? 403 : 429 }
      : { allowed: kind !== "probe", status: kind === "probe" ? 403 : 200 };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}
