import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import test from "node:test";
import {
  isFreshDiditTimestamp, isFreshSignedDiditTimestamp, isValidDiditSignature,
} from "./didit.ts";

test("a genuine old signature cannot be revived with a fresh unsigned timestamp header", () => {
  const previous = process.env.DIDIT_WEBHOOK_SECRET;
  process.env.DIDIT_WEBHOOK_SECRET = randomBytes(32).toString("hex");
  try {
    const now = 1_700_000_000_000, seconds = now / 1000;
    const payload = { status: "Approved", timestamp: seconds - 601 };
    const signature = createHmac("sha256", process.env.DIDIT_WEBHOOK_SECRET)
      .update(JSON.stringify(payload)).digest("hex");
    assert.equal(isValidDiditSignature(payload, signature), true);
    assert.equal(isFreshDiditTimestamp(String(seconds), now), true);
    assert.equal(isFreshSignedDiditTimestamp(payload, String(seconds), now), false);
    assert.equal(isFreshSignedDiditTimestamp(payload, String(payload.timestamp), now), false);
  } finally {
    if (previous === undefined) delete process.env.DIDIT_WEBHOOK_SECRET;
    else process.env.DIDIT_WEBHOOK_SECRET = previous;
  }
});
test("signed dispatch times match the header and expire within five minutes", () => {
  const now = 1_700_000_000_000, seconds = now / 1000;
  for (const delta of [-300, 0, 300]) {
    const timestamp = seconds + delta;
    assert.equal(isFreshSignedDiditTimestamp({ timestamp }, String(timestamp), now), true);
  }
  for (const delta of [-301, 301]) {
    const timestamp = seconds + delta;
    assert.equal(isFreshSignedDiditTimestamp({ timestamp }, String(timestamp), now), false);
  }
  for (const payload of [undefined, null, [], {}, { timestamp: String(seconds) }, { timestamp: seconds + 1 }]) {
    assert.equal(isFreshSignedDiditTimestamp(payload, String(seconds), now), false);
  }
  assert.equal(isFreshSignedDiditTimestamp({ get timestamp() { throw new Error("Not read"); } },
    String(seconds), now), false);
});
test("malformed non-hex or multibyte signatures are rejected without throwing", () => {
  const previous = process.env.DIDIT_WEBHOOK_SECRET;
  process.env.DIDIT_WEBHOOK_SECRET = randomBytes(32).toString("hex");
  try {
    for (const signature of ["é".repeat(64), "g".repeat(64), "0".repeat(63), "0".repeat(65), ""]) {
      assert.equal(isValidDiditSignature({ timestamp: 1_700_000_000 }, signature), false);
    }
  } finally {
    if (previous === undefined) delete process.env.DIDIT_WEBHOOK_SECRET;
    else process.env.DIDIT_WEBHOOK_SECRET = previous;
  }
});
