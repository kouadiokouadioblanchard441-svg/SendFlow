import { Router, type Request, type Response } from "express";
import {
  GetAdminNetworkDefenseResponse, CreateAdminNetworkExceptionBody, CreateAdminNetworkExceptionResponse,
  RevokeAdminNetworkExceptionBody, RevokeAdminNetworkExceptionParams, RevokeAdminNetworkExceptionResponse,
  ReleaseAdminAutomaticBlockBody, ReleaseAdminAutomaticBlockParams, ReleaseAdminAutomaticBlockResponse,
} from "@workspace/api-zod";
import { normalizeIp } from "@workspace/db/ip-access-policy";
import { respondAdminIdentityError, type AdminPermission } from "./admin";
import { mutationAllowed } from "./admin-ip-blocklist";
import { createNetworkException, readNetworkDefense, releaseAutomaticBlock, revokeNetworkException } from "../services/network-defense";
import { IpBlockError } from "../services/ip-blocklist";
import { recordAdminAudit } from "../lib/admin-audit";

type Authorize=(req:Request,res:Response,permission?:AdminPermission)=>string|null;
function fail(req:Request,res:Response,error:unknown) {
  if(error instanceof IpBlockError){res.status(error.status).json({error:error.message});return;}
  req.log?.error({err:error},"Network defense administrative action failed");
  res.status(503).json({error:"La protection réseau est momentanément indisponible."});
}
export function createAdminNetworkDefenseRouter(authorize:Authorize=respondAdminIdentityError) {
  const router=Router();
  router.use((_req,res,next)=>{res.setHeader("Cache-Control","no-store, private");next();});
  router.get("/network-defense",async(req,res)=>{
    const actor=authorize(req,res,"read");if(!actor)return;
    try{
      const data=await readNetworkDefense();
      await recordAdminAudit({adminUserId:actor,action:"view_network_defense",resourceType:"network_defense",resourceId:"list"});
      res.json(GetAdminNetworkDefenseResponse.parse({...data,requesterIp:normalizeIp(req.ip)}));
    }catch(error){fail(req,res,error);}
  });
  router.post("/network-defense/exceptions",async(req,res)=>{
    const actor=authorize(req,res,"mutate");if(!actor)return;
    try{
      if(!await mutationAllowed(req,res,actor))return;
      const parsed=CreateAdminNetworkExceptionBody.strict().safeParse(req.body);
      if(!parsed.success){res.status(400).json({error:"Adresse ou motif invalide."});return;}
      res.status(201).json(CreateAdminNetworkExceptionResponse.parse(await createNetworkException(actor,parsed.data.ipAddress,parsed.data.reason)));
    }catch(error){fail(req,res,error);}
  });
  router.post("/network-defense/exceptions/:id/revoke",async(req,res)=>{
    const actor=authorize(req,res,"mutate");if(!actor)return;
    try{
      if(!await mutationAllowed(req,res,actor))return;
      const params=RevokeAdminNetworkExceptionParams.safeParse(req.params), body=RevokeAdminNetworkExceptionBody.strict().safeParse(req.body);
      if(!params.success||!body.success){res.status(400).json({error:"Données invalides."});return;}
      res.json(RevokeAdminNetworkExceptionResponse.parse(await revokeNetworkException(actor,params.data.id,body.data.expectedVersion,body.data.reason)));
    }catch(error){fail(req,res,error);}
  });
  router.post("/network-defense/blocks/:id/release",async(req,res)=>{
    const actor=authorize(req,res,"mutate");if(!actor)return;
    try{
      if(!await mutationAllowed(req,res,actor))return;
      const params=ReleaseAdminAutomaticBlockParams.safeParse(req.params),body=ReleaseAdminAutomaticBlockBody.strict().safeParse(req.body);
      if(!params.success||!body.success){res.status(400).json({error:"Données invalides."});return;}
      res.json(ReleaseAdminAutomaticBlockResponse.parse(await releaseAutomaticBlock(actor,params.data.id,body.data.expectedVersion,body.data.reason)));
    }catch(error){fail(req,res,error);}
  });
  return router;
}
export default createAdminNetworkDefenseRouter();
