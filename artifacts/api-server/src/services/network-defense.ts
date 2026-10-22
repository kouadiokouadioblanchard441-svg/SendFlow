import { pool, type PoolClient } from "@workspace/db";
import { NETWORK_DEFENSE_POLICY } from "@workspace/db/network-defense";
import { isBlockableIp, normalizeIp } from "@workspace/db/ip-access-policy";
import { IpBlockError } from "./ip-blocklist";

type Row = Record<string, any>;
const block = (r: Row) => ({
  id:r.id,ipAddress:r.ip_address,blockedAt:r.blocked_at?.toISOString() ?? null,
  banCount:r.ban_count,rule:r.rule,version:r.version,
  active:Boolean(r.active),trusted:Boolean(r.trusted),
});
const exception = (r: Row) => ({
  id:r.id,ipAddress:r.ip_address,reason:r.reason,createdBy:r.created_by,
  createdAt:r.created_at.toISOString(),revokedAt:r.revoked_at?.toISOString() ?? null,version:r.version,
});
function reasonAndActor(actor: string, reason: string) {
  if (!actor) throw new IpBlockError("Autorisation administrateur requise.",403);
  if (reason.trim().length<3 || reason.trim().length>500 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(reason)) {
    throw new IpBlockError("Un motif de 3 à 500 caractères est obligatoire.",400);
  }
  return reason.trim();
}
async function auditedTransaction<T>(actor:string, reason:string, action:string, change:(client:PoolClient)=>Promise<{row:Row;result:T}>) {
  const clean=reasonAndActor(actor,reason);
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='1s'; SET LOCAL statement_timeout='3s'");
    const changed=await change(client);
    await client.query(`INSERT INTO public.sf_admin_audit_logs(admin_user_id,action,resource_type,resource_id,reason)
      VALUES($1,$2,'network_defense',$3,$4)`,[actor,action,changed.row.id,clean]);
    await client.query("COMMIT");
    return changed.result;
  } catch(error) {await client.query("ROLLBACK").catch(()=>{});throw error;}
  finally{client.release();}
}
export async function readNetworkDefense() {
  const [blocks,exceptions]=await Promise.all([
    pool.query(`SELECT d.*,
      EXISTS(SELECT 1 FROM public.sf_network_defense_allowlist a WHERE a.ip_address=d.ip_address AND a.revoked_at IS NULL) AS trusted,
      (d.blocked_at IS NOT NULL OR d.blocked_until IS NOT NULL) AS active
      FROM public.sf_network_defense d WHERE ban_count>0 ORDER BY updated_at DESC,id DESC LIMIT 100`),
    pool.query("SELECT * FROM public.sf_network_defense_allowlist ORDER BY created_at DESC,id DESC LIMIT 500"),
  ]);
  return {blocks:blocks.rows.map(block),exceptions:exceptions.rows.map(exception),policy:NETWORK_DEFENSE_POLICY};
}
export async function createNetworkException(actor:string,requestedIp:string,reason:string) {
  const ip=normalizeIp(requestedIp);
  if(!ip || !isBlockableIp(ip))throw new IpBlockError("Adresse IP publique invalide.",400);
  return auditedTransaction(actor,reason,"allow_network_ip",async client=>{
    // All manual and exception changes for one IP take the same advisory lock.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[ip]);
    const manual=await client.query("SELECT 1 FROM public.sf_ip_blocklist WHERE ip_address=$1 AND revoked_at IS NULL",[ip]);
    if(manual.rowCount)throw new IpBlockError("Cette IP est bloquée manuellement. Examinez ce blocage d’abord.",409);
    const automatic=await client.query(`SELECT 1 FROM public.sf_network_defense WHERE ip_address=$1
      AND (blocked_at IS NOT NULL OR blocked_until IS NOT NULL)`,[ip]);
    if(automatic.rowCount)throw new IpBlockError("Levez explicitement le blocage automatique avant d’ajouter une exception.",409);
    const rows=await client.query(`INSERT INTO public.sf_network_defense_allowlist(ip_address,reason,created_by)
      VALUES($1,$2,$3) ON CONFLICT(ip_address) DO UPDATE SET
      reason=EXCLUDED.reason,created_by=EXCLUDED.created_by,created_at=statement_timestamp(),
      revoked_at=NULL,revoked_by=NULL,version=sf_network_defense_allowlist.version+1
      WHERE sf_network_defense_allowlist.revoked_at IS NOT NULL RETURNING *`,[ip,reason.trim(),actor]);
    if(!rows.rowCount)throw new IpBlockError("Cette exception existe déjà.",409);
    return {row:rows.rows[0],result:exception(rows.rows[0])};
  });
}
export async function revokeNetworkException(actor:string,id:string,version:number,reason:string) {
  return auditedTransaction(actor,reason,"revoke_network_allow",async client=>{
    const rows=await client.query(`UPDATE public.sf_network_defense_allowlist SET revoked_at=statement_timestamp(),
      revoked_by=$2,version=version+1 WHERE id=$1 AND version=$3 AND revoked_at IS NULL RETURNING *`,[id,actor,version]);
    if(!rows.rowCount)throw new IpBlockError("L’exception a changé. Actualisez la liste.",409);
    return {row:rows.rows[0],result:exception(rows.rows[0])};
  });
}
export async function releaseAutomaticBlock(actor:string,id:string,version:number,reason:string) {
  return auditedTransaction(actor,reason,"release_automatic_ip",async client=>{
    const rows=await client.query(`UPDATE public.sf_network_defense SET blocked_until=NULL,blocked_at=NULL,
      request_count=0,probe_count=0,request_window_at=statement_timestamp(),probe_window_at=statement_timestamp(),
      version=version+1,updated_at=statement_timestamp()
      WHERE id=$1 AND version=$2 AND (blocked_at IS NOT NULL OR blocked_until IS NOT NULL) RETURNING *`,[id,version]);
    if(!rows.rowCount)throw new IpBlockError("Le blocage a changé ou a déjà été levé.",409);
    await client.query(`INSERT INTO public.sf_network_defense_events(ip_address,action,rule)
      VALUES($1,'admin_release',$2)`,[rows.rows[0].ip_address,rows.rows[0].rule??"review"]);
    return {row:rows.rows[0],result:block(rows.rows[0])};
  });
}
