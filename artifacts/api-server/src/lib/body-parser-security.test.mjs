import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { after, before, test } from "node:test";
import { gzipSync } from "node:zlib";
import { httpErrorHandler } from "./http-error-handler.ts";

const app = express();
app.use(express.json({ limit: "100kb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "100kb", parameterLimit: 100 }));
app.post("/echo", (req, res) => res.json(req.body));
app.use(httpErrorHandler);

let server;
let origin;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("accepts a valid JSON request", async () => {
  const response = await fetch(`${origin}/echo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "deposit", amountMinor: 1250 }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { kind: "deposit", amountMinor: 1250 });
});

test("accepts a valid compressed JSON request", async () => {
  const response = await fetch(`${origin}/echo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
    },
    body: gzipSync(Buffer.from(JSON.stringify({ status: "pending" }))),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "pending" });
});

test("accepts a valid URL-encoded request", async () => {
  const response = await fetch(`${origin}/echo`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ phone: "0700000000", purpose: "signup" }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { phone: "0700000000", purpose: "signup" });
});

test("rejects JSON bodies larger than 100 KB", async () => {
  const body = JSON.stringify({ value: "x".repeat(100 * 1024) });
  const response = await fetch(`${origin}/echo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  assert.equal(response.status, 413);
});

test("rejects URL-encoded bodies larger than 100 KB", async () => {
  const body = `value=${"x".repeat(100 * 1024)}`;
  const response = await fetch(`${origin}/echo`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  assert.equal(response.status, 413);
});

test("rejects malformed compressed input and keeps serving requests", async () => {
  const malformed = await fetch(`${origin}/echo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
    },
    body: Buffer.from("not a gzip stream"),
  });
  assert.equal(malformed.status, 400);

  const followUp = await fetch(`${origin}/echo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ check: "process-alive" }),
  });
  assert.equal(followUp.status, 200);
  assert.deepEqual(await followUp.json(), { check: "process-alive" });
});
