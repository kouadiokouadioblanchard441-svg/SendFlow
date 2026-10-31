import assert from "node:assert/strict";
import test from "node:test";
import {
  ResendConfigurationError,
  ResendDeliveryError,
  sendResendEmail,
} from "./resend-email.ts";
import { ExternalProviderCallUnavailableError } from "./provider-call-policy.ts";

const message = {
  to: "person@example.invalid",
  subject: "Code de vérification SendFlow",
  text: "Votre code est 123456.",
  html: "<p>Votre code est <strong>123456</strong>.</p>",
};

async function inProduction(action) {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    return await action();
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
}

test("email delivery uses server authentication, campaign correlation tags, and idempotency", async () => {
  await inProduction(async () => {
    let request;
    const campaignTags = [
      { name: "sendflow_campaign_recipient", value: "recipient-id" },
      { name: "sendflow_campaign_attempt", value: "attempt-id" },
    ];
    const result = await sendResendEmail({ ...message, tags: campaignTags }, {
      apiKey: "test-resend-key",
      fromEmail: "SendFlow <no-reply@example.invalid>",
      idempotencyKey: "test-campaign-idempotency-key",
      fetchImpl: async (url, init) => {
        request = { url, init };
        return new Response(JSON.stringify({ id: "email-message-id" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    assert.equal(request.url, "https://api.resend.com/emails");
    assert.equal(request.init.method, "POST");
    assert.equal(request.init.headers.Authorization, "Bearer test-resend-key");
    assert.equal(request.init.headers["Content-Type"], "application/json");
    assert.equal(request.init.headers["Idempotency-Key"], "test-campaign-idempotency-key");
    assert.deepEqual(JSON.parse(request.init.body), {
      from: "SendFlow <no-reply@example.invalid>",
      to: ["person@example.invalid"],
      subject: message.subject,
      text: message.text,
      html: message.html,
      tags: campaignTags,
    });
    assert.deepEqual(result, { messageId: "email-message-id", statusCode: 200 });
  });
});

test("Resend fails closed when credentials or sender identity are missing", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    await assert.rejects(
      () => sendResendEmail(message, {
        apiKey: "",
        fromEmail: "SendFlow <no-reply@example.invalid>",
        fetchImpl: async () => { throw new Error("must not send"); },
      }),
      ResendConfigurationError,
    );
    await assert.rejects(
      () => sendResendEmail(message, {
        apiKey: "test-resend-key",
        fromEmail: "",
        fetchImpl: async () => { throw new Error("must not send"); },
      }),
      ResendConfigurationError,
    );
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("Resend provider calls remain disabled outside production", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    await assert.rejects(
      () => sendResendEmail(message, {
        apiKey: "test-resend-key",
        fromEmail: "SendFlow <no-reply@example.invalid>",
        fetchImpl: async () => { throw new Error("must not send"); },
      }),
      ExternalProviderCallUnavailableError,
    );
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("Resend errors expose only the HTTP status, never provider response content", async () => {
  await inProduction(async () => {
    await assert.rejects(
      () => sendResendEmail(message, {
        apiKey: "test-resend-key",
        fromEmail: "SendFlow <no-reply@example.invalid>",
        fetchImpl: async () => new Response("private error body", { status: 403 }),
      }),
      (error) => error instanceof ResendDeliveryError && error.statusCode === 403
        && !error.message.includes("private"),
    );
  });
});
