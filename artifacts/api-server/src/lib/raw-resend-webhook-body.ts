import type { IncomingMessage } from "node:http";

type RawBodyRequest = Pick<IncomingMessage, "method" | "url"> & {
  rawBody?: Buffer;
};

export function captureRawResendWebhookBody(request: RawBodyRequest, body: Uint8Array) {
  if (request.method !== "POST" || request.url?.split("?")[0] !== "/api/webhooks/resend") return;
  request.rawBody = Buffer.from(body);
}
