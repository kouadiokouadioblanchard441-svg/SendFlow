import{c as q,u as ue,r as g,b8 as pe,f as me,j as e,b9 as he,X as F,L as h}from"./index-kQNeZlQr.js";import{s as X}from"./chunk-C_5aVmjj.js";import{s as J}from"./chunk-IIVr9JQU.js";import{u as U}from"./chunk-BlHX8ANb.js";import{C as D}from"./chunk-Dhza7Plt.js";import{W as E}from"./chunk-CGB0OhHp.js";import{S as u}from"./chunk-C0D_XseC.js";import{A}from"./chunk-C4orHbF5.js";import{L as fe}from"./chunk-poUxss5c.js";import{E as Z}from"./chunk-DQyXTdiv.js";import{M as G}from"./chunk-BseSOTI2.js";import{S as V}from"./chunk-CV4TDWyS.js";import{C as P}from"./chunk-c8AlMRMl.js";import{C as Q}from"./chunk-CzqKvLzW.js";import{C as ee}from"./chunk-DEuS7a-E.js";const ye=[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]],$=q("book-open",ye);const be=[["path",{d:"M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4",key:"1pf5j1"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"m5 12-3 3 3 3",key:"oke12k"}],["path",{d:"m9 18 3-3-3-3",key:"112psh"}]],T=q("file-code-2",be);const ve=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m4.93 4.93 4.24 4.24",key:"1ymg45"}],["path",{d:"m14.83 9.17 4.24-4.24",key:"1cb5xl"}],["path",{d:"m14.83 14.83 4.24 4.24",key:"q42g0n"}],["path",{d:"m9.17 14.83-4.24 4.24",key:"bqpfvv"}],["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}]],I=q("life-buoy",ve),xe="/assets/docs-api-integration-3d-5uJTV2FA.webp",ge="/assets/docs-hosted-checkout-3d-3aidseFi.webp",te={"create-hosted":{cURL:`curl --request POST "$SENDFLOW_API_BASE_URL/v1/payment-sessions" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY" \\
  --header "Idempotency-Key: order-2026-0042" \\
  --header "Content-Type: application/json" \\
  --data '{
    "merchantReference": "ORDER-2026-0042",
    "amountMinor": 12500,
    "currency": "XOF",
    "mode": "hosted",
    "returnUrl": "https://shop.example.com/payment/return"
  }'`,JavaScript:`import { env } from "node:process";

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
// Return checkoutUrl to your client, then redirect the customer's browser.`,"Node.js":`// Node.js 18+; run on your merchant server, never in a browser.
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
// Return checkoutUrl to your client and redirect the payer's browser.`,PHP:`$body = [
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
// Return $checkoutUrl to your client, then redirect the customer's browser.`,Python:`import os
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
# Return checkout_url to your client, then redirect the customer's browser.`},"create-direct":{cURL:`curl --request POST "$SENDFLOW_API_BASE_URL/v1/payment-sessions" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY" \\
  --header "Idempotency-Key: order-2026-0043" \\
  --header "Content-Type: application/json" \\
  --data '{
    "merchantReference": "ORDER-2026-0043",
    "amountMinor": 12500,
    "currency": "XOF",
    "mode": "direct"
  }'`,JavaScript:`import { env } from "node:process";

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
// Never send SENDFLOW_SECRET_KEY to a browser or mobile app.`,"Node.js":`// Node.js 18+; keep the secret key in server-side environment variables.
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
// Never expose the secretKey.`,PHP:`$body = [
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
$session = json_decode($response, true, flags: JSON_THROW_ON_ERROR);`,Python:`import os
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
session = response.json()`},"read-session":{cURL:`curl "$SENDFLOW_API_BASE_URL/v1/payment-sessions/$SESSION_ID" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY"`,JavaScript:`import { env } from "node:process";

const response = await fetch(
  \`\${env.SENDFLOW_API_BASE_URL}/v1/payment-sessions/\${sessionId}\`,
  { headers: { Authorization: \`Bearer \${env.SENDFLOW_SECRET_KEY}\` } },
);
const session = await response.json();
if (!response.ok) throw new Error(session.error ?? "SendFlow request failed");
// Confirm the order only when session.state === "succeeded".`,"Node.js":`// Merchant-server status check; sessionId comes from your stored creation response.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
const secretKey = process.env.SENDFLOW_SECRET_KEY;
if (!apiBaseUrl || !secretKey) throw new Error("Configure SendFlow server environment variables");

const response = await fetch(
  apiBaseUrl.replace(/\\/$/, "") + "/v1/payment-sessions/" + encodeURIComponent(sessionId),
  { headers: { Authorization: "Bearer " + secretKey } },
);
const session = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(session.error ?? \`SendFlow returned HTTP \${response.status}\`);
// Confirm the order only when the server returns state === "succeeded".`,PHP:`$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/v1/payment-sessions/" . rawurlencode($sessionId);
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("SENDFLOW_SECRET_KEY")],
]);
$response = curl_exec($ch);
if ($response === false || curl_getinfo($ch, CURLINFO_RESPONSE_CODE) >= 400) {
    throw new RuntimeException("SendFlow status could not be read");
}
$session = json_decode($response, true, flags: JSON_THROW_ON_ERROR);`,Python:`import os
import requests

response = requests.get(
    f"{os.environ['SENDFLOW_API_BASE_URL']}/v1/payment-sessions/{session_id}",
    headers={"Authorization": f"Bearer {os.environ['SENDFLOW_SECRET_KEY']}"},
    timeout=15,
)
response.raise_for_status()
session = response.json()
# Confirm the order only when session["state"] == "succeeded".`},"read-public-session":{cURL:`curl "$SENDFLOW_API_BASE_URL/v1/public/payment-sessions/$SESSION_ID" \\
  --header "X-SendFlow-Public-Key: $SENDFLOW_PUBLIC_KEY" \\
  --header "X-SendFlow-Client-Token: $SENDFLOW_CLIENT_TOKEN"`,JavaScript:`const apiBaseUrl = "https://merchent.business.sendflow.africa/api";
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
// Use checkout.countries to show the currently available countries/operators.`,"Node.js":`// session comes from your server-side create-direct request.
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
// Use checkout.countries to render the currently available payment choices.`,PHP:`$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/v1/public/payment-sessions/" . rawurlencode($sessionId);
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
$checkout = json_decode($response, true, flags: JSON_THROW_ON_ERROR);`,Python:`import os
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
# Use checkout["countries"] to display available payment choices.`,Kotlin:`import java.io.IOException
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
}`},"start-attempt":{cURL:`curl --request POST "$SENDFLOW_API_BASE_URL/v1/public/payment-sessions/$SESSION_ID/attempts" \\
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
  }'`,JavaScript:`const apiBaseUrl = "https://merchent.business.sendflow.africa/api";
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
// Keep attempt.pollToken in your server-side session where possible.`,"Node.js":`// Use the public key and client token returned with the direct session.
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
// Keep attempt.pollToken private; this response is not proof of payment.`,PHP:`$body = [
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
$attempt = json_decode($response, true, flags: JSON_THROW_ON_ERROR);`,Python:`import os
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
attempt = response.json()`,Kotlin:`import java.io.IOException
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
}`},"poll-attempt":{cURL:`curl "$SENDFLOW_API_BASE_URL/v1/public/payment-sessions/$SESSION_ID/attempts/$ATTEMPT_ID" \\
  --header "X-SendFlow-Public-Key: $SENDFLOW_PUBLIC_KEY" \\
  --header "X-SendFlow-Client-Token: $SENDFLOW_CLIENT_TOKEN" \\
  --header "X-LinkFlow-Attempt-Token: $SENDFLOW_POLL_TOKEN"`,JavaScript:`const apiBaseUrl = "https://merchent.business.sendflow.africa/api";
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
// Treat only the server-confirmed "succeeded" state as a paid order.`,"Node.js":`// session and attempt are responses from the previous direct-flow steps.
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
// Trust only the server-confirmed "succeeded" state.`,PHP:`$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/v1/public/payment-sessions/" . rawurlencode($sessionId) . "/attempts/" . rawurlencode($attemptId);
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
$status = json_decode($response, true, flags: JSON_THROW_ON_ERROR);`,Python:`import os
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
# Trust only the server-confirmed "succeeded" state.`,Kotlin:`import java.io.IOException
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
}`},"handle-http-errors":{cURL:`curl --include --silent --show-error \\
  "$SENDFLOW_API_BASE_URL/v1/payment-sessions/$SESSION_ID" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY"
# Inspect the HTTP status, Retry-After, and JSON { "error": "..." } body.
# A 503 does not prove success or final failure; verify status server-side.`,JavaScript:`const response = await fetch(
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
}`,"Node.js":`// Read the real HTTP status and { error: string } response body.
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
}`,PHP:`$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/v1/payment-sessions/" . rawurlencode($sessionId);
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
}`,Python:`import os
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
session = response.json()`},pricing:{cURL:'curl "$SENDFLOW_API_BASE_URL/pricing"',JavaScript:`import { env } from "node:process";

const response = await fetch(\`\${env.SENDFLOW_API_BASE_URL}/pricing\`);
if (!response.ok) throw new Error("Pricing catalog unavailable");
const catalog = await response.json();
const linkFlowOperators = catalog.operators.filter(
  (operator) => operator.fees.linkflow !== undefined,
);`,"Node.js":`// Public pricing catalog; no merchant key is required.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
if (!apiBaseUrl) throw new Error("Configure SENDFLOW_API_BASE_URL");
const response = await fetch(apiBaseUrl.replace(/\\/$/, "") + "/pricing");
const catalog = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(catalog.error ?? "Pricing catalog unavailable");
const linkFlowOperators = catalog.operators.filter(
  (operator) => operator.fees.linkflow !== undefined,
);`,PHP:`$ch = curl_init(rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/pricing");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
if ($response === false || curl_getinfo($ch, CURLINFO_RESPONSE_CODE) >= 400) {
    throw new RuntimeException("Pricing catalog unavailable");
}
$catalog = json_decode($response, true, flags: JSON_THROW_ON_ERROR);`,Python:`import os
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
]`},"payment-limits":{cURL:`curl --request GET "$SENDFLOW_API_BASE_URL/payment-limits" \\
  --header "Accept: application/json"`,JavaScript:`const response = await fetch(
  \`\${process.env.SENDFLOW_API_BASE_URL}/payment-limits\`,
  { headers: { Accept: "application/json" } },
);
if (!response.ok) throw new Error(\`SendFlow limits returned HTTP \${response.status}\`);
const limits = await response.json();
console.log("Minimum pay-in:", limits.minimumDepositMinor, limits.currency);
console.log("Minimum payout rule:", limits.minimumPayoutMinor, limits.currency);`,"Node.js":`// Public read; the server still enforces configured limits on every payment.
const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
if (!apiBaseUrl) throw new Error("Configure SENDFLOW_API_BASE_URL");
const response = await fetch(apiBaseUrl.replace(/\\/$/, "") + "/payment-limits", {
  headers: { Accept: "application/json" },
});
const limits = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(limits.error ?? \`Limits returned HTTP \${response.status}\`);
console.log("Minimum pay-in:", limits.minimumDepositMinor, limits.currency);
console.log("Minimum payout rule:", limits.minimumPayoutMinor, limits.currency);`,PHP:`$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/payment-limits";
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
$limits = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
echo $limits["minimumDepositMinor"] . " " . $limits["currency"];`,Python:`import json
import os
from urllib.request import Request, urlopen

base_url = os.environ["SENDFLOW_API_BASE_URL"].rstrip("/")
request = Request(base_url + "/payment-limits", headers={"Accept": "application/json"})
with urlopen(request, timeout=10) as response:
    limits = json.load(response)

print("Minimum pay-in:", limits["minimumDepositMinor"], limits["currency"])
print("Minimum payout rule:", limits["minimumPayoutMinor"], limits["currency"])`,Kotlin:`val url = URL("\${BuildConfig.SENDFLOW_API_BASE_URL}/payment-limits")
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
}`},webhook:{cURL:`# Local receiver test only. Never send this synthetic event to production.
timestamp=$(date +%s)
body='{"id":"9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644","type":"payment.succeeded","createdAt":"2026-01-01T12:00:00.000Z","data":{"sessionId":"00000000-0000-4000-8000-000000000001","merchantReference":"ORDER-2026-0042","attemptId":"00000000-0000-4000-8000-000000000002","transactionId":"00000000-0000-4000-8000-000000000003","amountMinor":12500,"currency":"XOF","status":"succeeded"}}'
signature=$(printf '%s' "$timestamp.$body" | openssl dgst -sha256 -hmac "$SEND_FLOW_WEBHOOK_SECRET" | awk '{print $NF}')
curl --request POST "http://127.0.0.1:3000/webhooks/sendflow" \\
  --header "Content-Type: application/json" \\
  --header "sendflow-event: payment.succeeded" \\
  --header "sendflow-delivery: 9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644" \\
  --header "sendflow-signature: t=$timestamp,v1=$signature" \\
  --data-binary "$body"`,JavaScript:`import { createHmac, timingSafeEqual } from "node:crypto";

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
// Verify the raw request bytes before parsing JSON; use a replay time limit.`,"Node.js":`import { createHmac, timingSafeEqual } from "node:crypto";

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
}`,PHP:`$rawBody = file_get_contents("php://input");
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
// Verify the timestamp freshness before processing the event.`,Python:`import hashlib
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

# Verify the raw request bytes and timestamp freshness before processing.`}};function we(i,r,c=12500){const o=te[i][r];if(!o)throw new Error(`No ${r} example is available for ${i}`);return i==="create-hosted"||i==="create-direct"?o.replaceAll("12500",String(c)):o}function Se(i){return Object.keys(te[i])}const O=[{path:"/docs",key:"home",label:"Documentation",group:"start",icon:$},{path:"/docs/getting-started",key:"start",label:"Getting started",group:"start",icon:A},{path:"/docs/authentication",key:"auth",label:"Authentication",group:"start",icon:fe},{path:"/docs/integrations/direct",key:"direct",label:"Direct API",group:"integration",icon:D},{path:"/docs/integrations/hosted",key:"hosted",label:"Hosted Checkout",group:"integration",icon:Z},{path:"/docs/api-reference",key:"api",label:"API reference",group:"apiReference",icon:T},{path:"/docs/api-reference",section:"create-session",key:"endpointCreate",label:"Create a session",group:"apiReference",icon:T,search:"merchantReference amountMinor currency mode description returnUrl metadata idempotency"},{path:"/docs/api-reference",section:"read-session",key:"endpointRead",label:"Read a session",group:"apiReference",icon:T,search:"sessionId state status Authorization Bearer"},{path:"/docs/api-reference",section:"direct-choices",key:"endpointChoices",label:"Direct checkout choices",group:"apiReference",icon:T,search:"countries operators phonePrefix countryCode publicKey clientToken"},{path:"/docs/api-reference",section:"create-attempt",key:"endpointAttempt",label:"Start a payment attempt",group:"apiReference",icon:T,search:"firstName lastName countryCode operatorId phoneNumber ussdCode otp pin"},{path:"/docs/api-reference",section:"read-attempt",key:"endpointAttemptRead",label:"Read attempt status",group:"apiReference",icon:T,search:"attemptId pollToken state status"},{path:"/docs/api-reference",section:"pricing-catalog",key:"endpointPricing",label:"Countries, operators & fees",group:"apiReference",icon:T,search:"countries operators fees requiresOtp otpCommand"},{path:"/docs/api-reference",section:"payment-limits",key:"endpointLimits",label:"Payment limits",group:"apiReference",icon:T,search:"limits minimum deposit payout payin XOF maximum"},{path:"/docs/api-reference",section:"payout-api",key:"endpointPayout",label:"Payout API availability",group:"apiReference",icon:T,search:"payout withdrawal merchant API not available"},{path:"/docs/webhooks",key:"webhooks",label:"Webhooks",group:"shared",icon:E},{path:"/docs/webhooks",section:"webhook-events",key:"webhookEvents",label:"Webhook events",group:"shared",icon:E,search:"payment.succeeded payment.failed events notifications"},{path:"/docs/webhooks",section:"webhook-signature",key:"delivery",label:"Webhook signatures",group:"shared",icon:E,search:"HMAC SHA-256 raw body sendflow-signature"},{path:"/docs/webhooks",section:"webhook-retries",key:"webhookRetries",label:"Retries & deduplication",group:"shared",icon:E,search:"retries delivery deduplicate timeout attempts"},{path:"/docs/reference",key:"reference",label:"Errors & security",group:"reference",icon:u},{path:"/docs/reference",section:"payment-states",key:"statesTitle",label:"Payment states",group:"reference",icon:u,search:"created waiting uncertain succeeded failed"},{path:"/docs/reference",section:"http-errors",key:"errors",label:"HTTP errors",group:"reference",icon:u,search:"400 401 403 404 409 429 503 Retry-After error message troubleshooting"},{path:"/docs/reference",section:"idempotency",key:"idempotency",label:"Idempotency",group:"reference",icon:u,search:"Idempotency-Key duplicate merchantReference retry"},{path:"/docs/reference",section:"expiration",key:"expiration",label:"Expiration & amounts",group:"reference",icon:u,search:"expiresAt one hour XOF amountMinor minimum maximum"},{path:"/docs/reference",section:"rate-limits",key:"rateLimits",label:"Rate limits",group:"reference",icon:u,search:"quota 429 Retry-After per minute"},{path:"/docs/reference",section:"service-availability",key:"serviceAvailability",label:"Service availability",group:"reference",icon:u,search:"503 LINKFLOW_SETTLEMENT_PROOF_READY production base URL"},{path:"/docs/reference",section:"security",key:"security",label:"Security",group:"reference",icon:u,search:"secret public key HMAC HTTPS tokens"}],N=[{id:"start",labelKey:"startGroup",icon:$},{id:"integration",labelKey:"integrations",icon:D},{id:"shared",labelKey:"sharedMethods",icon:E},{id:"apiReference",labelKey:"apiReferenceGroup",icon:T},{id:"reference",labelKey:"reference",icon:u}],L={fr:{navDocs:"Documentation",navGuides:"Guides",navApi:"Référence API",navWebhooks:"Webhooks",search:"Rechercher dans la documentation…",menuClose:"Fermer le menu",startGroup:"Démarrer",sectionPageIntro:"Cette rubrique détaille le contrat SendFlow correspondant. Les exemples restent illustratifs et les blocages de disponibilité sont signalés.",integrations:"Méthodes d’intégration",sharedMethods:"Commun aux deux",apiReferenceGroup:"Référence API",reference:"Référence",resources:"Ressources",noResults:"Aucun document ne correspond à cette recherche.",webhookRetries:"Relances et déduplication",home:"Documentation",start:"Bien démarrer",auth:"Authentification",direct:"API directe",hosted:"Paiement hébergé",api:"Référence API",webhooks:"Webhooks",ref:"Erreurs et sécurité",badge:"API REST · JSON",prod:"Documentation API SendFlow",homeTitle:"Intégrez SendFlow à votre plateforme",homeSub:"Découvrez les outils et les API nécessaires pour accepter les paiements avec SendFlow.",startTitle:"Bien démarrer",startSub:"Préparez vos accès, choisissez votre parcours et vérifiez chaque paiement depuis votre serveur.",authTitle:"Authentification",authSub:"Utilisez la clé secrète pour les appels serveur et la clé publique uniquement dans le parcours de caisse.",directTitle:"Intégration API directe",directSub:"Créez une session côté serveur, affichez les choix disponibles, puis suivez le statut confirmé par SendFlow.",hostedTitle:"Paiement par redirection",hostedSub:"Créez une session hébergée et redirigez le payeur vers le chemin de paiement SendFlow retourné par l’API.",apiTitle:"Référence API",apiSub:"Endpoints REST disponibles, paramètres, authentification, limites et réponses du contrat SendFlow.",webhooksTitle:"Webhooks",webhooksSub:"Configurez les notifications de paiement, vérifiez leur signature et traitez les livraisons répétées sans doublon.",refTitle:"Erreurs, idempotence et sécurité",refSub:"Réponses HTTP, durées, plafonds de requêtes et règles essentielles pour intégrer les paiements de façon fiable.",breadcrumb:"Documentation API",methods:"Choisissez votre méthode",methodsSub:"Les deux parcours utilisent des sessions SendFlow et la même confirmation serveur du paiement.",directCard:"API directe",directCardSub:"Votre serveur contrôle le parcours et orchestre l’expérience dans votre application.",hostedCard:"Paiement hébergé",hostedCardSub:"Votre serveur crée la session, puis redirige le client vers SendFlow sur payin.merchant.command.sendflow.africa.",methodLevel:"Niveau",methodControl:"Contrôle du parcours",methodIntegration:"Intégration",methodAuth:"Authentification",methodReturn:"Retour du paiement",developerLevel:"Développeur",simpleLevel:"Simple",highControl:"Élevé",hostedControl:"Limité à la page hébergée",restApi:"API REST",sessionRedirect:"Création de session puis redirection",authContract:"Clé secrète côté serveur",returnToConfirm:"Retour navigateur non probant",directGuide:"Voir le guide API directe",hostedGuide:"Voir le guide de redirection",capabilitiesTitle:"Ce que l’intégration SendFlow prévoit",capabilitySession:"Créer une session de paiement depuis votre serveur marchand.",capabilityCheckout:"Présenter un parcours hébergé SendFlow au payeur.",capabilityStatus:"Consulter le statut d’une session et d’une tentative.",capabilityWebhook:"Recevoir les notifications de paiement réussi ou échoué par webhook.",baseUrlTitle:"URL de base API",baseUrlPending:"En production, configurez SENDFLOW_API_BASE_URL=https://merchent.business.sendflow.africa/api : le domaine de l’application expose l’API sous /api. Le site principal est https://sendflow.africa, la documentation https://apis.docs.sendflow.africa et le paiement hébergé https://payin.merchant.command.sendflow.africa ; ces trois domaines ne remplacent pas l’origine API. Dans l’aperçu Replit, utilisez l’hôte temporaire de l’aperçu suivi de /api.",threeSteps:"En 3 étapes",stepOne:"Créez votre compte marchand",stepOneSub:"Un compte marchand actif et éligible est requis pour utiliser les paiements API.",stepTwo:"Configurez vos clés API",stepTwoSub:"Créez ou régénérez votre paire dans l’espace Développeurs ; la clé secrète ne s’affiche qu’à sa création.",stepThree:"Intégrez SendFlow à votre application",stepThreeSub:"Créez la session côté serveur et vérifiez le résultat auprès de SendFlow.",read:"Lire le guide",support:"Besoin d’aide ?",supportSub:"Contactez l’équipe SendFlow pour toute question liée à votre intégration.",contact:"Contacter le support",disclaimerTitle:"Confirmation du paiement",disclaimer:"Ne marquez jamais une commande comme payée sur la seule base d’une redirection ou d’un état affiché dans le navigateur. Vérifiez le statut serveur ou traitez un webhook dont la signature est valide.",whatIs:"Fonctionnement",whatIsText:"SendFlow crée une session de paiement fixe en XOF, renvoie les informations nécessaires au parcours choisi, puis expose un statut de paiement vérifié côté serveur.",prerequisites:"Prérequis",noCredentials:"Ne placez jamais la clé secrète dans le navigateur, une application mobile distribuée, un dépôt public ou des journaux.",notDocumented:"Gestion des clés API",notDocumentedText:"Créez ou régénérez la paire de clés dans l’espace Développeurs ; elle n’est pas créée automatiquement à l’ouverture du compte. Une nouvelle paire révoque l’ancienne. La clé secrète est réservée aux appels serveur ; la clé publique sert aux appels de caisse prévus par le parcours direct.",rotationText:"La clé secrète complète est affichée lors de sa création. Enregistrez-la dans un gestionnaire de secrets. La régénération désactive immédiatement l’ancienne paire de clés.",serverOnly:"Envoyez la clé secrète dans l’en-tête Authorization: Bearer depuis votre serveur. Ne la transmettez jamais au client.",credentialRolesTitle:"Rôle et emplacement de chaque identifiant",credentialHeader:"Identifiant",credentialUseHeader:"Utilisation",credentialHandlingHeader:"Protection",pollTokenNote:"Le pollToken est un identifiant d’accès à la tentative. Préférez interroger l’état depuis votre serveur avec la clé secrète ; si le client doit le recevoir pour afficher la progression, gardez-le temporairement en mémoire et excluez-le des journaux, URL et outils analytiques.",codeLabel:"Exemple de requête",placeholder:"Requête API",codeNote:"Extrait à intégrer à votre serveur ou à votre caisse : utilisez https://merchent.business.sendflow.africa/api comme SENDFLOW_API_BASE_URL en production. Remplacez les variables d’environnement et identifiants d’exemple par ceux de votre compte. Les clés et jetons affichés sont fictifs ; gardez la clé secrète côté serveur.",model:"Parcours de paiement",modelTextDirect:"Créez la session avec mode direct depuis votre serveur. Le client lit ensuite la session publique, affiche les pays et opérateurs disponibles, lance une tentative pour le montant fixe, puis suit le statut.",modelTextHosted:"Créez la session avec mode hosted depuis votre serveur. L’API renvoie checkoutPath ; combinez-le avec https://payin.merchant.command.sendflow.africa et redirigez le client.",apiAvailabilityTitle:"Disponibilité actuelle",apiAvailabilityText:"Dans le code inspecté, la création d’une session et le démarrage d’une tentative renvoient HTTP 503 lorsque le contrôle technique de preuve de règlement est fermé (LINKFLOW_SETTLEMENT_PROOF_READY=false). L’URL API documentée en production est https://merchent.business.sendflow.africa/api, mais ce code ne prouve pas que le domaine et le proxy Plesk sont actuellement joignables ou configurés. Les exemples décrivent le contrat, pas une activation en production ; 503 ne confirme ni un succès ni un échec final. Voir « Disponibilité du service ».",hostedOriginText:"checkoutPath reste un chemin relatif pour préserver le contrat API. Pour un paiement hébergé ou un lien LinkFlow en production, utilisez l’origine https://payin.merchant.command.sendflow.africa ; configurez SENDFLOW_CHECKOUT_ORIGIN avec cette valeur côté serveur marchand. Dans l’aperçu Replit, utilisez l’origine de l’aperçu.",hostedFallbackText:"Après une confirmation succeeded, la page redirige vers returnUrl si elle a été fournie ; sinon, le code actuel utilise https://sendflow.africa. La page ne redirige pas vers returnUrl après un échec confirmé. Une redirection reste une indication d’interface, jamais une preuve de paiement.",webhookSharedNote:"Les webhooks s’appliquent aux deux parcours, API directe et Hosted Checkout. Ils sont envoyés après un résultat final confirmé ; consultez le guide Webhooks pour vérifier la signature et dédupliquer les livraisons.",webhookGuideLink:"Ouvrir le guide Webhooks",mobileMoneyTitle:"Mobile Money, USSD et OTP",mobileMoneyText:"Les codes USSD et étapes OTP ne sont publiés que s’ils sont confirmés par une source officielle et applicables au parcours SendFlow. Aucun parcours OTP actuellement accepté par le contrat ne peut être documenté comme opérationnel : le corps de création de tentative n’accepte aucun OTP ni PIN et le service commun API directe/Hosted Checkout rejette les canaux marqués requiresOtp. Ne demandez jamais au payeur de transmettre son OTP ou son PIN à votre serveur. Pour un canal effectivement proposé, affichez uniquement le ussdCode renvoyé par l’API (il peut être null) et les choix retournés pour cette session. /api/pricing expose requiresOtp et otpCommand comme métadonnées, pas comme preuve de prise en charge.",mobileMoneyActorsTitle:"Qui fait quoi dans le parcours Mobile Money ?",mobileMoneyCountryTitle:"État documenté par pays et opérateur",androidDirectNote:"L’exemple Kotlin ci-dessous utilise les routes publiques de session directe depuis Android. Il s’agit d’un exemple REST, pas d’un SDK officiel ; il suppose kotlinx-coroutines-android. Créez la session sur votre serveur et transmettez seulement la clé publique et les jetons de session nécessaires.",directInputText:"Attention au format : la session peut renvoyer un code pays en minuscules (par exemple ci), mais la création de tentative exige deux lettres majuscules (CI). Convertissez-le en majuscules. phoneNumber doit inclure l’indicatif international renvoyé par la session (par exemple +225 suivi du numéro national). Utilisez operatorId directement depuis la réponse de session.",directCorsNote:"Les routes /api/v1/public/* ont leur propre configuration CORS : les appels navigateur sont autorisés sans cookies, en GET/POST/OPTIONS, avec Content-Type, X-SendFlow-Public-Key, X-SendFlow-Client-Token, X-LinkFlow-Attempt-Token et Idempotency-Key. La création et la lecture privée d’une session avec Authorization: Bearer restent côté serveur. N’exposez jamais la clé secrète dans le navigateur.",hostedTimerText:"La page hébergée affiche un compte à rebours d’attente de 10 minutes. Son expiration peut afficher une vue d’échec au payeur, mais le suivi serveur continue et une confirmation finale reçue ensuite prévaut. Le compte à rebours n’est pas un statut de paiement : vérifiez l’état serveur ou un webhook signé et traitez uncertain comme non final.",responsibilities:"Règles d’intégration",endpointStatus:"API REST · JSON",endpointCreate:"Créer une session de paiement",endpointRead:"Consulter une session et son état",endpointChoices:"Lire la session publique et les choix disponibles (mode direct)",endpointAttempt:"Créer une tentative de paiement directe",endpointAttemptRead:"Consulter le statut d’une tentative",accessServerSecret:"Serveur marchand · clé secrète et clé d’idempotence",accessServerSecretRead:"Serveur marchand · clé secrète",accessPublicSession:"Caisse · clé publique et jeton de session",accessPublicAttempt:"Caisse · clé publique, jeton de session et clé d’idempotence",accessAttemptRead:"Caisse · clés publique et de session, jeton de tentative",endpointPricing:"Consulter les pays, opérateurs et frais publics",accessPublic:"Public · aucune clé requise",endpointAccess:"Authentification",availableChoicesNote:"GET /api/pricing renvoie le catalogue public et les taux configurés, mais ne constitue pas un devis de frais ou de règlement par session et ne garantit pas qu’un opérateur puisse traiter un paiement API. Les réponses de session n’exposent pas le montant net marchand. Les choix de la session directe sont filtrés selon le routage et les règles actuellement pris en charge ; utilisez-les comme source de vérité.",referenceIntro:"Les exemples ci-dessous correspondent aux routes et schémas présents dans l’API SendFlow.",requestExample:"Exemple de requête",responseExample:"Exemple de réponse",webhookEvents:"Événements de paiement",webhookEventsSub:"Les webhooks sont communs aux parcours API directe et Hosted Checkout pour les sessions créées par l’API. Configurez une URL HTTPS publique et les événements dans l’espace Développeurs ; aucun endpoint public de gestion de webhooks n’est documenté. Les événements ne sont émis qu’après confirmation finale. Jusqu’à 5 webhooks actifs peuvent être configurés pour un compte.",webhookPayloadNote:"Le payload fournit des identifiants de session, tentative et transaction, la référence marchande, le montant, la devise et le statut. Son champ id est le même UUID que l’en-tête sendflow-delivery et reste stable lors des reprises. La référence marchande vient de votre requête : n’y placez pas de données personnelles.",eventNames:"Événements disponibles",delivery:"Signature et livraisons",deliveryText:"La signature HMAC-SHA256 est calculée sur la chaîne <horodatage>.<corps JSON brut>. Répondez en HTTP 2xx pour acquitter la livraison ; toute réponse non-2xx, erreur réseau ou expiration du délai sera retentée. Le délai de requête est de 8 secondes et le corps de réponse est limité à 8 Ko. SendFlow effectue 8 tentatives au total au maximum : l’envoi initial puis jusqu’à 7 reprises, espacées de 10 s, 30 s, 2 min, 10 min, 30 min, 2 h et 12 h. L’identifiant sendflow-delivery reste stable entre les reprises : utilisez-le pour dédupliquer.",webhookHeadersTitle:"En-têtes envoyés",webhookHeadersText:"sendflow-event identifie le type d’événement. sendflow-delivery contient le même UUID que payload.id et reste identique lors des reprises. sendflow-signature suit le format t=<horodatage Unix>,v1=<signature hexadécimale>. La signature est calculée sur les octets exacts du corps reçu. L’exemple de vérification choisit une fenêtre de fraîcheur de 300 secondes à titre de politique marchande ; SendFlow ne fixe pas cette valeur.",apiScopeTitle:"Périmètre de l’API publique",apiScopeText:"L’API marchande documentée est une API pay-in. Le code ne contient pas de route publique marchande pour créer ou suivre un payout/retrait, annuler un paiement, lister toutes les transactions ou consulter un solde. Le minimum payout est une règle produit, pas un contrat payout API. Aucun SDK marchand officiel n’est présent dans le projet inspecté ; l’exemple Kotlin Android est un appel REST, pas un SDK SendFlow.",endpointLimits:"Limites de paiement",endpointLimitsDesc:"Renvoie les seuils FCFA actuellement configurés. Cette lecture publique ne remplace jamais la validation serveur.",endpointPayout:"Disponibilité API payout",payoutApiTitle:"Payout marchand via API",payoutApiText:"Le contrat marchand actuellement implémenté couvre les paiements entrants (pay-in) : création et lecture de sessions, choix du checkout direct, démarrage et suivi d’une tentative. Aucune route publique marchande de création ou de suivi d’un payout/retrait n’est exposée dans le code. Le seuil minimum payout affiché par /api/payment-limits décrit une règle du produit SendFlow ; il ne signifie pas qu’un endpoint payout est disponible. N’envoyez pas de requête inventée : attendez la publication d’un contrat API payout officiel.",security:"Sécurité et fiabilité",errors:"Erreurs HTTP",idempotency:"Idempotence",expiration:"Expiration et montants",securityText:"Utilisez HTTPS. Stockez la clé secrète et le secret webhook (affiché une seule fois à sa création) dans un coffre sécurisé. Comparez la signature en temps constant, vérifiez la fraîcheur de l’horodatage et ne traitez l’événement qu’après validation.",errorsText:'Les routes documentées renvoient une erreur JSON sous la forme { "error": "…" }. Le contrat ne définit pas de code d’erreur machine stable : basez votre traitement sur le statut HTTP et vos propres règles, pas sur le texte du message. Une réponse 503 indique une indisponibilité, pas un échec final du paiement. Une redirection ou un état affiché dans le navigateur ne confirme jamais le paiement : vérifiez toujours le statut côté serveur.',globalHttpErrors:'Le parseur global peut aussi renvoyer 413 si le corps dépasse 100 Ko ou 415 si l’encodage/jeu de caractères n’est pas pris en charge. Une erreur interne non prévue peut renvoyer 500. Les réponses conservent le format JSON { "error": "…" } ; en cas de 500/503, ne déduisez jamais le résultat du paiement.',errorEnvelopeTitle:"Format d’erreur",httpErrorTableTitle:"Réponses HTTP et conduite à tenir",errorStatusHeader:"HTTP",errorMeaningHeader:"Signification",errorActionHeader:"Action recommandée",parametersTitle:"Paramètres du contrat",parameterFieldHeader:"Champ / emplacement",parameterTypeHeader:"Type",parameterRequirementHeader:"Exigence",parameterDescriptionHeader:"Description",noParameters:"Aucun paramètre de requête ni authentification n’est requis.",error400:"400 — corps, paramètres ou en-têtes invalides ; montant, devise, mode, URL HTTPS, métadonnées, pays, opérateur ou numéro non conformes au contrat.",error401:"401 — clé secrète absente, invalide ou révoquée. Vérifiez le secret côté serveur et l’en-tête Authorization: Bearer ; ne l’incluez jamais dans l’application cliente.",error403:"403 — compte marchand non autorisé ou non éligible à la création de paiements API.",error404:"404 — session, tentative ou identifiants publics indisponibles. Les identifiants publics invalides, une session expirée ou un mauvais mode peuvent aussi être masqués par cette réponse.",error409:"409 — référence marchand déjà utilisée ou clé Idempotency-Key réutilisée avec un corps différent. Pour une reprise, renvoyez la même requête avec la même clé ; une nouvelle opération métier reçoit une nouvelle clé.",error429:"429 — limite de requêtes atteinte. Respectez Retry-After: 60, ralentissez les vérifications de statut et ne relancez pas immédiatement.",error503:"503 — backend, configuration ou vérification serveur indisponible. Le code inspecté contient un contrôle LINKFLOW_SETTLEMENT_PROOF_READY fermé pour la création et le démarrage ; cela ne permet pas de diagnostiquer la joignabilité du backend déployé. Ce statut n’est jamais un résultat final du paiement.",idempotencyText:"Pour chaque création de session ou de tentative, envoyez une clé Idempotency-Key stable de 8 à 128 caractères, sans espace en début ou fin. Une reprise avec la même clé et le même corps renvoie la même opération ; la réutiliser avec une autre demande renvoie 409. Une référence marchand déjà utilisée renvoie aussi 409. Utilisez une nouvelle clé uniquement pour une nouvelle opération métier.",expirationText:"Les sessions expirent une heure après leur création. Après expiration, les choix publics et le démarrage d’une tentative ne sont plus disponibles. La lecture serveur de la session et la vérification d’une tentative déjà créée restent possibles avec des identifiants valides. Le montant est fixe en XOF et doit respecter les limites actuellement renvoyées par GET /api/payment-limits ; le payeur ne peut pas le modifier.",rateLimits:"Limites de requêtes",rateLimitsText:"Par clé API et par fenêtre d’une minute : 30 créations de session, 120 lectures, 5 tentatives directes et 60 vérifications de statut. La création de session a aussi une limite de 10 par minute au niveau du compte marchand. Par adresse IP, les lectures publiques de session sont limitées à 120 par minute, les tentatives à 5 et les vérifications à 60. Les quotas de clé, de compte et d’adresse IP peuvent s’appliquer ensemble. En cas de limitation, l’API renvoie 429 et Retry-After: 60 ; attendez ce délai avant de reprendre.",statesTitle:"États d’un paiement",statesText:"Les états de session et de tentative décrivent l’avancement du paiement ; seul un état final confirmé peut déclencher la validation de votre commande.",serviceAvailability:"Disponibilité du service",serviceAvailabilityText:"Dans le code inspecté, le contrôle technique LINKFLOW_SETTLEMENT_PROOF_READY vaut false : après authentification, la création d’une session et le démarrage d’une tentative renvoient HTTP 503 avant la validation du corps tant que ce contrôle reste fermé. Ce contrôle n’est pas une option métier du marchand. L’URL API documentée est https://merchent.business.sendflow.africa/api, mais cela ne confirme pas la joignabilité du backend déployé. La preuve de règlement authentifiée exigée doit lier référence, montant, devise, marchand, canal et type d’opération attendu avec une signature vérifiée ; le résultat de statut actuellement consulté ne fournit pas toutes ces garanties. Les lectures de statut ne créent pas de paiement et 503 ne confirme ni succès ni échec final.",environmentNote:"En production, SENDFLOW_API_BASE_URL=https://merchent.business.sendflow.africa/api. Le site principal est https://sendflow.africa ; la documentation est sur https://apis.docs.sendflow.africa et le paiement hébergé sur https://payin.merchant.command.sendflow.africa. Dans l’aperçu Replit, utilisez son hôte temporaire suivi de /api.",troubleshootingTitle:"Diagnostic rapide",hostedFlow:"Parcours de redirection",directFlow:"Parcours API directe",returnUrlText:"returnUrl est facultative, doit être une URL HTTPS et concerne le parcours hosted : la page de paiement ne redirige vers cette URL qu’après confirmation succeeded. En mode direct, la réponse de statut API ne fournit pas cette redirection ; votre application gère son propre écran après vérification serveur.",language:"Langue",copyright:"SendFlow · Documentation API",lastUpdated:"Référence API v1",contents:"Sommaire"},en:{navDocs:"Documentation",navGuides:"Guides",navApi:"API reference",navWebhooks:"Webhooks",search:"Search documentation…",menuClose:"Close menu",startGroup:"Start here",sectionPageIntro:"This section details the matching SendFlow contract. Examples are illustrative and current availability blocks are stated clearly.",integrations:"Integration methods",sharedMethods:"Shared",apiReferenceGroup:"API reference",reference:"Reference",resources:"Resources",noResults:"No documents match your search.",webhookRetries:"Retries & deduplication",home:"Documentation",start:"Getting started",auth:"Authentication",direct:"Direct API",hosted:"Hosted Checkout",api:"API reference",webhooks:"Webhooks",ref:"Errors & security",badge:"REST API · JSON",prod:"SendFlow API documentation",homeTitle:"Integrate SendFlow with your platform",homeSub:"Discover the tools and APIs you need to accept payments with SendFlow.",startTitle:"Getting started",startSub:"Set up your access, choose a payment flow, and verify each payment from your server.",authTitle:"Authentication",authSub:"Use the secret key for server requests and the public key only in the checkout flow.",directTitle:"Direct API integration",directSub:"Create a session server-side, display available choices, and follow the status confirmed by SendFlow.",hostedTitle:"Hosted payment redirect",hostedSub:"Create a hosted session and redirect the payer to the SendFlow payment path returned by the API.",apiTitle:"API reference",apiSub:"Available REST endpoints, parameters, authentication, limits, and SendFlow contract responses.",webhooksTitle:"Webhooks",webhooksSub:"Configure payment notifications, verify their signatures, and safely process repeated deliveries.",refTitle:"Errors, idempotency & security",refSub:"HTTP responses, session lifetimes, request limits, and essential rules for reliable payment integrations.",breadcrumb:"API documentation",methods:"Choose your integration method",methodsSub:"Both flows use SendFlow sessions and the same server-confirmed payment status.",directCard:"Direct API",directCardSub:"Your server controls the flow and orchestrates the experience in your application.",hostedCard:"Hosted payment",hostedCardSub:"Your server creates a session, then redirects the customer to SendFlow at payin.merchant.command.sendflow.africa.",methodLevel:"Level",methodControl:"Flow control",methodIntegration:"Integration",methodAuth:"Authentication",methodReturn:"Payment return",developerLevel:"Developer",simpleLevel:"Simple",highControl:"High",hostedControl:"Limited to hosted page",restApi:"REST API",sessionRedirect:"Create a session, then redirect",authContract:"Server-side secret key",returnToConfirm:"Browser redirect is not proof",directGuide:"View the direct API guide",hostedGuide:"View the redirect guide",capabilitiesTitle:"What SendFlow integration covers",capabilitySession:"Create a payment session from your merchant server.",capabilityCheckout:"Present a SendFlow-hosted payment flow to the payer.",capabilityStatus:"Read the status of a session and payment attempt.",capabilityWebhook:"Receive successful or failed payment notifications by webhook.",baseUrlTitle:"API base URL",baseUrlPending:"In production, set SENDFLOW_API_BASE_URL=https://merchent.business.sendflow.africa/api; the application domain exposes the API under /api. The main site is https://sendflow.africa, documentation is https://apis.docs.sendflow.africa, and hosted payments use https://payin.merchant.command.sendflow.africa. These are separate origins and must not be substituted for the API base. In Replit preview, use the temporary preview host followed by /api.",threeSteps:"In 3 steps",stepOne:"Create your merchant account",stepOneSub:"An active, eligible merchant account is required to use API payments.",stepTwo:"Configure your API keys",stepTwoSub:"Create or regenerate your key pair in the Developers area; the secret key is shown only when created.",stepThree:"Integrate SendFlow into your app",stepThreeSub:"Create sessions server-side and verify results with SendFlow.",read:"Read the guide",support:"Need help?",supportSub:"Contact the SendFlow team with questions about your integration.",contact:"Contact support",disclaimerTitle:"Payment confirmation",disclaimer:"Never mark an order as paid based only on a redirect or a browser-side state. Verify the server status or process a webhook whose signature is valid.",whatIs:"How it works",whatIsText:"SendFlow creates a fixed XOF payment session, returns the information for the selected flow, and exposes a server-verified payment status.",prerequisites:"Prerequisites",noCredentials:"Never place the secret key in a browser, distributed mobile app, public repository, or client-side logs.",notDocumented:"API key management",notDocumentedText:"Create or regenerate the key pair in the Developers area; it is not created automatically when an account is opened. Creating a new pair revokes the previous pair. The secret key is for server requests; the public key is used for checkout requests in the direct flow.",rotationText:"The full secret key is shown when it is created. Store it in a secret manager. Regenerating the pair immediately disables the previous keys.",serverOnly:"Send the secret key in the Authorization: Bearer header from your server. Never pass it to the client.",credentialRolesTitle:"Role and handling of each credential",credentialHeader:"Credential",credentialUseHeader:"Used for",credentialHandlingHeader:"Handling",pollTokenNote:"pollToken grants access to an attempt. Prefer checking status from your server with the secret key; if the client needs it to show progress, keep it in memory temporarily and exclude it from logs, URLs, and analytics.",codeLabel:"Request example",placeholder:"API request",codeNote:"For production, set SENDFLOW_API_BASE_URL to https://merchent.business.sendflow.africa/api. Replace sample environment variables and identifiers with your account values. Displayed keys and tokens are fictitious; keep the secret key server-side.",model:"Payment flow",modelTextDirect:"Create the session with mode direct from your server. The client then reads the public session, displays available countries and operators, starts an attempt for the fixed amount, and polls its status.",modelTextHosted:"Create the session with mode hosted from your server. The API returns checkoutPath; combine it with https://payin.merchant.command.sendflow.africa and redirect the customer.",apiAvailabilityTitle:"Current availability",apiAvailabilityText:"In the inspected code, session creation and attempt start return HTTP 503 when the technical settlement-proof control is closed (LINKFLOW_SETTLEMENT_PROOF_READY=false). The documented production API URL is https://merchent.business.sendflow.africa/api, but this code does not prove the domain or Plesk proxy is currently reachable or configured. Examples describe the contract, not production activation; 503 confirms neither success nor final failure. See “Service availability”.",hostedOriginText:"checkoutPath remains a relative path to preserve the API contract. For hosted payments and LinkFlow links in production, use https://payin.merchant.command.sendflow.africa as the origin; set SENDFLOW_CHECKOUT_ORIGIN to this value on the merchant server. In the Replit preview, use the preview origin.",hostedFallbackText:"After succeeded is confirmed, the page redirects to returnUrl if provided; otherwise the current code uses https://sendflow.africa. The page does not redirect to returnUrl after a confirmed failure. A redirect is a user-interface signal, never proof of payment.",webhookSharedNote:"Webhooks apply to both Direct API and Hosted Checkout. They are sent after a confirmed final result; see the Webhooks guide to verify signatures and deduplicate deliveries.",webhookGuideLink:"Open the Webhooks guide",mobileMoneyTitle:"Mobile Money, USSD, and OTP",mobileMoneyText:"USSD codes and OTP steps are published only when confirmed by an official source and applicable to the SendFlow flow. No OTP flow accepted by the current contract can be documented as operational: the create-attempt body accepts neither OTP nor PIN, and the service shared by Direct API and Hosted Checkout rejects channels marked as requiring OTP. Never ask a payer to send an OTP or PIN to your server. For a channel actually offered, display only the ussdCode returned by the API (it may be null) and the choices returned for that session. /api/pricing exposes requiresOtp and otpCommand as metadata, not proof that a flow is supported.",mobileMoneyActorsTitle:"Who does what in a Mobile Money payment?",mobileMoneyCountryTitle:"Documented status by country and operator",androidDirectNote:"The Kotlin example below uses public direct-session routes from Android. It is a REST example, not an official SDK; it assumes kotlinx-coroutines-android. Create the session on your server and pass only the public key and required session tokens to the app.",directInputText:"Mind the format: the session may return a lowercase country code (for example ci), while creating an attempt requires two uppercase letters (CI). Convert it to uppercase. phoneNumber must include the international prefix returned by the session (for example +225 followed by the national number). Use operatorId directly from the session response.",directCorsNote:"The /api/v1/public/* routes have their own CORS configuration: browser calls are allowed without cookies, using GET/POST/OPTIONS and Content-Type, X-SendFlow-Public-Key, X-SendFlow-Client-Token, X-LinkFlow-Attempt-Token, and Idempotency-Key. Creating a session and reading a private session with Authorization: Bearer remain server-side. Never expose the secret key in a browser.",hostedTimerText:"The hosted page displays a 10-minute waiting countdown. When it expires, the payer may see a failure screen, but server-side polling continues and a later final confirmation takes precedence. The countdown is not a payment status: check the server status or a signed webhook and treat uncertain as non-final.",responsibilities:"Integration rules",endpointStatus:"REST API · JSON",endpointCreate:"Create a payment session",endpointRead:"Read a session and its status",endpointChoices:"Read the public session and available choices (direct mode)",endpointAttempt:"Create a direct payment attempt",endpointAttemptRead:"Read an attempt status",accessServerSecret:"Merchant server · secret key and idempotency key",accessServerSecretRead:"Merchant server · secret key",accessPublicSession:"Checkout · public key and session token",accessPublicAttempt:"Checkout · public key, session token, and idempotency key",accessAttemptRead:"Checkout · public and session keys, attempt token",endpointPricing:"Read public countries, operators, and fees",accessPublic:"Public · no key required",endpointAccess:"Authentication",availableChoicesNote:"GET /api/pricing returns the public catalog and configured rates, but it is not a per-session fee or settlement quote and does not guarantee that an operator can process an API payment. Session responses do not expose the merchant net amount. Direct-session choices are filtered according to currently supported routing and rules; treat them as authoritative.",referenceIntro:"The examples below match routes and schemas present in the SendFlow API.",requestExample:"Request example",responseExample:"Response example",webhookEvents:"Payment events",webhookEventsSub:"Webhooks are shared by Direct API and Hosted Checkout for API-created sessions. Configure a public HTTPS URL and event types in the merchant account Developers area; no public webhook-management endpoint is documented. Events are emitted only after final confirmation. Up to 5 active webhook endpoints can be configured per account.",webhookPayloadNote:"The payload contains session, attempt, and transaction IDs, the merchant reference, amount, currency, and status. Its id field is the same UUID as the sendflow-delivery header and remains stable on retries. The merchant reference comes from your request: do not put personal data in it.",eventNames:"Available events",delivery:"Signatures and delivery",deliveryText:"The HMAC-SHA256 signature is computed over the string <timestamp>.<raw JSON body>. Return HTTP 2xx to acknowledge delivery; non-2xx responses, network errors, and timeouts are retried. The request timeout is 8 seconds and response bodies are limited to 8 KB. SendFlow makes at most 8 attempts total: the initial delivery plus up to 7 retries, spaced 10 s, 30 s, 2 min, 10 min, 30 min, 2 h, and 12 h apart. The sendflow-delivery ID stays stable across retries; use it for deduplication.",webhookHeadersTitle:"Request headers",webhookHeadersText:"sendflow-event identifies the event type. sendflow-delivery contains the same UUID as payload.id and remains unchanged on retries. sendflow-signature follows t=<Unix timestamp>,v1=<hex signature>. The signature is computed over the exact received body bytes. The verification example chooses a 300-second freshness window as merchant policy; SendFlow does not set this value.",apiScopeTitle:"Public API scope",apiScopeText:"The documented merchant API is a pay-in API. The inspected code has no public merchant route to create or track a payout/withdrawal, cancel a payment, list all transactions, or read a balance. The minimum payout is a product rule, not a payout API contract. No official merchant SDK is present in the inspected project; the Android Kotlin sample is a REST call, not a SendFlow SDK.",endpointLimits:"Payment limits",endpointLimitsDesc:"Returns the currently configured FCFA thresholds. This public read never replaces server-side validation.",endpointPayout:"Payout API availability",payoutApiTitle:"Merchant payout API",payoutApiText:"The merchant contract currently implemented covers incoming payments (pay-in): creating and reading sessions, direct checkout choices, and starting and checking an attempt. The inspected code does not expose a public merchant route to create or track a payout/withdrawal. The minimum payout shown by /api/payment-limits describes a SendFlow product rule; it does not mean a payout endpoint is available. Do not send an invented request: wait for an official payout API contract.",security:"Security & reliability",errors:"HTTP errors",idempotency:"Idempotency",expiration:"Expiration and amounts",securityText:"Use HTTPS. Store the secret key and webhook secret (shown once at creation) in a secure vault. Compare signatures in constant time, check timestamp freshness, and process events only after verification.",errorsText:'The documented routes return JSON errors in the form { "error": "…" }. The contract defines no stable machine-readable error code: handle HTTP status and your own business rules, not message text. A 503 means the operation is unavailable, not that payment finally failed. A redirect or client-side state never proves payment; always verify status server-side.',globalHttpErrors:'The global parser may also return 413 when a body exceeds 100 KB, or 415 for an unsupported charset or encoding. An unexpected internal error may return 500. Responses keep the JSON shape { "error": "…" }; never infer a payment result from a 500/503 response.',errorEnvelopeTitle:"Error format",httpErrorTableTitle:"HTTP responses and recommended handling",errorStatusHeader:"HTTP",errorMeaningHeader:"Meaning",errorActionHeader:"Recommended action",parametersTitle:"Contract parameters",parameterFieldHeader:"Field / location",parameterTypeHeader:"Type",parameterRequirementHeader:"Requirement",parameterDescriptionHeader:"Description",noParameters:"No request parameters or authentication are required.",error400:"400 — invalid body, parameters, or headers; amount, currency, mode, HTTPS URL, metadata, country, operator, or phone number does not match the contract.",error401:"401 — secret key missing, invalid, or revoked. Check the server-side Bearer credential; never include the secret in a client app.",error403:"403 — merchant account is not authorized or eligible to create API payments.",error404:"404 — session, attempt, or public credentials are unavailable. Invalid public credentials, an expired session, or the wrong session mode may also be hidden behind this response.",error409:"409 — merchant reference already used, or Idempotency-Key reused with a different body. For a retry, resend the same request with the same key; use a new key only for a new business operation.",error429:"429 — request limit reached. Respect Retry-After: 60, slow down status checks, and do not retry immediately.",error503:"503 — backend, configuration, or server-side verification is unavailable. The inspected code contains a closed LINKFLOW_SETTLEMENT_PROOF_READY control for creation and attempt start; that does not diagnose deployed backend reachability. This status is never a final payment result.",idempotencyText:"For each session or attempt creation, send a stable 8–128 character Idempotency-Key with no leading or trailing spaces. A retry with the same key and body returns the same operation; reusing it with a different request returns 409. A previously used merchant reference also returns 409. Use a new key only for a new business operation.",expirationText:"Sessions expire one hour after creation. After expiry, public choices and starting an attempt are unavailable. The server-side session read and status check for an already-created attempt remain possible with valid credentials. The amount is fixed in XOF and must follow the current limits returned by GET /api/payment-limits; the payer cannot change it.",rateLimits:"Request limits",rateLimitsText:"Per API key per one-minute window: 30 session creations, 120 reads, 5 direct attempts, and 60 status checks. Session creation also has a merchant-account limit of 10 per minute. Per client IP, public session reads are limited to 120 per minute, attempts to 5, and status checks to 60. Key, account, and IP quotas can apply together. A rate-limited response includes 429 and Retry-After: 60; wait before resuming.",statesTitle:"Payment states",statesText:"Session and attempt states describe payment progress; only a confirmed final state should trigger your order decision.",serviceAvailability:"Service availability",serviceAvailabilityText:"In the inspected code, the technical LINKFLOW_SETTLEMENT_PROOF_READY control is false: after authentication, session creation and attempt start return HTTP 503 before body validation while it remains closed. This is not a merchant business setting. The documented API URL is https://merchent.business.sendflow.africa/api, but this does not confirm that the deployed backend is reachable. Authenticated settlement evidence must bind the reference, amount, currency, merchant, channel, and expected operation type with a verified signature; the status result currently consulted does not provide all these guarantees. Status reads do not create payments, and 503 confirms neither success nor final failure.",environmentNote:"In production, set SENDFLOW_API_BASE_URL=https://merchent.business.sendflow.africa/api. The main site is https://sendflow.africa; documentation is https://apis.docs.sendflow.africa; hosted payments use https://payin.merchant.command.sendflow.africa. In the Replit preview, use its temporary host followed by /api.",troubleshootingTitle:"Quick troubleshooting",hostedFlow:"Hosted redirect flow",directFlow:"Direct API flow",returnUrlText:"returnUrl is optional, must be an HTTPS URL, and applies to hosted mode: the payment page redirects to it only after a succeeded confirmation. In direct mode, the API status response does not provide this redirect; your application handles its own result screen after server verification.",language:"Language",copyright:"SendFlow · API documentation",lastUpdated:"API reference v1",contents:"Contents"}},y={fr:{stepTitles:["Créez votre compte marchand","Configurez vos clés API","Intégrez SendFlow à votre application"],stepTexts:["Créez votre compte marchand SendFlow.","Créez ou régénérez votre paire dans l’espace Développeurs ; la clé secrète ne s’affiche qu’à sa création.","Créez les sessions côté serveur et vérifiez chaque résultat auprès de SendFlow."],responsibilitiesText:["Gardez la clé secrète sur votre serveur ; le navigateur utilise uniquement les identifiants publics de session.","Traitez les événements de webhook de façon idempotente et validez leur signature HMAC.","Ne confirmez une commande qu’après un statut succeeded renvoyé par l’API ou un webhook authentique."],directFlowTitles:["Créer la session","Charger les choix disponibles","Démarrer le paiement","Vérifier le résultat"],directFlowTexts:["Marchand — depuis votre backend, créez une session en mode direct avec un montant XOF fixe et une clé Idempotency-Key stable. La clé secrète reste sur le serveur.","Votre application de caisse lit la session publique avec publicKey et clientToken, puis affiche uniquement les pays et opérateurs renvoyés pour cette session.","Le payeur choisit l’opérateur et saisit son numéro. La caisse envoie les champs demandés ; l’API renvoie une tentative, un état et éventuellement ussdCode. Le montant vient de la session et ne peut pas être changé.","Le marchand suit la tentative avec pollToken ou lit la session avec sa clé secrète. Seul un état final succeeded confirmé valide la commande ; waiting et uncertain ne sont pas des succès."],hostedFlowTitles:["Créer une session hébergée","Rediriger le client","Laisser le client payer","Confirmer côté serveur"],hostedFlowTexts:["Marchand — votre backend crée la session avec mode=hosted, un montant fixe en XOF et une clé d’idempotence. Il reçoit checkoutPath.","Votre serveur combine checkoutPath avec https://payin.merchant.command.sendflow.africa, puis transmet l’URL complète au navigateur ou à l’application.","Le payeur choisit un moyen proposé sur la page SendFlow et suit les instructions affichées par l’opérateur. Le retour navigateur ne confirme pas le paiement.","Le serveur marchand relit la session et traite les webhooks communs aux deux modes. La page redirige vers returnUrl après succeeded ; seule la confirmation serveur valide la commande."],mobileMoneyActors:[{title:"Client payeur",body:"Choisit un pays et un opérateur renvoyés par la session, saisit son numéro et suit le code USSD effectivement fourni ou la notification de son opérateur. Il valide sur le parcours de l’opérateur ; l’application marchande ne doit pas collecter son OTP ou son PIN."},{title:"Marchand",body:"Crée la session sur son serveur, affiche les choix disponibles, démarre la tentative et interroge son état. Il n’envoie jamais la clé secrète dans le navigateur ou l’application mobile."},{title:"Réponse de l’API",body:"La tentative renvoie notamment attemptId, state, amountMinor, currency, pollToken et un ussdCode qui peut être null. Le corps de création ne contient aucun champ OTP ou PIN."},{title:"Webhook",body:"Pour les deux modes, SendFlow notifie payment.succeeded ou payment.failed uniquement après confirmation finale. Vérifiez la signature HMAC et dédupliquez avec sendflow-delivery."}],mobileMoneyCards:[{title:"Burkina Faso · Orange Money",countryCode:"BF",flag:"🇧🇫",status:"Parcours OTP non pris en charge",body:"Le catalogue d’opérateurs inspecté marque ce canal comme nécessitant un OTP, et le service partagé rejette les canaux ainsi marqués pour les tentatives API directe et Hosted Checkout. Le contrat SendFlow ne reçoit aucun OTP ; le code USSD et les étapes par pays restent à confirmer officiellement et ne sont pas publiés comme procédure de paiement."},{title:"Côte d’Ivoire · Orange Money",countryCode:"CI",flag:"🇨🇮",status:"Parcours OTP non confirmé",body:"Orange Money CI apparaît dans le catalogue, mais le contrat de tentative n’accepte aucun OTP ou PIN. /api/pricing peut renvoyer une métadonnée otpCommand décrivant une option de menu ; cela ne confirme ni un code USSD exact ni un parcours de paiement SendFlow. Le code et les étapes applicables restent à confirmer auprès d’une source officielle et dans le flux réel."},{title:"Sénégal · Orange Money",countryCode:"SN",flag:"🇸🇳",status:"Parcours OTP non pris en charge",body:"Le catalogue d’opérateurs inspecté marque ce canal comme nécessitant un OTP, et le service partagé rejette les canaux ainsi marqués pour les tentatives API directe et Hosted Checkout. Le contrat SendFlow ne reçoit aucun OTP ; le code USSD et les étapes par pays restent à confirmer officiellement et ne sont pas publiés comme procédure de paiement."},{title:"Mali · Orange Money",countryCode:"ML",flag:"🇲🇱",status:"Opérateur absent du catalogue inspecté",body:"Le Mali et son opérateur n’apparaissent pas dans le catalogue statique de paiement inspecté. Aucune disponibilité SendFlow n’est confirmée pour ce pays ; n’affichez pas de code ni d’étapes de paiement avant que le pays et l’opérateur soient proposés par une session et que le parcours soit vérifié."},{title:"Autres pays et opérateurs",status:"Choix dynamiques",body:"Il n’existe pas de liste statique fiable à publier depuis le code seul. GET /api/pricing fournit un catalogue général, mais les choix de session directe sont filtrés par les règles de routage et de configuration ; ils font autorité pour cette session."}],troubleshooting:[{symptom:"Aucun pays ou opérateur ne s’affiche",action:"Vérifiez la réponse de la session directe. Le catalogue global de frais ne garantit pas qu’un opérateur soit admissible pour cette session."},{symptom:"Aucun code USSD n’est renvoyé",action:"ussdCode peut être null. Ne fabriquez pas de code ; affichez uniquement les instructions fournies par la session SendFlow active."},{symptom:"Le client revient sans webhook",action:"La redirection du navigateur n’est pas une confirmation. Lisez le statut serveur et consultez l’historique des livraisons webhook dans l’espace Développeurs."},{symptom:"Le compte à rebours hébergé expire",action:"L’écran d’échec après 10 minutes n’est pas un état final serveur. Vérifiez la session et traitez uncertain comme non final."},{symptom:"Une création renvoie 503",action:"Le parcours de création et de tentative est actuellement désactivé dans le code inspecté. N’essayez pas de contourner cette indisponibilité ni de présenter le paiement comme échoué ou réussi."}],credentialRows:[{credential:"Clé secrète",usedFor:"Authorization: Bearer pour créer et lire une session depuis le backend marchand.",handling:"Format live : sfsk_live_ suivi de 43 caractères URL-safe. Serveur uniquement ; stockez-la dans un gestionnaire de secrets et ne la journalisez jamais."},{credential:"Clé publique",usedFor:"X-SendFlow-Public-Key pour les appels de caisse du parcours direct.",handling:"Format live : sfpk_live_ suivi de 43 caractères URL-safe. Peut être transmise au client dans le contexte de sa session ; elle ne remplace jamais la clé secrète."},{credential:"clientToken",usedFor:"X-SendFlow-Client-Token pour lire la session directe et démarrer une tentative.",handling:"43 caractères URL-safe ; jeton limité à une session. Ne le partagez pas entre commandes et évitez de le conserver dans des journaux."},{credential:"pollToken",usedFor:"X-LinkFlow-Attempt-Token pour consulter une tentative directe.",handling:"64 caractères hexadécimaux minuscules ; identifiant d’accès à une tentative. Préférez le suivi serveur et ne l’exposez que temporairement si l’interface en a besoin."},{credential:"Secret de signature webhook",usedFor:"Vérifier les notifications reçues sur votre endpoint.",handling:"Secret distinct des clés API, affiché une seule fois à la configuration ; conservez-le côté serveur."}],paymentStateRows:[{state:"created",meaning:"La session existe, aucune tentative n’a encore été lancée.",action:"Poursuivez le parcours de caisse prévu pour son mode."},{state:"waiting",meaning:"Une tentative est en attente de confirmation.",action:"Continuez le suivi ; ne marquez pas la commande comme payée."},{state:"uncertain",meaning:"Le résultat n’est pas confirmé et peut encore évoluer.",action:"Ne classez ni comme réussi ni comme échoué ; relisez le statut et attendez le résultat serveur."},{state:"succeeded",meaning:"Le paiement a été confirmé avec succès.",action:"Vous pouvez valider la commande après vérification côté serveur."},{state:"failed",meaning:"Un échec final a été confirmé.",action:"Ne livrez pas la commande ; appliquez votre parcours de nouvel essai métier."}],httpErrorRows:[{status:"400",meaning:"Corps, paramètre ou en-tête invalide au regard du contrat de la route.",action:"Corrigez les champs indiqués par la route concernée. Le corps d’erreur ne fournit pas de code machine stable."},{status:"401",meaning:"Clé secrète manquante, invalide ou révoquée.",action:"Vérifiez Authorization: Bearer côté serveur et la clé active. Ne transmettez pas le secret au client."},{status:"403",meaning:"Compte marchand non autorisé ou non éligible à cette opération API.",action:"Vérifiez l’éligibilité et les droits du compte avant de reprendre."},{status:"404",meaning:"Session, tentative ou identifiants publics introuvables ou indisponibles.",action:"Vérifiez les UUID, le mode et les jetons associés sans supposer qu’une ressource a été supprimée."},{status:"409",meaning:"Référence marchande en conflit ou clé d’idempotence réutilisée avec un corps différent.",action:"Pour une reprise, renvoyez exactement la même demande avec la même clé ; une nouvelle opération reçoit une nouvelle clé."},{status:"429",meaning:"Limite de requêtes atteinte.",action:"Respectez Retry-After: 60 et ralentissez les appels."},{status:"413",meaning:"Corps de requête supérieur à la limite globale de 100 Ko.",action:"Réduisez le corps ; les métadonnées de session sont limitées à 8 Ko."},{status:"415",meaning:"Jeu de caractères ou encodage de requête non pris en charge.",action:"Envoyez du JSON UTF-8 avec Content-Type: application/json."},{status:"500",meaning:"Erreur interne inattendue.",action:"Reprenez avec la même clé d’idempotence et le même corps ; ne créez pas une nouvelle opération. Vérifiez ensuite l’état serveur et contactez SendFlow si l’erreur persiste."},{status:"503",meaning:"Service indisponible ou verrou de création/démarrage fermé.",action:"Ne classez pas le paiement comme échoué. Reprenez le suivi serveur lorsque le service est disponible."}]},en:{stepTitles:["Create your merchant account","Configure your API keys","Integrate SendFlow into your app"],stepTexts:["Create your SendFlow merchant account.","Create or regenerate your key pair in the Developers area; the secret key is shown only when created.","Create sessions server-side and verify each result with SendFlow."],responsibilitiesText:["Keep the secret key on your server; the browser uses only public session credentials.","Process webhook events idempotently and verify their HMAC signature.","Confirm an order only after the API returns succeeded or an authentic webhook is received."],directFlowTitles:["Create the session","Load available choices","Start the payment","Verify the result"],directFlowTexts:["Merchant — create a direct-mode session on your backend with a fixed XOF amount and stable Idempotency-Key. Keep the secret key on the server.","Your checkout reads the public session with publicKey and clientToken, then displays only the countries and operators returned for that session.","The payer chooses an operator and enters a phone number. The checkout sends the required fields; the API returns an attempt, state, and possibly ussdCode. The session fixes the amount.","The merchant polls the attempt with pollToken or reads the session with the secret key. Only a confirmed final succeeded state completes the order; waiting and uncertain are not success."],hostedFlowTitles:["Create a hosted session","Redirect the customer","Let the customer pay","Verify server-side"],hostedFlowTexts:["Merchant — your backend creates the session with mode=hosted, a fixed XOF amount, and an idempotency key. It receives checkoutPath.","Your server combines checkoutPath with https://payin.merchant.command.sendflow.africa, then passes the complete URL to the browser or app.","The payer chooses a method on the SendFlow page and follows the operator instructions. A browser return does not confirm payment.","The merchant server reads the session and processes webhooks shared by both modes. The page redirects to returnUrl after succeeded; only server confirmation completes the order."],mobileMoneyActors:[{title:"Payer",body:"Chooses a country and operator returned by the session, enters a phone number, and follows only the returned USSD code or the operator notification. Authorization happens in the operator flow; the merchant app must not collect the payer’s OTP or PIN."},{title:"Merchant",body:"Creates the session on its server, displays available choices, starts the attempt, and checks its status. Never send the secret key to a browser or mobile app."},{title:"API response",body:"The attempt returns, among other fields, attemptId, state, amountMinor, currency, pollToken, and a possibly null ussdCode. The create-attempt body has no OTP or PIN field."},{title:"Webhook",body:"For both modes, SendFlow sends payment.succeeded or payment.failed only after final confirmation. Verify the HMAC signature and deduplicate with sendflow-delivery."}],mobileMoneyCards:[{title:"Burkina Faso · Orange Money",countryCode:"BF",flag:"🇧🇫",status:"OTP flow not supported",body:"The inspected operator catalog marks this channel as requiring OTP, and the shared service rejects channels so marked for both Direct API and Hosted Checkout attempts. The SendFlow contract accepts no OTP; country-specific USSD codes and steps remain to be officially confirmed and are not published as payment instructions."},{title:"Côte d’Ivoire · Orange Money",countryCode:"CI",flag:"🇨🇮",status:"OTP flow unconfirmed",body:"Orange Money CI appears in the catalog, but the attempt contract accepts no OTP or PIN. /api/pricing may return otpCommand menu metadata; this does not confirm an exact USSD code or a SendFlow payment flow. The applicable code and steps remain unconfirmed against an official source and the real flow."},{title:"Senegal · Orange Money",countryCode:"SN",flag:"🇸🇳",status:"OTP flow not supported",body:"The inspected operator catalog marks this channel as requiring OTP, and the shared service rejects channels so marked for both Direct API and Hosted Checkout attempts. The SendFlow contract accepts no OTP; country-specific USSD codes and steps remain to be officially confirmed and are not published as payment instructions."},{title:"Mali · Orange Money",countryCode:"ML",flag:"🇲🇱",status:"Operator absent from inspected catalog",body:"Mali and its operator do not appear in the inspected static payment catalog. SendFlow availability is not confirmed for this country; do not display a code or payment steps until a session offers the country/operator and the flow is verified."},{title:"Other countries and operators",status:"Dynamic choices",body:"The source alone does not provide a reliable static support list. GET /api/pricing returns a global catalog, but direct-session choices are filtered by routing and configuration rules and are authoritative for that session."}],troubleshooting:[{symptom:"No country or operator is displayed",action:"Check the direct session response. The global fee catalog does not guarantee that a method is eligible for this session."},{symptom:"No USSD code is returned",action:"ussdCode may be null. Do not invent a code; display only the instructions returned for the active SendFlow session."},{symptom:"The customer returns but no webhook arrives",action:"A browser redirect is not confirmation. Read the server status and check webhook delivery history in the Developers area."},{symptom:"The hosted countdown expires",action:"The failure screen after 10 minutes is not a final server state. Check the session and treat uncertain as non-final."},{symptom:"A create request returns 503",action:"Session and attempt creation are currently disabled in the inspected code. Do not work around this unavailability or label the payment as failed or successful."}],credentialRows:[{credential:"Secret key",usedFor:"Authorization: Bearer to create and read a session from the merchant backend.",handling:"Live format: sfsk_live_ followed by 43 URL-safe characters. Server only. Store it in a secrets manager and never log it."},{credential:"Public key",usedFor:"X-SendFlow-Public-Key for direct checkout requests.",handling:"Live format: sfpk_live_ followed by 43 URL-safe characters. May be sent to the client for its session; it never replaces the secret key."},{credential:"clientToken",usedFor:"X-SendFlow-Client-Token to read a direct session and start an attempt.",handling:"43 URL-safe characters; session-scoped token. Do not reuse across orders or place it in logs."},{credential:"pollToken",usedFor:"X-LinkFlow-Attempt-Token to read a direct attempt.",handling:"64 lowercase hexadecimal characters; attempt access credential. Prefer server-side polling; expose it only temporarily if the interface requires it."},{credential:"Webhook signing secret",usedFor:"Verify notifications received by your endpoint.",handling:"Separate from API keys and shown only once during setup; keep it server-side."}],paymentStateRows:[{state:"created",meaning:"The session exists; no attempt has started.",action:"Continue with the checkout flow for its mode."},{state:"waiting",meaning:"An attempt is awaiting confirmation.",action:"Continue checking; do not mark the order as paid."},{state:"uncertain",meaning:"The result is not confirmed and may still change.",action:"Treat as neither success nor failure; re-read status and wait for server confirmation."},{state:"succeeded",meaning:"Payment has been confirmed successfully.",action:"You may fulfill the order after server-side verification."},{state:"failed",meaning:"A final failure has been confirmed.",action:"Do not fulfill the order; use your business retry flow."}],httpErrorRows:[{status:"400",meaning:"Request body, parameter, or header does not match the route contract.",action:"Correct the fields for the route. The error body does not provide a stable machine-readable code."},{status:"401",meaning:"Secret key is missing, invalid, or revoked.",action:"Check the server-side Authorization: Bearer credential and active key. Never expose the secret to the client."},{status:"403",meaning:"Merchant account is not authorized or eligible for this API operation.",action:"Check account eligibility and permissions before retrying."},{status:"404",meaning:"Session, attempt, or public credentials are unknown or unavailable.",action:"Check UUIDs, mode, and associated tokens; do not assume the resource was deleted."},{status:"409",meaning:"Merchant reference conflict or an idempotency key reused with a different body.",action:"For a retry, resend the exact request with the same key; use a new key for a new operation."},{status:"429",meaning:"Request limit reached.",action:"Respect Retry-After: 60 and reduce request frequency."},{status:"413",meaning:"Request body exceeds the global 100 KB limit.",action:"Reduce the body; session metadata is limited to 8 KB."},{status:"415",meaning:"Request charset or encoding is unsupported.",action:"Send UTF-8 JSON with Content-Type: application/json."},{status:"500",meaning:"Unexpected internal error.",action:"Retry with the same idempotency key and body; do not create a new operation. Then check the server status and contact SendFlow if the error persists."},{status:"503",meaning:"Service unavailable or creation/attempt gate is closed.",action:"Do not mark the payment as failed. Resume server-side status checks when the service is available."}]}},se=[{method:"POST",path:"/api/v1/payment-sessions",description:"endpointCreate",access:"accessServerSecret",example:"create-hosted",anchor:"create-session",fieldsFr:[{field:"Authorization",type:"En-tête · Bearer",requirement:"Requis",description:"Clé secrète du marchand ; serveur uniquement."},{field:"Idempotency-Key",type:"En-tête · chaîne",requirement:"Requis",description:"8 à 128 caractères ; identique lors d’une reprise exacte."},{field:"Content-Type",type:"En-tête · chaîne",requirement:"Requis",description:"application/json."},{field:"merchantReference",type:"Chaîne",requirement:"Requis · corps",description:"Référence unique fournie par le marchand, 1 à 128 caractères."},{field:"amountMinor",type:"Entier",requirement:"Requis · corps",description:"Montant fixe dans la plage actuellement renvoyée par GET /api/payment-limits."},{field:"currency",type:"Chaîne",requirement:"Requis · corps",description:"Valeur acceptée : XOF."},{field:"mode",type:"Chaîne",requirement:"Requis · corps",description:"hosted ou direct."},{field:"description",type:"Chaîne",requirement:"Facultatif · corps",description:"240 caractères maximum."},{field:"returnUrl",type:"URL ou null",requirement:"Facultatif · corps",description:"URL HTTPS ; utilisée par le parcours hébergé après confirmation réussie."},{field:"metadata",type:"Objet JSON",requirement:"Facultatif · corps",description:"Données complémentaires limitées à 8 Ko ; n’y placez pas de données sensibles."}],fieldsEn:[{field:"Authorization",type:"Header · Bearer",requirement:"Required",description:"Merchant secret key; server only."},{field:"Idempotency-Key",type:"Header · string",requirement:"Required",description:"8–128 characters; reuse for an exact retry."},{field:"Content-Type",type:"Header · string",requirement:"Required",description:"application/json."},{field:"merchantReference",type:"String",requirement:"Required · body",description:"Unique merchant-supplied reference, 1–128 characters."},{field:"amountMinor",type:"Integer",requirement:"Required · body",description:"Fixed amount within the current range returned by GET /api/payment-limits."},{field:"currency",type:"String",requirement:"Required · body",description:"Accepted value: XOF."},{field:"mode",type:"String",requirement:"Required · body",description:"hosted or direct."},{field:"description",type:"String",requirement:"Optional · body",description:"Maximum 240 characters."},{field:"returnUrl",type:"URL or null",requirement:"Optional · body",description:"HTTPS URL; used by hosted checkout after successful confirmation."},{field:"metadata",type:"JSON object",requirement:"Optional · body",description:"Additional data limited to 8 KB; do not put sensitive data here."}],codesFr:"HTTP : 201, 400, 401, 403, 409, 429, 503.",codesEn:"HTTP: 201, 400, 401, 403, 409, 429, 503.",errorsFr:"400 : corps ou en-têtes invalides, limites de champs ou métadonnées dépassées. 401 : clé secrète absente, invalide ou révoquée. 403 : compte marchand non éligible. 409 : clé d’idempotence réutilisée avec un autre corps ou référence marchande déjà utilisée. 429 : quota dépassé. 503 : verrou de disponibilité fermé ou service indisponible ; dans l’état actuel, le verrou répond après authentification et avant la validation du corps.",errorsEn:"400: invalid body or headers, field limits, or oversized metadata. 401: missing, invalid, or revoked secret key. 403: merchant account not eligible. 409: idempotency key reused with a different body or merchant reference already used. 429: quota exceeded. 503: availability gate closed or service unavailable; in the current code, the gate responds after authentication and before body validation.",requirementsFr:"En-têtes : Authorization: Bearer <clé secrète>, Idempotency-Key (8–128 caractères, sans espaces en début/fin), Content-Type: application/json. Requis : merchantReference (1–128), amountMinor (entier XOF dans la plage configurée, à lire via GET /api/payment-limits), currency=XOF, mode=hosted|direct. Facultatifs : description (240 caractères max), returnUrl (URL HTTPS utilisée uniquement par le parcours hosted après confirmation succeeded), metadata (8 Ko max). Expiration : 1 heure.",requirementsEn:"Headers: Authorization: Bearer <secret key>, Idempotency-Key (8–128 characters, no leading/trailing spaces), Content-Type: application/json. Required: merchantReference (1–128), amountMinor (integer XOF within the configured range, read it from GET /api/payment-limits), currency=XOF, mode=hosted|direct. Optional: description (max 240 characters), returnUrl (HTTPS URL used only by hosted flow after succeeded confirmation), metadata (max 8 KB). Expires after 1 hour.",response:`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "merchantReference": "ORDER-2026-0042",
  "mode": "hosted",
  "state": "created",
  "amountMinor": 12500,
  "currency": "XOF",
  "checkoutPath": "/pay/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  "clientToken": "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
  "publicKey": "sfpk_live_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "expiresAt": "2026-10-29T11:30:00.000Z"
}`},{method:"GET",path:"/api/v1/payment-sessions/{sessionId}",description:"endpointRead",access:"accessServerSecretRead",example:"read-session",anchor:"read-session",fieldsFr:[{field:"sessionId",type:"UUID · chemin",requirement:"Requis",description:"Identifiant id renvoyé lors de la création de la session."},{field:"Authorization",type:"En-tête · Bearer",requirement:"Requis",description:"Clé secrète du marchand ; serveur uniquement."}],fieldsEn:[{field:"sessionId",type:"UUID · path",requirement:"Required",description:"The id returned when the session was created."},{field:"Authorization",type:"Header · Bearer",requirement:"Required",description:"Merchant secret key; server only."}],codesFr:"HTTP : 200, 401, 403, 404, 429, 503.",codesEn:"HTTP: 200, 401, 403, 404, 429, 503.",errorsFr:"401 : clé secrète invalide ou révoquée. 403 : compte non autorisé. 404 : UUID ou session inconnus. 429 : quota de lectures dépassé. 503 : lecture serveur momentanément indisponible.",errorsEn:"401: invalid or revoked secret key. 403: account not authorized. 404: unknown UUID or session. 429: read quota exceeded. 503: server-side read temporarily unavailable.",requirementsFr:"Paramètre de chemin : sessionId (UUID). En-tête : Authorization: Bearer <clé secrète>. États possibles : created, waiting, uncertain, succeeded, failed.",requirementsEn:"Path parameter: sessionId (UUID). Header: Authorization: Bearer <secret key>. Possible states: created, waiting, uncertain, succeeded, failed.",response:`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "merchantReference": "ORDER-2026-0042",
  "mode": "hosted",
  "state": "succeeded",
  "amountMinor": 12500,
  "currency": "XOF",
  "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
  "createdAt": "2026-10-29T10:30:00.000Z",
  "expiresAt": "2026-10-29T11:30:00.000Z"
}`},{method:"GET",path:"/api/v1/public/payment-sessions/{sessionId}",description:"endpointChoices",access:"accessPublicSession",example:"read-public-session",anchor:"direct-choices",fieldsFr:[{field:"sessionId",type:"UUID · chemin",requirement:"Requis",description:"Identifiant de la session en mode direct."},{field:"X-SendFlow-Public-Key",type:"En-tête · chaîne",requirement:"Requis",description:"Format live : sfpk_live_ suivi de 43 caractères URL-safe."},{field:"X-SendFlow-Client-Token",type:"En-tête · chaîne",requirement:"Requis",description:"Jeton de cette session : 43 caractères URL-safe."}],fieldsEn:[{field:"sessionId",type:"UUID · path",requirement:"Required",description:"Identifier for a direct-mode session."},{field:"X-SendFlow-Public-Key",type:"Header · string",requirement:"Required",description:"Live format: sfpk_live_ followed by 43 URL-safe characters."},{field:"X-SendFlow-Client-Token",type:"Header · string",requirement:"Required",description:"Session token: 43 URL-safe characters."}],codesFr:"HTTP : 200, 404, 429, 503.",codesEn:"HTTP: 200, 404, 429, 503.",errorsFr:"404 : identifiants publics invalides, session inconnue/expirée, lien inactif ou mode différent de direct. 429 : quota par clé ou adresse IP dépassé. 503 : session ou choix de paiement momentanément indisponibles.",errorsEn:"404: invalid public credentials, unknown/expired session, inactive link, or mode other than direct. 429: key or client-IP quota exceeded. 503: session or payment choices temporarily unavailable.",requirementsFr:"Réservé aux sessions mode=direct. Paramètre : sessionId (UUID). En-têtes : X-SendFlow-Public-Key et X-SendFlow-Client-Token.",requirementsEn:"For mode=direct sessions only. Parameter: sessionId (UUID). Headers: X-SendFlow-Public-Key and X-SendFlow-Client-Token.",response:`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "merchantName": "Boutique Exemple",
  "description": "Paiement ORDER-2026-0043",
  "mode": "direct",
  "state": "created",
  "amountMinor": 12500,
  "currency": "XOF",
  "expiresAt": "2026-10-29T11:30:00.000Z",
  "countries": [
    {
      "code": "ci",
      "name": "Côte d’Ivoire",
      "flag": "🇨🇮",
      "phonePrefix": "+225",
      "minPhoneDigits": 10,
      "maxPhoneDigits": 10,
      "operators": [{ "id": "<operator-id>", "name": "<operator-name>", "initials": "OP", "logoUrl": null }]
    }
  ]
}`},{method:"POST",path:"/api/v1/public/payment-sessions/{sessionId}/attempts",description:"endpointAttempt",access:"accessPublicAttempt",example:"start-attempt",anchor:"create-attempt",fieldsFr:[{field:"sessionId",type:"UUID · chemin",requirement:"Requis",description:"Identifiant de la session directe."},{field:"X-SendFlow-Public-Key",type:"En-tête · chaîne",requirement:"Requis",description:"Clé publique de l’espace marchand."},{field:"X-SendFlow-Client-Token",type:"En-tête · chaîne",requirement:"Requis",description:"Jeton renvoyé pour cette session."},{field:"Idempotency-Key",type:"En-tête · chaîne",requirement:"Requis",description:"8 à 128 caractères ; même clé pour reprendre la même tentative."},{field:"firstName",type:"Chaîne",requirement:"Requis · corps",description:"1 à 80 caractères."},{field:"lastName",type:"Chaîne",requirement:"Requis · corps",description:"1 à 80 caractères."},{field:"countryCode",type:"Chaîne",requirement:"Requis · corps",description:"Code pays à deux lettres majuscules, par exemple CI."},{field:"operatorId",type:"Chaîne",requirement:"Requis · corps",description:"Identifiant exact d’un opérateur renvoyé pour la session, 1 à 80 caractères."},{field:"phoneNumber",type:"Chaîne",requirement:"Requis · corps",description:"6 à 20 caractères ; inclure l’indicatif international phonePrefix renvoyé."}],fieldsEn:[{field:"sessionId",type:"UUID · path",requirement:"Required",description:"Identifier for the direct session."},{field:"X-SendFlow-Public-Key",type:"Header · string",requirement:"Required",description:"Public key for the merchant account."},{field:"X-SendFlow-Client-Token",type:"Header · string",requirement:"Required",description:"Token returned for this session."},{field:"Idempotency-Key",type:"Header · string",requirement:"Required",description:"8–128 characters; reuse to retry the same attempt."},{field:"firstName",type:"String",requirement:"Required · body",description:"1–80 characters."},{field:"lastName",type:"String",requirement:"Required · body",description:"1–80 characters."},{field:"countryCode",type:"String",requirement:"Required · body",description:"Two uppercase country letters, for example CI."},{field:"operatorId",type:"String",requirement:"Required · body",description:"Exact operator ID returned for the session, 1–80 characters."},{field:"phoneNumber",type:"String",requirement:"Required · body",description:"6–20 characters; include the returned international phonePrefix."}],codesFr:"HTTP : 201, 400, 404, 409, 429, 503.",codesEn:"HTTP: 201, 400, 404, 409, 429, 503.",errorsFr:"400 : corps invalide, pays/opérateur non proposé, numéro non conforme ou canal exclu par la règle OTP. 404 : session/identifiants publics indisponibles ou expirés. 409 : tentative ou clé d’idempotence en conflit. 429 : quota par clé ou adresse IP dépassé. 503 : démarrage bloqué par le verrou actuel ou service indisponible ; aucun résultat final n’est alors confirmé.",errorsEn:"400: invalid body, country/operator not offered, invalid phone number, or channel excluded by the OTP rule. 404: session/public credentials unavailable or expired. 409: attempt or idempotency conflict. 429: key or client-IP quota exceeded. 503: attempt start blocked by the current gate or service unavailable; no final result is confirmed.",requirementsFr:"Paramètre : sessionId (UUID). En-têtes : X-SendFlow-Public-Key, X-SendFlow-Client-Token, Idempotency-Key (8–128 caractères, sans espaces en début/fin). Corps : firstName et lastName (1–80), countryCode (2 lettres majuscules ; convertir le code de la session si nécessaire), operatorId (1–80, pris dans la session), phoneNumber (6–20 avec l’indicatif international phonePrefix). Le montant est celui de la session.",requirementsEn:"Parameter: sessionId (UUID). Headers: X-SendFlow-Public-Key, X-SendFlow-Client-Token, Idempotency-Key (8–128 characters, no leading/trailing spaces). Body: firstName and lastName (1–80), countryCode (two uppercase letters; convert the session value if needed), operatorId (1–80, from the session), phoneNumber (6–20 including the international phonePrefix). The session amount is fixed.",response:`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
  "state": "waiting",
  "amountMinor": 12500,
  "currency": "XOF",
  "ussdCode": null,
  "pollToken": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "merchantReference": "ORDER-2026-0042"
}`},{method:"GET",path:"/api/v1/public/payment-sessions/{sessionId}/attempts/{attemptId}",description:"endpointAttemptRead",access:"accessAttemptRead",example:"poll-attempt",anchor:"read-attempt",fieldsFr:[{field:"sessionId",type:"UUID · chemin",requirement:"Requis",description:"Identifiant de la session."},{field:"attemptId",type:"UUID · chemin",requirement:"Requis",description:"Identifiant de tentative renvoyé au démarrage."},{field:"X-SendFlow-Public-Key",type:"En-tête · chaîne",requirement:"Requis",description:"Clé publique du marchand."},{field:"X-SendFlow-Client-Token",type:"En-tête · chaîne",requirement:"Requis",description:"Jeton associé à la session."},{field:"X-LinkFlow-Attempt-Token",type:"En-tête · chaîne",requirement:"Requis",description:"Valeur pollToken renvoyée au démarrage de la tentative."}],fieldsEn:[{field:"sessionId",type:"UUID · path",requirement:"Required",description:"Session identifier."},{field:"attemptId",type:"UUID · path",requirement:"Required",description:"Attempt identifier returned when it was started."},{field:"X-SendFlow-Public-Key",type:"Header · string",requirement:"Required",description:"Merchant public key."},{field:"X-SendFlow-Client-Token",type:"Header · string",requirement:"Required",description:"Token associated with the session."},{field:"X-LinkFlow-Attempt-Token",type:"Header · string",requirement:"Required",description:"pollToken returned when the attempt started."}],codesFr:"HTTP : 200, 404, 429, 503.",codesEn:"HTTP: 200, 404, 429, 503.",errorsFr:"404 : session, tentative ou jeton d’accès indisponible. 429 : quota de vérification par clé ou adresse IP dépassé. 503 : vérification serveur indisponible ; conservez waiting/uncertain comme états non finaux.",errorsEn:"404: session, attempt, or access token unavailable. 429: key or client-IP status-check quota exceeded. 503: server verification unavailable; keep waiting/uncertain as non-final states.",requirementsFr:"Paramètres : sessionId et attemptId (UUID). En-têtes : X-SendFlow-Public-Key, X-SendFlow-Client-Token et X-LinkFlow-Attempt-Token (pollToken renvoyé au démarrage).",requirementsEn:"Parameters: sessionId and attemptId (UUID). Headers: X-SendFlow-Public-Key, X-SendFlow-Client-Token, and X-LinkFlow-Attempt-Token (the pollToken returned when the attempt starts).",response:`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
  "state": "waiting",
  "amountMinor": 12500,
  "currency": "XOF",
  "ussdCode": null,
  "pollToken": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "merchantReference": "ORDER-2026-0042"
}`},{method:"GET",path:"/api/pricing",description:"endpointPricing",access:"accessPublic",example:"pricing",anchor:"pricing-catalog",fieldsFr:[{field:"Paramètres",type:"—",requirement:"Aucun",description:"Aucune authentification ni paramètre de requête requis."}],fieldsEn:[{field:"Parameters",type:"—",requirement:"None",description:"No authentication or query parameters required."}],codesFr:"HTTP : 200, 503.",codesEn:"HTTP: 200, 503.",errorsFr:"503 : catalogue ou configuration tarifaire momentanément indisponible. Les taux affichés ne garantissent pas qu’un opérateur soit proposé dans une session ni qu’un paiement puisse être exécuté.",errorsEn:"503: catalog or fee configuration temporarily unavailable. Published rates do not guarantee that an operator will be offered in a session or that a payment can be executed.",requirementsFr:"Aucun en-tête d’authentification. fees.linkflow est un taux décimal (0,025 signifie 2,5 %). Les taux non configurés sont omis ; les valeurs de l’exemple sont illustratives.",requirementsEn:"No authentication header. fees.linkflow is a decimal rate (0.025 means 2.5%). Unconfigured rates are omitted; example values are illustrative.",response:`{
  "categories": [{
    "id": "linkflow",
    "label": "Paiement par lien LinkFlow",
    "shortLabel": "LinkFlow",
    "description": "Paiement via un lien LinkFlow"
  }],
  "countries": [{
    "id": "ci", "name": "Côte d’Ivoire", "dialCode": "+225", "initials": "CI",
    "flag": "🇨🇮", "enabled": true, "minPhoneDigits": 10, "maxPhoneDigits": 10,
    "operations": { "deposit": true, "interNetwork": true, "international": true }
  }],
  "operators": [{
    "id": "<operator-id>", "countryId": "ci", "name": "Opérateur Exemple",
    "shortName": "Exemple", "initials": "OP", "brand": "generic",
    "logoUrl": null, "requiresOtp": false, "otpCommand": null,
    "operations": { "deposit": true, "interNetwork": true, "international": true },
    "fees": { "linkflow": 0.025 }
  }]
}`},{method:"GET",path:"/api/payment-limits",description:"endpointLimitsDesc",access:"accessPublic",example:"payment-limits",anchor:"payment-limits",fieldsFr:[{field:"Paramètres",type:"—",requirement:"Aucun",description:"Aucune authentification ni paramètre de requête requis."},{field:"minimumDepositMinor",type:"Entier · XOF",requirement:"Réponse",description:"Minimum de dépôt configuré, en unités FCFA entières."},{field:"minimumPayoutMinor",type:"Entier · XOF",requirement:"Réponse",description:"Minimum de payout interne configuré ; ne signifie pas qu’une route payout marchande est disponible."},{field:"minimumInterNetworkMinor",type:"Entier · XOF",requirement:"Réponse",description:"Minimum du transfert inter-réseaux."},{field:"maximumTransferMinor",type:"Entier · XOF",requirement:"Réponse",description:"Maximum technique configuré pour les opérations de transfert."},{field:"maximumPayinMinor",type:"Entier · XOF",requirement:"Réponse",description:"Maximum technique configuré pour les paiements entrants."}],fieldsEn:[{field:"Parameters",type:"—",requirement:"None",description:"No authentication or query parameters required."},{field:"minimumDepositMinor",type:"Integer · XOF",requirement:"Response",description:"Configured minimum deposit, in whole FCFA units."},{field:"minimumPayoutMinor",type:"Integer · XOF",requirement:"Response",description:"Configured internal payout minimum; it does not mean a merchant payout route is available."},{field:"minimumInterNetworkMinor",type:"Integer · XOF",requirement:"Response",description:"Minimum inter-network transfer amount."},{field:"maximumTransferMinor",type:"Integer · XOF",requirement:"Response",description:"Configured technical ceiling for transfer operations."},{field:"maximumPayinMinor",type:"Integer · XOF",requirement:"Response",description:"Configured technical ceiling for incoming payments."}],codesFr:"HTTP : 200, 503.",codesEn:"HTTP: 200, 503.",errorsFr:"503 : réglages de paiement indisponibles. La route échoue explicitement tant que la table de configuration n’est pas provisionnée.",errorsEn:"503: payment limits are unavailable. The route fails explicitly until the configuration table is provisioned.",requirementsFr:"Lecture publique, sans clé API. Les valeurs sont informatives ; chaque opération est validée à nouveau côté serveur. Tous les montants sont des entiers XOF/FCFA. La réponse d’exemple affiche les valeurs initiales : la réponse active de cette route est la référence.",requirementsEn:"Public read; no API key. Values are informational; every operation is validated again on the server. Amounts are whole XOF/FCFA units. The sample response shows initial values; the live endpoint response is authoritative.",response:`{
  "currency": "XOF",
  "minimumDepositMinor": 200,
  "minimumPayoutMinor": 200,
  "minimumInterNetworkMinor": 1,
  "maximumTransferMinor": 10000000,
  "maximumPayinMinor": 2000000
}`}],Te={"/docs":"accueil home intégration paiements payment","/docs/getting-started":"prérequis compte marchand étapes getting started","/docs/authentication":"clé api publique secrète bearer authentification credentials","/docs/integrations/direct":"api directe session tentative paiement mobile money pays opérateurs montant statut countryCode operatorId phoneNumber ussdCode OTP USSD Kotlin Côte d’Ivoire Burkina Faso Orange Money","/docs/integrations/hosted":"redirection hébergée checkout page payment link checkoutPath returnUrl compte à rebours client paiement Hosted Checkout","/docs/api-reference":`${se.map(i=>`${i.method} ${i.path} ${i.description}`).join(" ")} frais LinkFlow pays opérateurs session tentative statut idempotence`,"/docs/webhooks":"webhook événements notifications signature retries livraisons payment.succeeded payment.failed HMAC","/docs/reference":"erreurs idempotence expiration sécurité limites 400 401 403 404 409 429 503 Retry-After environnement XOF uncertain"};function re(i){return i.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|(?:\/\/|#).*|--[A-Za-z-]+|\$[A-Za-z_]\w*|\b(?:curl|const|let|var|await|async|function|if|throw|import|from|def|return|new|true|false|null|None)\b|\b\d+(?:\.\d+)?\b)/gm).map((c,o)=>{if(!c)return null;let m="";return/^(["'`])/.test(c)?m="sf-docs-token-string":/^(\/\/|#)/.test(c)?m="sf-docs-token-comment":/^--/.test(c)?m="sf-docs-token-option":/^\$/.test(c)?m="sf-docs-token-variable":/^\d/.test(c)?m="sf-docs-token-number":/^(curl|const|let|var|await|async|function|if|throw|import|from|def|return|new|true|false|null|None)$/.test(c)&&(m="sf-docs-token-keyword"),m?e.jsx("span",{className:m,children:c},o):c})}const Y=`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "merchantReference": "ORDER-2026-0042",
  "mode": "hosted",
  "state": "created",
  "amountMinor": 12500,
  "currency": "XOF",
  "checkoutPath": "/pay/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  "clientToken": "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
  "publicKey": "sfpk_live_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "expiresAt": "2026-10-29T11:30:00.000Z"
}`,ke=`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "merchantReference": "ORDER-2026-0043",
  "mode": "direct",
  "state": "created",
  "amountMinor": 12500,
  "currency": "XOF",
  "checkoutPath": null,
  "clientToken": "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
  "publicKey": "sfpk_live_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "expiresAt": "2026-10-29T11:30:00.000Z"
}`,Ce=`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
  "state": "waiting",
  "amountMinor": 12500,
  "currency": "XOF",
  "ussdCode": null,
  "pollToken": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "merchantReference": "ORDER-2026-0043"
}`;function S({language:i,label:r,response:c,caption:o}){const[m,p]=g.useState(!1),f=U(),C=c.replaceAll("12500",String(f.data?.minimumDepositMinor??12500)),b=async()=>{try{await navigator.clipboard.writeText(C),p(!0),window.setTimeout(()=>p(!1),1600)}catch{p(!1)}};return e.jsxs("div",{className:"sf-docs-code","data-testid":"panel-response-example",children:[e.jsxs("div",{className:"sf-docs-code-head",children:[e.jsx("span",{className:"sf-docs-code-label",children:r}),e.jsx("div",{className:"sf-docs-code-tools",children:e.jsxs("button",{type:"button",className:"sf-docs-copy",onClick:()=>{b()},"data-testid":"button-copy-response",children:[m?e.jsx(Q,{size:13}):e.jsx(ee,{size:13}),m?i==="fr"?"Copié":"Copied":i==="fr"?"Copier":"Copy"]})})]}),e.jsx("pre",{children:e.jsx("code",{children:re(C)})}),e.jsx("div",{className:"sf-docs-code-note",children:o??(i==="fr"?"JSON · valeurs illustratives":"JSON · illustrative values")})]})}function l({language:i,label:r,example:c}){const[o,m]=g.useState("cURL"),[p,f]=g.useState(!1),C=U(),b=Se(c),R=we(c,o,C.data?.minimumDepositMinor??12500),_=async()=>{try{await navigator.clipboard.writeText(R),f(!0),window.setTimeout(()=>f(!1),1600)}catch{f(!1)}};return e.jsxs("div",{className:"sf-docs-code","data-testid":"panel-code-example",children:[e.jsxs("div",{className:"sf-docs-code-head",children:[e.jsx("span",{className:"sf-docs-code-label",children:r}),e.jsxs("div",{className:"sf-docs-code-tools",children:[e.jsx("div",{className:"sf-docs-code-lang",role:"group","aria-label":i==="fr"?"Format du code":"Code format",children:b.map(v=>e.jsx("button",{type:"button",className:o===v?"is-active":"",onClick:()=>m(v),"aria-pressed":o===v,"data-testid":`button-code-language-${v.toLowerCase()}`,children:v},v))}),e.jsxs("button",{type:"button",className:"sf-docs-copy",onClick:()=>{_()},"data-testid":"button-copy-code",children:[p?e.jsx(Q,{size:13}):e.jsx(ee,{size:13}),p?i==="fr"?"Copié":"Copied":i==="fr"?"Copier":"Copy"]})]})]}),e.jsx("pre",{children:e.jsx("code",{children:re(R)})}),e.jsxs("div",{className:"sf-docs-code-note",children:[L[i].codeNote," · ",o]})]})}function Be(){const[i]=ue(),[r,c]=g.useState("fr"),[o,m]=g.useState(""),[p,f]=g.useState(!1),[C,b]=g.useState(null),[R,_]=g.useState(()=>new Set([...N.map(n=>n.id),"resources"])),v=pe(i),x=v??"home",j=C?.path===i?C.section:"",t=L[r],B=U(v!==null),H=g.useMemo(()=>O.filter(n=>`${L[r][n.key]??n.label} ${n.label} ${n.search??Te[n.path]??""}`.toLowerCase().includes(o.trim().toLowerCase())),[r,o]);g.useEffect(()=>{if(!p)return;const n=document.body.style.overflow,s=a=>{a.key==="Escape"&&f(!1)};return document.body.style.overflow="hidden",window.addEventListener("keydown",s),()=>{document.body.style.overflow=n,window.removeEventListener("keydown",s)}},[p]),g.useEffect(()=>{const n=()=>{const s=window.location.hash.slice(1),a=O.some(k=>k.path===i&&k.section===s);b(s&&a?{path:i,section:s}:null)};return n(),window.addEventListener("hashchange",n),window.addEventListener("popstate",n),()=>{window.removeEventListener("hashchange",n),window.removeEventListener("popstate",n)}},[i]);const z=n=>{_(s=>{const a=new Set(s);return a.has(n)?a.delete(n):a.add(n),a})},ne=n=>n.path===i&&(n.section??"")===j,ie=n=>{f(!1),b(n.section?{path:n.path,section:n.section}:null),window.setTimeout(()=>window.scrollTo({top:0,behavior:"auto"}),50)},ae=`${x}Title`,w=O.find(n=>n.path===i&&n.section===j),K=w?t.sectionPageIntro:t[`${x}Sub`]??t.homeSub,M=w?t[w.key]??w.label:t[ae]??t.homeTitle;if(me({path:i,locale:r,title:v?`${M} · SendFlow`:"Page introuvable · SendFlow",description:v?K:"La page de documentation demandée est introuvable.",robots:v?"index,follow":"noindex,nofollow"}),!v)return e.jsx(he,{});const oe=N.map(n=>({key:n.labelKey,items:H.filter(s=>s.group===n.id)})),ce=()=>e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"sf-docs-eyebrow",children:"SENDFLOW / API"}),e.jsx("h1",{className:"sf-docs-title",children:t.homeTitle}),e.jsx("p",{className:"sf-docs-lede",children:t.homeSub}),e.jsxs("section",{className:"sf-docs-section sf-docs-home-methods",children:[e.jsx("h2",{children:t.methods}),e.jsx("p",{children:t.methodsSub}),e.jsxs("div",{className:"sf-docs-cards",children:[e.jsxs(h,{href:"/docs/integrations/hosted",className:"sf-docs-card sf-docs-card-link","data-testid":"card-docs-hosted",children:[e.jsx("div",{className:"sf-docs-card-art",children:e.jsx("img",{src:ge,alt:r==="fr"?"Illustration 3D d’un paiement sécurisé par téléphone":"3D illustration of a secure mobile payment",loading:"lazy"})}),e.jsxs("div",{className:"sf-docs-card-top",children:[e.jsx("span",{className:"sf-docs-card-icon",children:e.jsx(Z,{size:19})}),e.jsx(A,{className:"sf-docs-card-arrow",size:16})]}),e.jsx("h3",{children:t.hostedCard}),e.jsx("p",{children:t.hostedCardSub}),e.jsxs("dl",{className:"sf-docs-method-details",children:[e.jsxs("div",{children:[e.jsx("dt",{children:t.methodLevel}),e.jsx("dd",{children:t.simpleLevel})]}),e.jsxs("div",{children:[e.jsx("dt",{children:t.methodControl}),e.jsx("dd",{children:t.hostedControl})]}),e.jsxs("div",{children:[e.jsx("dt",{children:t.methodIntegration}),e.jsx("dd",{children:t.sessionRedirect})]}),e.jsxs("div",{children:[e.jsx("dt",{children:t.methodReturn}),e.jsx("dd",{children:t.returnToConfirm})]})]}),e.jsxs("span",{className:"sf-docs-card-cta",children:[t.hostedGuide,e.jsx(A,{size:13})]})]}),e.jsxs(h,{href:"/docs/integrations/direct",className:"sf-docs-card sf-docs-card-link","data-testid":"card-docs-direct",children:[e.jsx("div",{className:"sf-docs-card-art",children:e.jsx("img",{src:xe,alt:r==="fr"?"Illustration 3D d’un développeur intégrant SendFlow":"3D illustration of a developer integrating SendFlow",loading:"lazy"})}),e.jsxs("div",{className:"sf-docs-card-top",children:[e.jsx("span",{className:"sf-docs-card-icon",children:e.jsx(D,{size:19})}),e.jsx(A,{className:"sf-docs-card-arrow",size:16})]}),e.jsx("h3",{children:t.directCard}),e.jsx("p",{children:t.directCardSub}),e.jsxs("dl",{className:"sf-docs-method-details",children:[e.jsxs("div",{children:[e.jsx("dt",{children:t.methodLevel}),e.jsx("dd",{children:t.developerLevel})]}),e.jsxs("div",{children:[e.jsx("dt",{children:t.methodControl}),e.jsx("dd",{children:t.highControl})]}),e.jsxs("div",{children:[e.jsx("dt",{children:t.methodIntegration}),e.jsx("dd",{children:t.restApi})]}),e.jsxs("div",{children:[e.jsx("dt",{children:t.methodAuth}),e.jsx("dd",{children:t.authContract})]})]}),e.jsxs("span",{className:"sf-docs-card-cta",children:[t.directGuide,e.jsx(A,{size:13})]})]})]})]}),e.jsxs("div",{className:"sf-docs-meta",children:[e.jsxs("span",{className:"sf-docs-status",children:[e.jsx("i",{className:"sf-docs-status-dot"}),t.badge]}),e.jsx("span",{children:t.prod})]}),e.jsxs("div",{className:"sf-docs-warning",role:"note",children:[e.jsx(u,{size:16,"aria-hidden":"true"}),e.jsxs("div",{children:[e.jsx("strong",{children:t.disclaimerTitle}),t.disclaimer]})]}),e.jsxs("div",{className:"sf-docs-warning",role:"note",children:[e.jsx(u,{size:16,"aria-hidden":"true"}),e.jsxs("div",{children:[e.jsx("strong",{children:t.apiAvailabilityTitle}),t.apiAvailabilityText]})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.capabilitiesTitle}),e.jsxs("ul",{className:"sf-docs-list",children:[e.jsx("li",{children:t.capabilitySession}),e.jsx("li",{children:t.capabilityCheckout}),e.jsx("li",{children:t.capabilityStatus}),e.jsx("li",{children:t.capabilityWebhook})]}),e.jsxs("div",{className:"sf-docs-callout sf-docs-base-url",children:[e.jsx("strong",{children:t.baseUrlTitle}),e.jsx("span",{children:t.baseUrlPending})]})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.threeSteps}),e.jsx("div",{className:"sf-docs-steps",children:[["1",t.stepOne,t.stepOneSub,"/docs/integrations/direct"],["2",t.stepTwo,t.stepTwoSub,"/docs/authentication"],["3",t.stepThree,t.stepThreeSub,"/docs/reference"]].map(([n,s,a,k])=>e.jsxs("div",{className:"sf-docs-step",children:[e.jsx("span",{className:"sf-docs-step-index",children:n}),e.jsxs("div",{children:[e.jsx("strong",{children:s}),e.jsx("p",{children:a})]}),e.jsxs(h,{href:k,children:[t.read,e.jsx(A,{size:13})]})]},n))})]}),e.jsxs("section",{className:"sf-docs-support",children:[e.jsxs("div",{children:[e.jsx("h3",{children:t.support}),e.jsx("p",{children:t.supportSub})]}),e.jsxs("a",{href:"mailto:support@sendflow01.com","data-testid":"link-docs-support",children:[e.jsx(I,{size:15}),t.contact]})]})]}),de=()=>{const n=s=>!j||j===s;return e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"sf-docs-breadcrumb",children:[e.jsx(h,{href:"/docs",onClick:()=>b(null),children:t.breadcrumb}),e.jsx(P,{size:12}),e.jsx("span",{children:w?t[w.key]??w.label:t[x]??t.home})]}),e.jsx("div",{className:"sf-docs-eyebrow",children:"SENDFLOW / API"}),e.jsx("h1",{className:"sf-docs-title",children:M}),e.jsx("p",{className:"sf-docs-lede",children:K}),e.jsx("div",{className:"sf-docs-meta",children:e.jsxs("span",{className:"sf-docs-status",children:[e.jsx("i",{className:"sf-docs-status-dot"}),t.endpointStatus]})}),x==="start"&&e.jsxs(e.Fragment,{children:[e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.whatIs}),e.jsx("p",{children:t.whatIsText}),e.jsx("div",{className:"sf-docs-steps",children:y[r].stepTitles.map((s,a)=>e.jsxs("div",{className:"sf-docs-step",children:[e.jsxs("span",{className:"sf-docs-step-index",children:["0",a+1]}),e.jsxs("div",{children:[e.jsx("strong",{children:s}),e.jsx("p",{children:y[r].stepTexts[a]})]})]},s))})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.prerequisites}),e.jsxs("ul",{className:"sf-docs-list",children:[e.jsx("li",{children:t.notDocumentedText}),e.jsx("li",{children:t.noCredentials}),e.jsx("li",{children:t.baseUrlPending})]}),e.jsxs("div",{className:"sf-docs-warning",role:"note",children:[e.jsx(u,{size:16,"aria-hidden":"true"}),e.jsxs("div",{children:[e.jsx("strong",{children:t.apiAvailabilityTitle}),t.apiAvailabilityText]})]}),e.jsx(l,{language:r,label:r==="fr"?"Créer une session Hosted Checkout":"Create a Hosted Checkout session",example:"create-hosted"}),e.jsx(S,{language:r,label:r==="fr"?"Réponse de session illustrative":"Illustrative session response",response:Y})]})]}),x==="auth"&&e.jsxs(e.Fragment,{children:[e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.notDocumented}),e.jsx("p",{children:t.notDocumentedText}),e.jsx("p",{children:t.rotationText}),e.jsx("div",{className:"sf-docs-callout",children:t.serverOnly}),e.jsx(l,{language:r,label:t.codeLabel,example:"read-session"})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.credentialRolesTitle}),e.jsxs("table",{className:"sf-docs-reference-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:t.credentialHeader}),e.jsx("th",{children:t.credentialUseHeader}),e.jsx("th",{children:t.credentialHandlingHeader})]})}),e.jsx("tbody",{children:y[r].credentialRows.map(s=>e.jsxs("tr",{children:[e.jsx("td",{"data-label":t.credentialHeader,children:s.credential}),e.jsx("td",{"data-label":t.credentialUseHeader,children:s.usedFor}),e.jsx("td",{"data-label":t.credentialHandlingHeader,children:s.handling})]},s.credential))})]})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.prerequisites}),e.jsxs("ul",{className:"sf-docs-list",children:[e.jsx("li",{children:t.noCredentials}),e.jsx("li",{children:t.idempotencyText})]})]})]}),x==="direct"&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"sf-docs-warning",role:"note",children:[e.jsx(u,{size:16,"aria-hidden":"true"}),e.jsxs("div",{children:[e.jsx("strong",{children:t.apiAvailabilityTitle}),t.apiAvailabilityText]})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.model}),e.jsx("p",{children:t.modelTextDirect}),e.jsx("h3",{children:t.directFlow}),e.jsx("div",{className:"sf-docs-steps",children:y[r].directFlowTitles.map((s,a)=>e.jsxs("div",{className:"sf-docs-step",children:[e.jsxs("span",{className:"sf-docs-step-index",children:["0",a+1]}),e.jsxs("div",{children:[e.jsx("strong",{children:s}),e.jsx("p",{children:y[r].directFlowTexts[a]})]})]},s))}),e.jsx(l,{language:r,label:t.codeLabel,example:"create-direct"}),e.jsx(S,{language:r,label:t.responseExample,response:ke}),e.jsx(l,{language:r,label:t.codeLabel,example:"read-public-session"}),e.jsx("div",{className:"sf-docs-callout",children:t.androidDirectNote}),e.jsx("div",{className:"sf-docs-callout",children:t.directInputText}),e.jsx("div",{className:"sf-docs-callout",children:t.directCorsNote}),e.jsx(l,{language:r,label:t.codeLabel,example:"start-attempt"}),e.jsx(S,{language:r,label:t.responseExample,response:Ce}),e.jsx("div",{className:"sf-docs-callout",children:t.pollTokenNote}),e.jsx(l,{language:r,label:t.codeLabel,example:"poll-attempt"}),e.jsxs("div",{className:"sf-docs-callout",children:[e.jsxs("strong",{children:[t.mobileMoneyTitle,"."]})," ",t.mobileMoneyText]}),e.jsx("h3",{children:t.mobileMoneyActorsTitle}),e.jsx("div",{className:"sf-docs-endpoints",children:y[r].mobileMoneyActors.map(s=>e.jsxs("article",{className:"sf-docs-endpoint sf-docs-info",children:[e.jsx("div",{className:"sf-docs-endpoint-head",children:e.jsx("strong",{children:s.title})}),e.jsx("p",{children:s.body})]},s.title))}),e.jsx("h3",{children:t.mobileMoneyCountryTitle}),e.jsx("div",{className:"sf-docs-endpoints",children:y[r].mobileMoneyCards.map(s=>e.jsxs("article",{className:"sf-docs-endpoint sf-docs-info",children:[e.jsxs("div",{className:"sf-docs-endpoint-head",children:[e.jsxs("strong",{children:[s.flag&&e.jsxs("span",{"aria-hidden":"true",children:[s.flag," "]}),s.title,s.countryCode&&e.jsxs(e.Fragment,{children:[" ",e.jsx("code",{className:"sf-docs-inline-code",children:`country_code: "${s.countryCode}"`})]})]}),e.jsx("span",{className:"sf-docs-endpoint-pending",children:s.status})]}),e.jsx("p",{children:s.body})]},s.title))})]}),e.jsxs("div",{className:"sf-docs-callout",children:[e.jsx("strong",{children:t.webhookSharedNote})," ",e.jsx(h,{href:"/docs/webhooks",children:t.webhookGuideLink})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.responsibilities}),e.jsx("ul",{className:"sf-docs-list",children:y[r].responsibilitiesText.map(s=>e.jsx("li",{children:s},s))})]}),e.jsxs("div",{className:"sf-docs-warning",role:"note",children:[e.jsx(u,{size:16,"aria-hidden":"true"}),e.jsxs("div",{children:[e.jsx("strong",{children:t.disclaimerTitle}),t.disclaimer]})]})]}),x==="hosted"&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"sf-docs-warning",role:"note",children:[e.jsx(u,{size:16,"aria-hidden":"true"}),e.jsxs("div",{children:[e.jsx("strong",{children:t.apiAvailabilityTitle}),t.apiAvailabilityText]})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.model}),e.jsx("p",{children:t.modelTextHosted}),e.jsx("h3",{children:t.hostedFlow}),e.jsx("div",{className:"sf-docs-steps",children:y[r].hostedFlowTitles.map((s,a)=>e.jsxs("div",{className:"sf-docs-step",children:[e.jsxs("span",{className:"sf-docs-step-index",children:["0",a+1]}),e.jsxs("div",{children:[e.jsx("strong",{children:s}),e.jsx("p",{children:y[r].hostedFlowTexts[a]})]})]},s))}),e.jsx(l,{language:r,label:t.codeLabel,example:"create-hosted"}),e.jsx(S,{language:r,label:t.responseExample,response:Y}),e.jsx(l,{language:r,label:t.codeLabel,example:"read-session"}),e.jsxs("div",{className:"sf-docs-callout",children:[e.jsx("p",{children:t.hostedOriginText}),e.jsx("p",{children:t.returnUrlText}),e.jsx("p",{children:t.hostedFallbackText}),e.jsx("p",{children:t.hostedTimerText})]})]}),e.jsxs("div",{className:"sf-docs-callout",children:[e.jsx("strong",{children:t.webhookSharedNote})," ",e.jsx(h,{href:"/docs/webhooks",children:t.webhookGuideLink})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.responsibilities}),e.jsx("ul",{className:"sf-docs-list",children:y[r].responsibilitiesText.map(s=>e.jsx("li",{children:s},s))})]}),e.jsxs("div",{className:"sf-docs-warning",role:"note",children:[e.jsx(u,{size:16,"aria-hidden":"true"}),e.jsxs("div",{children:[e.jsx("strong",{children:t.disclaimerTitle}),t.disclaimer]})]})]}),x==="api"&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"sf-docs-warning",role:"note",children:[e.jsx(u,{size:16,"aria-hidden":"true"}),e.jsxs("div",{children:[e.jsx("strong",{children:t.apiAvailabilityTitle}),t.apiAvailabilityText]})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.reference}),e.jsx("p",{children:t.referenceIntro}),e.jsx("div",{className:"sf-docs-callout",children:t.globalHttpErrors}),e.jsx("div",{className:"sf-docs-endpoints",children:se.filter(s=>!j||s.anchor===j).map(s=>e.jsxs("article",{className:"sf-docs-endpoint","data-testid":`endpoint-card-${s.method.toLowerCase()}-${s.path.split("/").at(-1)}`,children:[e.jsxs("div",{className:"sf-docs-endpoint-head",children:[e.jsx("span",{className:`sf-docs-method-badge is-${s.method.toLowerCase()}`,children:s.method}),e.jsx("code",{children:s.path}),e.jsx("span",{className:"sf-docs-endpoint-pending",children:t.endpointStatus})]}),e.jsx("p",{children:t[s.description]}),e.jsxs("div",{className:"sf-docs-endpoint-access",children:[e.jsx("span",{children:t.endpointAccess}),e.jsx("strong",{children:t[s.access]})]}),e.jsx("p",{className:"sf-docs-endpoint-requirements",children:r==="fr"?s.requirementsFr:s.requirementsEn}),e.jsx("h3",{children:t.parametersTitle}),e.jsxs("table",{className:"sf-docs-reference-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:t.parameterFieldHeader}),e.jsx("th",{children:t.parameterTypeHeader}),e.jsx("th",{children:t.parameterRequirementHeader}),e.jsx("th",{children:t.parameterDescriptionHeader})]})}),e.jsx("tbody",{children:(r==="fr"?s.fieldsFr:s.fieldsEn).map(a=>e.jsxs("tr",{children:[e.jsx("td",{"data-label":t.parameterFieldHeader,children:e.jsx("code",{className:"sf-docs-inline-code",children:a.field})}),e.jsx("td",{"data-label":t.parameterTypeHeader,children:a.type}),e.jsx("td",{"data-label":t.parameterRequirementHeader,children:a.requirement}),e.jsx("td",{"data-label":t.parameterDescriptionHeader,children:a.description})]},a.field))})]}),e.jsx("p",{className:"sf-docs-endpoint-codes",children:r==="fr"?s.codesFr:s.codesEn}),e.jsxs("p",{className:"sf-docs-endpoint-requirements",children:[e.jsx("strong",{children:r==="fr"?"Erreurs et cas métier : ":"Errors and business cases: "}),r==="fr"?s.errorsFr:s.errorsEn]}),e.jsxs("details",{className:"sf-docs-endpoint-example",children:[e.jsx("summary",{children:t.requestExample}),e.jsx(l,{language:r,label:`${s.method} ${s.path}`,example:s.example})]}),e.jsxs("details",{className:"sf-docs-endpoint-example",children:[e.jsx("summary",{children:t.responseExample}),e.jsx(S,{language:r,label:`${t.responseExample} · JSON`,response:s.anchor==="payment-limits"&&B.data?JSON.stringify(B.data,null,2):s.response})]})]},s.path))}),e.jsx("p",{className:"sf-docs-endpoint-note",children:t.availableChoicesNote}),n("payout-api")&&e.jsxs("section",{className:"sf-docs-section sf-docs-section--nested",children:[e.jsx("h2",{children:t.payoutApiTitle}),e.jsx("p",{children:t.payoutApiText})]}),e.jsxs("div",{className:"sf-docs-callout",children:[e.jsxs("strong",{children:[t.apiScopeTitle,"."]})," ",t.apiScopeText]})]})]}),x==="webhooks"&&e.jsxs(e.Fragment,{children:[n("webhook-events")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.webhookEvents}),e.jsx("p",{children:t.webhookEventsSub}),e.jsxs("div",{className:"sf-docs-card",style:{marginTop:15},children:[e.jsxs("div",{className:"sf-docs-card-top",children:[e.jsx("span",{className:"sf-docs-card-icon",children:e.jsx(E,{size:18})}),e.jsx("span",{className:"sf-docs-status",children:t.endpointStatus})]}),e.jsx("h3",{children:t.eventNames}),e.jsxs("ul",{className:"sf-docs-list",children:[e.jsx("li",{children:e.jsx("code",{className:"sf-docs-inline-code",children:"payment.succeeded"})}),e.jsx("li",{children:e.jsx("code",{className:"sf-docs-inline-code",children:"payment.failed"})})]})]}),e.jsx(S,{language:r,label:`${t.responseExample} · payment.succeeded`,response:`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644",
  "type": "payment.succeeded",
  "createdAt": "2026-10-29T10:31:00.000Z",
  "data": {
    "sessionId": "00000000-0000-4000-8000-000000000001",
    "merchantReference": "ORDER-2026-0042",
    "attemptId": "00000000-0000-4000-8000-000000000002",
    "transactionId": "00000000-0000-4000-8000-000000000003",
    "amountMinor": 12500,
    "currency": "XOF",
    "status": "succeeded"
  }
}`}),e.jsx(S,{language:r,label:`${t.responseExample} · payment.failed`,response:`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28645",
  "type": "payment.failed",
  "createdAt": "2026-10-29T10:32:00.000Z",
  "data": {
    "sessionId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
    "merchantReference": "ORDER-2026-0042",
    "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
    "transactionId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28643",
    "amountMinor": 12500,
    "currency": "XOF",
    "status": "failed"
  }
}`})]}),n("webhook-signature")||j==="webhook-retries"?e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.delivery}),e.jsx("p",{children:t.deliveryText}),e.jsxs("div",{className:"sf-docs-callout",children:[e.jsx("strong",{children:t.webhookHeadersTitle}),e.jsx("p",{children:t.webhookHeadersText}),e.jsx("pre",{className:"sf-docs-response",children:e.jsx("code",{children:`sendflow-event: payment.succeeded
sendflow-delivery: 9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644
sendflow-signature: t=<unix-timestamp>,v1=<hex-signature>`})})]}),e.jsx(S,{language:r,label:`${t.responseExample} · JSON`,response:`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644",
  "type": "payment.succeeded",
  "createdAt": "2026-10-29T10:30:00.000Z",
  "data": {
    "sessionId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
    "merchantReference": "ORDER-2026-0042",
    "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
    "transactionId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28643",
    "amountMinor": 12500,
    "currency": "XOF",
    "status": "succeeded"
  }
}`}),e.jsx("div",{className:"sf-docs-callout",children:t.webhookPayloadNote}),e.jsx(l,{language:r,label:t.codeLabel,example:"webhook"})]}):null]}),x==="ref"&&e.jsxs(e.Fragment,{children:[n("security")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.security}),e.jsx("p",{children:t.securityText}),e.jsx(l,{language:r,label:t.codeLabel,example:"read-session"}),e.jsx(l,{language:r,label:t.codeLabel,example:"webhook"})]}),n("http-errors")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.errors}),e.jsx("p",{children:t.errorsText}),e.jsx("div",{className:"sf-docs-callout",children:t.globalHttpErrors}),e.jsx("h3",{children:t.httpErrorTableTitle}),e.jsxs("table",{className:"sf-docs-reference-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:t.errorStatusHeader}),e.jsx("th",{children:t.errorMeaningHeader}),e.jsx("th",{children:t.errorActionHeader})]})}),e.jsx("tbody",{children:y[r].httpErrorRows.map(s=>e.jsxs("tr",{children:[e.jsx("td",{"data-label":t.errorStatusHeader,children:e.jsx("code",{className:"sf-docs-inline-code",children:s.status})}),e.jsx("td",{"data-label":t.errorMeaningHeader,children:s.meaning}),e.jsx("td",{"data-label":t.errorActionHeader,children:s.action})]},s.status))})]}),e.jsx(S,{language:r,label:t.errorEnvelopeTitle,response:`{
  "error": "${r==="fr"?"Message d’erreur renvoyé par l’API":"Error message returned by the API"}"
}`}),e.jsx(l,{language:r,label:t.codeLabel,example:"handle-http-errors"})]}),n("http-errors")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.troubleshootingTitle}),e.jsx("div",{className:"sf-docs-endpoints",children:y[r].troubleshooting.map(s=>e.jsxs("article",{className:"sf-docs-endpoint sf-docs-info",children:[e.jsx("div",{className:"sf-docs-endpoint-head",children:e.jsx("strong",{children:s.symptom})}),e.jsx("p",{children:s.action})]},s.symptom))})]}),n("payment-states")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.statesTitle}),e.jsx("p",{children:t.statesText}),e.jsxs("table",{className:"sf-docs-reference-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:r==="fr"?"État":"State"}),e.jsx("th",{children:r==="fr"?"Signification":"Meaning"}),e.jsx("th",{children:r==="fr"?"Action marchande":"Merchant action"})]})}),e.jsx("tbody",{children:y[r].paymentStateRows.map(s=>e.jsxs("tr",{children:[e.jsx("td",{"data-label":r==="fr"?"État":"State",children:e.jsx("code",{className:"sf-docs-inline-code",children:s.state})}),e.jsx("td",{"data-label":r==="fr"?"Signification":"Meaning",children:s.meaning}),e.jsx("td",{"data-label":r==="fr"?"Action marchande":"Merchant action",children:s.action})]},s.state))})]}),e.jsx(l,{language:r,label:r==="fr"?"Lire le statut de session":"Read session status",example:"read-session"}),e.jsx(l,{language:r,label:r==="fr"?"Lire le statut d’une tentative directe":"Read direct attempt status",example:"poll-attempt"}),e.jsx(S,{language:r,label:r==="fr"?"Réponse de tentative · failed":"Attempt response · failed",response:`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
  "state": "failed",
  "amountMinor": 12500,
  "currency": "XOF",
  "ussdCode": null,
  "pollToken": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "merchantReference": "ORDER-2026-0043"
}`})]}),n("idempotency")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.idempotency}),e.jsx("p",{children:t.idempotencyText}),e.jsx(l,{language:r,label:t.codeLabel,example:"create-hosted"})]}),n("expiration")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.expiration}),e.jsx("p",{children:t.expirationText}),e.jsx(l,{language:r,label:t.codeLabel,example:"read-session"})]}),n("rate-limits")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.rateLimits}),e.jsx("p",{children:t.rateLimitsText}),e.jsx(l,{language:r,label:t.codeLabel,example:"handle-http-errors"})]}),n("service-availability")&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"sf-docs-callout",children:t.environmentNote}),e.jsxs("div",{className:"sf-docs-callout",children:[e.jsxs("strong",{children:[t.serviceAvailability,"."]})," ",t.serviceAvailabilityText]}),e.jsx(l,{language:r,label:t.codeLabel,example:"handle-http-errors"})]})]})]})};return e.jsxs("div",{className:"sf-docs",children:[e.jsxs("header",{className:"sf-docs-header",children:[e.jsx("button",{type:"button",className:"sf-docs-mobile-menu",onClick:()=>f(n=>!n),"aria-expanded":p,"aria-label":p?t.menuClose:t.contents,"data-testid":"button-docs-mobile-nav",children:p?e.jsx(F,{size:18}):e.jsx(G,{size:18})}),e.jsxs(h,{href:"/docs",className:"sf-docs-brand",onClick:()=>b(null),"aria-label":"SendFlow documentation","data-testid":"link-docs-home",children:[e.jsx("span",{className:"sf-docs-brand-mark",children:e.jsx("img",{src:X,alt:""})}),e.jsx("img",{className:"sf-docs-brand-word",src:J,alt:"SendFlow"})]}),e.jsxs("nav",{className:"sf-docs-nav","aria-label":"Main navigation",children:[e.jsx(h,{href:"/docs",className:i==="/docs"?"is-active":"",onClick:()=>b(null),"data-testid":"link-docs-top-home",children:t.navDocs}),e.jsx(h,{href:"/docs/getting-started",className:i==="/docs/getting-started"?"is-active":"",onClick:()=>b(null),"data-testid":"link-docs-top-guides",children:t.navGuides}),e.jsx(h,{href:"/docs/api-reference",className:i==="/docs/api-reference"?"is-active":"",onClick:()=>b(null),"data-testid":"link-docs-top-api",children:t.navApi}),e.jsx(h,{href:"/docs/webhooks",className:i==="/docs/webhooks"?"is-active":"",onClick:()=>b(null),"data-testid":"link-docs-top-webhooks",children:t.navWebhooks})]}),e.jsxs("div",{className:"sf-docs-header-tools",children:[e.jsx("button",{type:"button",className:"sf-docs-mobile-search",onClick:()=>f(!0),"aria-label":t.search,"data-testid":"button-docs-mobile-search",children:e.jsx(V,{size:18})}),e.jsx("button",{type:"button",className:"sf-docs-lang",onClick:()=>c(n=>n==="fr"?"en":"fr"),"aria-label":r==="fr"?"Switch to English":"Passer en français","data-testid":"button-docs-language",children:r==="fr"?"EN":"FR"})]})]}),e.jsxs("div",{className:"sf-docs-mobile-breadcrumb",children:[e.jsx("button",{type:"button",className:"sf-docs-mobile-crumb-menu",onClick:()=>f(n=>!n),"aria-expanded":p,"aria-label":p?t.menuClose:t.contents,"data-testid":"button-docs-mobile-crumb-menu",children:p?e.jsx(F,{size:17}):e.jsx(G,{size:17})}),e.jsx("span",{children:t.startGroup}),e.jsx(P,{size:15,"aria-hidden":"true"}),e.jsx("span",{className:"sf-docs-mobile-crumb-current",children:w?t[w.key]??w.label:t[x]??t.home})]}),e.jsxs("div",{className:"sf-docs-shell",children:[p&&e.jsx("button",{type:"button",className:"sf-docs-mobile-backdrop","aria-label":"Close documentation menu",onClick:()=>f(!1),"data-testid":"button-close-docs-sidebar"}),e.jsxs("aside",{className:`sf-docs-sidebar${p?" is-open":""}`,"aria-label":r==="fr"?"Navigation de la documentation":"Documentation navigation",children:[e.jsxs("div",{className:"sf-docs-drawer-head",children:[e.jsx("button",{type:"button",className:"sf-docs-drawer-close",onClick:()=>f(!1),"aria-label":t.menuClose,"data-testid":"button-close-docs-drawer",children:e.jsx(F,{size:18})}),e.jsxs(h,{href:"/docs",className:"sf-docs-drawer-brand",onClick:()=>{f(!1),b(null)},"aria-label":"SendFlow documentation","data-testid":"link-docs-drawer-brand",children:[e.jsx("img",{className:"sf-docs-drawer-mark",src:X,alt:""}),e.jsx("img",{className:"sf-docs-drawer-word",src:J,alt:"SendFlow"})]}),e.jsx("button",{type:"button",className:"sf-docs-drawer-language",onClick:()=>c(n=>n==="fr"?"en":"fr"),"aria-label":r==="fr"?"Switch to English":"Passer en français",children:r==="fr"?"EN":"FR"})]}),e.jsxs("label",{className:"sf-docs-search",children:[e.jsx(V,{size:15,"aria-hidden":"true"}),e.jsx("input",{type:"search",value:o,onChange:n=>m(n.target.value),placeholder:t.search,"aria-label":t.search,"data-testid":"input-docs-search"}),e.jsx("kbd",{children:"/"})]}),oe.filter(n=>n.items.length>0).map(n=>{const s=N.find(d=>d.labelKey===n.key)?.icon??$,a=N.find(d=>d.labelKey===n.key)?.id??n.key,k=R.has(a)||!!o.trim();return e.jsxs("section",{className:`sf-docs-nav-group${k?" is-open":""}${n.items.some(d=>d.path===i)?" is-active":""}`,children:[e.jsxs("button",{type:"button",className:"sf-docs-group-toggle",onClick:()=>z(a),"aria-expanded":k,"aria-controls":`docs-nav-${a}`,"data-testid":`button-docs-group-${a}`,children:[e.jsx(s,{size:15,"aria-hidden":"true"}),e.jsx("span",{children:t[n.key]}),e.jsx(P,{className:"sf-docs-group-chevron",size:15,"aria-hidden":"true"})]}),e.jsx("div",{className:"sf-docs-nav-items",id:`docs-nav-${a}`,hidden:!k,children:n.items.map(d=>{const le=d.icon,W=ne(d);return e.jsxs(h,{href:d.section?`${d.path}#${d.section}`:d.path,onClick:()=>ie(d),className:`sf-docs-side-link${W?" is-active":""}`,"aria-current":W?"page":void 0,"data-testid":`link-docs-${d.key}-${d.section??"page"}`,children:[e.jsx(le,{size:13}),t[d.key]??d.label]},`${d.path}:${d.section??"page"}`)})})]},n.key)}),o&&H.length===0&&e.jsx("div",{className:"sf-docs-search-empty",children:t.noResults}),(!o||`${t.resources} ${t.contact} support contact`.toLowerCase().includes(o.trim().toLowerCase()))&&e.jsxs("section",{className:`sf-docs-nav-group${R.has("resources")||o.trim()?" is-open":""}`,children:[e.jsxs("button",{type:"button",className:"sf-docs-group-toggle",onClick:()=>z("resources"),"aria-expanded":R.has("resources")||!!o.trim(),"aria-controls":"docs-nav-resources","data-testid":"button-docs-group-resources",children:[e.jsx(I,{size:15,"aria-hidden":"true"}),e.jsx("span",{children:t.resources}),e.jsx(P,{className:"sf-docs-group-chevron",size:15,"aria-hidden":"true"})]}),e.jsx("div",{className:"sf-docs-nav-items",id:"docs-nav-resources",hidden:!R.has("resources")&&!o.trim(),children:e.jsxs("a",{className:"sf-docs-side-link",href:"mailto:support@sendflow01.com","data-testid":"link-docs-sidebar-support",children:[e.jsx(I,{size:13}),t.contact]})})]}),e.jsxs("div",{className:"sf-docs-sidebar-note",children:[e.jsx(u,{size:15}),e.jsx("span",{children:t.prod})]})]}),e.jsxs("main",{className:"sf-docs-main",children:[e.jsx("article",{className:`sf-docs-content${x==="home"?" sf-docs-home":""}`,children:x==="home"?ce():de()},`${i}-${r}`),e.jsxs("footer",{className:"sf-docs-footer",children:[e.jsxs("span",{children:[t.copyright," · ",t.lastUpdated]}),e.jsxs("div",{className:"sf-docs-footer-links",children:[e.jsx(h,{href:"/docs/reference","data-testid":"link-docs-footer-security",children:t.security}),e.jsx(h,{href:"/docs/webhooks","data-testid":"link-docs-footer-webhooks",children:t.navWebhooks}),e.jsx("a",{href:"mailto:support@sendflow01.com","data-testid":"link-docs-footer-support",children:t.contact})]})]})]})]})]})}export{Be as default};
