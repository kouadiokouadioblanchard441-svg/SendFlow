import { productionUrls } from './docs-production-urls.ts';

export type DocsCodeFormat = 'cURL' | 'JavaScript' | 'Node.js' | 'PHP' | 'Python' | 'Kotlin';
export type DocsExampleId =
  | 'create-hosted'
  | 'create-direct'
  | 'read-session'
  | 'read-public-session'
  | 'start-attempt'
  | 'submit-otp'
  | 'confirm-otp'
  | 'handle-flow-action'
  | 'poll-attempt'
  | 'handle-http-errors'
  | 'pricing'
  | 'payment-limits'
  | 'payout-quote'
  | 'payout-create'
  | 'payout-list'
  | 'payout-read'
  | 'payout-cancel'
  | 'webhook';

type ExampleSet = Pick<Record<DocsCodeFormat, string>, 'cURL' | 'PHP' | 'Python'>
  & Partial<Record<DocsCodeFormat, string>>;

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
    "firstName": "<first-name>",
    "lastName": "<last-name>",
    "countryCode": "CI",
    "operatorId": "<operator-id-from-session>",
    "phoneNumber": "<international-phone-number>"
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
      firstName: "<first-name>",
      lastName: "<last-name>",
      countryCode: "CI",
      operatorId: "<operator-id-from-session>",
      phoneNumber: "<international-phone-number>",
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
      firstName: "<first-name>",
      lastName: "<last-name>",
      countryCode: "CI",
      operatorId: "<operator-id-from-session>",
      phoneNumber: "<international-phone-number>",
    }),
  },
);
const attempt = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(attempt.error ?? \`SendFlow returned HTTP \${response.status}\`);
const customerInstruction = { state: attempt.state, ussdCode: attempt.ussdCode ?? null };
// Return this instruction to the checkout UI. Do not return pollToken or a merchant secret.
// Keep attempt.pollToken private; this response is not proof of payment.`,
    PHP: `$body = [
    "firstName" => "<first-name>",
    "lastName" => "<last-name>",
    "countryCode" => "CI",
    "operatorId" => "<operator-id-from-session>",
    "phoneNumber" => "<international-phone-number>",
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
        "firstName": "<first-name>",
        "lastName": "<last-name>",
        "countryCode": "CI",
        "operatorId": "<operator-id-from-session>",
        "phoneNumber": "<international-phone-number>",
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
  'submit-otp': {
    cURL: `curl --request POST "$SENDFLOW_API_BASE_URL/v1/public/payment-sessions/$SESSION_ID/attempts" \\
  --header "X-SendFlow-Public-Key: $SENDFLOW_PUBLIC_KEY" \\
  --header "X-SendFlow-Client-Token: $SENDFLOW_CLIENT_TOKEN" \\
  --header "Idempotency-Key: payer-order-2026-0042" \\
  --header "Content-Type: application/json" \\
  --data @- <<JSON
{
  "firstName": "<first-name>",
  "lastName": "<last-name>",
  "countryCode": "CI",
  "operatorId": "<operator-id-from-session>",
  "phoneNumber": "<international-phone-number>",
  "otp": "$PAYER_OTP"
}
JSON
# Use this form when the payer obtained the OTP before starting the attempt.`,
    JavaScript: `// Use when the payer has already obtained the code from the operator.
// Keep otp short-lived; never log or persist it.
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
    body: JSON.stringify({ ...attemptRequest, otp }),
  },
);
const attempt = await response.json();
if (!response.ok) throw new Error(attempt.error ?? "Payment attempt failed");`,
    'Node.js': `// Submit an OTP obtained before the attempt; no challenge reference is needed.
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
    body: JSON.stringify({ ...attemptRequest, otp }),
  },
);
const attempt = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(attempt.error ?? "Payment attempt failed");`,
    PHP: `$body = [
    "firstName" => "<first-name>",
    "lastName" => "<last-name>",
    "countryCode" => "CI",
    "operatorId" => "<operator-id-from-session>",
    "phoneNumber" => "<international-phone-number>",
    "otp" => $payerEnteredOtp,
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
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
if ($response === false || $status >= 400) {
    throw new RuntimeException("Payment attempt failed");
}
$attempt = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
curl_close($ch);`,
    Python: `# Submit an OTP obtained before the attempt; no challenge reference is needed.
# Never log or persist the payer's OTP.
attempt_body = {
    **attempt_request,
    "otp": payer_entered_otp,
}
response = requests.post(
    f"{api_base_url}/v1/public/payment-sessions/{session_id}/attempts",
    headers={
        "X-SendFlow-Public-Key": public_key,
        "X-SendFlow-Client-Token": client_token,
        "Idempotency-Key": "payer-order-2026-0042",
    },
    json=attempt_body,
    timeout=15,
)
response.raise_for_status()
attempt = response.json()`,
  },
  'confirm-otp': {
    cURL: `curl --request POST "$SENDFLOW_API_BASE_URL/v1/public/payment-sessions/$SESSION_ID/attempts" \\
  --header "X-SendFlow-Public-Key: $SENDFLOW_PUBLIC_KEY" \\
  --header "X-SendFlow-Client-Token: $SENDFLOW_CLIENT_TOKEN" \\
  --header "Idempotency-Key: payer-order-2026-0042" \\
  --header "Content-Type: application/json" \\
  --data @- <<JSON
{
  "firstName": "<first-name>",
  "lastName": "<last-name>",
  "countryCode": "CI",
  "operatorId": "<operator-id-from-session>",
  "phoneNumber": "<international-phone-number>",
  "reference": "$ATTEMPT_REFERENCE",
  "otp": "$PAYER_OTP"
}
JSON`,
    JavaScript: `// Use after the first response has flow.action === "enter_otp".
// otp is the short-lived value entered by the payer; never log or persist it.
const confirmResponse = await fetch(
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
      ...attemptRequest,
      reference: attempt.flow.reference,
      otp,
    }),
  },
);
const confirmedAttempt = await confirmResponse.json();
if (!confirmResponse.ok) throw new Error(confirmedAttempt.error ?? "OTP confirmation failed");`,
    'Node.js': `// Reuse the exact initial attempt body and idempotency key.
// otp comes from the payer and must never be logged or stored durably.
if (attempt.flow.action !== "enter_otp" || !attempt.flow.reference) {
  throw new Error("No OTP challenge is waiting for confirmation");
}
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
      ...attemptRequest,
      reference: attempt.flow.reference,
      otp,
    }),
  },
);
const confirmedAttempt = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(confirmedAttempt.error ?? "OTP confirmation failed");`,
    PHP: `$body = [
    "firstName" => "<first-name>",
    "lastName" => "<last-name>",
    "countryCode" => "CI",
    "operatorId" => "<operator-id-from-session>",
    "phoneNumber" => "<international-phone-number>",
    "reference" => $attempt["flow"]["reference"],
    "otp" => $payerEnteredOtp,
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
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
if ($response === false || $status >= 400) {
    throw new RuntimeException("OTP confirmation failed");
}
$confirmedAttempt = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
curl_close($ch);`,
    Python: `# Reuse the initial request body and Idempotency-Key.
# otp is short-lived: never log or persist it.
if attempt["flow"]["action"] != "enter_otp" or not attempt["flow"]["reference"]:
    raise RuntimeError("No OTP challenge is waiting for confirmation")

confirmation_body = {
    **attempt_request,
    "reference": attempt["flow"]["reference"],
    "otp": payer_entered_otp,
}
response = requests.post(
    f"{api_base_url}/v1/public/payment-sessions/{session_id}/attempts",
    headers={
        "X-SendFlow-Public-Key": public_key,
        "X-SendFlow-Client-Token": client_token,
        "Idempotency-Key": "payer-order-2026-0042",
    },
    json=confirmation_body,
    timeout=15,
)
response.raise_for_status()
confirmed_attempt = response.json()`,
  },
  'handle-flow-action': {
    cURL: `# If you saved the attempt response as attempt.json:
jq -r 'if .flow.action == "open_redirect" then .flow.redirectUrl // empty else empty end' attempt.json
# Open only the exact URL returned by the API; do not construct one.`,
    JavaScript: `// Run in the payer's browser after receiving the attempt response.
const { action, redirectUrl } = attempt.flow ?? {};
if (action === "open_redirect" && typeof redirectUrl === "string") {
  window.location.assign(redirectUrl);
} else if (action === "enter_otp") {
  const instruction = document.querySelector("[data-sendflow-instruction]");
  if (instruction) instruction.textContent = attempt.flow.otpCommand ?? "Enter the code from your operator";
} else if (action === "approve_on_phone") {
  const instruction = document.querySelector("[data-sendflow-instruction]");
  if (instruction) instruction.textContent = "Approve the payment request on your phone";
}`,
    'Node.js': `// Return only the server-generated redirect URL to the checkout client.
const flow = attempt.flow ?? {};
const checkoutAction = flow.action === "open_redirect" && flow.redirectUrl
  ? { action: "open_redirect", redirectUrl: flow.redirectUrl }
  : { action: flow.action };
// Never substitute merchant returnUrl for redirectUrl.`,
    PHP: `$flow = $attempt["flow"] ?? [];
$checkoutAction = [
    "action" => $flow["action"] ?? "wait",
    "redirectUrl" => ($flow["action"] ?? null) === "open_redirect"
        ? ($flow["redirectUrl"] ?? null)
        : null,
];
// Return the exact API-provided URL; never build a provider URL locally.`,
    Python: `flow = attempt.get("flow", {})
if flow.get("action") == "open_redirect" and flow.get("redirectUrl"):
    checkout_action = {
        "action": "open_redirect",
        "redirectUrl": flow["redirectUrl"],
    }  # Open this exact server-returned URL in the payer's client.
else:
    checkout_action = {"action": flow.get("action", "wait")}`,
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
console.log("Countries:", catalog.countries);
console.log("Operators and configured fees:", catalog.operators.map((operator) => ({
  countryId: operator.countryId,
  id: operator.id,
  name: operator.name,
  operations: operator.operations,
  fees: operator.fees,
 })));
// Catalog policy metadata does not enable an OTP payment flow.
console.log("Operators with OTP policy metadata:", catalog.operators
  .filter((operator) => operator.requiresOtp)
  .map((operator) => ({
    countryId: operator.countryId,
    operatorId: operator.id,
    country: catalog.countries.find((country) => country.id === operator.countryId)?.name ?? operator.countryId,
    name: operator.name,
    requiresOtp: operator.requiresOtp,
    otpCommand: operator.otpCommand,
  })));`,
    'Node.js': `// Public pricing catalog; no merchant key is required.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
if (!apiBaseUrl) throw new Error("Configure SENDFLOW_API_BASE_URL");
const response = await fetch(apiBaseUrl.replace(/\\/$/, "") + "/pricing");
const catalog = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(catalog.error ?? "Pricing catalog unavailable");
console.log("Countries:", catalog.countries);
console.log("Operators and configured fees:", catalog.operators.map((operator) => ({
  countryId: operator.countryId,
  id: operator.id,
  name: operator.name,
  operations: operator.operations,
  fees: operator.fees,
 })));
// Catalog policy metadata does not enable an OTP payment flow.
console.log("Operators with OTP policy metadata:", catalog.operators
  .filter((operator) => operator.requiresOtp)
  .map((operator) => ({
    countryId: operator.countryId,
    operatorId: operator.id,
    country: catalog.countries.find((country) => country.id === operator.countryId)?.name ?? operator.countryId,
    name: operator.name,
    requiresOtp: operator.requiresOtp,
    otpCommand: operator.otpCommand,
  })));`,
    PHP: `$ch = curl_init(rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/pricing");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
if ($response === false || curl_getinfo($ch, CURLINFO_RESPONSE_CODE) >= 400) {
    throw new RuntimeException("Pricing catalog unavailable");
}
$catalog = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
print_r($catalog["countries"]);
$countryNames = array_column($catalog["countries"], "name", "id");
foreach ($catalog["operators"] as $operator) {
    print_r([
        "countryId" => $operator["countryId"],
        "id" => $operator["id"],
        "name" => $operator["name"],
        "operations" => $operator["operations"],
        "fees" => $operator["fees"],
    ]);
    if (!empty($operator["requiresOtp"])) {
        // Catalog policy metadata does not enable an OTP payment flow.
        print_r([
            "countryId" => $operator["countryId"],
            "operatorId" => $operator["id"],
            "country" => $countryNames[$operator["countryId"]] ?? $operator["countryId"],
            "name" => $operator["name"],
            "requiresOtp" => true,
            "otpCommand" => $operator["otpCommand"] ?? null,
        ]);
    }
}`,
    Python: `import os
import requests

response = requests.get(
    f"{os.environ['SENDFLOW_API_BASE_URL']}/pricing",
    timeout=15,
)
response.raise_for_status()
catalog = response.json()
print("Countries:", catalog["countries"])
print("Operators and configured fees:", [
    {
        "countryId": operator["countryId"],
        "id": operator["id"],
        "name": operator["name"],
        "operations": operator["operations"],
        "fees": operator["fees"],
    }
    for operator in catalog["operators"]
])
# Catalog policy metadata does not enable an OTP payment flow.
print("Operators with OTP policy metadata:", [
    {
        "countryId": operator["countryId"],
        "operatorId": operator["id"],
        "country": next(
            (country["name"] for country in catalog["countries"] if country["id"] == operator["countryId"]),
            operator["countryId"],
        ),
        "name": operator["name"],
        "requiresOtp": operator["requiresOtp"],
        "otpCommand": operator["otpCommand"],
    }
    for operator in catalog["operators"]
    if operator["requiresOtp"]
])`,
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
console.log(
  "Pay-in limits:",
  limits.minimumDepositMinor,
  limits.maximumPayinMinor,
  limits.currency,
);`,
    'Node.js': `// Public read; the server still enforces configured limits on every payment.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
if (!apiBaseUrl) throw new Error("Configure SENDFLOW_API_BASE_URL");
const response = await fetch(apiBaseUrl.replace(/\\/$/, "") + "/payment-limits", {
  headers: { Accept: "application/json" },
});
const limits = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(limits.error ?? \`Limits returned HTTP \${response.status}\`);
console.log(
  "Pay-in limits:",
  limits.minimumDepositMinor,
  limits.maximumPayinMinor,
  limits.currency,
);`,
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
echo "Pay-in limits: " . $limits["minimumDepositMinor"] . "–"
    . $limits["maximumPayinMinor"] . " " . $limits["currency"];`,
    Python: `import json
import os
from urllib.request import Request, urlopen

base_url = os.environ["SENDFLOW_API_BASE_URL"].rstrip("/")
request = Request(base_url + "/payment-limits", headers={"Accept": "application/json"})
with urlopen(request, timeout=10) as response:
    limits = json.load(response)

print(
    "Pay-in limits:",
    limits["minimumDepositMinor"],
    limits["maximumPayinMinor"],
    limits["currency"],
)`,
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
  'payout-quote': {
    'Node.js': `// Read-only quote; no payout is created and no funds are reserved.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
const secretKey = process.env.SENDFLOW_SECRET_KEY;
const operatorId = process.env.PAYOUT_OPERATOR_ID;
if (!apiBaseUrl || !secretKey || !operatorId) {
  throw new Error("Configure the SendFlow server key and payout operator ID");
}

const response = await fetch(apiBaseUrl.replace(/\\/$/, "") + "/v1/payout-quote", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + secretKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amountMinor: 12500,
    currency: "XOF",
    countryCode: "ci",
    operatorId,
    feePayer: "merchant",
  }),
});
const quote = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(quote.error ?? \`Quote returned HTTP \${response.status}\`);
console.log(quote);`,
    Python: `import os
import requests

api_base_url = os.environ["SENDFLOW_API_BASE_URL"].rstrip("/")
secret_key = os.environ["SENDFLOW_SECRET_KEY"]
operator_id = os.environ["PAYOUT_OPERATOR_ID"]
response = requests.post(
    api_base_url + "/v1/payout-quote",
    headers={"Authorization": f"Bearer {secret_key}"},
    json={
        "amountMinor": 12500,
        "currency": "XOF",
        "countryCode": "ci",
        "operatorId": operator_id,
        "feePayer": "merchant",
    },
    timeout=15,
)
response.raise_for_status()
print(response.json())`,
    cURL: `curl --request POST "$SENDFLOW_API_BASE_URL/v1/payout-quote" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY" \\
  --header "Content-Type: application/json" \\
  --data '{
    "amountMinor": 12500,
    "currency": "XOF",
    "countryCode": "ci",
    "operatorId": "'"$PAYOUT_OPERATOR_ID"'",
    "feePayer": "merchant"
  }'`,
    PHP: `$apiBaseUrl = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/");
$secretKey = getenv("SENDFLOW_SECRET_KEY");
$operatorId = getenv("PAYOUT_OPERATOR_ID");
if (!$apiBaseUrl || !$secretKey || !$operatorId) {
    throw new RuntimeException("Configure the SendFlow server key and payout operator ID");
}
$ch = curl_init($apiBaseUrl . "/v1/payout-quote");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer " . $secretKey,
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "amountMinor" => 12500,
        "currency" => "XOF",
        "countryCode" => "ci",
        "operatorId" => $operatorId,
        "feePayer" => "merchant",
    ], JSON_THROW_ON_ERROR),
]);
$body = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($body === false || $status < 200 || $status >= 300) {
    throw new RuntimeException("SendFlow quote failed: HTTP " . $status);
}
echo $body;`,
  },
  'payout-create': {
    'Node.js': `// A 503 is an unavailable response; verify the request status before retrying.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
const secretKey = process.env.SENDFLOW_SECRET_KEY;
const operatorId = process.env.PAYOUT_OPERATOR_ID;
const beneficiaryPhone = process.env.PAYOUT_BENEFICIARY_PHONE_E164;
const idempotencyKey = process.env.PAYOUT_IDEMPOTENCY_KEY;
if (!apiBaseUrl || !secretKey || !operatorId || !beneficiaryPhone || !idempotencyKey) {
  throw new Error("Configure the payout request values in your server environment");
}

const response = await fetch(apiBaseUrl.replace(/\\/$/, "") + "/v1/payouts", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + secretKey,
    "Idempotency-Key": idempotencyKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amountMinor: 12500,
    currency: "XOF",
    countryCode: "ci",
    operatorId,
    feePayer: "merchant",
    merchantReference: "ORDER-PAYOUT-2026-001",
    beneficiary: { phoneNumber: beneficiaryPhone },
  }),
});
const result = await response.json().catch(() => ({}));
if (response.status === 503) {
  console.log("Payout unavailable; verify server status before retrying.");
} else if (!response.ok) {
  throw new Error(result.error ?? \`Payout request returned HTTP \${response.status}\`);
} else {
  console.log(result);
}`,
    Python: `import os
import requests

api_base_url = os.environ["SENDFLOW_API_BASE_URL"].rstrip("/")
secret_key = os.environ["SENDFLOW_SECRET_KEY"]
operator_id = os.environ["PAYOUT_OPERATOR_ID"]
beneficiary_phone = os.environ["PAYOUT_BENEFICIARY_PHONE_E164"]
idempotency_key = os.environ["PAYOUT_IDEMPOTENCY_KEY"]
response = requests.post(
    api_base_url + "/v1/payouts",
    headers={
        "Authorization": f"Bearer {secret_key}",
        "Idempotency-Key": idempotency_key,
    },
    json={
        "amountMinor": 12500,
        "currency": "XOF",
        "countryCode": "ci",
        "operatorId": operator_id,
        "feePayer": "merchant",
        "merchantReference": "ORDER-PAYOUT-2026-001",
        "beneficiary": {"phoneNumber": beneficiary_phone},
    },
    timeout=15,
)
result = response.json()
if response.status_code == 503:
    print("Payout unavailable; verify server status before retrying.")
else:
    response.raise_for_status()
    print(result)`,
    cURL: `curl --request POST "$SENDFLOW_API_BASE_URL/v1/payouts" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY" \\
  --header "Idempotency-Key: $PAYOUT_IDEMPOTENCY_KEY" \\
  --header "Content-Type: application/json" \\
  --data-binary @- <<JSON
{
  "amountMinor": 12500,
  "currency": "XOF",
  "countryCode": "ci",
  "operatorId": "$PAYOUT_OPERATOR_ID",
  "feePayer": "merchant",
  "merchantReference": "ORDER-PAYOUT-2026-001",
  "beneficiary": {
    "phoneNumber": "$PAYOUT_BENEFICIARY_PHONE_E164"
  }
}
JSON`,
    PHP: `$apiBaseUrl = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/");
$secretKey = getenv("SENDFLOW_SECRET_KEY");
$operatorId = getenv("PAYOUT_OPERATOR_ID");
$beneficiaryPhone = getenv("PAYOUT_BENEFICIARY_PHONE_E164");
$idempotencyKey = getenv("PAYOUT_IDEMPOTENCY_KEY");
if (!$apiBaseUrl || !$secretKey || !$operatorId || !$beneficiaryPhone || !$idempotencyKey) {
    throw new RuntimeException("Configure payout request values in your server environment");
}
$ch = curl_init($apiBaseUrl . "/v1/payouts");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer " . $secretKey,
        "Idempotency-Key: " . $idempotencyKey,
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "amountMinor" => 12500,
        "currency" => "XOF",
        "countryCode" => "ci",
        "operatorId" => $operatorId,
        "feePayer" => "merchant",
        "merchantReference" => "ORDER-PAYOUT-2026-001",
        "beneficiary" => ["phoneNumber" => $beneficiaryPhone],
    ], JSON_THROW_ON_ERROR),
]);
$body = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$result = json_decode($body ?: "{}", true);
if ($status === 503) {
    echo "Payout unavailable; verify server status before retrying.";
} elseif ($body === false || $status < 200 || $status >= 300) {
    throw new RuntimeException("Payout request returned HTTP " . $status);
} else {
    echo $body;
}`,
  },
  'payout-list': {
    'Node.js': `const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
const secretKey = process.env.SENDFLOW_SECRET_KEY;
if (!apiBaseUrl || !secretKey) throw new Error("Configure the SendFlow server key");

const url = new URL(apiBaseUrl.replace(/\\/$/, "") + "/v1/payouts");
url.searchParams.set("limit", "25");
url.searchParams.set("status", "processing");
const response = await fetch(url, {
  headers: { Authorization: "Bearer " + secretKey },
});
const result = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(result.error ?? \`Payout list returned HTTP \${response.status}\`);
console.log(result.items, "nextCursor:", result.nextCursor);`,
    Python: `import os
import requests

response = requests.get(
    os.environ["SENDFLOW_API_BASE_URL"].rstrip("/") + "/v1/payouts",
    headers={"Authorization": f"Bearer {os.environ['SENDFLOW_SECRET_KEY']}"},
    params={"limit": 25, "status": "processing"},
    timeout=15,
)
response.raise_for_status()
result = response.json()
print(result["items"])
print("nextCursor:", result["nextCursor"])`,
    cURL: `curl --get "$SENDFLOW_API_BASE_URL/v1/payouts" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY" \\
  --data-urlencode "limit=25" \\
  --data-urlencode "status=processing"`,
    PHP: `$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/v1/payouts?limit=25&status=processing";
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("SENDFLOW_SECRET_KEY")],
]);
$body = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($body === false || $status < 200 || $status >= 300) {
    throw new RuntimeException("Payout list returned HTTP " . $status);
}
$result = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
print_r($result["items"]);
echo "nextCursor: " . ($result["nextCursor"] ?? "none");`,
  },
  'payout-read': {
    'Node.js': `const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
const secretKey = process.env.SENDFLOW_SECRET_KEY;
const payoutId = process.env.SENDFLOW_PAYOUT_ID;
if (!apiBaseUrl || !secretKey || !payoutId) throw new Error("Configure the payout ID and server key");

const response = await fetch(
  apiBaseUrl.replace(/\\/$/, "") + "/v1/payouts/" + encodeURIComponent(payoutId),
  { headers: { Authorization: "Bearer " + secretKey } },
);
const payout = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(payout.error ?? \`Payout read returned HTTP \${response.status}\`);
console.log(payout);`,
    Python: `import os
import requests

payout_id = os.environ["SENDFLOW_PAYOUT_ID"]
response = requests.get(
    os.environ["SENDFLOW_API_BASE_URL"].rstrip("/") + "/v1/payouts/" + payout_id,
    headers={"Authorization": f"Bearer {os.environ['SENDFLOW_SECRET_KEY']}"},
    timeout=15,
)
response.raise_for_status()
print(response.json())`,
    cURL: `curl --request GET "$SENDFLOW_API_BASE_URL/v1/payouts/$SENDFLOW_PAYOUT_ID" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY" \\
  --header "Accept: application/json"`,
    PHP: `$payoutId = getenv("SENDFLOW_PAYOUT_ID");
$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/v1/payouts/" . rawurlencode($payoutId);
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("SENDFLOW_SECRET_KEY")],
]);
$body = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($body === false || $status < 200 || $status >= 300) {
    throw new RuntimeException("Payout read returned HTTP " . $status);
}
echo $body;`,
  },
  'payout-cancel': {
    'Node.js': `const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
const secretKey = process.env.SENDFLOW_SECRET_KEY;
const payoutId = process.env.SENDFLOW_PAYOUT_ID;
if (!apiBaseUrl || !secretKey || !payoutId) throw new Error("Configure the payout ID and server key");

const response = await fetch(
  apiBaseUrl.replace(/\\/$/, "") + "/v1/payouts/" + encodeURIComponent(payoutId) + "/cancel",
  {
    method: "POST",
    headers: { Authorization: "Bearer " + secretKey },
  },
);
const result = await response.json().catch(() => ({}));
if (response.status === 409) {
  throw new Error("This payout can no longer be cancelled safely");
}
if (!response.ok) throw new Error(result.error ?? \`Payout cancel returned HTTP \${response.status}\`);
console.log(result);`,
    Python: `import os
import requests

payout_id = os.environ["SENDFLOW_PAYOUT_ID"]
response = requests.post(
    os.environ["SENDFLOW_API_BASE_URL"].rstrip("/") + "/v1/payouts/" + payout_id + "/cancel",
    headers={"Authorization": f"Bearer {os.environ['SENDFLOW_SECRET_KEY']}"},
    timeout=15,
)
if response.status_code == 409:
    raise RuntimeError("This payout can no longer be cancelled safely")
response.raise_for_status()
print(response.json())`,
    cURL: `curl --request POST "$SENDFLOW_API_BASE_URL/v1/payouts/$SENDFLOW_PAYOUT_ID/cancel" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY" \\
  --header "Accept: application/json"`,
    PHP: `$payoutId = getenv("SENDFLOW_PAYOUT_ID");
$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/v1/payouts/" . rawurlencode($payoutId) . "/cancel";
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("SENDFLOW_SECRET_KEY")],
]);
$body = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($status === 409) {
    throw new RuntimeException("This payout can no longer be cancelled safely");
}
if ($body === false || $status < 200 || $status >= 300) {
    throw new RuntimeException("Payout cancel returned HTTP " . $status);
}
echo $body;`,
  },
  webhook: {
    cURL: `# Local receiver test only. Never send this synthetic event to production.
# MERCHANT_WEBHOOK_RECEIVER_URL is your own webhook receiver URL.
timestamp=$(date +%s)
body='{"id":"9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644","type":"payment.succeeded","createdAt":"2026-01-01T12:00:00.000Z","data":{"sessionId":"00000000-0000-4000-8000-000000000001","merchantReference":"ORDER-2026-0042","attemptId":"00000000-0000-4000-8000-000000000002","transactionId":"00000000-0000-4000-8000-000000000003","amountMinor":12500,"currency":"XOF","status":"succeeded"}}'
signature=$(printf '%s' "$timestamp.$body" | openssl dgst -sha256 -hmac "$SEND_FLOW_WEBHOOK_SECRET" | awk '{print $NF}')
curl --request POST "$MERCHANT_WEBHOOK_RECEIVER_URL" \\
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

function addProductionUrlDefaults(code: string, example: DocsExampleId, format: DocsCodeFormat) {
  let result = code;
  const apiBaseUrl = productionUrls.apiBaseUrl;
  const checkoutOrigin = productionUrls.checkoutOrigin;

  if (format === 'cURL') {
    const shellConfig = [];
    if (result.includes('$SENDFLOW_API_BASE_URL')) {
      shellConfig.push(`SENDFLOW_API_BASE_URL="${apiBaseUrl}"`);
    }
    if (example === 'create-hosted') {
      shellConfig.push(`SENDFLOW_CHECKOUT_ORIGIN="${checkoutOrigin}"`);
    }
    if (shellConfig.length) result = `${shellConfig.join('\n')}\n${result}`;
    if (example === 'create-hosted') {
      result += '\n# Resolve the returned checkoutPath against "$SENDFLOW_CHECKOUT_ORIGIN" before redirecting.';
    }
  }

  if (format === 'JavaScript') {
    result = result.replaceAll('${env.SENDFLOW_API_BASE_URL}', apiBaseUrl);
    result = result.replaceAll(
      'env.SENDFLOW_CHECKOUT_ORIGIN',
      `"${checkoutOrigin}"`,
    );
    result = result.replace(/^if \(!checkoutOrigin\) throw new Error\([^\n]+\);\n/gm, '');
    result = result.replaceAll('${process.env.SENDFLOW_API_BASE_URL}', apiBaseUrl);
    result = result.replaceAll('process.env.SENDFLOW_API_BASE_URL', `"${apiBaseUrl}"`);
  }

  if (format === 'Node.js') {
    result = result.replaceAll('${process.env.SENDFLOW_API_BASE_URL}', apiBaseUrl);
    result = result.replaceAll(
      'process.env.SENDFLOW_API_BASE_URL',
      `process.env.SENDFLOW_API_BASE_URL || "${apiBaseUrl}"`,
    );
    result = result.replaceAll(
      'process.env.SENDFLOW_CHECKOUT_ORIGIN',
      `process.env.SENDFLOW_CHECKOUT_ORIGIN || "${checkoutOrigin}"`,
    );
    result = result.replace(/^if \(!apiBaseUrl\) throw new Error\([^\n]+\);\n/gm, '');
    result = result.replace(/^if \(!checkoutOrigin\) throw new Error\([^\n]+\);\n/gm, '');
    result = result.replaceAll('!apiBaseUrl || ', '');
  }

  if (format === 'PHP') {
    result = result.replaceAll(
      'getenv("SENDFLOW_API_BASE_URL")',
      `getenv("SENDFLOW_API_BASE_URL") ?: "${apiBaseUrl}"`,
    );
    result = result.replaceAll(
      'getenv("SENDFLOW_CHECKOUT_ORIGIN")',
      `getenv("SENDFLOW_CHECKOUT_ORIGIN") ?: "${checkoutOrigin}"`,
    );
    result = result.replace(
      /\nif \(!\$checkoutOrigin\) \{\n\s+throw new RuntimeException\("Set the official SendFlow checkout origin first"\);\n\}/,
      '',
    );
  }

  if (format === 'Python') {
    const usesApiBaseUrl = result.includes('SENDFLOW_API_BASE_URL');
    result = result.replaceAll(
      'os.environ["SENDFLOW_API_BASE_URL"]',
      'API_BASE_URL',
    );
    result = result.replaceAll(
      "os.environ['SENDFLOW_API_BASE_URL']",
      'API_BASE_URL',
    );
    result = result.replaceAll(
      'os.environ.get("SENDFLOW_CHECKOUT_ORIGIN")',
      'CHECKOUT_ORIGIN',
    );
    result = result.replace(
      /\nif not checkout_origin:\n\s+raise RuntimeError\("Set the official SendFlow checkout origin first"\)/,
      '',
    );
    if (usesApiBaseUrl || example === 'create-hosted') {
      const lines = result.split('\n');
      let importEnd = 0;
      let hasOsImport = false;
      while (importEnd < lines.length) {
        const line = lines[importEnd].trim();
        if (!line || line.startsWith('#') || line.startsWith('import ') || line.startsWith('from ')) {
          if (line === 'import os') hasOsImport = true;
          importEnd += 1;
          continue;
        }
        break;
      }
      if (!hasOsImport) {
        lines.splice(importEnd, 0, 'import os');
        importEnd += 1;
      }
      const pythonConfig = [
        `API_BASE_URL = os.environ.get("SENDFLOW_API_BASE_URL", "${apiBaseUrl}").rstrip("/")`,
        ...(example === 'create-hosted'
          ? [`CHECKOUT_ORIGIN = os.environ.get("SENDFLOW_CHECKOUT_ORIGIN", "${checkoutOrigin}")`]
          : []),
      ];
      lines.splice(importEnd, 0, '', ...pythonConfig, '');
      result = lines.join('\n');
    }
  }

  if (format === 'Kotlin') {
    result = result.replaceAll('${BuildConfig.SENDFLOW_API_BASE_URL}', apiBaseUrl);
    result = result.replaceAll(
      'apiBaseUrl: String,',
      `apiBaseUrl: String = "${apiBaseUrl}",`,
    );
  }

  return result;
}

export function getDocsCodeExample(example: DocsExampleId, format: DocsCodeFormat, amountMinor = 12_500) {
  const rawCode = examples[example][format];
  if (!rawCode) throw new Error(`No ${format} example is available for ${example}`);
  const code = addProductionUrlDefaults(rawCode, example, format);
  if (example === 'create-hosted' || example === 'create-direct') {
    return code.replaceAll('12500', String(amountMinor));
  }
  return code;
}

export function getDocsCodeFormats(example: DocsExampleId): DocsCodeFormat[] {
  return Object.keys(examples[example]) as DocsCodeFormat[];
}
