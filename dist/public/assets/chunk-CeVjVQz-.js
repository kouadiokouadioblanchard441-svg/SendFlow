import{c as te,u as pe,r as w,ba as me,f as he,j as e,bb as ye,X as U,L as y}from"./index-LP6D4TN8.js";import{s as Y}from"./chunk-C_5aVmjj.js";import{s as J}from"./chunk-IIVr9JQU.js";import{C as F}from"./chunk-Dh3SZuwR.js";import{W as $}from"./chunk-3fEsNx5u.js";import{S as A}from"./chunk-DE4K3c5h.js";import{A as R}from"./chunk-D0LqNpno.js";import{L as fe}from"./chunk-CtgFu9P-.js";import{E as D}from"./chunk-B037EvrO.js";import{M as V}from"./chunk-82NINau8.js";import{S as Z}from"./chunk-C_yIryFb.js";import{C as I}from"./chunk-BmvFdLpY.js";import{C as B}from"./chunk-CrTj4-JR.js";import{C as H}from"./chunk-Ct6fvxpg.js";const ve=[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]],z=te("book-open",ve);const be=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m4.93 4.93 4.24 4.24",key:"1ymg45"}],["path",{d:"m14.83 9.17 4.24-4.24",key:"1cb5xl"}],["path",{d:"m14.83 14.83 4.24 4.24",key:"q42g0n"}],["path",{d:"m9.17 14.83-4.24 4.24",key:"bqpfvv"}],["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}]],q=te("life-buoy",be),xe="/assets/docs-api-integration-3d-5uJTV2FA.webp",Se="/assets/docs-hosted-checkout-3d-3aidseFi.webp",b={apiBaseUrl:"https://merchent.business.sendflow.africa/api",checkoutOrigin:"https://payin.merchant.command.sendflow.africa",merchantApp:"https://merchent.business.sendflow.africa",publicSite:"https://sendflow.africa",documentation:"https://apis.docs.sendflow.africa"},se={"create-hosted":{cURL:`curl --request POST "$SENDFLOW_API_BASE_URL/v1/payment-sessions" \\
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
$session = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
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
$session = json_decode($response, true, 512, JSON_THROW_ON_ERROR);`,Python:`import os
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
$session = json_decode($response, true, 512, JSON_THROW_ON_ERROR);`,Python:`import os
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
$checkout = json_decode($response, true, 512, JSON_THROW_ON_ERROR);`,Python:`import os
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
    "firstName": "<first-name>",
    "lastName": "<last-name>",
    "countryCode": "CI",
    "operatorId": "<operator-id-from-session>",
    "phoneNumber": "<international-phone-number>"
  }'
# The response includes ussdCode when configured; it may be null. Never invent one.`,JavaScript:`const apiBaseUrl = "https://merchent.business.sendflow.africa/api";
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
// Keep attempt.pollToken private; this response is not proof of payment.`,PHP:`$body = [
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
    ]; // Return only this instruction; never construct a code locally.`,Python:`import os
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
}  # Display only this API-provided code; it can be null.`,Kotlin:`import java.io.IOException
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
$status = json_decode($response, true, 512, JSON_THROW_ON_ERROR);`,Python:`import os
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
console.log("Countries:", catalog.countries);
console.log("Operators and configured fees:", catalog.operators.map((operator) => ({
  countryId: operator.countryId,
  id: operator.id,
  name: operator.name,
  operations: operator.operations,
  fees: operator.fees,
})));`,"Node.js":`// Public pricing catalog; no merchant key is required.
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
})));`,PHP:`$ch = curl_init(rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/pricing");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
if ($response === false || curl_getinfo($ch, CURLINFO_RESPONSE_CODE) >= 400) {
    throw new RuntimeException("Pricing catalog unavailable");
}
$catalog = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
print_r($catalog["countries"]);
foreach ($catalog["operators"] as $operator) {
    print_r([
        "countryId" => $operator["countryId"],
        "id" => $operator["id"],
        "name" => $operator["name"],
        "operations" => $operator["operations"],
        "fees" => $operator["fees"],
    ]);
}`,Python:`import os
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
])`},"payment-limits":{cURL:`curl --request GET "$SENDFLOW_API_BASE_URL/payment-limits" \\
  --header "Accept: application/json"`,JavaScript:`const response = await fetch(
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
);`,"Node.js":`// Public read; the server still enforces configured limits on every payment.
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
);`,PHP:`$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/payment-limits";
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
    . $limits["maximumPayinMinor"] . " " . $limits["currency"];`,Python:`import json
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
)`,Kotlin:`val url = URL("\${BuildConfig.SENDFLOW_API_BASE_URL}/payment-limits")
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
}`},"payout-quote":{"Node.js":`// Read-only quote; no payout is created and no funds are reserved.
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
console.log(quote);`,Python:`import os
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
print(response.json())`,cURL:`curl --request POST "$SENDFLOW_API_BASE_URL/v1/payout-quote" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY" \\
  --header "Content-Type: application/json" \\
  --data '{
    "amountMinor": 12500,
    "currency": "XOF",
    "countryCode": "ci",
    "operatorId": "'"$PAYOUT_OPERATOR_ID"'",
    "feePayer": "merchant"
  }'`,PHP:`$apiBaseUrl = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/");
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
echo $body;`},"payout-create":{"Node.js":`// This endpoint currently returns 503 with payout_unavailable.
// No payout is created and no funds are reserved in that state.
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
if (response.status === 503 && result.code === "payout_unavailable") {
  console.log("No payout was created; no funds were reserved.");
} else if (!response.ok) {
  throw new Error(result.error ?? \`Payout request returned HTTP \${response.status}\`);
} else {
  console.log(result);
}`,Python:`import os
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
if response.status_code == 503 and result.get("code") == "payout_unavailable":
    print("No payout was created; no funds were reserved.")
else:
    response.raise_for_status()
    print(result)`,cURL:`curl --request POST "$SENDFLOW_API_BASE_URL/v1/payouts" \\
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
JSON`,PHP:`$apiBaseUrl = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/");
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
if ($status === 503 && ($result["code"] ?? null) === "payout_unavailable") {
    echo "No payout was created; no funds were reserved.";
} elseif ($body === false || $status < 200 || $status >= 300) {
    throw new RuntimeException("Payout request returned HTTP " . $status);
} else {
    echo $body;
}`},"payout-list":{"Node.js":`const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
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
console.log(result.items, "nextCursor:", result.nextCursor);`,Python:`import os
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
print("nextCursor:", result["nextCursor"])`,cURL:`curl --get "$SENDFLOW_API_BASE_URL/v1/payouts" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY" \\
  --data-urlencode "limit=25" \\
  --data-urlencode "status=processing"`,PHP:`$url = rtrim(getenv("SENDFLOW_API_BASE_URL"), "/") . "/v1/payouts?limit=25&status=processing";
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
echo "nextCursor: " . ($result["nextCursor"] ?? "none");`},"payout-read":{"Node.js":`const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
const secretKey = process.env.SENDFLOW_SECRET_KEY;
const payoutId = process.env.SENDFLOW_PAYOUT_ID;
if (!apiBaseUrl || !secretKey || !payoutId) throw new Error("Configure the payout ID and server key");

const response = await fetch(
  apiBaseUrl.replace(/\\/$/, "") + "/v1/payouts/" + encodeURIComponent(payoutId),
  { headers: { Authorization: "Bearer " + secretKey } },
);
const payout = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(payout.error ?? \`Payout read returned HTTP \${response.status}\`);
console.log(payout);`,Python:`import os
import requests

payout_id = os.environ["SENDFLOW_PAYOUT_ID"]
response = requests.get(
    os.environ["SENDFLOW_API_BASE_URL"].rstrip("/") + "/v1/payouts/" + payout_id,
    headers={"Authorization": f"Bearer {os.environ['SENDFLOW_SECRET_KEY']}"},
    timeout=15,
)
response.raise_for_status()
print(response.json())`,cURL:`curl --request GET "$SENDFLOW_API_BASE_URL/v1/payouts/$SENDFLOW_PAYOUT_ID" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY" \\
  --header "Accept: application/json"`,PHP:`$payoutId = getenv("SENDFLOW_PAYOUT_ID");
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
echo $body;`},"payout-cancel":{"Node.js":`const apiBaseUrl = process.env.SENDFLOW_API_BASE_URL;
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
console.log(result);`,Python:`import os
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
print(response.json())`,cURL:`curl --request POST "$SENDFLOW_API_BASE_URL/v1/payouts/$SENDFLOW_PAYOUT_ID/cancel" \\
  --header "Authorization: Bearer $SENDFLOW_SECRET_KEY" \\
  --header "Accept: application/json"`,PHP:`$payoutId = getenv("SENDFLOW_PAYOUT_ID");
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
echo $body;`},webhook:{cURL:`# Local receiver test only. Never send this synthetic event to production.
# MERCHANT_WEBHOOK_RECEIVER_URL is your own webhook receiver URL.
timestamp=$(date +%s)
body='{"id":"9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644","type":"payment.succeeded","createdAt":"2026-01-01T12:00:00.000Z","data":{"sessionId":"00000000-0000-4000-8000-000000000001","merchantReference":"ORDER-2026-0042","attemptId":"00000000-0000-4000-8000-000000000002","transactionId":"00000000-0000-4000-8000-000000000003","amountMinor":12500,"currency":"XOF","status":"succeeded"}}'
signature=$(printf '%s' "$timestamp.$body" | openssl dgst -sha256 -hmac "$SEND_FLOW_WEBHOOK_SECRET" | awk '{print $NF}')
curl --request POST "$MERCHANT_WEBHOOK_RECEIVER_URL" \\
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

# Verify the raw request bytes and timestamp freshness before processing.`}};function Te(a,h,s){let o=a;const i=b.apiBaseUrl,f=b.checkoutOrigin;if(s==="cURL"){const l=[];o.includes("$SENDFLOW_API_BASE_URL")&&l.push(`SENDFLOW_API_BASE_URL="${i}"`),h==="create-hosted"&&l.push(`SENDFLOW_CHECKOUT_ORIGIN="${f}"`),l.length&&(o=`${l.join(`
`)}
${o}`),h==="create-hosted"&&(o+=`
# Resolve the returned checkoutPath against "$SENDFLOW_CHECKOUT_ORIGIN" before redirecting.`)}if(s==="JavaScript"&&(o=o.replaceAll("${env.SENDFLOW_API_BASE_URL}",i),o=o.replaceAll("env.SENDFLOW_CHECKOUT_ORIGIN",`"${f}"`),o=o.replace(/^if \(!checkoutOrigin\) throw new Error\([^\n]+\);\n/gm,""),o=o.replaceAll("${process.env.SENDFLOW_API_BASE_URL}",i),o=o.replaceAll("process.env.SENDFLOW_API_BASE_URL",`"${i}"`)),s==="Node.js"&&(o=o.replaceAll("${process.env.SENDFLOW_API_BASE_URL}",i),o=o.replaceAll("process.env.SENDFLOW_API_BASE_URL",`process.env.SENDFLOW_API_BASE_URL || "${i}"`),o=o.replaceAll("process.env.SENDFLOW_CHECKOUT_ORIGIN",`process.env.SENDFLOW_CHECKOUT_ORIGIN || "${f}"`),o=o.replace(/^if \(!apiBaseUrl\) throw new Error\([^\n]+\);\n/gm,""),o=o.replace(/^if \(!checkoutOrigin\) throw new Error\([^\n]+\);\n/gm,""),o=o.replaceAll("!apiBaseUrl || ","")),s==="PHP"&&(o=o.replaceAll('getenv("SENDFLOW_API_BASE_URL")',`getenv("SENDFLOW_API_BASE_URL") ?: "${i}"`),o=o.replaceAll('getenv("SENDFLOW_CHECKOUT_ORIGIN")',`getenv("SENDFLOW_CHECKOUT_ORIGIN") ?: "${f}"`),o=o.replace(/\nif \(!\$checkoutOrigin\) \{\n\s+throw new RuntimeException\("Set the official SendFlow checkout origin first"\);\n\}/,"")),s==="Python"){const l=o.includes("SENDFLOW_API_BASE_URL");if(o=o.replaceAll('os.environ["SENDFLOW_API_BASE_URL"]',"API_BASE_URL"),o=o.replaceAll("os.environ['SENDFLOW_API_BASE_URL']","API_BASE_URL"),o=o.replaceAll('os.environ.get("SENDFLOW_CHECKOUT_ORIGIN")',"CHECKOUT_ORIGIN"),o=o.replace(/\nif not checkout_origin:\n\s+raise RuntimeError\("Set the official SendFlow checkout origin first"\)/,""),l||h==="create-hosted"){const u=o.split(`
`);let E=0,x=!1;for(;E<u.length;){const j=u[E].trim();if(!j||j.startsWith("#")||j.startsWith("import ")||j.startsWith("from ")){j==="import os"&&(x=!0),E+=1;continue}break}x||(u.splice(E,0,"import os"),E+=1);const T=[`API_BASE_URL = os.environ.get("SENDFLOW_API_BASE_URL", "${i}").rstrip("/")`,...h==="create-hosted"?[`CHECKOUT_ORIGIN = os.environ.get("SENDFLOW_CHECKOUT_ORIGIN", "${f}")`]:[]];u.splice(E,0,"",...T,""),o=u.join(`
`)}}return s==="Kotlin"&&(o=o.replaceAll("${BuildConfig.SENDFLOW_API_BASE_URL}",i),o=o.replaceAll("apiBaseUrl: String,",`apiBaseUrl: String = "${i}",`)),o}function ge(a,h,s=12500){const o=se[a][h];if(!o)throw new Error(`No ${h} example is available for ${a}`);const i=Te(o,a,h);return a==="create-hosted"||a==="create-direct"?i.replaceAll("12500",String(s)):i}function we(a){return Object.keys(se[a])}const L=[{path:"/docs",key:"home",label:"Documentation",group:"start",icon:z},{path:"/docs/getting-started",key:"start",label:"Getting started",group:"start",icon:R},{path:"/docs/authentication",key:"auth",label:"Authentication",group:"start",icon:fe},{path:"/docs/integrations/direct",key:"direct",label:"Direct API",group:"integration",icon:F},{path:"/docs/integrations/hosted",key:"hosted",label:"Hosted Checkout",group:"integration",icon:D},{path:"/docs/webhooks",key:"webhooks",label:"Webhooks",group:"webhooks",icon:$},{path:"/docs/reference",key:"reference",label:"Errors & security",group:"reliability",icon:A}],O=[{id:"start",labelKey:"startGroup",icon:z},{id:"integration",labelKey:"integrations",icon:F},{id:"webhooks",labelKey:"webhooksGroup",icon:$},{id:"reliability",labelKey:"reliabilityGroup",icon:A}],Q={fr:{navDocs:"Documentation",navGuides:"Guides",navApi:"API directe",navWebhooks:"Webhooks",search:"Rechercher dans la documentation…",menuClose:"Fermer le menu",startGroup:"Démarrer",sectionPageIntro:"Cette rubrique détaille le contrat SendFlow correspondant. Les exemples utilisent des données d’exemple et les blocages de disponibilité sont signalés.",integrations:"Parcours de paiement",webhooksGroup:"Webhooks",reliabilityGroup:"États, erreurs et sécurité",endpointGroupSessions:"1. Sessions serveur",endpointGroupDirect:"2. Caisse API directe",endpointGroupCatalog:"3. Catalogue public et limites",reference:"Référence",resources:"Ressources",noResults:"Aucun document ne correspond à cette recherche.",webhookRetries:"Relances et déduplication",home:"Documentation",start:"Bien démarrer",auth:"Authentification",direct:"API directe",hosted:"Paiement hébergé",webhooks:"Webhooks",ref:"Erreurs et sécurité",badge:"API REST · JSON",prod:"Documentation API SendFlow",homeTitle:"Intégrez SendFlow à votre plateforme",homeSub:"Découvrez les outils et les API nécessaires pour accepter les paiements avec SendFlow.",startTitle:"Démarrer",startWelcomeTitle:"Bienvenue sur SendFlow",startSub:"Intégrez les paiements Mobile Money de SendFlow à votre application avec un parcours hébergé ou une API directe.",authTitle:"Authentification",authSub:"Utilisez la clé secrète pour les appels serveur et la clé publique uniquement dans le parcours de caisse.",directTitle:"Intégration API directe",directSub:"Créez une session côté serveur, affichez les choix disponibles, puis suivez le statut confirmé par SendFlow.",hostedTitle:"Paiement par redirection",hostedSub:"Créez une session hébergée et redirigez le payeur vers le chemin de paiement SendFlow retourné par l’API.",apiTitle:"Référence API",apiSub:"Endpoints REST disponibles, paramètres, authentification, limites et réponses du contrat SendFlow.",webhooksTitle:"Webhooks",webhooksSub:"Configurez les notifications de paiement, vérifiez leur signature et traitez les livraisons répétées sans doublon.",refTitle:"Erreurs, idempotence et sécurité",refSub:"Réponses HTTP, durées, plafonds de requêtes et règles essentielles pour intégrer les paiements de façon fiable.",breadcrumb:"Documentation API",methods:"Choisissez votre méthode",methodsSub:"Les deux parcours utilisent des sessions SendFlow et la même confirmation serveur du paiement.",directCard:"API directe",directCardSub:"Votre serveur contrôle le parcours et orchestre l’expérience dans votre application.",hostedCard:"Paiement hébergé",hostedCardSub:"Votre serveur crée la session, puis redirige le client vers la page de paiement hébergée SendFlow.",methodLevel:"Niveau",methodControl:"Contrôle du parcours",methodIntegration:"Intégration",methodAuth:"Authentification",methodReturn:"Retour du paiement",developerLevel:"Développeur",simpleLevel:"Simple",highControl:"Élevé",hostedControl:"Limité à la page hébergée",restApi:"API REST",sessionRedirect:"Création de session puis redirection",authContract:"Clé secrète côté serveur",returnToConfirm:"Retour navigateur non probant",directGuide:"Voir le guide API directe",hostedGuide:"Voir le guide de redirection",capabilitiesTitle:"Ce que vous pouvez faire",capabilitySession:"Créer une session de paiement depuis votre serveur marchand.",capabilityCheckout:"Présenter un parcours hébergé SendFlow au payeur.",capabilityDirect:"Intégrer directement la caisse dans votre application.",capabilityStatus:"Consulter le statut d’une session et d’une tentative.",capabilityWebhook:"Recevoir les notifications de paiement réussi ou échoué par webhook.",baseUrlTitle:"Adresses de production",apiBaseUrlLabel:"API SendFlow · SENDFLOW_API_BASE_URL",checkoutOriginLabel:"Paiement hébergé · SENDFLOW_CHECKOUT_ORIGIN",merchantAppLabel:"Application marchand",publicSiteLabel:"Site public SendFlow",documentationUrlLabel:"Documentation API",baseUrlPending:"Copiez chaque adresse depuis son bloc. Configurez les variables nécessaires sur votre serveur marchand et ne placez jamais la clé secrète dans le navigateur.",quickstartTitle:"Démarrage rapide",quickstartPrereqTitle:"Prérequis",quickstartPrereqText:"Un compte marchand avec accès à l’API et une paire de clés SendFlow. Configurez SENDFLOW_API_BASE_URL et SENDFLOW_SECRET_KEY dans l’environnement de votre serveur. SENDFLOW_CHECKOUT_ORIGIN est nécessaire uniquement pour Hosted Checkout.",quickstartCatalogTitle:"Vérifier les pays, opérateurs et frais",quickstartCatalogText:"GET /pricing renvoie le catalogue public et les taux configurés. Cette lecture ne nécessite pas de clé secrète. Les choix proposés pour un paiement direct doivent ensuite être lus depuis sa session.",quickstartLimitsTitle:"Vérifier les limites de paiement",quickstartLimitsText:"GET /payment-limits renvoie les limites actuellement configurées. Le serveur valide toujours le montant au moment de créer la session.",quickstartDirectTitle:"Créer une session de paiement directe",quickstartDirectText:"Créez la session depuis votre serveur marchand avec un montant fixe en XOF et une clé Idempotency-Key unique pour cette opération. Le montant ne peut pas être modifié par le payeur.",quickstartChoicesTitle:"Charger les choix de paiement",quickstartChoicesText:"Utilisez l’identifiant, la clé publique et le jeton de la session créée. Affichez uniquement les pays et opérateurs renvoyés par cette session.",quickstartAttemptTitle:"Démarrer une tentative Mobile Money",quickstartAttemptText:"Après le choix du moyen, démarrez la tentative avec les champs prévus par l’API ; le montant reste celui de la session. L’opérateur adresse ensuite une demande de confirmation USSD au payeur, qui la valide sur son téléphone. Affichez ussdCode exactement s’il est renvoyé ; cette valeur peut être null.",quickstartStatusTitle:"Vérifier le statut",quickstartStatusText:"Relisez la session depuis votre serveur avec la clé secrète ou vérifiez le webhook après validation de sa signature. Ne confirmez la commande qu’après un état succeeded.",quickstartIntegrationNote:"Les adresses de production sont copiables dans les blocs ci-dessus. Remplacez les valeurs d’exemple par celles de votre compte et gardez la clé secrète côté serveur.",threeSteps:"Parcours recommandé",stepOne:"Créez votre compte marchand",stepOneSub:"Un compte marchand actif et éligible est requis pour utiliser les paiements API.",stepTwo:"Configurez vos clés API",stepTwoSub:"Créez ou régénérez votre paire dans l’espace Développeurs ; la clé secrète ne s’affiche qu’à sa création.",stepThree:"Intégrez SendFlow à votre application",stepThreeSub:"Créez la session côté serveur et vérifiez le résultat auprès de SendFlow.",read:"Lire le guide",support:"Besoin d’aide ?",supportSub:"Contactez l’équipe SendFlow pour toute question liée à votre intégration.",contact:"Contacter le support",disclaimerTitle:"Confirmation du paiement",disclaimer:"Ne marquez jamais une commande comme payée sur la seule base d’une redirection ou d’un état affiché dans le navigateur. Vérifiez le statut serveur ou traitez un webhook dont la signature est valide.",whatIs:"Paiements SendFlow pour les marchands",whatIsText:"SendFlow propose une API de paiement pour intégrer un parcours hébergé ou une caisse directe, puis vérifier les opérations côté serveur.",prerequisites:"Prérequis",noCredentials:"Ne placez jamais la clé secrète dans le navigateur, une application mobile distribuée, un dépôt public ou des journaux.",notDocumented:"Gestion des clés API",notDocumentedText:"Une paire initiale est créée à l’inscription et incluse dans la réponse de création du compte. Vous pouvez ensuite créer une nouvelle paire dans l’espace Développeurs ; cette opération révoque immédiatement l’ancienne. Les clés ne portent pas de permissions configurables par clé : SendFlow contrôle l’accès et l’éligibilité côté serveur selon l’opération. La clé secrète sert aux appels privés depuis votre serveur ; la clé publique sert uniquement aux appels de caisse du parcours direct.",rotationText:"La clé secrète complète est renvoyée uniquement dans la réponse d’inscription ou de création/régénération de la paire ; la liste des clés ne montre que son préfixe. Enregistrez-la dans un gestionnaire de secrets. Si vous l’avez perdue, régénérez la paire : l’ancienne est immédiatement désactivée.",serverOnly:"Envoyez la clé secrète dans l’en-tête Authorization: Bearer depuis votre serveur. Ne la transmettez jamais au client.",credentialRolesTitle:"Rôle et emplacement de chaque identifiant",credentialHeader:"Identifiant",credentialUseHeader:"Utilisation",credentialHandlingHeader:"Protection",pollTokenNote:"Le pollToken est un identifiant d’accès à la tentative. Préférez interroger l’état depuis votre serveur avec la clé secrète ; si le client doit le recevoir pour afficher la progression, gardez-le temporairement en mémoire et excluez-le des journaux, URL et outils analytiques.",codeLabel:"Exemple de requête",placeholder:"Requête API",endpointGroupNote:"Les endpoints sont regroupés par étape et par contexte d’exécution.",directExamplesTitle:"Exemples dans l’ordre du parcours",directStepCreate:"Étape 1 · Créer la session sur votre serveur",directStepRead:"Étape 2 · Charger les choix dans la caisse",directStepAttempt:"Étape 3 · Démarrer la tentative dans la caisse",directStepPoll:"Étape 4 · Vérifier le résultat",hostedExamplesTitle:"Exemples dans l’ordre du parcours",hostedStepCreate:"Étape 1 · Créer la session et préparer le lien",hostedStepStatus:"Étape 2 · Vérifier le statut côté serveur",model:"Parcours de paiement",modelTextDirect:"Créez la session avec mode direct depuis votre serveur. Le client lit ensuite la session publique, affiche les pays et opérateurs disponibles, lance une tentative pour le montant fixe, puis suit le statut.",modelTextHosted:"Créez la session avec mode hosted depuis votre serveur. L’API renvoie checkoutPath ; combinez-le avec la valeur SENDFLOW_CHECKOUT_ORIGIN copiée dans le bloc de production, puis redirigez le client.",apiAvailabilityTitle:"URL de production et statut des opérations",apiAvailabilityText:"Toutes les requêtes utilisent l’adresse API de production du bloc copiable « API SendFlow ». Statut actuel : la création d’une session PAYIN (POST /api/v1/payment-sessions) et le démarrage d’une tentative renvoient HTTP 503 avant toute création ; aucun paiement n’est lancé. La création PAYOUT (POST /api/v1/payouts) renvoie également HTTP 503 ; aucune demande n’est créée et aucun fonds n’est réservé. Le devis PAYOUT, lorsqu’il est disponible, reste une lecture seule. Les exemples décrivent le contrat SendFlow et ne signifient pas que ces opérations sont activées.",hostedOriginText:"checkoutPath reste un chemin relatif pour préserver le contrat API. Pour un paiement hébergé ou un lien LinkFlow, combinez-le avec la valeur copiée dans SENDFLOW_CHECKOUT_ORIGIN sur votre serveur marchand.",hostedFallbackText:"Après une confirmation succeeded, la page redirige vers returnUrl si elle a été fournie ; sinon, elle revient vers le site public SendFlow. La page ne redirige pas vers returnUrl après un échec confirmé. Une redirection reste une indication d’interface, jamais une preuve de paiement.",webhookSharedNote:"Les webhooks reflètent les événements enregistrés côté serveur. payout.succeeded n’est émis qu’après une confirmation finale vérifiée ; consultez le guide Webhooks pour vérifier la signature et dédupliquer les livraisons.",webhookGuideLink:"Ouvrir le guide Webhooks",mobileMoneyTitle:"Mobile Money et confirmation USSD",mobileMoneyText:"Après le démarrage de la tentative, l’opérateur adresse au payeur une demande de confirmation USSD qu’il valide sur son téléphone. L’application marchande ne doit ni intercepter ni reproduire cette étape. Le corps de requête reste celui du contrat API et ne transporte pas la validation opérateur. La session active détermine les pays, opérateurs et choix disponibles ; affichez uniquement les options qu’elle renvoie. Si une tentative renvoie ussdCode, affichez exactement cette valeur ; elle peut être null. Dans le catalogue, otpCommand décrit une instruction ou un menu opérateur, pas une confirmation à saisir dans votre application.",mobileMoneyFlowsTitle:"Résumé des parcours",mobileMoneyFlowHeader:"Parcours",mobileMoneyResponseHeader:"Réponse SendFlow",mobileMoneyActionHeader:"Action correcte",mobileMoneyActorsTitle:"Qui fait quoi dans le parcours Mobile Money ?",mobileMoneyCountryTitle:"Instructions renvoyées par la session",mobileMoneyCountryHeader:"Source",mobileMoneyStatusHeader:"Disponibilité",mobileMoneyCodeHeader:"Instruction",mobileMoneyDetailsHeader:"À respecter",androidDirectNote:"L’exemple Kotlin ci-dessous utilise les routes publiques de session directe depuis Android. Il s’agit d’un exemple REST, pas d’un SDK officiel ; il suppose kotlinx-coroutines-android. Créez la session sur votre serveur et transmettez seulement la clé publique et les jetons de session nécessaires.",directInputText:"Attention au format : la session peut renvoyer un code pays en minuscules (par exemple ci), mais la création de tentative exige deux lettres majuscules (CI). Convertissez-le en majuscules. phoneNumber doit inclure l’indicatif international renvoyé par la session (par exemple +225 suivi du numéro national). Utilisez operatorId directement depuis la réponse de session.",directCorsNote:"Les routes /api/v1/public/* ont leur propre configuration CORS : les appels navigateur sont autorisés sans cookies, en GET/POST/OPTIONS, avec Content-Type, X-SendFlow-Public-Key, X-SendFlow-Client-Token, X-LinkFlow-Attempt-Token et Idempotency-Key. La création et la lecture privée d’une session avec Authorization: Bearer restent côté serveur. N’exposez jamais la clé secrète dans le navigateur.",hostedTimerText:"La page hébergée affiche un compte à rebours d’attente de 10 minutes. Son expiration peut afficher une vue d’échec au payeur, mais le suivi serveur continue et une confirmation finale reçue ensuite prévaut. Le compte à rebours n’est pas un statut de paiement : vérifiez l’état serveur ou un webhook signé et traitez uncertain comme non final.",responsibilities:"Bonnes pratiques pour une intégration financière",endpointStatus:"API REST · JSON",endpointCreate:"Créer une session de paiement",endpointRead:"Consulter une session et son état",endpointChoices:"Lire la session publique et les choix disponibles (mode direct)",endpointAttempt:"Créer une tentative de paiement directe",endpointAttemptRead:"Consulter le statut d’une tentative",accessServerSecret:"Serveur marchand · clé secrète et clé d’idempotence",accessServerSecretRead:"Serveur marchand · clé secrète",accessPublicSession:"Caisse · clé publique et jeton de session",accessPublicAttempt:"Caisse · clé publique, jeton de session et clé d’idempotence",accessAttemptRead:"Caisse · clés publique et de session, jeton de tentative",endpointPricing:"Consulter les pays, opérateurs et frais publics",accessPublic:"Public · aucune clé requise",endpointAccess:"Authentification",availableChoicesNote:"GET /api/pricing renvoie le catalogue public et les taux configurés, mais ne constitue pas un devis de frais ou de règlement par session et ne garantit pas qu’un opérateur puisse traiter un paiement API. Les réponses de session n’exposent pas le montant net marchand. Les choix de la session directe sont filtrés selon le routage et les règles actuellement pris en charge ; utilisez-les comme source de vérité.",referenceIntro:"Les exemples ci-dessous correspondent aux routes et schémas présents dans l’API SendFlow.",requestExample:"Exemple de requête",responseExample:"Exemple de réponse",webhookEvents:"Événements webhook",webhookEventsSub:"Les événements disponibles sont payment.succeeded, payment.failed, payout.created, payout.processing, payout.succeeded, payout.failed et payout.uncertain. Les événements payout ne sont émis que pour les transitions enregistrées côté serveur ; payout.succeeded exige une confirmation finale vérifiée. La création payout reste bloquée tant que cette preuve n’est pas disponible.",webhookPayloadNote:"Les payloads paiement contiennent les identifiants de session, tentative et transaction. Les payloads payout contiennent la référence, les montants, les frais, le pays, l’opérateur et le statut, sans numéro de bénéficiaire. Le champ id correspond à l’UUID sendflow-delivery et reste stable lors des reprises. Le même contrôle de signature s’applique aux deux familles d’événements. N’insérez aucune donnée personnelle dans merchantReference.",eventNames:"Événements disponibles",delivery:"Signature et livraisons",deliveryText:"La signature HMAC-SHA256 est calculée sur la chaîne <horodatage>.<corps JSON brut>. Répondez en HTTP 2xx pour acquitter la livraison ; toute réponse non-2xx, erreur réseau ou expiration du délai sera retentée. Le délai de requête est de 8 secondes et le corps de réponse est limité à 8 Ko. SendFlow effectue 8 tentatives au total au maximum : l’envoi initial puis jusqu’à 7 reprises, espacées de 10 s, 30 s, 2 min, 10 min, 30 min, 2 h et 12 h. L’identifiant sendflow-delivery reste stable entre les reprises : utilisez-le pour dédupliquer.",webhookHeadersTitle:"En-têtes envoyés",webhookHeadersText:"sendflow-event identifie le type d’événement. sendflow-delivery contient le même UUID que payload.id et reste identique lors des reprises. sendflow-signature suit le format t=<horodatage Unix>,v1=<signature hexadécimale>. La signature est calculée sur les octets exacts du corps reçu. L’exemple de vérification choisit une fenêtre de fraîcheur de 300 secondes à titre de politique marchande ; SendFlow ne fixe pas cette valeur.",apiScopeTitle:"Sens des flux et disponibilité réelle",apiScopeText:"PAYIN : le client paie par Mobile Money ; après confirmation finale vérifiée côté serveur, le montant net est crédité au portefeuille SendFlow du marchand. PAYOUT : le marchand demande un transfert sortant depuis le solde disponible de son portefeuille vers le compte Mobile Money d’un bénéficiaire. SendFlow calcule les montants, frais et réservations côté serveur. État actuel : la création d’une session ou d’une tentative PAYIN répond HTTP 503 avant démarrage ; la création d’un PAYOUT répond HTTP 503 sans demande ni réservation. Les exemples documentent le contrat, mais ne signifient pas que ces créations sont ouvertes en production.",endpointLimits:"Limites de paiement",endpointLimitsDesc:"Renvoie les seuils FCFA actuellement configurés. Cette lecture publique ne remplace jamais la validation serveur.",endpointPayout:"Disponibilité API payout",payoutApiTitle:"Payout marchand via API",payoutApiText:"Le PAYOUT est un transfert sortant du portefeuille SendFlow du marchand authentifié vers le compte Mobile Money d’un bénéficiaire. Le solde utilisable est calculé après déduction des réservations actives ; les frais et montants sont validés côté serveur. Le devis ne réserve aucun fonds. operations.payout=true dans /api/pricing indique une configuration de catalogue, pas une disponibilité garantie. Actuellement, la création répond HTTP 503 avec payout_unavailable : aucune demande n’est créée et aucun fonds n’est réservé.",payoutQuoteTitle:"1. Calculer le devis",payoutQuoteText:"POST /api/v1/payout-quote est une lecture sans réservation. Repérez un pays et un opérateur avec operations.payout=true dans /api/pricing, puis envoyez amountMinor en entier XOF, countryCode en minuscules, son operatorId exact et feePayer (merchant ou beneficiary). La réponse inclut les montants calculés, le solde disponible, les limites, la version tarifaire et quoteExpiresAt. Une configuration ou un canal indisponible peut répondre 503.",payoutCreateTitle:"2. Envoyer une demande de payout",payoutCreateText:"POST /api/v1/payouts demande un transfert vers le compte Mobile Money du bénéficiaire. Il exige la clé secrète active du marchand dans Authorization: Bearer, Idempotency-Key (8–128 caractères), pays, opérateur, montant, devise, payeur de frais et numéro international correspondant au pays. Les clés ne portent pas de permissions configurables par clé : SendFlow vérifie l’état et l’éligibilité du compte côté serveur. SendFlow recalcule le tarif et le solde disponible ; le devis n’autorise pas le transfert. La création reste fermée : HTTP 503 payout_unavailable ne crée ni demande ni réservation. Réutilisez la même clé pour une reprise exacte.",payoutListTitle:"3. Lister les demandes",payoutListText:"GET /api/v1/payouts ne retourne que les demandes du marchand authentifié. limit accepte 1–100 (25 par défaut), cursor un UUID et status un état de payout.",payoutReadTitle:"4. Consulter une demande",payoutReadText:"GET /api/v1/payouts/{payoutId} exige l’UUID renvoyé par une demande existante du même marchand. Le téléphone du bénéficiaire est masqué.",payoutCancelTitle:"5. Annuler avant envoi",payoutCancelText:"POST /api/v1/payouts/{payoutId}/cancel ne fonctionne que si les fonds sont réservés et que l’exécution SendFlow n’a pas commencé. Après envoi ou si l’état ne permet plus l’annulation, l’API renvoie 409.",security:"Sécurité et fiabilité",errors:"Erreurs HTTP",idempotency:"Idempotence",expiration:"Expiration et montants",securityText:"Utilisez HTTPS. Stockez la clé secrète et le secret webhook (affiché une seule fois à sa création) dans un coffre sécurisé. Comparez la signature en temps constant, vérifiez la fraîcheur de l’horodatage et ne traitez l’événement qu’après validation.",errorsText:'Les routes documentées renvoient une erreur JSON sous la forme { "error": "…" }. Le contrat ne définit pas de code d’erreur machine stable : basez votre traitement sur le statut HTTP et vos propres règles, pas sur le texte du message. Pour la création PAYIN actuellement fermée, HTTP 503 arrive avant la création : aucun sessionId n’est renvoyé et aucun paiement n’est lancé ; il n’y a donc pas de session à consulter. Pour un paiement déjà créé, une erreur 503 de lecture ne prouve ni succès ni échec final : relisez le statut ou vérifiez le webhook. La création PAYOUT 503 ne crée aucune demande et ne réserve aucun fonds. Une redirection ou un état navigateur ne confirme jamais un paiement.',globalHttpErrors:'Une requête peut renvoyer 413 si son corps dépasse 100 Ko ou 415 si son encodage n’est pas pris en charge. Une erreur serveur inattendue peut renvoyer 500. Les réponses conservent le format JSON { "error": "…" } ; en cas de 500/503, ne déduisez jamais le résultat du paiement.',errorEnvelopeTitle:"Format d’erreur",httpErrorTableTitle:"Réponses HTTP et conduite à tenir",errorStatusHeader:"HTTP",errorMeaningHeader:"Signification",errorActionHeader:"Action recommandée",parametersTitle:"Paramètres du contrat",parameterFieldHeader:"Champ / emplacement",parameterTypeHeader:"Type",parameterRequirementHeader:"Exigence",parameterDescriptionHeader:"Description",noParameters:"Aucun paramètre de requête ni authentification n’est requis.",error400:"400 — corps, paramètres ou en-têtes invalides ; montant, devise, mode, URL HTTPS, métadonnées, pays, opérateur ou numéro non conformes au contrat.",error401:"401 — clé secrète absente, invalide ou révoquée. Vérifiez le secret côté serveur et l’en-tête Authorization: Bearer ; ne l’incluez jamais dans l’application cliente.",error403:"403 — compte marchand non autorisé ou non éligible à la création de paiements API.",error404:"404 — session, tentative ou identifiants publics indisponibles. Les identifiants publics invalides, une session expirée ou un mauvais mode peuvent aussi être masqués par cette réponse.",error409:"409 — référence marchand déjà utilisée ou clé Idempotency-Key réutilisée avec un corps différent. Pour une reprise, renvoyez la même requête avec la même clé ; une nouvelle opération métier reçoit une nouvelle clé.",error429:"429 — limite de requêtes atteinte. Respectez Retry-After: 60, ralentissez les vérifications de statut et ne relancez pas immédiatement.",error503:"503 — opération indisponible. Le résultat dépend de la route : une création refusée avant émission d’un identifiant ne peut pas être consultée ; pour une session ou tentative déjà créée, relisez le statut ou vérifiez le webhook. Ce statut seul ne prouve jamais un succès ni un échec final.",idempotencyText:"Pour chaque création de session ou de tentative, envoyez une clé Idempotency-Key stable de 8 à 128 caractères, sans espace en début ou fin. Une reprise avec la même clé et le même corps renvoie la même opération ; la réutiliser avec une autre demande renvoie 409. Une référence marchand déjà utilisée renvoie aussi 409. Utilisez une nouvelle clé uniquement pour une nouvelle opération métier.",expirationText:"Les sessions expirent une heure après leur création. Après expiration, les choix publics et le démarrage d’une tentative ne sont plus disponibles. La lecture serveur de la session et la vérification d’une tentative déjà créée restent possibles avec des identifiants valides. Le montant est fixe en XOF et doit respecter les limites actuellement renvoyées par GET /api/payment-limits ; le payeur ne peut pas le modifier.",rateLimits:"Limites de requêtes",rateLimitsText:"Par clé API et par fenêtre d’une minute : 30 créations de session, 120 lectures, 5 tentatives directes et 60 vérifications de statut. La création de session a aussi une limite de 10 par minute au niveau du compte marchand. Par adresse IP, les lectures publiques de session sont limitées à 120 par minute, les tentatives à 5 et les vérifications à 60. Les quotas de clé, de compte et d’adresse IP peuvent s’appliquer ensemble. En cas de limitation, l’API renvoie 429 et Retry-After: 60 ; attendez ce délai avant de reprendre.",statesTitle:"États d’un paiement",statesText:"Les états de session et de tentative décrivent l’avancement du paiement ; seul un état final confirmé peut déclencher la validation de votre commande.",serviceAvailability:"Adresses de production et suivi",serviceAvailabilityText:"Consultez le statut ou le webhook signé uniquement pour une session ou tentative déjà créée. Si la création répond 503 avant de renvoyer un identifiant, aucune session n’existe à consulter. Une redirection du navigateur ne constitue jamais une confirmation.",environmentNote:"Les adresses de production sont présentées individuellement dans des blocs copiables.",troubleshootingTitle:"Diagnostic rapide",hostedFlow:"Parcours de redirection",directFlow:"Parcours API directe",returnUrlTitle:"Configurer le retour après paiement",returnUrlText:"Pour chaque session hosted, renseignez le champ facultatif returnUrl dans le JSON de POST /api/v1/payment-sessions avec l’URL HTTPS de votre propre page de retour ; la requête copiable ci-dessus montre où la saisir. Ce champ n’est pas SENDFLOW_CHECKOUT_ORIGIN, qui désigne le checkout hébergé SendFlow. L’URL doit faire au plus 2 048 caractères et ne peut pas contenir d’identifiants intégrés. La redirection a lieu uniquement après confirmation succeeded ; après un échec, le checkout ne redirige pas vers returnUrl. Si le champ est omis, le checkout revient vers SendFlow. Vérifiez toujours le statut serveur ou le webhook signé : la redirection n’est pas une preuve de paiement.",language:"Langue",copyright:"SendFlow · Documentation API",lastUpdated:"Référence API v1",contents:"Sommaire"},en:{navDocs:"Documentation",navGuides:"Guides",navApi:"Direct API",navWebhooks:"Webhooks",search:"Search documentation…",menuClose:"Close menu",startGroup:"Start here",sectionPageIntro:"This section details the matching SendFlow contract. Examples use sample data, and current availability blocks are stated clearly.",integrations:"Payment flows",webhooksGroup:"Webhooks",reliabilityGroup:"States, errors & security",endpointGroupSessions:"1. Server sessions",endpointGroupDirect:"2. Direct checkout",endpointGroupCatalog:"3. Public catalog & limits",reference:"Reference",resources:"Resources",noResults:"No documents match your search.",webhookRetries:"Retries & deduplication",home:"Documentation",start:"Getting started",auth:"Authentication",direct:"Direct API",hosted:"Hosted Checkout",webhooks:"Webhooks",ref:"Errors & security",badge:"REST API · JSON",prod:"SendFlow API documentation",homeTitle:"Integrate SendFlow with your platform",homeSub:"Discover the tools and APIs you need to accept payments with SendFlow.",startTitle:"Get started",startWelcomeTitle:"Welcome to SendFlow",startSub:"Integrate SendFlow Mobile Money payments into your app with hosted checkout or a direct API flow.",authTitle:"Authentication",authSub:"Use the secret key for server requests and the public key only in the checkout flow.",directTitle:"Direct API integration",directSub:"Create a session server-side, display available choices, and follow the status confirmed by SendFlow.",hostedTitle:"Hosted payment redirect",hostedSub:"Create a hosted session and redirect the payer to the SendFlow payment path returned by the API.",apiTitle:"API reference",apiSub:"Available REST endpoints, parameters, authentication, limits, and SendFlow contract responses.",webhooksTitle:"Webhooks",webhooksSub:"Configure payment notifications, verify their signatures, and safely process repeated deliveries.",refTitle:"Errors, idempotency & security",refSub:"HTTP responses, session lifetimes, request limits, and essential rules for reliable payment integrations.",breadcrumb:"API documentation",methods:"Choose your integration method",methodsSub:"Both flows use SendFlow sessions and the same server-confirmed payment status.",directCard:"Direct API",directCardSub:"Your server controls the flow and orchestrates the experience in your application.",hostedCard:"Hosted payment",hostedCardSub:"Your server creates the session, then redirects the customer to the SendFlow hosted payment page.",methodLevel:"Level",methodControl:"Flow control",methodIntegration:"Integration",methodAuth:"Authentication",methodReturn:"Payment return",developerLevel:"Developer",simpleLevel:"Simple",highControl:"High",hostedControl:"Limited to hosted page",restApi:"REST API",sessionRedirect:"Create a session, then redirect",authContract:"Server-side secret key",returnToConfirm:"Browser redirect is not proof",directGuide:"View the direct API guide",hostedGuide:"View the redirect guide",capabilitiesTitle:"What you can do",capabilitySession:"Create a payment session from your merchant server.",capabilityCheckout:"Present a SendFlow-hosted payment flow to the payer.",capabilityDirect:"Integrate checkout directly into your application.",capabilityStatus:"Read the status of a session and payment attempt.",capabilityWebhook:"Receive successful or failed payment notifications by webhook.",baseUrlTitle:"Production URLs",apiBaseUrlLabel:"SendFlow API · SENDFLOW_API_BASE_URL",checkoutOriginLabel:"Hosted payment · SENDFLOW_CHECKOUT_ORIGIN",merchantAppLabel:"Merchant application",publicSiteLabel:"SendFlow public site",documentationUrlLabel:"API documentation",baseUrlPending:"Copy each address from its block. Set the required variables on your merchant server and never put your secret key in the browser.",quickstartTitle:"Quickstart",quickstartPrereqTitle:"Prerequisites",quickstartPrereqText:"A merchant account with API access and a SendFlow key pair. Set SENDFLOW_API_BASE_URL and SENDFLOW_SECRET_KEY in your server environment. SENDFLOW_CHECKOUT_ORIGIN is required only for Hosted Checkout.",quickstartCatalogTitle:"Check countries, operators, and fees",quickstartCatalogText:"GET /pricing returns the public catalog and configured rates. This read does not require a secret key. For direct payments, read the choices from the specific payment session.",quickstartLimitsTitle:"Check payment limits",quickstartLimitsText:"GET /payment-limits returns the currently configured limits. The server validates the amount again when creating a session.",quickstartDirectTitle:"Create a direct payment session",quickstartDirectText:"Create the session from your merchant server with a fixed XOF amount and a unique Idempotency-Key for this operation. The payer cannot change the amount.",quickstartChoicesTitle:"Load payment choices",quickstartChoicesText:"Use the ID, public key, and token from the created session. Display only the countries and operators returned for that session.",quickstartAttemptTitle:"Start a Mobile Money attempt",quickstartAttemptText:"After the payer chooses a method, start the attempt with the API fields; the session fixes the amount. The operator then sends a USSD confirmation request to the payer, who approves it on their phone. Display ussdCode exactly if returned; it may be null.",quickstartStatusTitle:"Check the status",quickstartStatusText:"Read the session from your server with the secret key, or verify the webhook signature. Confirm the order only after a succeeded state.",quickstartIntegrationNote:"Production addresses can be copied from the blocks above. Replace sample values with your account values and keep the secret key on your server.",threeSteps:"Recommended flow",stepOne:"Create your merchant account",stepOneSub:"An active, eligible merchant account is required to use API payments.",stepTwo:"Configure your API keys",stepTwoSub:"Create or regenerate your key pair in the Developers area; the secret key is shown only when created.",stepThree:"Integrate SendFlow into your app",stepThreeSub:"Create sessions server-side and verify results with SendFlow.",read:"Read the guide",support:"Need help?",supportSub:"Contact the SendFlow team with questions about your integration.",contact:"Contact support",disclaimerTitle:"Payment confirmation",disclaimer:"Never mark an order as paid based only on a redirect or a browser-side state. Verify the server status or process a webhook whose signature is valid.",whatIs:"SendFlow payments for merchants",whatIsText:"SendFlow provides a payment API for integrating hosted checkout or a direct checkout, with payment operations verified server-side.",prerequisites:"Prerequisites",noCredentials:"Never place the secret key in a browser, distributed mobile app, public repository, or client-side logs.",notDocumented:"API key management",notDocumentedText:"An initial pair is created at signup and included in the account-creation response. You can create a new pair later in the Developers area; doing so immediately revokes the previous pair. Keys do not have configurable per-key permissions: SendFlow checks account status and eligibility server-side for each operation. The secret key is for private server requests; the public key is used only for direct checkout requests.",rotationText:"The full secret key is returned only in the signup or key-pair creation/regeneration response; the key list shows only its prefix. Store it in a secret manager. If you lose it, regenerate the pair; the previous pair is immediately disabled.",serverOnly:"Send the secret key in the Authorization: Bearer header from your server. Never pass it to the client.",credentialRolesTitle:"Role and handling of each credential",credentialHeader:"Credential",credentialUseHeader:"Used for",credentialHandlingHeader:"Handling",pollTokenNote:"pollToken grants access to an attempt. Prefer checking status from your server with the secret key; if the client needs it to show progress, keep it in memory temporarily and exclude it from logs, URLs, and analytics.",codeLabel:"Request example",placeholder:"API request",endpointGroupNote:"Endpoints are grouped by integration step and execution context.",directExamplesTitle:"Examples in payment-flow order",directStepCreate:"Step 1 · Create the session on your server",directStepRead:"Step 2 · Load choices in checkout",directStepAttempt:"Step 3 · Start the attempt in checkout",directStepPoll:"Step 4 · Verify the result",hostedExamplesTitle:"Examples in payment-flow order",hostedStepCreate:"Step 1 · Create the session and prepare the link",hostedStepStatus:"Step 2 · Check status on your server",model:"Payment flow",modelTextDirect:"Create the session with mode direct from your server. The client then reads the public session, displays available countries and operators, starts an attempt for the fixed amount, and polls its status.",modelTextHosted:"Create the session with mode hosted from your server. The API returns checkoutPath; combine it with the copied SENDFLOW_CHECKOUT_ORIGIN value, then redirect the customer.",apiAvailabilityTitle:"Production API URL and operation status",apiAvailabilityText:"All requests use the production API address in the copyable “SendFlow API” block. Current status: PAYIN session creation (POST /api/v1/payment-sessions) and attempt startup return HTTP 503 before anything is created; no payment is initiated. PAYOUT creation (POST /api/v1/payouts) also returns HTTP 503; no request is created and no funds are reserved. A PAYOUT quote, when available, is read-only. The examples describe the SendFlow API contract and do not mean these operations are enabled.",hostedOriginText:"checkoutPath remains a relative path to preserve the API contract. For hosted payments and LinkFlow links, combine it with the SENDFLOW_CHECKOUT_ORIGIN value copied on your merchant server.",hostedFallbackText:"After succeeded is confirmed, the page redirects to returnUrl if provided; otherwise, it returns to the SendFlow public site. The page does not redirect to returnUrl after a confirmed failure. A redirect is a user-interface signal, never proof of payment.",webhookSharedNote:"Webhooks reflect server-recorded events. payout.succeeded is emitted only after verified final confirmation; see the Webhooks guide to verify signatures and deduplicate deliveries.",webhookGuideLink:"Open the Webhooks guide",mobileMoneyTitle:"Mobile Money and USSD confirmation",mobileMoneyText:"After an attempt starts, the operator sends a USSD confirmation request to the payer, who approves it on their phone. The merchant app must not intercept or reproduce that step. The API request body remains limited to the fields in its contract and does not carry the operator confirmation. The active session determines available countries, operators, and choices; display only what it returns. If an attempt returns ussdCode, display that exact value; it may be null. In the catalog, otpCommand describes an operator instruction or menu, not a confirmation to collect in your application.",mobileMoneyFlowsTitle:"Flow summary",mobileMoneyFlowHeader:"Flow",mobileMoneyResponseHeader:"SendFlow response",mobileMoneyActionHeader:"Correct action",mobileMoneyActorsTitle:"Who does what in a Mobile Money payment?",mobileMoneyCountryTitle:"Instructions returned by the session",mobileMoneyCountryHeader:"Source",mobileMoneyStatusHeader:"Availability",mobileMoneyCodeHeader:"Instruction",mobileMoneyDetailsHeader:"Guidance",androidDirectNote:"The Kotlin example below uses public direct-session routes from Android. It is a REST example, not an official SDK; it assumes kotlinx-coroutines-android. Create the session on your server and pass only the public key and required session tokens to the app.",directInputText:"Mind the format: the session may return a lowercase country code (for example ci), while creating an attempt requires two uppercase letters (CI). Convert it to uppercase. phoneNumber must include the international prefix returned by the session (for example +225 followed by the national number). Use operatorId directly from the session response.",directCorsNote:"The /api/v1/public/* routes have their own CORS configuration: browser calls are allowed without cookies, using GET/POST/OPTIONS and Content-Type, X-SendFlow-Public-Key, X-SendFlow-Client-Token, X-LinkFlow-Attempt-Token, and Idempotency-Key. Creating a session and reading a private session with Authorization: Bearer remain server-side. Never expose the secret key in a browser.",hostedTimerText:"The hosted page displays a 10-minute waiting countdown. When it expires, the payer may see a failure screen, but server-side polling continues and a later final confirmation takes precedence. The countdown is not a payment status: check the server status or a signed webhook and treat uncertain as non-final.",responsibilities:"Financial integration best practices",endpointStatus:"REST API · JSON",endpointCreate:"Create a payment session",endpointRead:"Read a session and its status",endpointChoices:"Read the public session and available choices (direct mode)",endpointAttempt:"Create a direct payment attempt",endpointAttemptRead:"Read an attempt status",accessServerSecret:"Merchant server · secret key and idempotency key",accessServerSecretRead:"Merchant server · secret key",accessPublicSession:"Checkout · public key and session token",accessPublicAttempt:"Checkout · public key, session token, and idempotency key",accessAttemptRead:"Checkout · public and session keys, attempt token",endpointPricing:"Read public countries, operators, and fees",accessPublic:"Public · no key required",endpointAccess:"Authentication",availableChoicesNote:"GET /api/pricing returns the public catalog and configured rates, but it is not a per-session fee or settlement quote and does not guarantee that an operator can process an API payment. Session responses do not expose the merchant net amount. Direct-session choices are filtered according to currently supported routing and rules; treat them as authoritative.",referenceIntro:"The examples below match routes and schemas present in the SendFlow API.",requestExample:"Request example",responseExample:"Response example",webhookEvents:"Webhook events",webhookEventsSub:"Available events are payment.succeeded, payment.failed, payout.created, payout.processing, payout.succeeded, payout.failed, and payout.uncertain. Payout events are emitted only for server-recorded transitions; payout.succeeded requires verified final confirmation. Payout creation remains blocked until that evidence is available.",webhookPayloadNote:"Payment payloads include session, attempt, and transaction identifiers. Payout payloads include the reference, amounts, fees, country, operator, and status, but no beneficiary phone number. The id matches the sendflow-delivery UUID and stays stable across retries. The same signature verification applies to both event families. Do not put personal data in merchantReference.",eventNames:"Available events",delivery:"Signatures and delivery",deliveryText:"The HMAC-SHA256 signature is computed over the string <timestamp>.<raw JSON body>. Return HTTP 2xx to acknowledge delivery; non-2xx responses, network errors, and timeouts are retried. The request timeout is 8 seconds and response bodies are limited to 8 KB. SendFlow makes at most 8 attempts total: the initial delivery plus up to 7 retries, spaced 10 s, 30 s, 2 min, 10 min, 30 min, 2 h, and 12 h apart. The sendflow-delivery ID stays stable across retries; use it for deduplication.",webhookHeadersTitle:"Request headers",webhookHeadersText:"sendflow-event identifies the event type. sendflow-delivery contains the same UUID as payload.id and remains unchanged on retries. sendflow-signature follows t=<Unix timestamp>,v1=<hex signature>. The signature is computed over the exact received body bytes. The verification example chooses a 300-second freshness window as merchant policy; SendFlow does not set this value.",apiScopeTitle:"Flow direction and actual availability",apiScopeText:"PAYIN: the customer pays by Mobile Money; after verified final server confirmation, the net amount is credited to the merchant’s SendFlow wallet. PAYOUT: the merchant requests an outgoing transfer from the available SendFlow wallet balance to a beneficiary’s Mobile Money account. SendFlow calculates amounts, fees, and reservations server-side. Current status: creating a PAYIN session or attempt returns HTTP 503 before it starts; creating a PAYOUT returns HTTP 503 with no request or reservation. The examples document the contract, but do not mean these operations are open in production.",endpointLimits:"Payment limits",endpointLimitsDesc:"Returns the currently configured FCFA thresholds. This public read never replaces server-side validation.",endpointPayout:"Payout API availability",payoutApiTitle:"Merchant payout API",payoutApiText:"A PAYOUT is an outgoing transfer from the authenticated merchant’s SendFlow wallet to a beneficiary’s Mobile Money account. Available balance is calculated after active reservations; amounts and fees are validated server-side. A quote does not reserve funds. operations.payout=true in /api/pricing describes catalog configuration, not guaranteed availability. Creation currently returns HTTP 503 with payout_unavailable: no request is created and no funds are reserved.",payoutQuoteTitle:"1. Calculate a quote",payoutQuoteText:"POST /api/v1/payout-quote is read-only and does not reserve funds. Find a country and operator with operations.payout=true in /api/pricing, then send amountMinor as a whole XOF amount, lowercase countryCode, its exact operatorId, and feePayer (merchant or beneficiary). The response includes calculated amounts, available balance, limits, pricing version, and quoteExpiresAt. Missing configuration or an unavailable route can return 503.",payoutCreateTitle:"2. Submit a payout request",payoutCreateText:"POST /api/v1/payouts requests a transfer to the beneficiary’s Mobile Money account. It requires the merchant’s active secret key in Authorization: Bearer, an Idempotency-Key (8–128 characters), country, operator, amount, currency, fee payer, and an international phone number matching the country. Keys do not have configurable per-key permissions; SendFlow checks account status and eligibility server-side for each operation. SendFlow recalculates fees and available balance; a quote does not authorize a transfer. Creation is currently closed: HTTP 503 payout_unavailable creates no request and reserves no funds. Reuse the same key for an exact retry.",payoutListTitle:"3. List requests",payoutListText:"GET /api/v1/payouts returns only requests owned by the authenticated merchant. limit accepts 1–100 (25 by default), cursor is a UUID, and status filters by payout state.",payoutReadTitle:"4. Read a request",payoutReadText:"GET /api/v1/payouts/{payoutId} requires the UUID of an existing request owned by the same merchant. The beneficiary phone is masked.",payoutCancelTitle:"5. Cancel before dispatch",payoutCancelText:"POST /api/v1/payouts/{payoutId}/cancel is available only while funds are reserved and SendFlow execution has not started. After dispatch, or when the state no longer permits cancellation, the API returns 409.",security:"Security & reliability",errors:"HTTP errors",idempotency:"Idempotency",expiration:"Expiration and amounts",securityText:"Use HTTPS. Store the secret key and webhook secret (shown once at creation) in a secure vault. Compare signatures in constant time, check timestamp freshness, and process events only after verification.",errorsText:'The documented routes return JSON errors in the form { "error": "…" }. The contract defines no stable machine-readable error code: handle HTTP status and your own business rules, not message text. For the currently blocked PAYIN creation, HTTP 503 occurs before creation: no sessionId is returned, no payment starts, and there is no session to query. For an already-created payment, a 503 on a status read proves neither success nor final failure; read the status again or verify the webhook. A 503 from payout creation creates no request and reserves no funds. A redirect or browser state never confirms payment.',globalHttpErrors:'A request may also return 413 when its body exceeds 100 KB, or 415 for an unsupported encoding. An unexpected server error may return 500. Responses keep the JSON shape { "error": "…" }; never infer a payment result from a 500/503 response.',errorEnvelopeTitle:"Error format",httpErrorTableTitle:"HTTP responses and recommended handling",errorStatusHeader:"HTTP",errorMeaningHeader:"Meaning",errorActionHeader:"Recommended action",parametersTitle:"Contract parameters",parameterFieldHeader:"Field / location",parameterTypeHeader:"Type",parameterRequirementHeader:"Requirement",parameterDescriptionHeader:"Description",noParameters:"No request parameters or authentication are required.",error400:"400 — invalid body, parameters, or headers; amount, currency, mode, HTTPS URL, metadata, country, operator, or phone number does not match the contract.",error401:"401 — secret key missing, invalid, or revoked. Check the server-side Bearer credential; never include the secret in a client app.",error403:"403 — merchant account is not authorized or eligible to create API payments.",error404:"404 — session, attempt, or public credentials are unavailable. Invalid public credentials, an expired session, or the wrong session mode may also be hidden behind this response.",error409:"409 — merchant reference already used, or Idempotency-Key reused with a different body. For a retry, resend the same request with the same key; use a new key only for a new business operation.",error429:"429 — request limit reached. Respect Retry-After: 60, slow down status checks, and do not retry immediately.",error503:"503 — the operation is unavailable. The result depends on the route: if a create request is rejected before an identifier is returned, there is nothing to query; for an existing session or attempt, read its status again or verify the webhook. This status alone never proves success or final failure.",idempotencyText:"For each session or attempt creation, send a stable 8–128 character Idempotency-Key with no leading or trailing spaces. A retry with the same key and body returns the same operation; reusing it with a different request returns 409. A previously used merchant reference also returns 409. Use a new key only for a new business operation.",expirationText:"Sessions expire one hour after creation. After expiry, public choices and starting an attempt are unavailable. The server-side session read and status check for an already-created attempt remain possible with valid credentials. The amount is fixed in XOF and must follow the current limits returned by GET /api/payment-limits; the payer cannot change it.",rateLimits:"Request limits",rateLimitsText:"Per API key per one-minute window: 30 session creations, 120 reads, 5 direct attempts, and 60 status checks. Session creation also has a merchant-account limit of 10 per minute. Per client IP, public session reads are limited to 120 per minute, attempts to 5, and status checks to 60. Key, account, and IP quotas can apply together. A rate-limited response includes 429 and Retry-After: 60; wait before resuming.",statesTitle:"Payment states",statesText:"Session and attempt states describe payment progress; only a confirmed final state should trigger your order decision.",serviceAvailability:"Production URLs and status checks",serviceAvailabilityText:"Read the status or signed webhook only for a session or attempt that was created. If creation returns 503 before an identifier is returned, there is no session to query. A browser redirect is never confirmation.",environmentNote:"Production addresses are shown individually in copyable blocks below.",troubleshootingTitle:"Quick troubleshooting",hostedFlow:"Hosted redirect flow",directFlow:"Direct API flow",returnUrlTitle:"Configure the post-payment return",returnUrlText:"For each hosted session, set the optional returnUrl field in the POST /api/v1/payment-sessions JSON body to your own HTTPS return page; the copyable request above shows where to set it. This field is not SENDFLOW_CHECKOUT_ORIGIN, which is the SendFlow hosted-checkout origin. The URL can be at most 2,048 characters and cannot contain embedded credentials. Redirect happens only after a succeeded confirmation; after a confirmed failure, checkout does not redirect to returnUrl. If omitted, checkout returns to SendFlow. Always verify the server status or signed webhook: a redirect is not proof of payment.",language:"Language",copyright:"SendFlow · API documentation",lastUpdated:"API reference v1",contents:"Contents"}},v={fr:{stepTitles:["Obtenez vos accès API","Choisissez votre intégration","Vérifiez chaque paiement"],stepTexts:["Une paire initiale est fournie à l’inscription. Gardez la clé secrète sur votre serveur ; si elle a été perdue, régénérez la paire dans l’espace Développeurs.","Choisissez Hosted Checkout pour rediriger le payeur, ou l’API directe pour garder votre propre caisse.","Consultez le catalogue, créez les sessions côté serveur et vérifiez le résultat par statut ou webhook signé."],responsibilitiesText:["Créez la session depuis votre serveur à partir de la commande de confiance. Utilisez une merchantReference unique et une Idempotency-Key stable ; pour reprendre la même opération, renvoyez la même clé avec le même corps.","Gardez la clé secrète sur votre serveur. En mode direct, transmettez au client uniquement la clé publique et les jetons de session nécessaires ; n’intégrez jamais le secret dans l’application ou les journaux.","Après le démarrage, le payeur reçoit une demande USSD de son opérateur et la valide sur son téléphone. Affichez ussdCode uniquement s’il est renvoyé, exactement tel quel ; la valeur peut être null.","Enregistrez sessionId, attemptId et merchantReference pour le rapprochement. Traitez created, waiting et uncertain comme non finaux ; ne validez la commande qu’après un succeeded confirmé par le serveur.","Vérifiez la signature HMAC sur le corps brut et l’horodatage du webhook. Dédupliquez avec sendflow-delivery et enregistrez l’événement avant d’acquitter sa réception.","Respectez Retry-After après un 429, évitez les vérifications en boucle et utilisez les webhooks configurés. Un 503 de création sans identifiant ne crée aucune session ; ne concluez ni à un paiement réussi ni à un échec final sur ce seul statut.","N’insérez pas de données personnelles dans merchantReference ou metadata. Limitez les données conservées dans vos journaux et ne journalisez jamais les secrets."],directFlowTitles:["Créer la session","Charger les choix disponibles","Démarrer le paiement","Vérifier le résultat"],directFlowTexts:["Marchand — depuis votre backend, créez une session en mode direct avec un montant XOF fixe et une clé Idempotency-Key stable. La clé secrète reste sur le serveur.","Votre application de caisse lit la session publique avec publicKey et clientToken, puis affiche uniquement les pays et opérateurs renvoyés pour cette session.","Le payeur choisit l’opérateur et saisit son numéro. La caisse envoie les champs prévus ; l’opérateur adresse ensuite une demande de confirmation USSD au payeur. L’API renvoie l’état et peut renvoyer ussdCode ; le montant fixé par la session ne change pas.","Le marchand suit la tentative avec pollToken ou lit la session avec sa clé secrète. Après un succeeded final confirmé, le montant net est crédité au portefeuille SendFlow du marchand. waiting et uncertain ne déclenchent aucun crédit."],hostedFlowTitles:["Créer une session hébergée","Rediriger le client","Laisser le client payer","Confirmer côté serveur"],hostedFlowTexts:["Marchand — votre backend crée la session avec mode=hosted, un montant fixe en XOF et une clé d’idempotence. Il reçoit checkoutPath.","Votre serveur combine checkoutPath avec la valeur copiée dans SENDFLOW_CHECKOUT_ORIGIN, puis transmet l’URL complète au navigateur ou à l’application.","Le payeur choisit un moyen proposé sur la page SendFlow, puis reçoit et valide la demande USSD de l’opérateur sur son téléphone. Le retour navigateur ne confirme pas le paiement.","Le serveur marchand relit la session et traite les webhooks communs aux deux modes. Après succeeded confirmé, le montant net est crédité au portefeuille SendFlow du marchand ; seule la confirmation serveur valide aussi la commande."],mobileMoneyActors:[{title:"Client payeur",body:"Choisit un pays et un opérateur renvoyés par la session, saisit son numéro, puis reçoit et valide la demande USSD de l’opérateur sur son téléphone. Toute saisie demandée par l’opérateur reste dans ce parcours ; l’application marchande ne recueille pas la validation."},{title:"Marchand",body:"Crée la session sur son serveur, affiche les choix disponibles, démarre la tentative et interroge son état. Il n’envoie jamais la clé secrète dans le navigateur ou l’application mobile."},{title:"Réponse de l’API",body:"La tentative renvoie notamment attemptId, state, amountMinor, currency, pollToken et éventuellement ussdCode, qui peut être null. Le payeur confirme séparément dans le parcours USSD de l’opérateur."},{title:"Webhook",body:"Pour les deux modes, SendFlow notifie payment.succeeded ou payment.failed uniquement après confirmation finale. Vérifiez la signature HMAC et dédupliquez avec sendflow-delivery."}],mobileMoneyFlowRows:[{flow:"Demande USSD opérateur",response:"L’opérateur demande au payeur de confirmer sur son téléphone ; ussdCode peut être renvoyé ou null.",action:"Laissez le payeur valider dans le parcours opérateur. Si ussdCode est renvoyé, affichez-le tel quel sans le reconstruire."},{flow:"Résultat de la tentative",response:"L’état reste waiting ou uncertain jusqu’à confirmation serveur.",action:"Attendez un état final ou un webhook signé ; ne marquez pas la commande comme payée à la seule réception de la demande USSD."},{flow:"Validation dans l’application marchande",response:"La confirmation opérateur ne fait pas partie du corps de requête API.",action:"Ne reproduisez pas l’écran USSD et ne demandez pas au payeur de saisir sa validation dans votre application."}],mobileMoneyCards:[{title:"Session active",status:"Options renvoyées pour cette session",code:"attempt.ussdCode ou null",body:"La session détermine les pays et opérateurs proposés. Affichez uniquement les options renvoyées. Le payeur valide la demande reçue dans le parcours USSD de son opérateur ; votre application attend ensuite la confirmation serveur."}],troubleshooting:[{symptom:"Aucun pays ou opérateur ne s’affiche",action:"Vérifiez la réponse de la session directe. Le catalogue global de frais ne garantit pas qu’un opérateur soit admissible pour cette session."},{symptom:"Aucun code USSD n’est renvoyé",action:"ussdCode peut être null. N’inventez pas de code ; le payeur suit la demande USSD de l’opérateur si elle lui est envoyée, puis vous attendez la confirmation serveur."},{symptom:"Le client revient sans webhook",action:"La redirection du navigateur n’est pas une confirmation. Lisez le statut serveur et consultez l’historique des livraisons webhook dans l’espace Développeurs."},{symptom:"Le compte à rebours hébergé expire",action:"L’écran d’échec après 10 minutes n’est pas un état final serveur. Vérifiez la session et traitez uncertain comme non final."},{symptom:"Une création renvoie 503",action:"Pour la création PAYIN actuellement fermée, aucun identifiant n’est renvoyé : aucune session ni tentative n’a été créée et il n’y a rien à consulter. Pour une session déjà créée, une erreur 503 de lecture ne constitue pas un résultat final."}],credentialRows:[{credential:"Clé secrète",usedFor:"Authorization: Bearer pour les endpoints privés, dont la création/lecture de session et les opérations PAYOUT selon leur disponibilité.",handling:"Format live : sfsk_live_ suivi de 43 caractères URL-safe. Serveur uniquement ; stockez-la dans un gestionnaire de secrets et ne la journalisez jamais."},{credential:"Clé publique",usedFor:"X-SendFlow-Public-Key pour les appels de caisse du parcours direct, avec le clientToken de la session.",handling:"Format live : sfpk_live_ suivi de 43 caractères URL-safe. Peut être transmise au client ; seule, elle ne suffit pas à accéder à une session et ne remplace jamais la clé secrète."},{credential:"clientToken",usedFor:"X-SendFlow-Client-Token, associé à la clé publique pour lire une session directe et démarrer une tentative.",handling:"43 caractères URL-safe ; jeton limité à une session. Ne le partagez pas entre commandes et évitez de le conserver dans des journaux."},{credential:"pollToken",usedFor:"X-LinkFlow-Attempt-Token, avec la clé publique et le clientToken, pour consulter une tentative directe.",handling:"64 caractères hexadécimaux minuscules ; identifiant d’accès limité à une tentative. Préférez le suivi serveur et ne l’exposez que temporairement si l’interface en a besoin."},{credential:"Secret de signature webhook",usedFor:"Vérifier les notifications reçues sur votre endpoint.",handling:"Secret distinct des clés API, affiché une seule fois à la configuration ; conservez-le côté serveur."}],paymentStateRows:[{state:"created",meaning:"La session existe, aucune tentative n’a encore été lancée.",action:"Poursuivez le parcours de caisse prévu pour son mode."},{state:"waiting",meaning:"Une tentative est en attente de confirmation.",action:"Continuez le suivi ; ne marquez pas la commande comme payée."},{state:"uncertain",meaning:"Le résultat n’est pas confirmé et peut encore évoluer.",action:"Ne classez ni comme réussi ni comme échoué ; relisez le statut et attendez le résultat serveur."},{state:"succeeded",meaning:"Le paiement a été confirmé avec succès.",action:"Vous pouvez valider la commande après vérification côté serveur."},{state:"failed",meaning:"Un échec final a été confirmé.",action:"Ne livrez pas la commande ; appliquez votre parcours de nouvel essai métier."}],httpErrorRows:[{status:"400",meaning:"Corps, paramètre ou en-tête invalide au regard du contrat de la route.",action:"Corrigez les champs indiqués par la route concernée. Le corps d’erreur ne fournit pas de code machine stable."},{status:"401",meaning:"Clé secrète manquante, invalide ou révoquée.",action:"Vérifiez Authorization: Bearer côté serveur et la clé active. Ne transmettez pas le secret au client."},{status:"403",meaning:"Compte marchand non autorisé ou non éligible à cette opération API.",action:"Vérifiez l’éligibilité et les droits du compte avant de reprendre."},{status:"404",meaning:"Session, tentative ou identifiants publics introuvables ou indisponibles.",action:"Vérifiez les UUID, le mode et les jetons associés sans supposer qu’une ressource a été supprimée."},{status:"409",meaning:"Référence marchande en conflit ou clé d’idempotence réutilisée avec un corps différent.",action:"Pour une reprise, renvoyez exactement la même demande avec la même clé ; une nouvelle opération reçoit une nouvelle clé."},{status:"429",meaning:"Limite de requêtes atteinte.",action:"Respectez Retry-After: 60 et ralentissez les appels."},{status:"413",meaning:"Corps de requête supérieur à la limite globale de 100 Ko.",action:"Réduisez le corps ; les métadonnées de session sont limitées à 8 Ko."},{status:"415",meaning:"Jeu de caractères ou encodage de requête non pris en charge.",action:"Envoyez du JSON UTF-8 avec Content-Type: application/json."},{status:"500",meaning:"Erreur serveur inattendue.",action:"Reprenez avec la même clé d’idempotence et le même corps ; ne créez pas une nouvelle opération. Vérifiez ensuite l’état serveur et contactez SendFlow si l’erreur persiste."},{status:"503",meaning:"Service temporairement indisponible.",action:"Ne classez pas le paiement comme échoué. Vérifiez de nouveau l’état de la session ou de la tentative."}]},en:{stepTitles:["Get your API access","Choose your integration","Verify every payment"],stepTexts:["An initial key pair is provided at signup. Keep the secret key on your server; if it is lost, regenerate the pair in the Developers area.","Choose Hosted Checkout to redirect the payer, or the Direct API to keep your own checkout.","Read the catalog, create sessions server-side, and verify results through status checks or signed webhooks."],responsibilitiesText:["Create the session server-side from the trusted order. Use a unique merchantReference and a stable Idempotency-Key; retry the same operation with the same key and identical body.","Keep the secret key on your server. In direct mode, pass only the public key and required session tokens to the client; never bundle the secret in the app or logs.","After an attempt starts, the operator sends the payer a USSD confirmation request to approve on their phone. Display ussdCode only when returned, exactly as received; it may be null.","Persist sessionId, attemptId, and merchantReference for reconciliation. Treat created, waiting, and uncertain as non-final; complete an order only after server-confirmed succeeded.","Verify webhook HMAC using the raw body and timestamp. Deduplicate with sendflow-delivery and persist the event before acknowledging receipt.","Respect Retry-After after 429, avoid tight polling, and use configured webhooks. A create-time 503 without an identifier creates no session; that status alone proves neither payment success nor final failure.","Keep personal data out of merchantReference and metadata. Minimize retained log data and never log secrets."],directFlowTitles:["Create the session","Load available choices","Start the payment","Verify the result"],directFlowTexts:["Merchant — create a direct-mode session on your backend with a fixed XOF amount and stable Idempotency-Key. Keep the secret key on the server.","Your checkout reads the public session with publicKey and clientToken, then displays only the countries and operators returned for that session.","The payer chooses an operator and enters a phone number. Checkout sends the contract fields; the operator then sends a USSD confirmation request to the payer. The API returns the state and may return ussdCode; the session amount stays fixed.","The merchant polls the attempt with pollToken or reads the session with the secret key. After a final confirmed succeeded state, the net amount is credited to the merchant’s SendFlow wallet. waiting and uncertain do not trigger a credit."],hostedFlowTitles:["Create a hosted session","Redirect the customer","Let the customer pay","Verify server-side"],hostedFlowTexts:["Merchant — your backend creates the session with mode=hosted, a fixed XOF amount, and an idempotency key. It receives checkoutPath.","Your server combines checkoutPath with the copied SENDFLOW_CHECKOUT_ORIGIN value, then passes the complete URL to the browser or app.","The payer chooses a method on the SendFlow page, then receives and approves the operator’s USSD request on their phone. A browser return does not confirm payment.","The merchant server reads the session and processes webhooks shared by both modes. After succeeded is confirmed, the net amount is credited to the merchant’s SendFlow wallet; server confirmation also completes the order."],mobileMoneyActors:[{title:"Payer",body:"Chooses a country and operator returned by the session, enters a phone number, then receives and approves the operator’s USSD request on their phone. Any operator-side entry stays in that flow; the merchant app does not collect the confirmation."},{title:"Merchant",body:"Creates the session on its server, displays available choices, starts the attempt, and checks its status. Never send the secret key to a browser or mobile app."},{title:"API response",body:"The attempt returns, among other fields, attemptId, state, amountMinor, currency, pollToken, and possibly ussdCode, which may be null. The payer confirms separately in the operator’s USSD flow."},{title:"Webhook",body:"For both modes, SendFlow sends payment.succeeded or payment.failed only after final confirmation. Verify the HMAC signature and deduplicate with sendflow-delivery."}],mobileMoneyFlowRows:[{flow:"Operator USSD request",response:"The operator asks the payer to confirm on their phone; ussdCode may be returned or null.",action:"Let the payer approve in the operator flow. If ussdCode is returned, display it as-is and do not reconstruct it."},{flow:"Attempt result",response:"The state remains waiting or uncertain until server confirmation.",action:"Wait for a final state or signed webhook; receiving the USSD request alone does not mean the order is paid."},{flow:"Confirmation in merchant app",response:"Operator confirmation is not part of the API request body.",action:"Do not recreate the USSD screen or ask the payer to enter the operator confirmation in your app."}],mobileMoneyCards:[{title:"Active session",status:"Options returned for this session",code:"attempt.ussdCode or null",body:"The session determines which countries and operators are offered. Display only the returned options. The payer approves the operator USSD request on their phone; your app then waits for server confirmation."}],troubleshooting:[{symptom:"No country or operator is displayed",action:"Check the direct session response. The global fee catalog does not guarantee that a method is eligible for this session."},{symptom:"No USSD code is returned",action:"ussdCode may be null. Do not invent one; the payer follows the operator USSD request if sent, and your app waits for server confirmation."},{symptom:"The customer returns but no webhook arrives",action:"A browser redirect is not confirmation. Read the server status and check webhook delivery history in the Developers area."},{symptom:"The hosted countdown expires",action:"The failure screen after 10 minutes is not a final server state. Check the session and treat uncertain as non-final."},{symptom:"A create request returns 503",action:"For the currently blocked PAYIN creation, no identifier is returned: no session or attempt exists to query. For an already-created session, a 503 status-read error is not a final result."}],credentialRows:[{credential:"Secret key",usedFor:"Authorization: Bearer for private endpoints, including session creation/reading and PAYOUT operations subject to availability.",handling:"Live format: sfsk_live_ followed by 43 URL-safe characters. Server only. Store it in a secrets manager and never log it."},{credential:"Public key",usedFor:"X-SendFlow-Public-Key for direct checkout requests, paired with that session’s clientToken.",handling:"Live format: sfpk_live_ followed by 43 URL-safe characters. May be sent to the client; by itself it cannot access a session and never replaces the secret key."},{credential:"clientToken",usedFor:"X-SendFlow-Client-Token, paired with the public key to read a direct session and start an attempt.",handling:"43 URL-safe characters; session-scoped token. Do not reuse across orders or place it in logs."},{credential:"pollToken",usedFor:"X-LinkFlow-Attempt-Token, together with the public key and clientToken, to read a direct attempt.",handling:"64 lowercase hexadecimal characters; attempt-scoped access credential. Prefer server-side polling; expose it only temporarily if the interface requires it."},{credential:"Webhook signing secret",usedFor:"Verify notifications received by your endpoint.",handling:"Separate from API keys and shown only once during setup; keep it server-side."}],paymentStateRows:[{state:"created",meaning:"The session exists; no attempt has started.",action:"Continue with the checkout flow for its mode."},{state:"waiting",meaning:"An attempt is awaiting confirmation.",action:"Continue checking; do not mark the order as paid."},{state:"uncertain",meaning:"The result is not confirmed and may still change.",action:"Treat as neither success nor failure; re-read status and wait for server confirmation."},{state:"succeeded",meaning:"Payment has been confirmed successfully.",action:"You may fulfill the order after server-side verification."},{state:"failed",meaning:"A final failure has been confirmed.",action:"Do not fulfill the order; use your business retry flow."}],httpErrorRows:[{status:"400",meaning:"Request body, parameter, or header does not match the route contract.",action:"Correct the fields for the route. The error body does not provide a stable machine-readable code."},{status:"401",meaning:"Secret key is missing, invalid, or revoked.",action:"Check the server-side Authorization: Bearer credential and active key. Never expose the secret to the client."},{status:"403",meaning:"Merchant account is not authorized or eligible for this API operation.",action:"Check merchant account status and eligibility before retrying."},{status:"404",meaning:"Session, attempt, or public credentials are unknown or unavailable.",action:"Check UUIDs, mode, and associated tokens; do not assume the resource was deleted."},{status:"409",meaning:"Merchant reference conflict or an idempotency key reused with a different body.",action:"For a retry, resend the exact request with the same key; use a new key for a new operation."},{status:"429",meaning:"Request limit reached.",action:"Respect Retry-After: 60 and reduce request frequency."},{status:"413",meaning:"Request body exceeds the global 100 KB limit.",action:"Reduce the body; session metadata is limited to 8 KB."},{status:"415",meaning:"Request charset or encoding is unsupported.",action:"Send UTF-8 JSON with Content-Type: application/json."},{status:"500",meaning:"Unexpected server error.",action:"Retry with the same idempotency key and body; do not create a new operation. Then check the server status and contact SendFlow if the error persists."},{status:"503",meaning:"Service temporarily unavailable.",action:"Do not mark the payment as failed. Check the session or attempt status again."}]}},re=[{method:"POST",path:"/api/v1/payment-sessions",description:"endpointCreate",access:"accessServerSecret",example:"create-hosted",anchor:"create-session",fieldsFr:[{field:"Authorization",type:"En-tête · Bearer",requirement:"Requis",description:"Clé secrète du marchand ; serveur uniquement."},{field:"Idempotency-Key",type:"En-tête · chaîne",requirement:"Requis",description:"8 à 128 caractères ; identique lors d’une reprise exacte."},{field:"Content-Type",type:"En-tête · chaîne",requirement:"Requis",description:"application/json."},{field:"merchantReference",type:"Chaîne",requirement:"Requis · corps",description:"Référence unique fournie par le marchand, 1 à 128 caractères."},{field:"amountMinor",type:"Entier",requirement:"Requis · corps",description:"Montant fixe dans la plage actuellement renvoyée par GET /api/payment-limits."},{field:"currency",type:"Chaîne",requirement:"Requis · corps",description:"Valeur acceptée : XOF."},{field:"mode",type:"Chaîne",requirement:"Requis · corps",description:"hosted ou direct."},{field:"description",type:"Chaîne",requirement:"Facultatif · corps",description:"240 caractères maximum."},{field:"returnUrl",type:"URL ou null",requirement:"Facultatif · corps",description:"URL HTTPS ; utilisée par le parcours hébergé après confirmation réussie."},{field:"metadata",type:"Objet JSON",requirement:"Facultatif · corps",description:"Données complémentaires limitées à 8 Ko ; n’y placez pas de données sensibles."}],fieldsEn:[{field:"Authorization",type:"Header · Bearer",requirement:"Required",description:"Merchant secret key; server only."},{field:"Idempotency-Key",type:"Header · string",requirement:"Required",description:"8–128 characters; reuse for an exact retry."},{field:"Content-Type",type:"Header · string",requirement:"Required",description:"application/json."},{field:"merchantReference",type:"String",requirement:"Required · body",description:"Unique merchant-supplied reference, 1–128 characters."},{field:"amountMinor",type:"Integer",requirement:"Required · body",description:"Fixed amount within the current range returned by GET /api/payment-limits."},{field:"currency",type:"String",requirement:"Required · body",description:"Accepted value: XOF."},{field:"mode",type:"String",requirement:"Required · body",description:"hosted or direct."},{field:"description",type:"String",requirement:"Optional · body",description:"Maximum 240 characters."},{field:"returnUrl",type:"URL or null",requirement:"Optional · body",description:"HTTPS URL; used by hosted checkout after successful confirmation."},{field:"metadata",type:"JSON object",requirement:"Optional · body",description:"Additional data limited to 8 KB; do not put sensitive data here."}],codesFr:"HTTP : 201, 400, 401, 403, 409, 429, 503.",codesEn:"HTTP: 201, 400, 401, 403, 409, 429, 503.",errorsFr:"400 : corps ou en-têtes invalides, limites de champs ou métadonnées dépassées. 401 : clé secrète absente, invalide ou révoquée. 403 : compte marchand non éligible. 409 : clé d’idempotence réutilisée avec un autre corps ou référence marchande déjà utilisée. 429 : quota dépassé. 503 : service temporairement indisponible ; la création n’est pas confirmée.",errorsEn:"400: invalid body or headers, field limits, or oversized metadata. 401: missing, invalid, or revoked secret key. 403: merchant account not eligible. 409: idempotency key reused with a different body or merchant reference already used. 429: quota exceeded. 503: service temporarily unavailable; the session was not confirmed.",requirementsFr:"En-têtes : Authorization: Bearer <clé secrète>, Idempotency-Key (8–128 caractères, sans espaces en début/fin), Content-Type: application/json. Requis : merchantReference (1–128), amountMinor (entier XOF dans la plage configurée, à lire via GET /api/payment-limits), currency=XOF, mode=hosted|direct. Facultatifs : description (240 caractères max), returnUrl (URL HTTPS utilisée uniquement par le parcours hosted après confirmation succeeded), metadata (8 Ko max). Expiration : 1 heure.",requirementsEn:"Headers: Authorization: Bearer <secret key>, Idempotency-Key (8–128 characters, no leading/trailing spaces), Content-Type: application/json. Required: merchantReference (1–128), amountMinor (integer XOF within the configured range, read it from GET /api/payment-limits), currency=XOF, mode=hosted|direct. Optional: description (max 240 characters), returnUrl (HTTPS URL used only by hosted flow after succeeded confirmation), metadata (max 8 KB). Expires after 1 hour.",response:`{
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
}`},{method:"POST",path:"/api/v1/public/payment-sessions/{sessionId}/attempts",description:"endpointAttempt",access:"accessPublicAttempt",example:"start-attempt",anchor:"create-attempt",fieldsFr:[{field:"sessionId",type:"UUID · chemin",requirement:"Requis",description:"Identifiant de la session directe."},{field:"X-SendFlow-Public-Key",type:"En-tête · chaîne",requirement:"Requis",description:"Clé publique de l’espace marchand."},{field:"X-SendFlow-Client-Token",type:"En-tête · chaîne",requirement:"Requis",description:"Jeton renvoyé pour cette session."},{field:"Idempotency-Key",type:"En-tête · chaîne",requirement:"Requis",description:"8 à 128 caractères ; même clé pour reprendre la même tentative."},{field:"firstName",type:"Chaîne",requirement:"Requis · corps",description:"1 à 80 caractères."},{field:"lastName",type:"Chaîne",requirement:"Requis · corps",description:"1 à 80 caractères."},{field:"countryCode",type:"Chaîne",requirement:"Requis · corps",description:"Code pays à deux lettres majuscules, par exemple CI."},{field:"operatorId",type:"Chaîne",requirement:"Requis · corps",description:"Identifiant exact d’un opérateur renvoyé pour la session, 1 à 80 caractères."},{field:"phoneNumber",type:"Chaîne",requirement:"Requis · corps",description:"6 à 20 caractères ; inclure l’indicatif international phonePrefix renvoyé."}],fieldsEn:[{field:"sessionId",type:"UUID · path",requirement:"Required",description:"Identifier for the direct session."},{field:"X-SendFlow-Public-Key",type:"Header · string",requirement:"Required",description:"Public key for the merchant account."},{field:"X-SendFlow-Client-Token",type:"Header · string",requirement:"Required",description:"Token returned for this session."},{field:"Idempotency-Key",type:"Header · string",requirement:"Required",description:"8–128 characters; reuse to retry the same attempt."},{field:"firstName",type:"String",requirement:"Required · body",description:"1–80 characters."},{field:"lastName",type:"String",requirement:"Required · body",description:"1–80 characters."},{field:"countryCode",type:"String",requirement:"Required · body",description:"Two uppercase country letters, for example CI."},{field:"operatorId",type:"String",requirement:"Required · body",description:"Exact operator ID returned for the session, 1–80 characters."},{field:"phoneNumber",type:"String",requirement:"Required · body",description:"6–20 characters; include the returned international phonePrefix."}],codesFr:"HTTP : 201, 400, 404, 409, 429, 503.",codesEn:"HTTP: 201, 400, 404, 409, 429, 503.",errorsFr:"400 : corps invalide, pays/opérateur non proposé, numéro non conforme ou mode de confirmation non pris en charge. 404 : session/identifiants publics indisponibles ou expirés. 409 : tentative ou clé d’idempotence en conflit. 429 : quota par clé ou adresse IP dépassé. 503 : service temporairement indisponible ; aucune confirmation finale n’est renvoyée.",errorsEn:"400: invalid body, country/operator not offered, invalid phone number, or unsupported confirmation method. 404: session/public credentials unavailable or expired. 409: attempt or idempotency conflict. 429: key or client-IP quota exceeded. 503: service temporarily unavailable; no final confirmation is returned.",requirementsFr:"Paramètre : sessionId (UUID). En-têtes : X-SendFlow-Public-Key, X-SendFlow-Client-Token, Idempotency-Key (8–128 caractères, sans espaces en début/fin). Corps : firstName et lastName (1–80), countryCode (2 lettres majuscules ; convertir le code de la session si nécessaire), operatorId (1–80, pris dans la session), phoneNumber (6–20 avec l’indicatif international phonePrefix). Le montant est celui de la session.",requirementsEn:"Parameter: sessionId (UUID). Headers: X-SendFlow-Public-Key, X-SendFlow-Client-Token, Idempotency-Key (8–128 characters, no leading/trailing spaces). Body: firstName and lastName (1–80), countryCode (two uppercase letters; convert the session value if needed), operatorId (1–80, from the session), phoneNumber (6–20 including the international phonePrefix). The session amount is fixed.",response:`{
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
}`},{method:"GET",path:"/api/pricing",description:"endpointPricing",access:"accessPublic",example:"pricing",anchor:"pricing-catalog",fieldsFr:[{field:"Paramètres",type:"—",requirement:"Aucun",description:"Aucune authentification ni paramètre de requête requis."}],fieldsEn:[{field:"Parameters",type:"—",requirement:"None",description:"No authentication or query parameters required."}],codesFr:"HTTP : 200, 503.",codesEn:"HTTP: 200, 503.",errorsFr:"503 : catalogue ou configuration tarifaire momentanément indisponible. Les taux affichés ne garantissent pas qu’un opérateur soit proposé dans une session ni qu’un paiement puisse être exécuté.",errorsEn:"503: catalog or fee configuration temporarily unavailable. Published rates do not guarantee that an operator will be offered in a session or that a payment can be executed.",requirementsFr:"Aucun en-tête d’authentification. fees.linkflow est un taux décimal (0,025 signifie 2,5 %). Les taux non configurés sont omis ; les valeurs présentées sont des données d’exemple.",requirementsEn:"No authentication header. fees.linkflow is a decimal rate (0.025 means 2.5%). Unconfigured rates are omitted; displayed values are sample data.",response:`{
  "categories": [
    { "id": "deposit", "label": "Dépôt", "shortLabel": "Dépôt", "description": "Alimenter votre wallet SendFlow" },
    { "id": "inter-network", "label": "Transfert inter réseau", "shortLabel": "Inter réseau", "description": "Transférer entre deux réseaux" },
    { "id": "international", "label": "Transfert international", "shortLabel": "International", "description": "Envoyer vers un autre pays" },
    { "id": "linkflow", "label": "Paiement par lien LinkFlow", "shortLabel": "LinkFlow", "description": "Paiement via un lien LinkFlow" },
    { "id": "payout", "label": "Versement marchand", "shortLabel": "Payout", "description": "Décaissement API vers un bénéficiaire" }
  ],
  "countries": [{
    "id": "ci", "name": "Côte d’Ivoire", "dialCode": "+225", "initials": "CI",
    "flag": "🇨🇮", "enabled": true, "minPhoneDigits": 10, "maxPhoneDigits": 10,
    "operations": { "deposit": true, "interNetwork": true, "international": true, "payout": false }
  }],
  "operators": [{
    "id": "<operator-id>", "countryId": "ci", "name": "Opérateur Exemple",
    "shortName": "Exemple", "initials": "OP", "brand": "generic",
    "logoUrl": null, "requiresOtp": false, "otpCommand": null,
      "operations": { "deposit": true, "interNetwork": true, "international": true, "payout": false },
    "fees": { "linkflow": 0.025 }
  }]
}`},{method:"GET",path:"/api/payment-limits",description:"endpointLimitsDesc",access:"accessPublic",example:"payment-limits",anchor:"payment-limits",fieldsFr:[{field:"Paramètres",type:"—",requirement:"Aucun",description:"Aucune authentification ni paramètre de requête requis."},{field:"minimumDepositMinor",type:"Entier · XOF",requirement:"Réponse",description:"Minimum de dépôt configuré, en unités FCFA entières."},{field:"minimumPayoutMinor",type:"Entier · XOF",requirement:"Réponse",description:"Seuil minimum indiqué pour les retraits SendFlow ; il ne constitue pas une opération API de retrait."},{field:"minimumInterNetworkMinor",type:"Entier · XOF",requirement:"Réponse",description:"Minimum du transfert inter-réseaux."},{field:"maximumTransferMinor",type:"Entier · XOF",requirement:"Réponse",description:"Maximum technique configuré pour les opérations de transfert."},{field:"maximumPayinMinor",type:"Entier · XOF",requirement:"Réponse",description:"Maximum technique configuré pour les paiements entrants."}],fieldsEn:[{field:"Parameters",type:"—",requirement:"None",description:"No authentication or query parameters required."},{field:"minimumDepositMinor",type:"Integer · XOF",requirement:"Response",description:"Configured minimum deposit, in whole FCFA units."},{field:"minimumPayoutMinor",type:"Integer · XOF",requirement:"Response",description:"Minimum shown for SendFlow payouts; it is not a merchant payout API operation."},{field:"minimumInterNetworkMinor",type:"Integer · XOF",requirement:"Response",description:"Minimum inter-network transfer amount."},{field:"maximumTransferMinor",type:"Integer · XOF",requirement:"Response",description:"Configured technical ceiling for transfer operations."},{field:"maximumPayinMinor",type:"Integer · XOF",requirement:"Response",description:"Configured technical ceiling for incoming payments."}],codesFr:"HTTP : 200, 503.",codesEn:"HTTP: 200, 503.",errorsFr:"503 : limites de paiement temporairement indisponibles. Réessayez plus tard ; ne supposez pas que les valeurs ont changé.",errorsEn:"503: payment limits are temporarily unavailable. Retry later; do not assume the values have changed.",requirementsFr:"Lecture publique, sans clé API. Les valeurs sont informatives ; chaque opération est validée à nouveau côté serveur. Tous les montants sont des entiers XOF/FCFA. La réponse d’exemple affiche les valeurs initiales : la réponse active de cette route est la référence.",requirementsEn:"Public read; no API key. Values are informational; every operation is validated again on the server. Amounts are whole XOF/FCFA units. The sample response shows initial values; the live endpoint response is authoritative.",response:`{
  "currency": "XOF",
  "minimumDepositMinor": 200,
  "minimumPayoutMinor": 200,
  "minimumInterNetworkMinor": 1,
  "maximumTransferMinor": 10000000,
  "maximumPayinMinor": 2000000
}`}],Ee=[{key:"endpointGroupSessions",anchors:["create-session","read-session"]},{key:"endpointGroupDirect",anchors:["direct-choices","create-attempt","read-attempt"]},{key:"endpointGroupCatalog",anchors:["pricing-catalog","payment-limits"]}],Ce={"/docs":"accueil home intégration paiements payment","/docs/getting-started":"prérequis compte marchand étapes getting started","/docs/authentication":"clé api publique secrète bearer authentification credentials","/docs/integrations/direct":`api directe session tentative paiement mobile money pays opérateurs montant statut countryCode operatorId phoneNumber ussdCode OTP USSD Kotlin Côte d’Ivoire Burkina Faso Orange Money ${re.map(a=>`${a.method} ${a.path} ${a.description}`).join(" ")} frais limites idempotence`,"/docs/integrations/hosted":"redirection hébergée checkout page payment link checkoutPath returnUrl compte à rebours client paiement Hosted Checkout","/docs/webhooks":"webhook événements notifications signature retries livraisons payment.succeeded payment.failed HMAC","/docs/reference":"erreurs idempotence expiration sécurité limites 400 401 403 404 409 429 503 Retry-After environnement XOF uncertain"};function ne(a){return a.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|(?:\/\/|#).*|--[A-Za-z-]+|\$[A-Za-z_]\w*|\b(?:curl|const|let|var|await|async|function|if|throw|import|from|def|return|new|true|false|null|None)\b|\b\d+(?:\.\d+)?\b)/gm).map((s,o)=>{if(!s)return null;let i="";return/^(["'`])/.test(s)?i="sf-docs-token-string":/^(\/\/|#)/.test(s)?i="sf-docs-token-comment":/^--/.test(s)?i="sf-docs-token-option":/^\$/.test(s)?i="sf-docs-token-variable":/^\d/.test(s)?i="sf-docs-token-number":/^(curl|const|let|var|await|async|function|if|throw|import|from|def|return|new|true|false|null|None)$/.test(s)&&(i="sf-docs-token-keyword"),i?e.jsx("span",{className:i,children:s},o):s})}const _e=`{
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
}`,ee=`{
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
}`,Re=`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
  "state": "waiting",
  "amountMinor": 12500,
  "currency": "XOF",
  "ussdCode": null,
  "pollToken": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "merchantReference": "ORDER-2026-0043"
}`;function C({language:a,label:h,response:s,caption:o}){const[i,f]=w.useState(!1),l=s,u=async()=>{try{await navigator.clipboard.writeText(l),f(!0),window.setTimeout(()=>f(!1),1600)}catch{f(!1)}};return e.jsxs("div",{className:"sf-docs-code","data-testid":"panel-response-example",children:[e.jsxs("div",{className:"sf-docs-code-head",children:[e.jsx("span",{className:"sf-docs-code-label",children:h}),e.jsx("div",{className:"sf-docs-code-tools",children:e.jsxs("button",{type:"button",className:"sf-docs-copy",onClick:()=>{u()},"data-testid":"button-copy-response",children:[i?e.jsx(B,{size:13}):e.jsx(H,{size:13}),i?a==="fr"?"Copié":"Copied":a==="fr"?"Copier":"Copy"]})})]}),e.jsx("pre",{children:e.jsx("code",{children:ne(l)})}),e.jsx("div",{className:"sf-docs-code-note",children:o??(a==="fr"?"JSON · données d’exemple":"JSON · sample data")})]})}function g({language:a,label:h,value:s}){const[o,i]=w.useState(!1),f=async()=>{try{await navigator.clipboard.writeText(s),i(!0),window.setTimeout(()=>i(!1),1600)}catch{i(!1)}};return e.jsxs("div",{className:"sf-docs-code sf-docs-url-block","data-testid":"panel-copyable-url",children:[e.jsxs("div",{className:"sf-docs-code-head",children:[e.jsx("span",{className:"sf-docs-code-label",children:h}),e.jsxs("button",{type:"button",className:"sf-docs-copy",onClick:()=>{f()},"data-testid":"button-copy-url",children:[o?e.jsx(B,{size:13}):e.jsx(H,{size:13}),o?a==="fr"?"Copié":"Copied":a==="fr"?"Copier":"Copy"]})]}),e.jsx("pre",{className:"sf-docs-url-value",children:e.jsx("code",{children:s})})]})}function d({language:a,label:h,example:s}){const o=we(s),[i,f]=w.useState(()=>o[0]??"cURL"),[l,u]=w.useState(!1),E=ge(s,i),x=async()=>{try{await navigator.clipboard.writeText(E),u(!0),window.setTimeout(()=>u(!1),1600)}catch{u(!1)}};return e.jsxs("div",{className:"sf-docs-code","data-testid":"panel-code-example",children:[e.jsxs("div",{className:"sf-docs-code-head",children:[e.jsx("span",{className:"sf-docs-code-label",children:h}),e.jsxs("div",{className:"sf-docs-code-tools",children:[e.jsx("div",{className:"sf-docs-code-lang",role:"group","aria-label":a==="fr"?"Format du code":"Code format",children:o.map(T=>e.jsx("button",{type:"button",className:i===T?"is-active":"",onClick:()=>f(T),"aria-pressed":i===T,"data-testid":`button-code-language-${T.toLowerCase()}`,children:T},T))}),e.jsxs("button",{type:"button",className:"sf-docs-copy",onClick:()=>{x()},"data-testid":"button-copy-code",children:[l?e.jsx(B,{size:13}):e.jsx(H,{size:13}),l?a==="fr"?"Copié":"Copied":a==="fr"?"Copier":"Copy"]})]})]}),e.jsx("pre",{children:e.jsx("code",{children:ne(E)})})]})}function He(){const[a,h]=pe(),[s,o]=w.useState("fr"),[i,f]=w.useState(""),[l,u]=w.useState(!1),[E,x]=w.useState(null),[T,j]=w.useState(()=>new Set([...O.map(n=>n.id),"resources"])),k=me(a),S=k??"home",N=E?.path===a?E.section:"",t=Q[s],K=w.useMemo(()=>L.filter(n=>`${Q[s][n.key]??n.label} ${n.label} ${n.search??Ce[n.path]??""}`.toLowerCase().includes(i.trim().toLowerCase())),[s,i]);w.useEffect(()=>{a==="/docs/api-reference"&&h("/docs/integrations/direct",{replace:!0})},[a,h]),w.useEffect(()=>{if(!l)return;const n=document.body.style.overflow,p=r=>{r.key==="Escape"&&u(!1)};return document.body.style.overflow="hidden",window.addEventListener("keydown",p),()=>{document.body.style.overflow=n,window.removeEventListener("keydown",p)}},[l]),w.useEffect(()=>{const n=()=>{const p=window.location.hash.slice(1),r=L.some(m=>m.path===a&&m.section===p);x(p&&r?{path:a,section:p}:null)};return n(),window.addEventListener("hashchange",n),window.addEventListener("popstate",n),()=>{window.removeEventListener("hashchange",n),window.removeEventListener("popstate",n)}},[a]);const W=n=>{j(p=>{const r=new Set(p);return r.has(n)?r.delete(n):r.add(n),r})},oe=n=>n.path===a&&(n.section??"")===N,ae=n=>{u(!1),x(n.section?{path:n.path,section:n.section}:null),window.setTimeout(()=>window.scrollTo({top:0,behavior:"auto"}),50)},ie=`${S}Title`,_=L.find(n=>n.path===a&&n.section===N),ce=O.find(n=>L.some(p=>p.path===a&&p.group===n.id)),M=S==="start"?t.startSub:_?t.sectionPageIntro:t[`${S}Sub`]??t.homeSub,X=S==="start"?t.startWelcomeTitle:_?t[_.key]??_.label:t[ie]??t.homeTitle;if(he({path:a,locale:s,title:k?`${X} · SendFlow`:"Page introuvable · SendFlow",description:k?M:"La page de documentation demandée est introuvable.",robots:k?"index,follow":"noindex,nofollow"}),!k)return e.jsx(ye,{});const de=O.map(n=>({key:n.labelKey,items:K.filter(p=>p.group===n.id)})),le=()=>e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"sf-docs-eyebrow",children:"SENDFLOW / API"}),e.jsx("h1",{className:"sf-docs-title",children:t.homeTitle}),e.jsx("p",{className:"sf-docs-lede",children:t.homeSub}),e.jsx(g,{language:s,label:t.apiBaseUrlLabel,value:b.apiBaseUrl}),e.jsxs("section",{className:"sf-docs-section sf-docs-home-methods",children:[e.jsx("h2",{children:t.methods}),e.jsx("p",{children:t.methodsSub}),e.jsxs("div",{className:"sf-docs-cards",children:[e.jsxs(y,{href:"/docs/integrations/hosted",className:"sf-docs-card sf-docs-card-link","data-testid":"card-docs-hosted",children:[e.jsx("div",{className:"sf-docs-card-art",children:e.jsx("img",{src:Se,alt:s==="fr"?"Illustration 3D d’un paiement sécurisé par téléphone":"3D illustration of a secure mobile payment",loading:"lazy"})}),e.jsxs("div",{className:"sf-docs-card-top",children:[e.jsx("span",{className:"sf-docs-card-icon",children:e.jsx(D,{size:19})}),e.jsx(R,{className:"sf-docs-card-arrow",size:16})]}),e.jsx("h3",{children:t.hostedCard}),e.jsx("p",{children:t.hostedCardSub}),e.jsxs("dl",{className:"sf-docs-method-details",children:[e.jsxs("div",{children:[e.jsx("dt",{children:t.methodLevel}),e.jsx("dd",{children:t.simpleLevel})]}),e.jsxs("div",{children:[e.jsx("dt",{children:t.methodControl}),e.jsx("dd",{children:t.hostedControl})]}),e.jsxs("div",{children:[e.jsx("dt",{children:t.methodIntegration}),e.jsx("dd",{children:t.sessionRedirect})]}),e.jsxs("div",{children:[e.jsx("dt",{children:t.methodReturn}),e.jsx("dd",{children:t.returnToConfirm})]})]}),e.jsxs("span",{className:"sf-docs-card-cta",children:[t.hostedGuide,e.jsx(R,{size:13})]})]}),e.jsxs(y,{href:"/docs/integrations/direct",className:"sf-docs-card sf-docs-card-link","data-testid":"card-docs-direct",children:[e.jsx("div",{className:"sf-docs-card-art",children:e.jsx("img",{src:xe,alt:s==="fr"?"Illustration 3D d’un développeur intégrant SendFlow":"3D illustration of a developer integrating SendFlow",loading:"lazy"})}),e.jsxs("div",{className:"sf-docs-card-top",children:[e.jsx("span",{className:"sf-docs-card-icon",children:e.jsx(F,{size:19})}),e.jsx(R,{className:"sf-docs-card-arrow",size:16})]}),e.jsx("h3",{children:t.directCard}),e.jsx("p",{children:t.directCardSub}),e.jsxs("dl",{className:"sf-docs-method-details",children:[e.jsxs("div",{children:[e.jsx("dt",{children:t.methodLevel}),e.jsx("dd",{children:t.developerLevel})]}),e.jsxs("div",{children:[e.jsx("dt",{children:t.methodControl}),e.jsx("dd",{children:t.highControl})]}),e.jsxs("div",{children:[e.jsx("dt",{children:t.methodIntegration}),e.jsx("dd",{children:t.restApi})]}),e.jsxs("div",{children:[e.jsx("dt",{children:t.methodAuth}),e.jsx("dd",{children:t.authContract})]})]}),e.jsxs("span",{className:"sf-docs-card-cta",children:[t.directGuide,e.jsx(R,{size:13})]})]})]})]}),e.jsxs("div",{className:"sf-docs-meta",children:[e.jsxs("span",{className:"sf-docs-status",children:[e.jsx("i",{className:"sf-docs-status-dot"}),t.badge]}),e.jsx("span",{children:t.prod})]}),e.jsxs("div",{className:"sf-docs-warning",role:"note",children:[e.jsx(A,{size:16,"aria-hidden":"true"}),e.jsxs("div",{children:[e.jsx("strong",{children:t.disclaimerTitle}),t.disclaimer]})]}),e.jsxs("div",{className:"sf-docs-warning",role:"note",children:[e.jsx(A,{size:16,"aria-hidden":"true"}),e.jsxs("div",{children:[e.jsx("strong",{children:t.apiAvailabilityTitle}),t.apiAvailabilityText]})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.capabilitiesTitle}),e.jsxs("ul",{className:"sf-docs-list",children:[e.jsx("li",{children:t.capabilitySession}),e.jsx("li",{children:t.capabilityCheckout}),e.jsx("li",{children:t.capabilityStatus}),e.jsx("li",{children:t.capabilityWebhook})]}),e.jsxs("div",{className:"sf-docs-production-urls sf-docs-production-url-section",children:[e.jsx("strong",{children:t.baseUrlTitle}),e.jsx("span",{children:t.baseUrlPending}),e.jsx(g,{language:s,label:t.apiBaseUrlLabel,value:b.apiBaseUrl}),e.jsx(g,{language:s,label:t.checkoutOriginLabel,value:b.checkoutOrigin})]})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.threeSteps}),e.jsx("div",{className:"sf-docs-steps",children:[["1",t.stepOne,t.stepOneSub,"/docs/integrations/direct"],["2",t.stepTwo,t.stepTwoSub,"/docs/authentication"],["3",t.stepThree,t.stepThreeSub,"/docs/reference"]].map(([n,p,r,m])=>e.jsxs("div",{className:"sf-docs-step",children:[e.jsx("span",{className:"sf-docs-step-index",children:n}),e.jsxs("div",{children:[e.jsx("strong",{children:p}),e.jsx("p",{children:r})]}),e.jsxs(y,{href:m,children:[t.read,e.jsx(R,{size:13})]})]},n))})]}),e.jsxs("section",{className:"sf-docs-support",children:[e.jsxs("div",{children:[e.jsx("h3",{children:t.support}),e.jsx("p",{children:t.supportSub})]}),e.jsxs("a",{href:"mailto:support@sendflow01.com","data-testid":"link-docs-support",children:[e.jsx(q,{size:15}),t.contact]})]})]}),ue=()=>{const n=r=>!N||N===r,p=()=>e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.reference}),e.jsx("p",{children:t.referenceIntro}),e.jsx("div",{className:"sf-docs-callout",children:t.globalHttpErrors}),Ee.map(r=>{const m=re.filter(c=>r.anchors.includes(c.anchor));return e.jsxs("section",{className:"sf-docs-endpoint-group",children:[e.jsx("h3",{children:t[r.key]}),e.jsx("div",{className:"sf-docs-endpoints",children:m.map(c=>e.jsxs("article",{id:c.anchor,className:"sf-docs-endpoint","data-testid":`endpoint-card-${c.method.toLowerCase()}-${c.path.split("/").at(-1)}`,children:[e.jsxs("div",{className:"sf-docs-endpoint-head",children:[e.jsx("span",{className:`sf-docs-method-badge is-${c.method.toLowerCase()}`,children:c.method}),e.jsx("code",{children:c.path}),e.jsx("span",{className:"sf-docs-endpoint-pending",children:t.endpointStatus})]}),e.jsx("p",{children:t[c.description]}),e.jsxs("div",{className:"sf-docs-endpoint-access",children:[e.jsx("span",{children:t.endpointAccess}),e.jsx("strong",{children:t[c.access]})]}),e.jsx("p",{className:"sf-docs-endpoint-requirements",children:s==="fr"?c.requirementsFr:c.requirementsEn}),e.jsx("h3",{children:t.parametersTitle}),e.jsxs("table",{className:"sf-docs-reference-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:t.parameterFieldHeader}),e.jsx("th",{children:t.parameterTypeHeader}),e.jsx("th",{children:t.parameterRequirementHeader}),e.jsx("th",{children:t.parameterDescriptionHeader})]})}),e.jsx("tbody",{children:(s==="fr"?c.fieldsFr:c.fieldsEn).map(P=>e.jsxs("tr",{children:[e.jsx("td",{"data-label":t.parameterFieldHeader,children:e.jsx("code",{className:"sf-docs-inline-code",children:P.field})}),e.jsx("td",{"data-label":t.parameterTypeHeader,children:P.type}),e.jsx("td",{"data-label":t.parameterRequirementHeader,children:P.requirement}),e.jsx("td",{"data-label":t.parameterDescriptionHeader,children:P.description})]},P.field))})]}),e.jsx("p",{className:"sf-docs-endpoint-codes",children:s==="fr"?c.codesFr:c.codesEn}),e.jsxs("p",{className:"sf-docs-endpoint-requirements",children:[e.jsx("strong",{children:s==="fr"?"Erreurs et cas métier : ":"Errors and business cases: "}),s==="fr"?c.errorsFr:c.errorsEn]}),e.jsxs("details",{className:"sf-docs-endpoint-example",children:[e.jsx("summary",{children:t.requestExample}),e.jsx(d,{language:s,label:`${c.method} ${c.path}`,example:c.example})]}),e.jsxs("details",{className:"sf-docs-endpoint-example",children:[e.jsx("summary",{children:t.responseExample}),e.jsx(C,{language:s,label:`${t.responseExample} · JSON`,response:c.response})]})]},c.path))})]},r.key)}),e.jsx("p",{className:"sf-docs-endpoint-note",children:t.availableChoicesNote}),e.jsxs("section",{className:"sf-docs-section sf-docs-section--nested",children:[e.jsx("h2",{children:t.payoutApiTitle}),e.jsx("p",{children:t.payoutApiText}),e.jsx("div",{className:"sf-docs-callout",children:t.serverOnly}),e.jsx("h3",{children:t.payoutQuoteTitle}),e.jsx("p",{children:t.payoutQuoteText}),e.jsx(d,{language:s,label:"POST /api/v1/payout-quote",example:"payout-quote"}),e.jsx("h3",{children:t.payoutCreateTitle}),e.jsx("p",{children:t.payoutCreateText}),e.jsx(d,{language:s,label:"POST /api/v1/payouts",example:"payout-create"}),e.jsx("h3",{children:t.payoutListTitle}),e.jsx("p",{children:t.payoutListText}),e.jsx(d,{language:s,label:"GET /api/v1/payouts",example:"payout-list"}),e.jsx("h3",{children:t.payoutReadTitle}),e.jsx("p",{children:t.payoutReadText}),e.jsx(d,{language:s,label:"GET /api/v1/payouts/{payoutId}",example:"payout-read"}),e.jsx("h3",{children:t.payoutCancelTitle}),e.jsx("p",{children:t.payoutCancelText}),e.jsx(d,{language:s,label:"POST /api/v1/payouts/{payoutId}/cancel",example:"payout-cancel"})]}),e.jsxs("div",{className:"sf-docs-callout",children:[e.jsxs("strong",{children:[t.apiScopeTitle,"."]})," ",t.apiScopeText]})]});return e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"sf-docs-breadcrumb",children:[e.jsx(y,{href:"/docs",onClick:()=>x(null),children:t.breadcrumb}),e.jsx(I,{size:12}),e.jsx("span",{children:_?t[_.key]??_.label:t[S]??t.home})]}),e.jsx("div",{className:"sf-docs-eyebrow",children:"SENDFLOW / API"}),e.jsx("h1",{className:"sf-docs-title",children:X}),e.jsx("p",{className:"sf-docs-lede",children:M}),e.jsx("div",{className:"sf-docs-meta",children:e.jsxs("span",{className:"sf-docs-status",children:[e.jsx("i",{className:"sf-docs-status-dot"}),t.endpointStatus]})}),S==="start"&&e.jsxs(e.Fragment,{children:[e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.whatIs}),e.jsx("p",{children:t.whatIsText})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.methods}),e.jsx("p",{children:t.methodsSub}),e.jsxs("div",{className:"sf-docs-cards",children:[e.jsxs(y,{href:"/docs/integrations/hosted",className:"sf-docs-card sf-docs-card-link",children:[e.jsxs("div",{className:"sf-docs-card-top",children:[e.jsx("span",{className:"sf-docs-card-icon",children:e.jsx(D,{size:19})}),e.jsx(R,{className:"sf-docs-card-arrow",size:16})]}),e.jsx("h3",{children:"Hosted Checkout"}),e.jsx("p",{children:t.hostedCardSub}),e.jsxs("span",{className:"sf-docs-card-cta",children:[t.hostedGuide,e.jsx(R,{size:13})]})]}),e.jsxs(y,{href:"/docs/integrations/direct",className:"sf-docs-card sf-docs-card-link",children:[e.jsxs("div",{className:"sf-docs-card-top",children:[e.jsx("span",{className:"sf-docs-card-icon",children:e.jsx(F,{size:19})}),e.jsx(R,{className:"sf-docs-card-arrow",size:16})]}),e.jsx("h3",{children:t.directCard}),e.jsx("p",{children:t.directCardSub}),e.jsxs("span",{className:"sf-docs-card-cta",children:[t.directGuide,e.jsx(R,{size:13})]})]})]})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.capabilitiesTitle}),e.jsxs("ul",{className:"sf-docs-list",children:[e.jsx("li",{children:t.capabilitySession}),e.jsx("li",{children:t.capabilityCheckout}),e.jsx("li",{children:t.capabilityDirect}),e.jsx("li",{children:t.capabilityStatus}),e.jsx("li",{children:t.capabilityWebhook})]})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.baseUrlTitle}),e.jsxs("div",{className:"sf-docs-production-urls sf-docs-production-url-section",children:[e.jsx("span",{children:t.baseUrlPending}),e.jsx(g,{language:s,label:t.apiBaseUrlLabel,value:b.apiBaseUrl}),e.jsx(g,{language:s,label:t.checkoutOriginLabel,value:b.checkoutOrigin})]})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.threeSteps}),e.jsx("div",{className:"sf-docs-steps",children:v[s].stepTitles.map((r,m)=>e.jsxs("div",{className:"sf-docs-step",children:[e.jsxs("span",{className:"sf-docs-step-index",children:["0",m+1]}),e.jsxs("div",{children:[e.jsx("strong",{children:r}),e.jsx("p",{children:v[s].stepTexts[m]})]})]},r))})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.quickstartTitle}),e.jsx("h3",{children:t.quickstartPrereqTitle}),e.jsx("p",{children:t.quickstartPrereqText}),e.jsx("div",{className:"sf-docs-callout",children:t.serverOnly}),e.jsx("div",{className:"sf-docs-callout",children:t.quickstartIntegrationNote}),e.jsxs("div",{className:"sf-docs-warning",role:"note",children:[e.jsx(A,{size:16,"aria-hidden":"true"}),e.jsxs("div",{children:[e.jsx("strong",{children:t.apiAvailabilityTitle}),t.apiAvailabilityText]})]}),e.jsx("h3",{children:t.quickstartCatalogTitle}),e.jsx("p",{children:t.quickstartCatalogText}),e.jsx(d,{language:s,label:"GET /api/pricing",example:"pricing"}),e.jsx("h3",{children:t.quickstartLimitsTitle}),e.jsx("p",{children:t.quickstartLimitsText}),e.jsx(d,{language:s,label:"GET /api/payment-limits",example:"payment-limits"}),e.jsx("h3",{children:t.quickstartDirectTitle}),e.jsx("p",{children:t.quickstartDirectText}),e.jsx(d,{language:s,label:"POST /api/v1/payment-sessions",example:"create-direct"}),e.jsx(C,{language:s,label:t.responseExample,response:ee}),e.jsx("h3",{children:t.quickstartChoicesTitle}),e.jsx("p",{children:t.quickstartChoicesText}),e.jsx(d,{language:s,label:"GET /api/v1/public/payment-sessions/{sessionId}",example:"read-public-session"}),e.jsx("h3",{children:t.quickstartAttemptTitle}),e.jsx("p",{children:t.quickstartAttemptText}),e.jsx(d,{language:s,label:"POST /api/v1/public/payment-sessions/{sessionId}/attempts",example:"start-attempt"}),e.jsx("h3",{children:t.quickstartStatusTitle}),e.jsx("p",{children:t.quickstartStatusText}),e.jsx(d,{language:s,label:"GET /api/v1/payment-sessions/{sessionId}",example:"read-session"})]})]}),S==="auth"&&e.jsxs(e.Fragment,{children:[e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.notDocumented}),e.jsx("p",{children:t.notDocumentedText}),e.jsx("p",{children:t.rotationText}),e.jsx("div",{className:"sf-docs-callout",children:t.serverOnly}),e.jsx(d,{language:s,label:t.codeLabel,example:"read-session"})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.credentialRolesTitle}),e.jsxs("table",{className:"sf-docs-reference-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:t.credentialHeader}),e.jsx("th",{children:t.credentialUseHeader}),e.jsx("th",{children:t.credentialHandlingHeader})]})}),e.jsx("tbody",{children:v[s].credentialRows.map(r=>e.jsxs("tr",{children:[e.jsx("td",{"data-label":t.credentialHeader,children:r.credential}),e.jsx("td",{"data-label":t.credentialUseHeader,children:r.usedFor}),e.jsx("td",{"data-label":t.credentialHandlingHeader,children:r.handling})]},r.credential))})]})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.prerequisites}),e.jsxs("ul",{className:"sf-docs-list",children:[e.jsx("li",{children:t.noCredentials}),e.jsx("li",{children:t.idempotencyText})]})]})]}),S==="direct"&&e.jsxs(e.Fragment,{children:[e.jsx(g,{language:s,label:t.apiBaseUrlLabel,value:b.apiBaseUrl}),e.jsxs("div",{className:"sf-docs-warning",role:"note",children:[e.jsx(A,{size:16,"aria-hidden":"true"}),e.jsxs("div",{children:[e.jsx("strong",{children:t.apiAvailabilityTitle}),t.apiAvailabilityText]})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.model}),e.jsx("p",{children:t.modelTextDirect}),e.jsx("h3",{children:t.directFlow}),e.jsx("div",{className:"sf-docs-steps",children:v[s].directFlowTitles.map((r,m)=>e.jsxs("div",{className:"sf-docs-step",children:[e.jsxs("span",{className:"sf-docs-step-index",children:["0",m+1]}),e.jsxs("div",{children:[e.jsx("strong",{children:r}),e.jsx("p",{children:v[s].directFlowTexts[m]})]})]},r))}),e.jsx("h3",{children:t.directExamplesTitle}),e.jsxs("div",{className:"sf-docs-code-steps",children:[e.jsxs("section",{className:"sf-docs-code-step",children:[e.jsx("h4",{children:t.directStepCreate}),e.jsx(d,{language:s,label:t.codeLabel,example:"create-direct"}),e.jsx(C,{language:s,label:t.responseExample,response:ee})]}),e.jsxs("section",{className:"sf-docs-code-step",children:[e.jsx("h4",{children:t.directStepRead}),e.jsx("div",{className:"sf-docs-callout",children:t.directCorsNote}),e.jsx(d,{language:s,label:t.codeLabel,example:"read-public-session"})]}),e.jsxs("section",{className:"sf-docs-code-step",children:[e.jsx("h4",{children:t.directStepAttempt}),e.jsx("div",{className:"sf-docs-callout",children:t.androidDirectNote}),e.jsx("div",{className:"sf-docs-callout",children:t.directInputText}),e.jsx(d,{language:s,label:t.codeLabel,example:"start-attempt"}),e.jsx(C,{language:s,label:t.responseExample,response:Re}),e.jsxs("div",{className:"sf-docs-callout",children:[e.jsxs("strong",{children:[t.mobileMoneyTitle,"."]})," ",t.mobileMoneyText]})]}),e.jsxs("section",{className:"sf-docs-code-step",children:[e.jsx("h4",{children:t.directStepPoll}),e.jsx("div",{className:"sf-docs-callout",children:t.pollTokenNote}),e.jsx(d,{language:s,label:t.codeLabel,example:"poll-attempt"})]})]}),e.jsx("h3",{children:t.mobileMoneyFlowsTitle}),e.jsxs("table",{className:"sf-docs-reference-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:t.mobileMoneyFlowHeader}),e.jsx("th",{children:t.mobileMoneyResponseHeader}),e.jsx("th",{children:t.mobileMoneyActionHeader})]})}),e.jsx("tbody",{children:v[s].mobileMoneyFlowRows.map(r=>e.jsxs("tr",{children:[e.jsx("td",{"data-label":t.mobileMoneyFlowHeader,children:r.flow}),e.jsx("td",{"data-label":t.mobileMoneyResponseHeader,children:r.response}),e.jsx("td",{"data-label":t.mobileMoneyActionHeader,children:r.action})]},r.flow))})]}),e.jsx("h3",{children:t.mobileMoneyActorsTitle}),e.jsx("div",{className:"sf-docs-endpoints",children:v[s].mobileMoneyActors.map(r=>e.jsxs("article",{className:"sf-docs-endpoint sf-docs-info",children:[e.jsx("div",{className:"sf-docs-endpoint-head",children:e.jsx("strong",{children:r.title})}),e.jsx("p",{children:r.body})]},r.title))}),e.jsx("h3",{children:t.mobileMoneyCountryTitle}),e.jsxs("table",{className:"sf-docs-reference-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:t.mobileMoneyCountryHeader}),e.jsx("th",{children:t.mobileMoneyStatusHeader}),e.jsx("th",{children:t.mobileMoneyCodeHeader}),e.jsx("th",{children:t.mobileMoneyDetailsHeader})]})}),e.jsx("tbody",{children:v[s].mobileMoneyCards.map(r=>e.jsxs("tr",{children:[e.jsxs("td",{"data-label":t.mobileMoneyCountryHeader,children:[e.jsxs("strong",{children:[r.flag&&e.jsxs("span",{"aria-hidden":"true",children:[r.flag," "]}),r.title]}),r.countryCode&&e.jsxs(e.Fragment,{children:[" ",e.jsx("code",{className:"sf-docs-inline-code",children:`country_code: "${r.countryCode}"`})]})]}),e.jsx("td",{"data-label":t.mobileMoneyStatusHeader,children:r.status}),e.jsx("td",{"data-label":t.mobileMoneyCodeHeader,children:e.jsx("code",{children:r.code})}),e.jsx("td",{"data-label":t.mobileMoneyDetailsHeader,children:r.body})]},r.title))})]})]}),p(),e.jsxs("div",{className:"sf-docs-callout",children:[e.jsx("strong",{children:t.webhookSharedNote})," ",e.jsx(y,{href:"/docs/webhooks",children:t.webhookGuideLink})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.responsibilities}),e.jsx("ul",{className:"sf-docs-list",children:v[s].responsibilitiesText.map(r=>e.jsx("li",{children:r},r))})]}),e.jsxs("div",{className:"sf-docs-warning",role:"note",children:[e.jsx(A,{size:16,"aria-hidden":"true"}),e.jsxs("div",{children:[e.jsx("strong",{children:t.disclaimerTitle}),t.disclaimer]})]})]}),S==="hosted"&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"sf-docs-production-urls",children:[e.jsx(g,{language:s,label:t.apiBaseUrlLabel,value:b.apiBaseUrl}),e.jsx(g,{language:s,label:t.checkoutOriginLabel,value:b.checkoutOrigin})]}),e.jsxs("div",{className:"sf-docs-warning",role:"note",children:[e.jsx(A,{size:16,"aria-hidden":"true"}),e.jsxs("div",{children:[e.jsx("strong",{children:t.apiAvailabilityTitle}),t.apiAvailabilityText]})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.model}),e.jsx("p",{children:t.modelTextHosted}),e.jsx("h3",{children:t.hostedFlow}),e.jsx("div",{className:"sf-docs-steps",children:v[s].hostedFlowTitles.map((r,m)=>e.jsxs("div",{className:"sf-docs-step",children:[e.jsxs("span",{className:"sf-docs-step-index",children:["0",m+1]}),e.jsxs("div",{children:[e.jsx("strong",{children:r}),e.jsx("p",{children:v[s].hostedFlowTexts[m]})]})]},r))}),e.jsx("h3",{children:t.hostedExamplesTitle}),e.jsxs("div",{className:"sf-docs-code-steps",children:[e.jsxs("section",{className:"sf-docs-code-step",children:[e.jsx("h4",{children:t.hostedStepCreate}),e.jsx(d,{language:s,label:t.codeLabel,example:"create-hosted"}),e.jsx(C,{language:s,label:t.responseExample,response:_e})]}),e.jsxs("section",{className:"sf-docs-code-step",children:[e.jsx("h4",{children:t.hostedStepStatus}),e.jsx(d,{language:s,label:t.codeLabel,example:"read-session"})]})]}),e.jsxs("div",{className:"sf-docs-callout",children:[e.jsx("p",{children:t.hostedOriginText}),e.jsx("p",{children:e.jsx("strong",{children:t.returnUrlTitle})}),e.jsx("p",{children:t.returnUrlText}),e.jsx("p",{children:t.hostedFallbackText}),e.jsx("p",{children:t.hostedTimerText})]})]}),e.jsxs("div",{className:"sf-docs-callout",children:[e.jsx("strong",{children:t.webhookSharedNote})," ",e.jsx(y,{href:"/docs/webhooks",children:t.webhookGuideLink})]}),e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.responsibilities}),e.jsx("ul",{className:"sf-docs-list",children:v[s].responsibilitiesText.map(r=>e.jsx("li",{children:r},r))})]}),e.jsxs("div",{className:"sf-docs-warning",role:"note",children:[e.jsx(A,{size:16,"aria-hidden":"true"}),e.jsxs("div",{children:[e.jsx("strong",{children:t.disclaimerTitle}),t.disclaimer]})]})]}),S==="webhooks"&&e.jsxs(e.Fragment,{children:[n("webhook-events")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.webhookEvents}),e.jsx("p",{children:t.webhookEventsSub}),e.jsxs("div",{className:"sf-docs-card",style:{marginTop:15},children:[e.jsxs("div",{className:"sf-docs-card-top",children:[e.jsx("span",{className:"sf-docs-card-icon",children:e.jsx($,{size:18})}),e.jsx("span",{className:"sf-docs-status",children:t.endpointStatus})]}),e.jsx("h3",{children:t.eventNames}),e.jsx("ul",{className:"sf-docs-list",children:["payment.succeeded","payment.failed","payout.created","payout.processing","payout.succeeded","payout.failed","payout.uncertain"].map(r=>e.jsx("li",{children:e.jsx("code",{className:"sf-docs-inline-code",children:r})},r))})]}),e.jsx(C,{language:s,label:`${t.responseExample} · payment.succeeded`,response:`{
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
}`}),e.jsx(C,{language:s,label:`${t.responseExample} · payment.failed`,response:`{
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
}`}),e.jsx(C,{language:s,label:`${t.responseExample} · payout.created`,response:`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28646",
  "type": "payout.created",
  "createdAt": "2026-10-29T10:33:00.000Z",
  "data": {
    "amountMinor": 12500,
    "beneficiaryAmountMinor": 12500,
    "countryCode": "ci",
    "currency": "XOF",
    "feeMinor": 250,
    "feePayer": "merchant",
    "merchantReference": "ORDER-PAYOUT-2026-001",
    "operatorId": "operator-id-from-sendflow",
    "payoutId": "00000000-0000-4000-8000-000000000004",
    "reference": "SFPOA1B2C3D4E5F60718",
    "status": "funds_reserved",
    "totalDebitMinor": 12750
  }
}`})]}),n("webhook-signature")||N==="webhook-retries"?e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.delivery}),e.jsx("p",{children:t.deliveryText}),e.jsxs("div",{className:"sf-docs-callout",children:[e.jsx("strong",{children:t.webhookHeadersTitle}),e.jsx("p",{children:t.webhookHeadersText}),e.jsx("pre",{className:"sf-docs-response",children:e.jsx("code",{children:`sendflow-event: payment.succeeded
sendflow-delivery: 9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644
sendflow-signature: t=<unix-timestamp>,v1=<hex-signature>`})})]}),e.jsx(C,{language:s,label:`${t.responseExample} · JSON`,response:`{
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
}`}),e.jsx("div",{className:"sf-docs-callout",children:t.webhookPayloadNote}),e.jsx(d,{language:s,label:t.codeLabel,example:"webhook"})]}):null]}),S==="ref"&&e.jsxs(e.Fragment,{children:[n("payment-states")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.statesTitle}),e.jsx("p",{children:t.statesText}),e.jsxs("table",{className:"sf-docs-reference-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:s==="fr"?"État":"State"}),e.jsx("th",{children:s==="fr"?"Signification":"Meaning"}),e.jsx("th",{children:s==="fr"?"Action marchande":"Merchant action"})]})}),e.jsx("tbody",{children:v[s].paymentStateRows.map(r=>e.jsxs("tr",{children:[e.jsx("td",{"data-label":s==="fr"?"État":"State",children:e.jsx("code",{className:"sf-docs-inline-code",children:r.state})}),e.jsx("td",{"data-label":s==="fr"?"Signification":"Meaning",children:r.meaning}),e.jsx("td",{"data-label":s==="fr"?"Action marchande":"Merchant action",children:r.action})]},r.state))})]}),e.jsx(d,{language:s,label:s==="fr"?"Lire le statut de session":"Read session status",example:"read-session"}),e.jsx(d,{language:s,label:s==="fr"?"Lire le statut d’une tentative directe":"Read direct attempt status",example:"poll-attempt"}),e.jsx(C,{language:s,label:s==="fr"?"Réponse de tentative · failed":"Attempt response · failed",response:`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
  "state": "failed",
  "amountMinor": 12500,
  "currency": "XOF",
  "ussdCode": null,
  "pollToken": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "merchantReference": "ORDER-2026-0043"
}`})]}),n("idempotency")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.idempotency}),e.jsx("p",{children:t.idempotencyText}),e.jsx(d,{language:s,label:t.codeLabel,example:"create-hosted"})]}),n("expiration")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.expiration}),e.jsx("p",{children:t.expirationText}),e.jsx(d,{language:s,label:t.codeLabel,example:"read-session"})]}),n("rate-limits")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.rateLimits}),e.jsx("p",{children:t.rateLimitsText})]}),n("service-availability")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.serviceAvailability}),e.jsx("div",{className:"sf-docs-callout",children:t.environmentNote}),e.jsxs("div",{className:"sf-docs-production-urls",children:[e.jsx(g,{language:s,label:t.apiBaseUrlLabel,value:b.apiBaseUrl}),e.jsx(g,{language:s,label:t.checkoutOriginLabel,value:b.checkoutOrigin}),e.jsx(g,{language:s,label:t.merchantAppLabel,value:b.merchantApp}),e.jsx(g,{language:s,label:t.publicSiteLabel,value:b.publicSite}),e.jsx(g,{language:s,label:t.documentationUrlLabel,value:b.documentation})]}),e.jsx("p",{children:t.serviceAvailabilityText})]}),n("http-errors")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.errors}),e.jsx("p",{children:t.errorsText}),e.jsx("div",{className:"sf-docs-callout",children:t.globalHttpErrors}),e.jsx("h3",{children:t.httpErrorTableTitle}),e.jsxs("table",{className:"sf-docs-reference-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:t.errorStatusHeader}),e.jsx("th",{children:t.errorMeaningHeader}),e.jsx("th",{children:t.errorActionHeader})]})}),e.jsx("tbody",{children:v[s].httpErrorRows.map(r=>e.jsxs("tr",{children:[e.jsx("td",{"data-label":t.errorStatusHeader,children:e.jsx("code",{className:"sf-docs-inline-code",children:r.status})}),e.jsx("td",{"data-label":t.errorMeaningHeader,children:r.meaning}),e.jsx("td",{"data-label":t.errorActionHeader,children:r.action})]},r.status))})]}),e.jsx(C,{language:s,label:t.errorEnvelopeTitle,response:`{
  "error": "${s==="fr"?"Message d’erreur renvoyé par l’API":"Error message returned by the API"}"
}`}),e.jsx(d,{language:s,label:t.codeLabel,example:"handle-http-errors"})]}),n("http-errors")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.troubleshootingTitle}),e.jsx("div",{className:"sf-docs-endpoints",children:v[s].troubleshooting.map(r=>e.jsxs("article",{className:"sf-docs-endpoint sf-docs-info",children:[e.jsx("div",{className:"sf-docs-endpoint-head",children:e.jsx("strong",{children:r.symptom})}),e.jsx("p",{children:r.action})]},r.symptom))})]}),n("security")&&e.jsxs("section",{className:"sf-docs-section",children:[e.jsx("h2",{children:t.security}),e.jsx("p",{children:t.securityText})]})]})]})};return e.jsxs("div",{className:"sf-docs",children:[e.jsxs("header",{className:"sf-docs-header",children:[e.jsx("button",{type:"button",className:"sf-docs-mobile-menu",onClick:()=>u(n=>!n),"aria-expanded":l,"aria-label":l?t.menuClose:t.contents,"data-testid":"button-docs-mobile-nav",children:l?e.jsx(U,{size:18}):e.jsx(V,{size:18})}),e.jsxs(y,{href:"/docs",className:"sf-docs-brand",onClick:()=>x(null),"aria-label":"SendFlow documentation","data-testid":"link-docs-home",children:[e.jsx("span",{className:"sf-docs-brand-mark",children:e.jsx("img",{src:Y,alt:""})}),e.jsx("img",{className:"sf-docs-brand-word",src:J,alt:"SendFlow"})]}),e.jsxs("nav",{className:"sf-docs-nav","aria-label":"Main navigation",children:[e.jsx(y,{href:"/docs",className:a==="/docs"?"is-active":"",onClick:()=>x(null),"data-testid":"link-docs-top-home",children:t.navDocs}),e.jsx(y,{href:"/docs/getting-started",className:a==="/docs/getting-started"?"is-active":"",onClick:()=>x(null),"data-testid":"link-docs-top-guides",children:t.navGuides}),e.jsx(y,{href:"/docs/integrations/direct",className:a==="/docs/integrations/direct"?"is-active":"",onClick:()=>x(null),"data-testid":"link-docs-top-api",children:t.navApi}),e.jsx(y,{href:"/docs/webhooks",className:a==="/docs/webhooks"?"is-active":"",onClick:()=>x(null),"data-testid":"link-docs-top-webhooks",children:t.navWebhooks})]}),e.jsxs("div",{className:"sf-docs-header-tools",children:[e.jsx("button",{type:"button",className:"sf-docs-mobile-search",onClick:()=>u(!0),"aria-label":t.search,"data-testid":"button-docs-mobile-search",children:e.jsx(Z,{size:18})}),e.jsx("button",{type:"button",className:"sf-docs-lang",onClick:()=>o(n=>n==="fr"?"en":"fr"),"aria-label":s==="fr"?"Switch to English":"Passer en français","data-testid":"button-docs-language",children:s==="fr"?"EN":"FR"})]})]}),e.jsxs("div",{className:"sf-docs-mobile-breadcrumb",children:[e.jsx("button",{type:"button",className:"sf-docs-mobile-crumb-menu",onClick:()=>u(n=>!n),"aria-expanded":l,"aria-label":l?t.menuClose:t.contents,"data-testid":"button-docs-mobile-crumb-menu",children:l?e.jsx(U,{size:17}):e.jsx(V,{size:17})}),e.jsx("span",{children:t[ce?.labelKey??"startGroup"]}),e.jsx(I,{size:15,"aria-hidden":"true"}),e.jsx("span",{className:"sf-docs-mobile-crumb-current",children:_?t[_.key]??_.label:t[S]??t.home})]}),e.jsxs("div",{className:"sf-docs-shell",children:[l&&e.jsx("button",{type:"button",className:"sf-docs-mobile-backdrop","aria-label":"Close documentation menu",onClick:()=>u(!1),"data-testid":"button-close-docs-sidebar"}),e.jsxs("aside",{className:`sf-docs-sidebar${l?" is-open":""}`,"aria-label":s==="fr"?"Navigation de la documentation":"Documentation navigation",children:[e.jsxs("div",{className:"sf-docs-drawer-head",children:[e.jsx("button",{type:"button",className:"sf-docs-drawer-close",onClick:()=>u(!1),"aria-label":t.menuClose,"data-testid":"button-close-docs-drawer",children:e.jsx(U,{size:18})}),e.jsxs(y,{href:"/docs",className:"sf-docs-drawer-brand",onClick:()=>{u(!1),x(null)},"aria-label":"SendFlow documentation","data-testid":"link-docs-drawer-brand",children:[e.jsx("img",{className:"sf-docs-drawer-mark",src:Y,alt:""}),e.jsx("img",{className:"sf-docs-drawer-word",src:J,alt:"SendFlow"})]}),e.jsx("button",{type:"button",className:"sf-docs-drawer-language",onClick:()=>o(n=>n==="fr"?"en":"fr"),"aria-label":s==="fr"?"Switch to English":"Passer en français",children:s==="fr"?"EN":"FR"})]}),e.jsxs("label",{className:"sf-docs-search",children:[e.jsx(Z,{size:15,"aria-hidden":"true"}),e.jsx("input",{type:"search",value:i,onChange:n=>f(n.target.value),placeholder:t.search,"aria-label":t.search,"data-testid":"input-docs-search"}),e.jsx("kbd",{children:"/"})]}),de.filter(n=>n.items.length>0).map(n=>{const p=O.find(c=>c.labelKey===n.key)?.icon??z,r=O.find(c=>c.labelKey===n.key)?.id??n.key,m=T.has(r)||!!i.trim();return e.jsxs("section",{className:`sf-docs-nav-group${m?" is-open":""}${n.items.some(c=>c.path===a)?" is-active":""}`,children:[e.jsxs("button",{type:"button",className:"sf-docs-group-toggle",onClick:()=>W(r),"aria-expanded":m,"aria-controls":`docs-nav-${r}`,"data-testid":`button-docs-group-${r}`,children:[e.jsx(p,{size:15,"aria-hidden":"true"}),e.jsx("span",{children:t[n.key]}),e.jsx(I,{className:"sf-docs-group-chevron",size:15,"aria-hidden":"true"})]}),e.jsx("div",{className:"sf-docs-nav-items",id:`docs-nav-${r}`,hidden:!m,children:n.items.map(c=>{const P=c.icon,G=oe(c);return e.jsxs(y,{href:c.section?`${c.path}#${c.section}`:c.path,onClick:()=>ae(c),className:`sf-docs-side-link${G?" is-active":""}`,"aria-current":G?"page":void 0,"data-testid":`link-docs-${c.key}-${c.section??"page"}`,children:[e.jsx(P,{size:13}),t[c.key]??c.label]},`${c.path}:${c.section??"page"}`)})})]},n.key)}),i&&K.length===0&&e.jsx("div",{className:"sf-docs-search-empty",children:t.noResults}),(!i||`${t.resources} ${t.contact} support contact`.toLowerCase().includes(i.trim().toLowerCase()))&&e.jsxs("section",{className:`sf-docs-nav-group${T.has("resources")||i.trim()?" is-open":""}`,children:[e.jsxs("button",{type:"button",className:"sf-docs-group-toggle",onClick:()=>W("resources"),"aria-expanded":T.has("resources")||!!i.trim(),"aria-controls":"docs-nav-resources","data-testid":"button-docs-group-resources",children:[e.jsx(q,{size:15,"aria-hidden":"true"}),e.jsx("span",{children:t.resources}),e.jsx(I,{className:"sf-docs-group-chevron",size:15,"aria-hidden":"true"})]}),e.jsx("div",{className:"sf-docs-nav-items",id:"docs-nav-resources",hidden:!T.has("resources")&&!i.trim(),children:e.jsxs("a",{className:"sf-docs-side-link",href:"mailto:support@sendflow01.com","data-testid":"link-docs-sidebar-support",children:[e.jsx(q,{size:13}),t.contact]})})]}),e.jsxs("div",{className:"sf-docs-sidebar-note",children:[e.jsx(A,{size:15}),e.jsx("span",{children:t.prod})]})]}),e.jsxs("main",{className:"sf-docs-main",children:[e.jsx("article",{className:`sf-docs-content${S==="home"?" sf-docs-home":""}`,children:S==="home"?le():ue()},`${a}-${s}`),e.jsxs("footer",{className:"sf-docs-footer",children:[e.jsxs("span",{children:[t.copyright," · ",t.lastUpdated]}),e.jsxs("div",{className:"sf-docs-footer-links",children:[e.jsx(y,{href:"/docs/reference","data-testid":"link-docs-footer-security",children:t.security}),e.jsx(y,{href:"/docs/webhooks","data-testid":"link-docs-footer-webhooks",children:t.navWebhooks}),e.jsx("a",{href:"mailto:support@sendflow01.com","data-testid":"link-docs-footer-support",children:t.contact})]})]})]})]})]})}export{He as default};
