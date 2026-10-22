import { Router, type Request, type Response } from "express";
import {
  CreateAdminIpBlockBody, CreateAdminIpBlockResponse,
  ListAdminIpBlocksQueryParams, ListAdminIpBlocksResponse,
  RevokeAdminIpBlockBody, RevokeAdminIpBlockParams, RevokeAdminIpBlockResponse,
} from "@workspace/api-zod";
import { db, sql } from "@workspace/db";
import { normalizeIp } from "@workspace/db/ip-access-policy";
import { respondAdminIdentityError, type AdminPermission } from "./admin";
import { fingerprint, isTrustedOrigin } from "../lib/request-security";
import { recordAdminAudit } from "../lib/admin-audit";
import { createIpBlock, IpBlockError, listIpBlocks, revokeIpBlock } from "../services/ip-blocklist";

type Authorize = (req: Request, res: Response, permission?: AdminPermission) => string | null;

export async function mutationAllowed(req: Request, res: Response, actor: string) {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine non autorisée." });
    return false;
  }
  const bucket = fingerprint(`admin-ip-blocklist:${actor}`);
  const result = await db.execute(sql`
    INSERT INTO public.sf_api_request_limits (bucket_hash, window_started_at, request_count)
    VALUES (${bucket}, statement_timestamp(), 1)
    ON CONFLICT (bucket_hash) DO UPDATE SET
      window_started_at = CASE WHEN sf_api_request_limits.window_started_at <= statement_timestamp() - interval '1 minute'
        THEN statement_timestamp() ELSE sf_api_request_limits.window_started_at END,
      request_count = CASE WHEN sf_api_request_limits.window_started_at <= statement_timestamp() - interval '1 minute'
        THEN 1 ELSE sf_api_request_limits.request_count + 1 END
    WHERE sf_api_request_limits.window_started_at <= statement_timestamp() - interval '1 minute'
       OR sf_api_request_limits.request_count < 30 RETURNING request_count
  `);
  if (result.rows.length) return true;
  res.setHeader("Retry-After", "60");
  res.status(429).json({ error: "Trop d’actions. Réessayez dans une minute." });
  return false;
}

function fail(req: Request, res: Response, error: unknown) {
  if (error instanceof IpBlockError) { res.status(error.status).json({ error: error.message }); return; }
  req.log?.error({ err: error }, "IP blocklist operation failed");
  res.status(503).json({ error: "La protection réseau est momentanément indisponible." });
}

// Dependency seam is used only by isolated tests. Production always uses the
// existing server authorization; no header, env flag or client role bypass.
export function createAdminIpBlocklistRouter(authorize: Authorize = respondAdminIdentityError) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store, private"); next(); });
  router.get("/ip-blocklist", async (req, res) => {
    const actor = authorize(req, res, "read");
    if (!actor) return;
    const parsed = ListAdminIpBlocksQueryParams.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: "Page invalide." }); return; }
    try {
      const result = await listIpBlocks(parsed.data.page ?? 1);
      await recordAdminAudit({ adminUserId: actor, action: "view_ip_blocklist", resourceType: "ip_block", resourceId: "list" });
      res.json(ListAdminIpBlocksResponse.parse({ ...result, requesterIp: normalizeIp(req.ip) }));
    } catch (error) { fail(req, res, error); }
  });
  router.post("/ip-blocklist", async (req, res) => {
    const actor = authorize(req, res, "mutate");
    if (!actor) return;
    try {
      if (!await mutationAllowed(req, res, actor)) return;
      const body = CreateAdminIpBlockBody.strict().safeParse(req.body);
      if (!body.success) { res.status(400).json({ error: "Adresse ou motif invalide." }); return; }
      const row = await createIpBlock(actor, body.data.ipAddress, body.data.reason, normalizeIp(req.ip));
      res.status(201).json(CreateAdminIpBlockResponse.parse(row));
    } catch (error) { fail(req, res, error); }
  });
  router.post("/ip-blocklist/:id/revoke", async (req, res) => {
    const actor = authorize(req, res, "mutate");
    if (!actor) return;
    try {
      if (!await mutationAllowed(req, res, actor)) return;
      const params = RevokeAdminIpBlockParams.safeParse(req.params);
      const body = RevokeAdminIpBlockBody.strict().safeParse(req.body);
      if (!params.success || !body.success) { res.status(400).json({ error: "Données de déblocage invalides." }); return; }
      const row = await revokeIpBlock(actor, params.data.id, body.data.expectedVersion, body.data.reason);
      res.json(RevokeAdminIpBlockResponse.parse(row));
    } catch (error) { fail(req, res, error); }
  });
  return router;
}
export default createAdminIpBlocklistRouter();
