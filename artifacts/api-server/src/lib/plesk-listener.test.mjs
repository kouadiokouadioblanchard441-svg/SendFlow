import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import test from "node:test";
import { listenOnPleskPort, PLESK_LISTEN_HOST, requirePleskPort } from "./plesk-listener.ts";

test("requires the exact Plesk-provided port and rejects unsafe values", () => {
  assert.equal(requirePleskPort(" 8080 "), 8080);
  assert.equal(requirePleskPort("65535"), 65535);
  for (const value of [undefined, "", "   ", "0", "65536", "-1", "1.5", "8080;exit"]) {
    assert.throws(
      () => requirePleskPort(value),
      { message: /^(PORT environment variable is required|PORT must be an integer)/ },
    );
  }
});

test("binds the supplied port on all interfaces and keeps the HTTP process listening", async (t) => {
  const app = express();
  app.get("/ready", (_request, response) => response.status(200).json({ ready: true }));

  const server = listenOnPleskPort(app, 0);
  t.after(async () => {
    if (server.listening) await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  assert.equal(address.address, PLESK_LISTEN_HOST);

  const response = await fetch(`http://127.0.0.1:${address.port}/ready`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ready: true });
  assert.equal(server.listening, true);
});
