export type DocsCodeFormat = 'cURL' | 'JavaScript' | 'PHP' | 'Python' | 'Kotlin';
export type DocsExampleId =
  | 'create-hosted'
  | 'create-direct'
  | 'read-session'
  | 'read-public-session'
  | 'start-attempt'
  | 'poll-attempt'
  | 'pricing'
  | 'webhook';

type ExampleSet = Record<Exclude<DocsCodeFormat, 'Kotlin'>, string> & { Kotlin?: string };

const examples: Record<DocsExampleId, ExampleSet> = {
  'create-hosted': {
    cURL: `curl --request POST "$SENDFLOW_API_BASE_URL/v1/payment-sessions" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY" \\
  --header "Idempotency-Key: order-2026-0042" \\
  --header "Content-Type: application/json" \\
  --data '{
    "merchantReference": "ORDER-2026-0042",
    "amountMinor": 12500,
    "currency": "XOF",
    "mode": "hosted",
    "returnUrl": "https://shop.example.com/payment/return"
  }'`,
    JavaScript: `const response = await fetch(
  \`\${process.env.SENDFLOW_API_BASE_URL}/v1/payment-sessions\`,
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.SENDFLOW_SECRET_KEY}\`,
      "Idempotency-Key": "order-2026-0042",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      merchantReference: "ORDER-2026-0042",
      amountMinor: 12500,
      currency: "XOF",
      mode: "hosted",
      returnUrl: "https://shop.example.com/payment/return",
    }),
  },
);
const session = await response.json();
if (!response.ok) throw new Error(session.error ?? "SendFlow request failed");
if (!session.checkoutPath) throw new Error("No hosted checkout path was returned");
const checkoutOrigin = process.env.SENDFLOW_CHECKOUT_ORIGIN;
if (!checkoutOrigin) throw new Error("Set the official SendFlow checkout origin first");
const checkoutUrl = new URL(session.checkoutPath, checkoutOrigin).toString();
// Return checkoutUrl to your client, then redirect the customer's browser.`,
    PHP: `$body = [
    "merchantReference" => "ORDER-2026-0042",
    "amountMinor" => 12500,
    "currency" => "XOF",
    "mode" => "hosted",
    "returnUrl" => "https://shop.example.com/payment/return",
];
$ch = curl_init(rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/v1/payment-sessions");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer " . getenv("SENDFLOW_SECRET_KEY"),
        "Idempotency-Key: order-2026-0042",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode($body, JSON_THROW_ON_ERROR),
]);
$response = curl_exec($ch);
if ($response === false || curl_getinfo($ch, CURLINFO_RESPONSE_CODE) >= 400) {
    throw new RuntimeException("SendFlow session could not be created");
}
$session = json_decode($response, true, flags: JSON_THROW_ON_ERROR);
if (empty($session["checkoutPath"])) {
    throw new RuntimeException("No hosted checkout path was returned");
}
$checkoutOrigin = getenv("SENDFLOW_CHECKOUT_ORIGIN");
if (!$checkoutOrigin) {
    throw new RuntimeException("Set the official SendFlow checkout origin first");
}
$checkoutUrl = rtrim($checkoutOrigin, "/") . $session["checkoutPath"];
// Return $checkoutUrl to your client, then redirect the customer's browser.`,
    Python: `import os
import requests
from urllib.parse import urljoin

response = requests.post(
    f"{os.environ['SENDFLOW_API_BASE_URL']}/v1/payment-sessions",
    headers={
        "Authorization": f"Bearer {os.environ['SENDFLOW_SECRET_KEY']}",
        "Idempotency-Key": "order-2026-0042",
    },
    json={
        "merchantReference": "ORDER-2026-0042",
        "amountMinor": 12500,
        "currency": "XOF",
        "mode": "hosted",
        "returnUrl": "https://shop.example.com/payment/return",
    },
    timeout=15,
)
response.raise_for_status()
session = response.json()
if not session.get("checkoutPath"):
    raise RuntimeError("No hosted checkout path was returned")
checkout_origin = os.environ.get("SENDFLOW_CHECKOUT_ORIGIN")
if not checkout_origin:
    raise RuntimeError("Set the official SendFlow checkout origin first")
checkout_url = urljoin(checkout_origin.rstrip("/") + "/", session["checkoutPath"].lstrip("/"))
# Return checkout_url to your client, then redirect the customer's browser.`,
  },
  'create-direct': {
    cURL: `curl --request POST "$SENDFLOW_API_BASE_URL/v1/payment-sessions" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY" \\
  --header "Idempotency-Key: order-2026-0043" \\
  --header "Content-Type: application/json" \\
  --data '{
    "merchantReference": "ORDER-2026-0043",
    "amountMinor": 12500,
    "currency": "XOF",
    "mode": "direct"
  }'`,
    JavaScript: `const response = await fetch(
  \`\${process.env.SENDFLOW_API_BASE_URL}/v1/payment-sessions\`,
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.SENDFLOW_SECRET_KEY}\`,
      "Idempotency-Key": "order-2026-0043",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      merchantReference: "ORDER-2026-0043",
      amountMinor: 12500,
      currency: "XOF",
      mode: "direct",
    }),
  },
);
const session = await response.json();
if (!response.ok) throw new Error(session.error ?? "SendFlow request failed");
// Send session.id, session.publicKey, and session.clientToken to your checkout client.
// Never send SENDFLOW_SECRET_KEY to a browser or mobile app.`,
    PHP: `$body = [
    "merchantReference" => "ORDER-2026-0043",
    "amountMinor" => 12500,
    "currency" => "XOF",
    "mode" => "direct",
];
$ch = curl_init(rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/v1/payment-sessions");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer " . getenv("SENDFLOW_SECRET_KEY"),
        "Idempotency-Key: order-2026-0043",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode($body, JSON_THROW_ON_ERROR),
]);
$response = curl_exec($ch);
if ($response === false || curl_getinfo($ch, CURLINFO_RESPONSE_CODE) >= 400) {
    throw new RuntimeException("SendFlow session could not be created");
}
$session = json_decode($response, true, flags: JSON_THROW_ON_ERROR);`,
    Python: `import os
import requests

response = requests.post(
    f"{os.environ['SENDFLOW_API_BASE_URL']}/v1/payment-sessions",
    headers={
        "Authorization": f"Bearer {os.environ['SENDFLOW_SECRET_KEY']}",
        "Idempotency-Key": "order-2026-0043",
    },
    json={
        "merchantReference": "ORDER-2026-0043",
        "amountMinor": 12500,
        "currency": "XOF",
        "mode": "direct",
    },
    timeout=15,
)
response.raise_for_status()
session = response.json()`,
  },
  'read-session': {
    cURL: `curl "$SENDFLOW_API_BASE_URL/v1/payment-sessions/$SESSION_ID" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY"`,
    JavaScript: `const response = await fetch(
  \`\${process.env.SENDFLOW_API_BASE_URL}/v1/payment-sessions/\${sessionId}\`,
  { headers: { Authorization: \`Bearer \${process.env.SENDFLOW_SECRET_KEY}\` } },
);
const session = await response.json();
if (!response.ok) throw new Error(session.error ?? "SendFlow request failed");
// Confirm the order only when session.state === "succeeded".`,
    PHP: `$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/v1/payment-sessions/" . rawurlencode($sessionId);
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("SENDFLOW_SECRET_KEY")],
]);
$response = curl_exec($ch);
if ($response === false || curl_getinfo($ch, CURLINFO_RESPONSE_CODE) >= 400) {
    throw new RuntimeException("SendFlow status could not be read");
}
$session = json_decode($response, true, flags: JSON_THROW_ON_ERROR);`,
    Python: `import os
import requests

response = requests.get(
    f"{os.environ['SENDFLOW_API_BASE_URL']}/v1/payment-sessions/{session_id}",
    headers={"Authorization": f"Bearer {os.environ['SENDFLOW_SECRET_KEY']}"},
    timeout=15,
)
response.raise_for_status()
session = response.json()
# Confirm the order only when session["state"] == "succeeded".`,
  },
  'read-public-session': {
    cURL: `curl "$SENDFLOW_API_BASE_URL/v1/public/payment-sessions/$SESSION_ID" \\
  --header "X-SendFlow-Public-Key: $SENDFLOW_PUBLIC_KEY" \\
  --header "X-SendFlow-Client-Token: $SENDFLOW_CLIENT_TOKEN"`,
    JavaScript: `const response = await fetch(
  \`\${apiBaseUrl}/v1/public/payment-sessions/\${session.id}\`,
  {
    headers: {
      "X-SendFlow-Public-Key": session.publicKey,
      "X-SendFlow-Client-Token": session.clientToken,
    },
  },
);
const checkout = await response.json();
if (!response.ok) throw new Error(checkout.error ?? "SendFlow request failed");
// Use checkout.countries to show the currently available countries/operators.`,
    PHP: `$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/v1/public/payment-sessions/" . rawurlencode($sessionId);
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "X-SendFlow-Public-Key: " . $publicKey,
        "X-SendFlow-Client-Token: " . $clientToken,
    ],
]);
$response = curl_exec($ch);
if ($response === false || curl_getinfo($ch, CURLINFO_RESPONSE_CODE) >= 400) {
    throw new RuntimeException("Checkout details could not be read");
}
$checkout = json_decode($response, true, flags: JSON_THROW_ON_ERROR);`,
    Python: `import requests

response = requests.get(
    f"{api_base_url}/v1/public/payment-sessions/{session_id}",
    headers={
        "X-SendFlow-Public-Key": public_key,
        "X-SendFlow-Client-Token": client_token,
    },
    timeout=15,
)
response.raise_for_status()
checkout = response.json()
# Use checkout["countries"] to display available payment choices.`,
    Kotlin: `import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

suspend fun readDirectSession(
    apiBaseUrl: String,
    sessionId: String,
    publicKey: String,
    clientToken: String,
): JSONObject = withContext(Dispatchers.IO) {
    val connection = (URL("$apiBaseUrl/v1/public/payment-sessions/$sessionId").openConnection()
        as HttpURLConnection).apply {
        requestMethod = "GET"
        connectTimeout = 15_000
        readTimeout = 15_000
        setRequestProperty("X-SendFlow-Public-Key", publicKey)
        setRequestProperty("X-SendFlow-Client-Token", clientToken)
    }
    try {
        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
        if (status !in 200..299) {
            throw IOException(JSONObject(body).optString("error", "SendFlow request failed"))
        }
        JSONObject(body)
    } finally {
        connection.disconnect()
    }
}`,
  },
  'start-attempt': {
    cURL: `curl --request POST "$SENDFLOW_API_BASE_URL/v1/public/payment-sessions/$SESSION_ID/attempts" \\
  --header "X-SendFlow-Public-Key: $SENDFLOW_PUBLIC_KEY" \\
  --header "X-SendFlow-Client-Token: $SENDFLOW_CLIENT_TOKEN" \\
  --header "Idempotency-Key: payer-order-2026-0042" \\
  --header "Content-Type: application/json" \\
  --data '{
    "firstName": "Awa",
    "lastName": "Kone",
    "countryCode": "CI",
    "operatorId": "<operator-id-from-session>",
    "phoneNumber": "+2250700000000"
  }'`,
    JavaScript: `const response = await fetch(
  \`\${apiBaseUrl}/v1/public/payment-sessions/\${session.id}/attempts\`,
  {
    method: "POST",
    headers: {
      "X-SendFlow-Public-Key": session.publicKey,
      "X-SendFlow-Client-Token": session.clientToken,
      "Idempotency-Key": "payer-order-2026-0042",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      firstName: "Awa",
      lastName: "Kone",
      countryCode: "CI",
      operatorId: "<operator-id-from-session>",
      phoneNumber: "+2250700000000",
    }),
  },
);
const attempt = await response.json();
if (!response.ok) throw new Error(attempt.error ?? "Payment could not start");
// Keep attempt.pollToken in your server-side session where possible.`,
    PHP: `$body = [
    "firstName" => "Awa",
    "lastName" => "Kone",
    "countryCode" => "CI",
    "operatorId" => "<operator-id-from-session>",
    "phoneNumber" => "+2250700000000",
];
$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/v1/public/payment-sessions/" . rawurlencode($sessionId) . "/attempts";
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "X-SendFlow-Public-Key: " . $publicKey,
        "X-SendFlow-Client-Token: " . $clientToken,
        "Idempotency-Key: payer-order-2026-0042",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode($body, JSON_THROW_ON_ERROR),
]);
$response = curl_exec($ch);
if ($response === false || curl_getinfo($ch, CURLINFO_RESPONSE_CODE) >= 400) {
    throw new RuntimeException("Payment attempt could not start");
}
$attempt = json_decode($response, true, flags: JSON_THROW_ON_ERROR);`,
    Python: `import requests

response = requests.post(
    f"{api_base_url}/v1/public/payment-sessions/{session_id}/attempts",
    headers={
        "X-SendFlow-Public-Key": public_key,
        "X-SendFlow-Client-Token": client_token,
        "Idempotency-Key": "payer-order-2026-0042",
    },
    json={
        "firstName": "Awa",
        "lastName": "Kone",
        "countryCode": "CI",
        "operatorId": "<operator-id-from-session>",
        "phoneNumber": "+2250700000000",
    },
    timeout=15,
)
response.raise_for_status()
attempt = response.json()`,
    Kotlin: `import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

suspend fun startDirectAttempt(
    apiBaseUrl: String,
    sessionId: String,
    publicKey: String,
    clientToken: String,
    idempotencyKey: String,
    firstName: String,
    lastName: String,
    countryCode: String,
    operatorId: String,
    phoneNumber: String,
): JSONObject = withContext(Dispatchers.IO) {
    // Obtain publicKey and clientToken from your merchant server; never embed the secret key here.
    val url = URL("$apiBaseUrl/v1/public/payment-sessions/$sessionId/attempts")
    val connection = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 15_000
        readTimeout = 15_000
        doOutput = true
        setRequestProperty("X-SendFlow-Public-Key", publicKey)
        setRequestProperty("X-SendFlow-Client-Token", clientToken)
        setRequestProperty("Idempotency-Key", idempotencyKey)
        setRequestProperty("Content-Type", "application/json")
    }
    try {
        val body = JSONObject()
            .put("firstName", firstName)
            .put("lastName", lastName)
            .put("countryCode", countryCode.uppercase())
            .put("operatorId", operatorId)
            .put("phoneNumber", phoneNumber)
        connection.outputStream.use {
            it.write(body.toString().toByteArray(Charsets.UTF_8))
        }
        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val responseBody = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
        if (status !in 200..299) {
            throw IOException(JSONObject(responseBody).optString("error", "Payment could not start"))
        }
        JSONObject(responseBody)
    } finally {
        connection.disconnect()
    }
}`,
  },
  'poll-attempt': {
    cURL: `curl "$SENDFLOW_API_BASE_URL/v1/public/payment-sessions/$SESSION_ID/attempts/$ATTEMPT_ID" \\
  --header "X-SendFlow-Public-Key: $SENDFLOW_PUBLIC_KEY" \\
  --header "X-SendFlow-Client-Token: $SENDFLOW_CLIENT_TOKEN" \\
  --header "X-LinkFlow-Attempt-Token: $SENDFLOW_POLL_TOKEN"`,
    JavaScript: `const response = await fetch(
  \`\${apiBaseUrl}/v1/public/payment-sessions/\${sessionId}/attempts/\${attemptId}\`,
  {
    headers: {
      "X-SendFlow-Public-Key": publicKey,
      "X-SendFlow-Client-Token": clientToken,
      "X-LinkFlow-Attempt-Token": attempt.pollToken,
    },
  },
);
const status = await response.json();
if (!response.ok) throw new Error(status.error ?? "Payment status unavailable");
// Treat only the server-confirmed "succeeded" state as a paid order.`,
    PHP: `$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/v1/public/payment-sessions/" . rawurlencode($sessionId) . "/attempts/" . rawurlencode($attemptId);
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "X-SendFlow-Public-Key: " . $publicKey,
        "X-SendFlow-Client-Token: " . $clientToken,
        "X-LinkFlow-Attempt-Token: " . $pollToken,
    ],
]);
$response = curl_exec($ch);
if ($response === false || curl_getinfo($ch, CURLINFO_RESPONSE_CODE) >= 400) {
    throw new RuntimeException("Payment status unavailable");
}
$status = json_decode($response, true, flags: JSON_THROW_ON_ERROR);`,
    Python: `import requests

response = requests.get(
    f"{api_base_url}/v1/public/payment-sessions/{session_id}/attempts/{attempt_id}",
    headers={
        "X-SendFlow-Public-Key": public_key,
        "X-SendFlow-Client-Token": client_token,
        "X-LinkFlow-Attempt-Token": poll_token,
    },
    timeout=15,
)
response.raise_for_status()
status = response.json()
# Trust only the server-confirmed "succeeded" state.`,
    Kotlin: `import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

suspend fun pollDirectAttempt(
    apiBaseUrl: String,
    sessionId: String,
    attemptId: String,
    publicKey: String,
    clientToken: String,
    pollToken: String,
): JSONObject = withContext(Dispatchers.IO) {
    val url = URL("$apiBaseUrl/v1/public/payment-sessions/$sessionId/attempts/$attemptId")
    val connection = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        connectTimeout = 15_000
        readTimeout = 15_000
        setRequestProperty("X-SendFlow-Public-Key", publicKey)
        setRequestProperty("X-SendFlow-Client-Token", clientToken)
        setRequestProperty("X-LinkFlow-Attempt-Token", pollToken)
    }
    try {
        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
        if (status !in 200..299) {
            throw IOException(JSONObject(body).optString("error", "Payment status unavailable"))
        }
        JSONObject(body)
    } finally {
        connection.disconnect()
    }
}`,
  },
  pricing: {
    cURL: `curl "$SENDFLOW_API_BASE_URL/pricing"`,
    JavaScript: `const response = await fetch(\`\${apiBaseUrl}/pricing\`);
if (!response.ok) throw new Error("Pricing catalog unavailable");
const catalog = await response.json();
const linkFlowOperators = catalog.operators.filter(
  (operator) => operator.fees.linkflow !== undefined,
);`,
    PHP: `$ch = curl_init(rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/pricing");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
if ($response === false || curl_getinfo($ch, CURLINFO_RESPONSE_CODE) >= 400) {
    throw new RuntimeException("Pricing catalog unavailable");
}
$catalog = json_decode($response, true, flags: JSON_THROW_ON_ERROR);`,
    Python: `import os
import requests

response = requests.get(
    f"{os.environ['SENDFLOW_API_BASE_URL']}/pricing",
    timeout=15,
)
response.raise_for_status()
catalog = response.json()
linkflow = [
    operator for operator in catalog["operators"]
    if operator["fees"].get("linkflow") is not None
]`,
  },
  webhook: {
    cURL: `timestamp=$(date +%s)
body='{"id":"9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644","type":"payment.succeeded","createdAt":"2026-01-01T12:00:00.000Z","data":{"sessionId":"00000000-0000-4000-8000-000000000001","merchantReference":"ORDER-2026-0042","attemptId":"00000000-0000-4000-8000-000000000002","transactionId":"00000000-0000-4000-8000-000000000003","amountMinor":12500,"currency":"XOF","status":"succeeded"}}'
signature=$(printf '%s' "$timestamp.$body" | openssl dgst -sha256 -hmac "$SEND_FLOW_WEBHOOK_SECRET" | awk '{print $NF}')
curl --request POST "$MERCHANT_WEBHOOK_URL" \\
  --header "Content-Type: application/json" \\
  --header "sendflow-event: payment.succeeded" \\
  --header "sendflow-delivery: 9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644" \\
  --header "sendflow-signature: t=$timestamp,v1=$signature" \\
  --data-binary "$body"`,
    JavaScript: `import { createHmac, timingSafeEqual } from "node:crypto";

function verifySendFlowWebhook(rawBody, signatureHeader, secret) {
  const match = /^t=(\\d+),v1=([a-f0-9]{64})$/.exec(signatureHeader ?? "");
  if (!match) return false;
  // Example replay window; choose and apply a freshness policy in your service.
  if (Math.abs(Date.now() / 1000 - Number(match[1])) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(\`\${match[1]}.\${rawBody}\`, "utf8")
    .digest();
  const received = Buffer.from(match[2], "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
// Verify the raw request bytes before parsing JSON; use a replay time limit.`,
    PHP: `$rawBody = file_get_contents("php://input");
$header = $_SERVER["HTTP_SENDFLOW_SIGNATURE"] ?? "";
if (!preg_match('/^t=(\\d+),v1=([a-f0-9]{64})$/', $header, $matches)) {
    http_response_code(400);
    exit;
}
// Example replay window; choose and apply a freshness policy in your service.
if (abs(time() - (int) $matches[1]) > 300) {
    http_response_code(400);
    exit;
}
$expected = hash_hmac("sha256", $matches[1] . "." . $rawBody, getenv("SEND_FLOW_WEBHOOK_SECRET"));
if (!hash_equals($expected, $matches[2])) {
    http_response_code(401);
    exit;
}
// Verify the timestamp freshness before processing the event.`,
    Python: `import hashlib
import hmac
import re
import time

def verify_sendflow_webhook(raw_body: bytes, signature_header: str, secret: str) -> bool:
    match = re.fullmatch(r"t=(\\d+),v1=([a-f0-9]{64})", signature_header or "")
    if not match:
        return False
    # Example replay window; choose and apply a freshness policy in your service.
    if abs(time.time() - int(match.group(1))) > 300:
        return False
    signed = match.group(1).encode() + b"." + raw_body
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, match.group(2))

# Verify the raw request bytes and timestamp freshness before processing.`,
  },
};

export function getDocsCodeExample(example: DocsExampleId, format: DocsCodeFormat) {
  const code = examples[example][format];
  if (!code) throw new Error(`No ${format} example is available for ${example}`);
  return code;
}

export function getDocsCodeFormats(example: DocsExampleId): DocsCodeFormat[] {
  return Object.keys(examples[example]) as DocsCodeFormat[];
}
