// Imported by the main isolated suite: uses its disposable DB and clean env only.
import assert from "node:assert/strict";
import { test } from "node:test";
import http from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const runtimePath = process.env.SENDFLOW_ISOLATED_RUNTIME;
if (!runtimePath?.includes("/sendflow-isolated-finance-")) throw new Error("Isolated runner required");
const runtime = createRequire(import.meta.url)(runtimePath);
const { pool, createIpBlock, revokeIpBlock, isIpBlocked } = runtime;

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await new Promise((yes, no) => {server.once("listening", yes);server.once("error", no);});
}
function request(server, path, {method="GET", ip="198.51.100.90", body, origin, extra={}}={}) {
  const data = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((yes,no) => {
    const req=http.request({host:"127.0.0.1",port:server.address().port,path,method,headers:{
      "x-forwarded-for":ip,...(origin ? {Origin:origin} : {}),
      ...(data ? {"content-type":"application/json"} : {}), ...extra,
    }},res=>{
      let text="";res.on("data",c=>text+=c);res.on("end",()=>yes({status:res.statusCode,text,headers:res.headers}));
    });req.on("error",no);req.end(data);
  });
}
const close = (server) => new Promise(resolve=>server.close(resolve));

test("Blocklist SQL persistence, duplicate race, immutable audit and versioned revocation",async()=>{
  const ip="198.51.100.41", actor="fixture-security-admin";
  const results=await Promise.allSettled(Array.from({length:8},()=>createIpBlock(actor,ip,"Isolated abuse report","203.0.113.1")));
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  for(const r of results.filter(r=>r.status==="rejected")) assert.equal(r.reason.status,409);
  const row=results.find(r=>r.status==="fulfilled").value;
  assert.equal(await isIpBlocked(ip),true);
  assert.equal(await isIpBlocked("::ffff:198.51.100.41"),true);
  const audit=await pool.query("SELECT count(*)::int AS n FROM sf_admin_audit_logs WHERE resource_id=$1 AND action='block_ip'",[row.id]);
  assert.equal(audit.rows[0].n,1);
  await assert.rejects(()=>createIpBlock(actor,"::ffff:203.0.113.1","Self block","203.0.113.1"),e=>e.status===409);
  await assert.rejects(()=>createIpBlock(actor,"10.1.2.3","Proxy block","203.0.113.1"),e=>e.status===400);
  await assert.rejects(()=>createIpBlock(actor,"2001:db8::3","x","203.0.113.1"),e=>e.status===400);
  await assert.rejects(()=>createIpBlock("","2001:db8::3","Missing actor","203.0.113.1"),e=>e.status===403);
  await assert.rejects(()=>revokeIpBlock(actor,row.id,row.version+1,"Wrong version"),e=>e.status===409);
  const revocations=await Promise.allSettled(Array.from({length:5},()=>revokeIpBlock(actor,row.id,row.version,"Isolated review complete")));
  assert.equal(revocations.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(await isIpBlocked(ip),false);
  const reblocked=await createIpBlock(actor,ip,"Repeat abuse after review","203.0.113.1");
  assert.equal(reblocked.id,row.id); assert.equal(reblocked.version,3);
  await assert.rejects(()=>revokeIpBlock(actor,row.id,1,"Stale browser request"),e=>e.status===409);
  await revokeIpBlock(actor,row.id,3,"Fixture cleanup");
});

test("A failed audit insertion rolls the IP block back atomically",async()=>{
  await assert.rejects(()=>createIpBlock("x".repeat(256),"198.51.100.42","Audit failure test","203.0.113.1"));
  assert.equal(await isIpBlocked("198.51.100.42"),false);
});

test("Blocked IP is refused before every API method, auth, preflight and webhook",async()=>{
  const server=http.createServer(runtime.app);await listen(server);
  const row=await createIpBlock("fixture-security-admin","198.51.100.43","Isolated API block","203.0.113.1");
  try {
    for(const [path,method] of [
      ["/api/healthz","GET"],["/api/me","GET"],["/api/auth/sign-in","POST"],
      ["/api/auth/sign-in","OPTIONS"],["/api/webhooks/didit","POST"],["/api/anything","DELETE"],
    ]) {
      const result=await request(server,path,{method,ip:"198.51.100.43",body:method==="POST"?{}:undefined});
      assert.equal(result.status,403,`${method} ${path}`); assert.match(result.headers["cache-control"],/no-store/);
    }
    assert.equal((await request(server,"/api/healthz",{ip:"8.8.8.8, 198.51.100.43"})).status,403);
    assert.equal((await request(server,"/api/healthz",{ip:"::ffff:198.51.100.43"})).status,403);
    assert.equal((await request(server,"/api/healthz",{ip:"198.51.100.44"})).status,200);
    await revokeIpBlock("fixture-security-admin",row.id,row.version,"Fixture cleanup");
    assert.equal((await request(server,"/api/healthz",{ip:"198.51.100.43"})).status,200);
  } finally {await close(server);}
});

test("Production admin routes cannot be opened with client-supplied role headers",async()=>{
  const server=http.createServer(runtime.app);await listen(server);
  try {
    for(const [path,method] of [
      ["/api/DMgrgmt-1np5g23g12bGFtMwh/ip-blocklist","GET"],
      ["/api/DMgrgmt-1np5g23g12bGFtMwh/ip-blocklist","POST"],
      ["/api/DMgrgmt-1np5g23g12bGFtMwh/ip-blocklist/11111111-1111-4111-8111-111111111111/revoke","POST"],
    ]) {
      const r=await request(server,path,{method,origin:"https://sendflow-test.invalid",
        body:method==="POST"?{ipAddress:"198.51.100.48",reason:"Fake admin"}:undefined,
        extra:{"x-admin-id":"fixture-security-admin","x-role":"admin"}});
      assert.equal(r.status,401);
    }
    assert.equal(await isIpBlocked("198.51.100.48"),false);
  }finally{await close(server);}
});

test("Authorized isolated controller uses strict inputs, CSRF, real list and rate limit",async()=>{
  const app=runtime.express();app.set("trust proxy",1);app.use(runtime.express.json());
  app.use(runtime.createAdminIpBlocklistRouter(()=> "fixture-controller-admin"));
  const server=http.createServer(app);await listen(server);
  const origin="https://sendflow-test.invalid";
  try {
    const data={ipAddress:"2001:0DB8:0:0::51",reason:"Isolated controller test"};
    assert.equal((await request(server,"/ip-blocklist",{method:"POST",body:data})).status,403);
    assert.equal((await request(server,"/ip-blocklist",{method:"POST",body:data,origin:"https://evil.invalid"})).status,403);
    assert.equal((await request(server,"/ip-blocklist",{method:"POST",body:{...data,blockedBy:"spoof"},origin})).status,400);
    const created=await request(server,"/ip-blocklist",{method:"POST",body:data,origin});
    assert.equal(created.status,201);const row=JSON.parse(created.text);
    assert.equal(row.ipAddress,"2001:db8::51"); assert.equal(row.blockedBy,"fixture-controller-admin");
    const list=await request(server,"/ip-blocklist?page=1");
    assert.equal(list.status,200); assert.ok(JSON.parse(list.text).items.some(i=>i.id===row.id));
    assert.equal(JSON.parse(list.text).requesterIp,"198.51.100.90");
    assert.equal((await request(server,"/ip-blocklist?page=0")).status,400);
    const revoked=await request(server,`/ip-blocklist/${row.id}/revoke`,{method:"POST",origin,
      body:{expectedVersion:row.version,reason:"Controller fixture cleanup"}});
    assert.equal(revoked.status,200);
    assert.equal((await request(server,`/ip-blocklist/${row.id}/revoke`,{method:"POST",origin,
      body:{expectedVersion:row.version,reason:"Replay revocation"}})).status,409);
    let limited;
    for(let i=0;i<31;i++) limited=await request(server,"/ip-blocklist",{method:"POST",origin,body:{}});
    assert.equal(limited.status,429);
  }finally{await close(server);}
});

test("Site HTML, SPA routes, assets and HEAD are blocked; DB failure fails closed",async()=>{
  const root=await mkdtemp(join(tmpdir(),"sf-ip-site-"));
  await writeFile(join(root,"index.html"),"<html>Isolated site</html>");
  await writeFile(join(root,"app.js"),"/* isolated asset */");
  const server=runtime.createSiteServer(root);await listen(server);
  const row=await createIpBlock("fixture-security-admin","198.51.100.55","Isolated site block","203.0.113.1");
  try {
    for(const path of ["/","/customer/page","/app.js"]) {
      assert.equal((await request(server,path,{ip:"198.51.100.55"})).status,403);
      assert.equal((await request(server,path,{ip:"198.51.100.56"})).status,200);
    }
    assert.equal((await request(server,"/app.js",{method:"HEAD",ip:"198.51.100.55"})).status,403);
    assert.equal((await request(server,"/.env")).status,403);
    assert.equal((await request(server,"/app.js.map")).status,404);
    await revokeIpBlock("fixture-security-admin",row.id,row.version,"Fixture cleanup");
    assert.equal((await request(server,"/",{ip:"198.51.100.55"})).status,200);
  }finally{await close(server);await rm(root,{recursive:true,force:true});}
  const broken=runtime.createSiteServer("/unused",(req,res)=>runtime.enforceIpAccess(req,res,async()=>{throw new Error("fixture DB outage")}));
  await listen(broken);
  try{ assert.equal((await request(broken,"/")).status,503); }finally{await close(broken);}
});
