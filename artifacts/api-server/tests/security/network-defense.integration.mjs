import assert from "node:assert/strict";
import {test} from "node:test";
import http from "node:http";
import {createRequire} from "node:module";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
const path=process.env.SENDFLOW_ISOLATED_RUNTIME;
if(!path?.includes("/sendflow-isolated-finance-"))throw new Error("Disposable database required");
const r=createRequire(import.meta.url)(path),{pool}=r;
const actor="fixture-network-admin";
function request(server,url,ip,{method="GET",body,origin,extra={}}={}) {
  return new Promise((resolve,reject)=>{
    const req=http.request({host:"127.0.0.1",port:server.address().port,path:url,method,
      headers:{"x-forwarded-for":ip,...(body?{"content-type":"application/json"}:{}),...(origin?{origin}:{}),...extra}},res=>{
        let text="";res.on("data",c=>text+=c);res.on("end",()=>resolve({status:res.statusCode,text,headers:res.headers}));
      });
    req.on("error",reject);req.end(body?JSON.stringify(body):undefined);
  });
}
async function serve(app=r.app) {
  const server=http.createServer(app);server.listen(0,"127.0.0.1");
  await new Promise((a,b)=>{server.once("listening",a);server.once("error",b);});return server;
}
const close=s=>new Promise(a=>s.close(a));
async function state(ip) {return(await pool.query("SELECT * FROM sf_network_defense WHERE ip_address=$1",[ip])).rows[0];}

test("Legacy expired and future bans become permanent; explicitly released bans stay released",async()=>{
  for(const ip of ["198.51.100.240","198.51.100.241"]) {
    const row=await state(ip);assert.ok(row.blocked_at);assert.equal(row.version,2);
  }
  assert.equal((await state("198.51.100.242")).blocked_at,null);
  // An old exception must not silently release an old automatic ban either.
  await pool.query(`INSERT INTO sf_network_defense_allowlist(ip_address,reason,created_by)
    VALUES('198.51.100.240','Legacy exception fixture',$1)`,[actor]);
  const server=await serve();
  try{
    assert.equal((await request(server,"/api/healthz","198.51.100.240")).status,403);
    const old=(await r.readNetworkDefense()).blocks.find(x=>x.ipAddress==="198.51.100.240");
    assert.equal(old.trusted,true);assert.equal(old.active,true);
  }finally{await close(server);}
});

test("Scanner ban is permanent across workers and time passage until explicit versioned release",async()=>{
  const ip="198.51.100.201",a=await serve(),b=await serve();
  const root=await mkdtemp(join(tmpdir(),"sf-auto-site-"));
  await writeFile(join(root,"index.html"),"<html>Isolated page</html>");
  await writeFile(join(root,"app.js"),"/* isolated asset */");
  const site=r.createSiteServer(root);site.listen(0,"127.0.0.1");
  await new Promise((yes,no)=>{site.once("listening",yes);site.once("error",no);});
  try{
    for(let i=0;i<5;i++)assert.equal((await request(a,"/.env.production",ip)).status,403);
    let row=await state(ip);assert.equal(row.ban_count,1);assert.equal(row.rule,"reconnaissance");
    assert.ok(row.blocked_at);assert.equal(row.blocked_until,null);
    const blocked=await request(b,"/api/healthz",ip);
    assert.equal(blocked.status,403);assert.equal(blocked.headers["retry-after"],undefined);
    assert.equal((await request(b,"/api/healthz",`8.8.8.8, ${ip}`)).status,403);
    assert.equal((await request(b,"/api/healthz",`::ffff:${ip}`)).status,403);
    assert.equal((await request(b,"/api/healthz","198.51.100.202")).status,200);
    assert.equal((await request(site,"/",ip)).status,403);
    assert.equal((await request(site,"/app.js",ip)).status,403);
    assert.equal((await request(site,"/","198.51.100.202")).status,200);
    await pool.query("UPDATE sf_network_defense SET blocked_at='2000-01-01',blocked_until='2000-01-02' WHERE ip_address=$1",[ip]);
    assert.equal((await request(b,"/api/healthz",ip)).status,403);
    const restarted=await serve();
    try{assert.equal((await request(restarted,"/api/healthz",ip)).status,403);}finally{await close(restarted);}
    await assert.rejects(()=>r.createNetworkException(actor,ip,"Cannot bypass an existing ban"),e=>e.status===409);
    const list=await r.readNetworkDefense();
    assert.equal(list.blocks.find(x=>x.id===row.id).active,true);
    await assert.rejects(()=>r.releaseAutomaticBlock("x".repeat(256),row.id,row.version,"Audit must roll back release"));
    assert.equal((await request(b,"/api/healthz",ip)).status,403);
    await r.releaseAutomaticBlock(actor,row.id,row.version,"Explicit authorized release");
    assert.equal((await request(b,"/api/healthz",ip)).status,200);
    for(let i=0;i<5;i++)await request(a,"/.git/config",ip);
    row=await state(ip);assert.equal(row.ban_count,2);
    assert.ok(row.blocked_at);assert.equal(row.blocked_until,null);
    await r.releaseAutomaticBlock(actor,row.id,row.version,"Isolated review complete");
    assert.equal((await request(b,"/api/healthz",ip)).status,200);
    await assert.rejects(()=>r.releaseAutomaticBlock(actor,row.id,row.version,"Stale replay"),e=>e.status===409);
  }finally{await close(a);await close(b);await close(site);await rm(root,{recursive:true,force:true});}
});

test("Cloud requests and isolated mistakes are not bans; request flood creates one permanent ban",async()=>{
  const ip="198.51.100.203",server=await serve();
  try{
    assert.equal((await request(server,"/not-a-real-page",ip,{extra:{"user-agent":"cloud scanner"}})).status,404);
    assert.equal((await state(ip)).ban_count,0);
    await pool.query("UPDATE sf_network_defense SET request_count=1200,request_window_at=now() WHERE ip_address=$1",[ip]);
    const attempts=await Promise.all(Array.from({length:12},()=>request(server,"/not-a-real-page",ip)));
    assert.ok(attempts.every(x=>[403,429].includes(x.status)));
    const row=await state(ip);assert.equal(row.ban_count,1);assert.equal(row.rule,"request_flood");
    assert.ok(row.blocked_at);assert.equal(row.blocked_until,null);
    const events=await pool.query("SELECT count(*)::int AS n FROM sf_network_defense_events WHERE ip_address=$1 AND action='automatic_block'",[ip]);
    assert.equal(events.rows[0].n,1);
    await r.releaseAutomaticBlock(actor,row.id,row.version,"Fixture cleanup");
  }finally{await close(server);}
});

test("Trusted IP exceptions never override manual blocks or administrator authentication",async()=>{
  const ip="198.51.100.204",server=await serve();
  try{
    const allow=await r.createNetworkException(actor,ip,"Authorized integration test");
    for(let i=0;i<7;i++)assert.equal((await request(server,"/.env",ip)).status,404);
    assert.equal(await state(ip),undefined);
    assert.equal((await request(server,"/api/DMgrgmt-1np5g23g12bGFtMwh/network-defense",ip)).status,503);
    const manual=await r.createIpBlock(actor,ip,"Manual block overrides trust","203.0.113.1");
    assert.equal((await request(server,"/api/healthz",ip)).status,403);
    await r.revokeIpBlock(actor,manual.id,manual.version,"Fixture cleanup");
    await r.revokeNetworkException(actor,allow.id,allow.version,"Remove test exception");
    await assert.rejects(()=>r.revokeNetworkException(actor,allow.id,allow.version,"Replay revoke"),e=>e.status===409);
    for(let i=0;i<5;i++)await request(server,"/.env",ip);
    const row=await state(ip);assert.equal(row.ban_count,1);
    await assert.rejects(()=>r.createNetworkException(actor,ip,"Cannot release by adding trust"),e=>e.status===409);
    await r.releaseAutomaticBlock(actor,row.id,row.version,"Explicitly reviewed release");
    const allowAgain=await r.createNetworkException(actor,ip,"Trusted after explicit release");
    assert.equal((await request(server,"/api/healthz",ip)).status,200);
    await r.revokeNetworkException(actor,allowAgain.id,allowAgain.version,"Fixture cleanup");
    assert.equal((await request(server,"/api/healthz",ip)).status,200);
  }finally{await close(server);}
});

test("Exception audit failure rolls back, and automatic event history cannot be rewritten",async()=>{
  await assert.rejects(()=>r.createNetworkException("x".repeat(256),"198.51.100.205","Atomic exception fixture"));
  assert.equal((await pool.query("SELECT 1 FROM sf_network_defense_allowlist WHERE ip_address='198.51.100.205'")).rowCount,0);
  await assert.rejects(()=>pool.query("UPDATE sf_network_defense_events SET rule='forged'"),e=>e.code==="42501");
  await assert.rejects(()=>pool.query("DELETE FROM sf_network_defense_events"),e=>e.code==="42501");
});

test("Controller validates CSRF, role and version for allow/revoke/release; no raw request content returned",async()=>{
  const app=r.express();app.set("trust proxy",1);app.use(r.express.json());
  app.use(r.createAdminNetworkDefenseRouter(()=>"fixture-network-controller"));
  const server=await serve(app),ip="198.51.100.206",origin="https://sendflow-test.invalid";
  try{
    const body={ipAddress:ip,reason:"Isolated controller exception"};
    assert.equal((await request(server,"/network-defense/exceptions",ip,{method:"POST",body})).status,403);
    assert.equal((await request(server,"/network-defense/exceptions",ip,{method:"POST",body:{...body,isAdmin:true},origin})).status,400);
    const added=await request(server,"/network-defense/exceptions",ip,{method:"POST",body,origin});
    assert.equal(added.status,201);const allow=JSON.parse(added.text);
    const status=await request(server,"/network-defense",ip);assert.equal(status.status,200);
    assert.equal(JSON.parse(status.text).policy.probesPerTenMinutes,5);
    assert.equal(JSON.parse(status.text).policy.automaticBlocksPermanent,true);
    assert.ok(JSON.parse(status.text).exceptions.some(x=>x.id===allow.id));
    assert.equal((await request(server,`/network-defense/exceptions/${allow.id}/revoke`,ip,{method:"POST",origin,
      body:{expectedVersion:allow.version+1,reason:"Stale view"}})).status,409);
    assert.equal((await request(server,`/network-defense/exceptions/${allow.id}/revoke`,ip,{method:"POST",origin,
      body:{expectedVersion:allow.version,reason:"Fixture cleanup"}})).status,200);
  }finally{await close(server);}
});
