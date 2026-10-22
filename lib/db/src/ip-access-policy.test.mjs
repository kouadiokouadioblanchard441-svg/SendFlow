import assert from "node:assert/strict";
import test from "node:test";
import { normalizeIp, isBlockableIp, requestIp, trustedProxyHops } from "./ip-access-policy.ts";

test("IP canonicalization handles IPv4, IPv6 and mapped aliases", () => {
  assert.equal(normalizeIp("198.51.100.23"), "198.51.100.23");
  assert.equal(normalizeIp("2001:0DB8:0000:0:0:0:0:1"), "2001:db8::1");
  for (const ip of ["::ffff:198.51.100.23", "0:0:0:0:0:ffff:c633:6417"]) {
    assert.equal(normalizeIp(ip), "198.51.100.23");
  }
  for (const ip of ["example.com", "127.1", "010.1.1.1", "198.51.100.1:443", "[::1]", "::1%lo",
    "198.51.100.0/24", " 198.51.100.1", "198.51.100.1 ", "1.2.3.4,5.6.7.8", ""]) {
    assert.equal(normalizeIp(ip), null, ip);
  }
});

test("Infrastructure addresses cannot be used to lock out the reverse proxy", () => {
  for (const ip of ["127.0.0.1", "::1", "::", "10.0.0.1", "172.16.3.4", "192.168.1.1", "169.254.1.1",
    "::ffff:127.0.0.1", "fe80::1", "fc00::1", "ff02::1", "224.0.0.1", "255.255.255.255"]) {
    assert.equal(isBlockableIp(ip), false, ip);
  }
  assert.equal(isBlockableIp("198.51.100.23"), true);
  assert.equal(isBlockableIp("2001:db8::1"), true);
});

test("Client IP uses only the configured trusted proxy hops, not spoofed left headers", () => {
  const req = {socket:{remoteAddress:"::ffff:127.0.0.1"},headers:{"x-forwarded-for":"203.0.113.9, 198.51.100.23"}};
  assert.equal(requestIp(req, 0), "127.0.0.1");
  assert.equal(requestIp(req, 1), "198.51.100.23");
  assert.equal(requestIp(req, 2), "203.0.113.9");
  assert.equal(requestIp({...req,headers:{"x-real-ip":"203.0.113.9","cf-connecting-ip":"203.0.113.9"}},1),"127.0.0.1");
  assert.equal(requestIp({...req,headers:{"x-forwarded-for":"bad"}},1), null);
  assert.equal(requestIp({...req,headers:{"x-forwarded-for":Array(50).fill("1.1.1.1").join(",")}},1), null);
  assert.throws(()=>trustedProxyHops(undefined,"production"));
  for (const input of ["true","-1","17","1.5"]) assert.throws(()=>trustedProxyHops(input));
});
