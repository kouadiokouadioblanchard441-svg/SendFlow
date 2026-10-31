import test from "node:test";
import assert from "node:assert/strict";
import { sendResendEmail } from "./resend-email.ts";

test("Resend sends one recipient with the stable provider idempotency header", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  let request;
  try {
    const result = await sendResendEmail({
      to: "recipient@example.test",
      subject: "SendFlow notice",
      text: "A test message",
      html: "<p>A test message</p>",
    }, {
      apiKey: "test-resend-key",
      fromEmail: "SendFlow <no-reply@sendflow.africa>",
      idempotencyKey: "campaign-recipient-test-id",
      fetchImpl: async (url, init) => {
        request = { url, init };
        return new Response(JSON.stringify({ id: "resend-message-test-id" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    assert.equal(request.url, "https://api.resend.com/emails");
    assert.equal(request.init.headers["Idempotency-Key"], "campaign-recipient-test-id");
    assert.deepEqual(JSON.parse(request.init.body).to, ["recipient@example.test"]);
    assert.deepEqual(result, { messageId: "resend-message-test-id", statusCode: 200 });
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
