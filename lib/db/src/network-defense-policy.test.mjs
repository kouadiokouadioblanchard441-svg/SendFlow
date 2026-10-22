import assert from "node:assert/strict";
import test from "node:test";
import {classifyNetworkRequest} from "./network-defense-policy.ts";

test("Reconnaissance recognizes sensitive paths and encoded traversal, without reading query/body",()=>{
  for(const path of ["/.env","/.env.production","/.git/config","/.svn/entries","/wp-login.php","/wp-admin/",
    "/phpmyadmin/index.php","/actuator/env","/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php",
    "/%2e%2e/etc/passwd","/%252e%252e/etc/passwd","/..\\windows\\win.ini"]) {
    assert.equal(classifyNetworkRequest(path),"probe",path);
  }
  for(const path of ["/","/api/auth/sign-in","/api/healthz","/DMgrgmt-1np5g23g12bGFtMwh/ip-blocklist",
    "/assets/logo.png","/api/webhooks/didit","/api/me/transactions","/unrecognized",
    "/search?q=/.env","/pricing?recipient=wp-admin","/@vite/client"]) {
    assert.equal(classifyNetworkRequest(path),"normal",path);
  }
});
