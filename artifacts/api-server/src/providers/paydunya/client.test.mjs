import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PaydunyaClient, PaydunyaError } from "./client.ts";

const masterKey = "synthetic-master-key-for-tests";
const live = {
  NODE_ENV: "production",
  PAYDUNYA_LIVE_ENABLED: "true",
  PAYDUNYA_EXECUTION_HOST: "plesk",
  SENDFLOW_DATABASE_TARGET: "production",
  PAYDUNYA_MASTER_KEY: masterKey,
  PAYDUNYA_PRIVATE_KEY: "synthetic-private-key",
  PAYDUNYA_TOKEN: "synthetic-token",
};
const reference = "0123456789ABCDEF0123456789ABCD";
const phoneNumber = "22501020304";
const statusHash = createHash("sha512").update(masterKey).digest("hex");

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("live PayDunya is fail-closed unless the approved production host and keys exist", async () => {
  const missingFlags = new PaydunyaClient({ ...live, PAYDUNYA_LIVE_ENABLED: "false" }, async () => {
    throw new Error("transport must not be called");
  });
  await assert.rejects(
    missingFlags.createInvoice({
      amountMinor: 1000, operationReference: reference, channel: "orange-money-ci",
      phoneNumber, customerName: "Test User",
    }),
    (error) => error instanceof PaydunyaError && error.code === "LIVE_DISABLED",
  );
  const missingKeys = new PaydunyaClient({ ...live, PAYDUNYA_PRIVATE_KEY: undefined }, async () => {
    throw new Error("transport must not be called");
  });
  await assert.rejects(
    missingKeys.createInvoice({
      amountMinor: 1000, operationReference: reference, channel: "orange-money-ci",
      phoneNumber, customerName: "Test User",
    }),
    (error) => error instanceof PaydunyaError && error.code === "CONFIGURATION_REQUIRED",
  );
});

test("invoice creation sends the selected channel and returns only the approved provider URL", async () => {
  let seen;
  const client = new PaydunyaClient(live, async (url, init) => {
    seen = { url, init, body: JSON.parse(init.body) };
    return jsonResponse({
      response_code: "00",
      response_text: "https://app.paydunya.com/checkout/invoice/invoice_123456",
      token: "invoice_123456",
    });
  });
  const invoice = await client.createInvoice({
    amountMinor: 1200,
    operationReference: reference,
    channel: "orange-money-ci",
    phoneNumber,
    customerName: "Test User",
    returnUrl: "https://merchant.example/return",
  });
  assert.equal(seen.url, "https://app.paydunya.com/api/v1/checkout-invoice/create");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers["PAYDUNYA-MASTER-KEY"], masterKey);
  assert.deepEqual(seen.body.invoice.channels, ["orange-money-ci"]);
  assert.equal(seen.body.invoice.total_amount, 1200);
  assert.equal(seen.body.custom_data.sendflow_reference, reference);
  assert.equal(seen.body.actions.return_url, "https://merchant.example/return");
  assert.deepEqual(invoice, {
    token: "invoice_123456",
    redirectUrl: "https://app.paydunya.com/checkout/invoice/invoice_123456",
  });
});

test("invoice creation rejects a redirect URL outside the official HTTPS checkout host", async () => {
  const client = new PaydunyaClient(live, async () => jsonResponse({
    response_code: "00",
    response_text: "https://attacker.invalid/checkout/invoice/invoice_123456",
    token: "invoice_123456",
  }));
  await assert.rejects(
    client.createInvoice({
      amountMinor: 1200,
      operationReference: reference,
      channel: "orange-money-ci",
      phoneNumber,
      customerName: "Test User",
    }),
    (error) => error instanceof PaydunyaError && error.code === "INVALID_RESPONSE",
  );
});

test("invoice creation rejects a provider URL whose token differs from the status token", async () => {
  const client = new PaydunyaClient(live, async () => jsonResponse({
    response_code: "00",
    response_text: "https://app.paydunya.com/checkout/invoice/invoice_other",
    token: "invoice_123456",
  }));
  await assert.rejects(
    client.createInvoice({
      amountMinor: 1200,
      operationReference: reference,
      channel: "orange-money-ci",
      phoneNumber,
    }),
    (error) => error instanceof PaydunyaError && error.code === "INVALID_RESPONSE",
  );
});

test("status is accepted only when provider hash, invoice, amount, reference, and payer match", async () => {
  let seenUrl;
  const client = new PaydunyaClient(live, async (url) => {
    seenUrl = url;
    return jsonResponse({
      response_code: "00",
      hash: statusHash,
      invoice: { token: "invoice_123456", total_amount: 1200 },
      custom_data: { sendflow_reference: reference },
      status: "completed",
      customer: { phone: phoneNumber },
    });
  });
  const status = await client.getVerifiedInvoiceStatus({
    token: "invoice_123456",
    expectedAmountMinor: 1200,
    expectedReference: reference,
    expectedPhoneNumber: phoneNumber,
  });
  assert.equal(seenUrl, "https://app.paydunya.com/api/v1/checkout-invoice/confirm/invoice_123456");
  assert.deepEqual(status, {
    token: "invoice_123456",
    status: "completed",
    amountMinor: 1200,
    currency: "XOF",
    sendflowReference: reference,
    phoneNumber,
  });
});

test("status with an invalid hash or mismatched transaction is never final", async () => {
  const invalidHash = new PaydunyaClient(live, async () => jsonResponse({
    response_code: "00",
    hash: "0".repeat(128),
    invoice: { token: "invoice_123456", total_amount: 1200 },
    custom_data: { sendflow_reference: reference },
    status: "completed",
    customer: { phone: phoneNumber },
  }));
  await assert.rejects(
    invalidHash.getVerifiedInvoiceStatus({
      token: "invoice_123456",
      expectedAmountMinor: 1200,
      expectedReference: reference,
      expectedPhoneNumber: phoneNumber,
    }),
    (error) => error instanceof PaydunyaError && error.code === "UNVERIFIED_STATUS",
  );

  const mismatchedAmount = new PaydunyaClient(live, async () => jsonResponse({
    response_code: "00",
    hash: statusHash,
    invoice: { token: "invoice_123456", total_amount: 1199 },
    custom_data: { sendflow_reference: reference },
    status: "completed",
    customer: { phone: phoneNumber },
  }));
  await assert.rejects(
    mismatchedAmount.getVerifiedInvoiceStatus({
      token: "invoice_123456",
      expectedAmountMinor: 1200,
      expectedReference: reference,
      expectedPhoneNumber: phoneNumber,
    }),
    (error) => error instanceof PaydunyaError && error.code === "UNVERIFIED_STATUS",
  );
});
