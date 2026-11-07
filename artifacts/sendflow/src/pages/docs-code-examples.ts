export type DocsCodeFormat = 'cURL' | 'JavaScript' | 'Node.js' | 'PHP' | 'Python' | 'Kotlin';
export type DocsExampleId =
  | 'create-hosted'
  | 'create-direct'
  | 'read-session'
  | 'read-public-session'
  | 'start-attempt'
  | 'poll-attempt'
  | 'handle-http-errors'
  | 'pricing'
  | 'payment-limits'
  | 'webhook';

type ExampleSet = Record<Exclude<DocsCodeFormat, 'Kotlin' | 'Node.js'>, string> & {
  'Node.js'?: string;
  Kotlin?: string;
};

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
    JavaScript: `import { env } from "node:process";

const response = await fetch(
  \`\${env.SENDFLOW_API_BASE_URL}/v1/payment-sessions\`,
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${env.SENDFLOW_SECRET_KEY}\`,
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
const checkoutOrigin = env.SENDFLOW_CHECKOUT_ORIGIN;
if (!checkoutOrigin) throw new Error("Set the official SendFlow checkout origin first");
const checkoutUrl = new URL(session.checkoutPath, checkoutOrigin).toString();
// Return checkoutUrl to your client, then redirect the customer's browser.`,
    'Node.js': `// Node.js 18+; run on your merchant server, never in a browser.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
const secretKey = process.env.SENDFLOW_SECRET_KEY;
if (!apiBaseUrl || !secretKey) throw new Error("Configure SendFlow server environment variables");

const response = await fetch(apiBaseUrl.replace(/\\/$/, "") + "/v1/payment-sessions", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + secretKey,
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
});
const session = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(session.error ?? \`SendFlow returned HTTP \${response.status}\`);
if (!session.checkoutPath) throw new Error("No hosted checkout path was returned");

const checkoutOrigin = process.env.SENDFLOW_CHECKOUT_ORIGIN;
if (!checkoutOrigin) throw new Error("Configure the official SendFlow checkout origin");
const checkoutUrl = new URL(session.checkoutPath, checkoutOrigin).toString();
// Return checkoutUrl to your client and redirect the payer's browser.`,
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
$session = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
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
    JavaScript: `import { env } from "node:process";

const response = await fetch(
  \`\${env.SENDFLOW_API_BASE_URL}/v1/payment-sessions\`,
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${env.SENDFLOW_SECRET_KEY}\`,
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
    'Node.js': `// Node.js 18+; keep the secret key in server-side environment variables.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
const secretKey = process.env.SENDFLOW_SECRET_KEY;
if (!apiBaseUrl || !secretKey) throw new Error("Configure SendFlow server environment variables");

const response = await fetch(apiBaseUrl.replace(/\\/$/, "") + "/v1/payment-sessions", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + secretKey,
    "Idempotency-Key": "order-2026-0043",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    merchantReference: "ORDER-2026-0043",
    amountMinor: 12500,
    currency: "XOF",
    mode: "direct",
  }),
});
const session = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(session.error ?? \`SendFlow returned HTTP \${response.status}\`);
// Send only session.id, session.publicKey and session.clientToken to your direct-checkout client.
// Never expose the secretKey.`,
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
$session = json_decode($response, true, 512, JSON_THROW_ON_ERROR);`,
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
    JavaScript: `import { env } from "node:process";

const response = await fetch(
  \`\${env.SENDFLOW_API_BASE_URL}/v1/payment-sessions/\${sessionId}\`,
  { headers: { Authorization: \`Bearer \${env.SENDFLOW_SECRET_KEY}\` } },
);
const session = await response.json();
if (!response.ok) throw new Error(session.error ?? "SendFlow request failed");
// Confirm the order only when session.state === "succeeded".`,
    'Node.js': `// Merchant-server status check; sessionId comes from your stored creation response.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
const secretKey = process.env.SENDFLOW_SECRET_KEY;
if (!apiBaseUrl || !secretKey) throw new Error("Configure SendFlow server environment variables");

const response = await fetch(
  apiBaseUrl.replace(/\\/$/, "") + "/v1/payment-sessions/" + encodeURIComponent(sessionId),
  { headers: { Authorization: "Bearer " + secretKey } },
);
const session = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(session.error ?? \`SendFlow returned HTTP \${response.status}\`);
// Confirm the order only when the server returns state === "succeeded".`,
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
$session = json_decode($response, true, 512, JSON_THROW_ON_ERROR);`,
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
    JavaScript: `const apiBaseUrl = "https://merchent.business.sendflow.africa/api";
// session is the response from your server-side create-direct request.
const response = await fetch(
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
    'Node.js': `// session comes from your server-side create-direct request.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
if (!apiBaseUrl) throw new Error("Configure SENDFLOW_API_BASE_URL on your server");

const response = await fetch(
  apiBaseUrl.replace(/\\/$/, "") + "/v1/public/payment-sessions/" + encodeURIComponent(session.id),
  {
    headers: {
      "X-SendFlow-Public-Key": session.publicKey,
      "X-SendFlow-Client-Token": session.clientToken,
    },
  },
);
const checkout = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(checkout.error ?? \`SendFlow returned HTTP \${response.status}\`);
// Use checkout.countries to render the currently available payment choices.`,
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
$checkout = json_decode($response, true, 512, JSON_THROW_ON_ERROR);`,
    Python: `import os
import requests

api_base_url = os.environ["SENDFLOW_API_BASE_URL"]
# Set these from the response to your server-side create-direct request.
session_id = "<session-id-from-create-response>"
public_key = "<public-key-from-create-response>"
client_token = "<client-token-from-create-response>"

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
  }'
# The response includes ussdCode when configured; it may be null. Never invent one.`,
    JavaScript: `const apiBaseUrl = "https://merchent.business.sendflow.africa/api";
// session is the response from your server-side create-direct request.
const response = await fetch(
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
// Render only the exact server-returned instruction; never build or inject HTML.
const ussdCodeElement = document.querySelector("[data-sendflow-ussd-code]");
if (ussdCodeElement) {
  ussdCodeElement.textContent = typeof attempt.ussdCode === "string" ? attempt.ussdCode : "";
  ussdCodeElement.hidden = !ussdCodeElement.textContent;
}
// Keep attempt.pollToken in your server-side session where possible.`,
    'Node.js': `// Use the public key and client token returned with the direct session.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
if (!apiBaseUrl) throw new Error("Configure SENDFLOW_API_BASE_URL on your server");

const response = await fetch(
  apiBaseUrl.replace(/\\/$/, "") + "/v1/public/payment-sessions/" +
    encodeURIComponent(session.id) + "/attempts",
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
const attempt = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(attempt.error ?? \`SendFlow returned HTTP \${response.status}\`);
const customerInstruction = { state: attempt.state, ussdCode: attempt.ussdCode ?? null };
// Return this instruction to the checkout UI. Do not return pollToken or a merchant secret.
// Keep attempt.pollToken private; this response is not proof of payment.`,
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
    $attempt = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
    $customerInstruction = [
        "state" => $attempt["state"],
        "ussdCode" => $attempt["ussdCode"] ?? null,
    ]; // Return only this instruction; never construct a code locally.`,
    Python: `import os
import requests

api_base_url = os.environ["SENDFLOW_API_BASE_URL"]
# Set these from the response to your server-side create-direct request.
session_id = "<session-id-from-create-response>"
public_key = "<public-key-from-create-response>"
client_token = "<client-token-from-create-response>"

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
attempt = response.json()
customer_instruction = {
    "state": attempt["state"],
    "ussdCode": attempt.get("ussdCode"),
}  # Display only this API-provided code; it can be null.`,
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
        val attempt = JSONObject(responseBody)
        val ussdCode = attempt.opt("ussdCode") as? String
        // Render ussdCode with TextView.text; it may be null. Never assemble it locally.
        attempt.put("ussdCode", ussdCode ?: JSONObject.NULL)
        attempt
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
    JavaScript: `const apiBaseUrl = "https://merchent.business.sendflow.africa/api";
// session and attempt are the responses from the previous direct-flow steps.
const response = await fetch(
  \`\${apiBaseUrl}/v1/public/payment-sessions/\${session.id}/attempts/\${attempt.attemptId}\`,
  {
    headers: {
      "X-SendFlow-Public-Key": session.publicKey,
      "X-SendFlow-Client-Token": session.clientToken,
      "X-LinkFlow-Attempt-Token": attempt.pollToken,
    },
  },
);
const status = await response.json();
if (!response.ok) throw new Error(status.error ?? "Payment status unavailable");
// Treat only the server-confirmed "succeeded" state as a paid order.`,
    'Node.js': `// session and attempt are responses from the previous direct-flow steps.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
if (!apiBaseUrl) throw new Error("Configure SENDFLOW_API_BASE_URL on your server");

const response = await fetch(
  apiBaseUrl.replace(/\\/$/, "") + "/v1/public/payment-sessions/" +
    encodeURIComponent(session.id) + "/attempts/" + encodeURIComponent(attempt.attemptId),
  {
    headers: {
      "X-SendFlow-Public-Key": session.publicKey,
      "X-SendFlow-Client-Token": session.clientToken,
      "X-LinkFlow-Attempt-Token": attempt.pollToken,
    },
  },
);
const status = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(status.error ?? \`SendFlow returned HTTP \${response.status}\`);
// Trust only the server-confirmed "succeeded" state.`,
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
$status = json_decode($response, true, 512, JSON_THROW_ON_ERROR);`,
    Python: `import os
import requests

api_base_url = os.environ["SENDFLOW_API_BASE_URL"]
# Set these from the previous direct-flow responses.
session_id = "<session-id-from-create-response>"
attempt_id = "<attempt-id-from-start-response>"
public_key = "<public-key-from-create-response>"
client_token = "<client-token-from-create-response>"
poll_token = "<poll-token-from-start-response>"

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
  'handle-http-errors': {
    cURL: `curl --include --silent --show-error \\
  "$SENDFLOW_API_BASE_URL/v1/payment-sessions/$SESSION_ID" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY"
# Inspect the HTTP status, Retry-After, and JSON { "error": "..." } body.
# A 503 does not prove success or final failure; verify status server-side.`,
    JavaScript: `const response = await fetch(
  \`\${process.env.SENDFLOW_API_BASE_URL}/v1/payment-sessions/\${sessionId}\`,
  {
    headers: {
      Authorization: \`Bearer \${process.env.SENDFLOW_SECRET_KEY}\`,
    },
  },
);
const payload = await response.json().catch(() => ({}));
if (response.status === 429) {
  const retryAfter = response.headers.get("Retry-After") ?? "60";
  throw new Error(\`Rate limited; retry after \${retryAfter} seconds.\`);
}
if (response.status === 503) {
  throw new Error("Service unavailable; do not infer a final payment result.");
}
if (!response.ok) {
  throw new Error(payload.error ?? \`SendFlow returned HTTP \${response.status}\`);
}`,
    'Node.js': `// Read the real HTTP status and { error: string } response body.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
const secretKey = process.env.SENDFLOW_SECRET_KEY;
if (!apiBaseUrl || !secretKey) throw new Error("Configure SendFlow server environment variables");

const response = await fetch(
  apiBaseUrl.replace(/\\/$/, "") + "/v1/payment-sessions/" + encodeURIComponent(sessionId),
  { headers: { Authorization: "Bearer " + secretKey } },
);
const payload = await response.json().catch(() => ({}));
if (response.status === 429) {
  const retryAfter = response.headers.get("Retry-After");
  throw new Error("Rate limited; Retry-After: " + (retryAfter ?? "not provided"));
}
if (response.status === 503) {
  throw new Error("Service unavailable; do not infer a final payment result.");
}
if (!response.ok) {
  throw new Error(payload.error ?? \`SendFlow returned HTTP \${response.status}\`);
}`,
    PHP: `$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/v1/payment-sessions/" . rawurlencode($sessionId);
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("SENDFLOW_SECRET_KEY")],
]);
$raw = curl_exec($ch);
if ($raw === false) {
    throw new RuntimeException("SendFlow request could not be completed");
}
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$headers = substr($raw, 0, $headerSize);
$body = substr($raw, $headerSize);
$payload = json_decode($body, true);
if ($status === 429) {
    preg_match('/^Retry-After:\\s*(\\d+)/im', $headers, $match);
    throw new RuntimeException("Rate limited; wait " . ($match[1] ?? "60") . " seconds");
}
if ($status === 503) {
    throw new RuntimeException("Service unavailable; do not infer a final payment result");
}
if ($status >= 400) {
    throw new RuntimeException($payload["error"] ?? "SendFlow request failed");
}`,
    Python: `import os
import requests

response = requests.get(
    f"{os.environ['SENDFLOW_API_BASE_URL']}/v1/payment-sessions/{session_id}",
    headers={"Authorization": f"Bearer {os.environ['SENDFLOW_SECRET_KEY']}"},
    timeout=15,
)
if response.status_code == 429:
    retry_after = response.headers.get("Retry-After", "60")
    raise RuntimeError(f"Rate limited; wait {retry_after} seconds")
if response.status_code == 503:
    raise RuntimeError("Service unavailable; do not infer a final payment result")
if not response.ok:
    raise RuntimeError(response.json().get("error", f"HTTP {response.status_code}"))
session = response.json()`,
  },
  pricing: {
    cURL: `curl "$SENDFLOW_API_BASE_URL/pricing"`,
    JavaScript: `import { env } from "node:process";

const response = await fetch(\`\${env.SENDFLOW_API_BASE_URL}/pricing\`);
if (!response.ok) throw new Error("Pricing catalog unavailable");
const catalog = await response.json();
const linkFlowOperators = catalog.operators.filter(
  (operator) => operator.fees.linkflow !== undefined,
);`,
    'Node.js': `// Public pricing catalog; no merchant key is required.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
if (!apiBaseUrl) throw new Error("Configure SENDFLOW_API_BASE_URL");
const response = await fetch(apiBaseUrl.replace(/\\/$/, "") + "/pricing");
const catalog = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(catalog.error ?? "Pricing catalog unavailable");
const linkFlowOperators = catalog.operators.filter(
  (operator) => operator.fees.linkflow !== undefined,
);`,
    PHP: `$ch = curl_init(rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/pricing");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
if ($response === false || curl_getinfo($ch, CURLINFO_RESPONSE_CODE) >= 400) {
    throw new RuntimeException("Pricing catalog unavailable");
}
$catalog = json_decode($response, true, 512, JSON_THROW_ON_ERROR);`,
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
  'payment-limits': {
    cURL: `curl --request GET "$SENDFLOW_API_BASE_URL/payment-limits" \\
  --header "Accept: application/json"`,
    JavaScript: `const response = await fetch(
  \`\${process.env.SENDFLOW_API_BASE_URL}/payment-limits\`,
  { headers: { Accept: "application/json" } },
);
if (!response.ok) throw new Error(\`SendFlow limits returned HTTP \${response.status}\`);
const limits = await response.json();
console.log("Minimum pay-in:", limits.minimumDepositMinor, limits.currency);
console.log("Minimum payout rule:", limits.minimumPayoutMinor, limits.currency);`,
    'Node.js': `// Public read; the server still enforces configured limits on every payment.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
if (!apiBaseUrl) throw new Error("Configure SENDFLOW_API_BASE_URL");
const response = await fetch(apiBaseUrl.replace(/\\/$/, "") + "/payment-limits", {
  headers: { Accept: "application/json" },
});
const limits = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(limits.error ?? \`Limits returned HTTP \${response.status}\`);
console.log("Minimum pay-in:", limits.minimumDepositMinor, limits.currency);
console.log("Minimum payout rule:", limits.minimumPayoutMinor, limits.currency);`,
    PHP: `$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/payment-limits";
$curl = curl_init($url);
curl_setopt_array($curl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Accept: application/json"],
]);
$body = curl_exec($curl);
$status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);
if ($body === false || $status < 200 || $status >= 300) {
    throw new RuntimeException("SendFlow limits request failed: HTTP " . $status);
}
$limits = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
echo $limits["minimumDepositMinor"] . " " . $limits["currency"];`,
    Python: `import json
import os
from urllib.request import Request, urlopen

base_url = os.environ["SENDFLOW_API_BASE_URL"].rstrip("/")
request = Request(base_url + "/payment-limits", headers={"Accept": "application/json"})
with urlopen(request, timeout=10) as response:
    limits = json.load(response)

print("Minimum pay-in:", limits["minimumDepositMinor"], limits["currency"])
print("Minimum payout rule:", limits["minimumPayoutMinor"], limits["currency"])`,
    Kotlin: `val url = URL("\${BuildConfig.SENDFLOW_API_BASE_URL}/payment-limits")
val connection = (url.openConnection() as HttpURLConnection).apply {
    requestMethod = "GET"
    setRequestProperty("Accept", "application/json")
    connectTimeout = 10_000
    readTimeout = 10_000
}
try {
    check(connection.responseCode in 200..299) {
        "SendFlow limits returned HTTP \${connection.responseCode}"
    }
    val body = connection.inputStream.bufferedReader().use { it.readText() }
    // Parse the public JSON response with your app's existing JSON library.
} finally {
    connection.disconnect()
}`,
  },
  webhook: {
    cURL: `# Local receiver test only. Never send this synthetic event to production.
timestamp=$(date +%s)
body='{"id":"9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644","type":"payment.succeeded","createdAt":"2026-01-01T12:00:00.000Z","data":{"sessionId":"00000000-0000-4000-8000-000000000001","merchantReference":"ORDER-2026-0042","attemptId":"00000000-0000-4000-8000-000000000002","transactionId":"00000000-0000-4000-8000-000000000003","amountMinor":12500,"currency":"XOF","status":"succeeded"}}'
signature=$(printf '%s' "$timestamp.$body" | openssl dgst -sha256 -hmac "$SEND_FLOW_WEBHOOK_SECRET" | awk '{print $NF}')
curl --request POST "http://127.0.0.1:3000/webhooks/sendflow" \\
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
    'Node.js': `import { createHmac, timingSafeEqual } from "node:crypto";

// Pass the exact raw request bytes and sendflow-signature header to this function.
// In Express, capture the raw body before applying express.json().
export function verifySendFlowWebhook(rawBody, signatureHeader, secret) {
  if (!Buffer.isBuffer(rawBody) || !secret) return null;
  const match = /^t=(\\d+),v1=([a-f0-9]{64})$/.exec(signatureHeader ?? "");
  if (!match) return null;

  const timestamp = Number(match[1]);
  // Example freshness window is merchant policy; SendFlow does not define it.
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return null;

  const expected = createHmac("sha256", secret)
    .update(Buffer.concat([Buffer.from(match[1] + ".", "utf8"), rawBody]))
    .digest();
  const received = Buffer.from(match[2], "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  // Parse only after signature validation; persist payload.id idempotently before acknowledging.
  return JSON.parse(rawBody.toString("utf8"));
}`,
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

export function getDocsCodeExample(example: DocsExampleId, format: DocsCodeFormat, amountMinor = 12_500) {
  const code = examples[example][format];
  if (!code) throw new Error(`No ${format} example is available for ${example}`);
  if (example === 'create-hosted' || example === 'create-direct') {
    return code.replaceAll('12500', String(amountMinor));
  }
  return code;
}

export function getDocsCodeFormats(example: DocsExampleId): DocsCodeFormat[] {
  return Object.keys(examples[example]) as DocsCodeFormat[];
}
