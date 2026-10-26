import type { CustomerBiometricOptionsOptions } from "@workspace/api-client-react";

type JsonCredential = Record<string, unknown>;

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(window.atob(padded), (character) => character.charCodeAt(0));
}

function encodeBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function hasPlatformBiometricAuthenticator() {
  if (
    typeof window === "undefined"
    || !window.isSecureContext
    || !navigator.credentials
    || !window.PublicKeyCredential
    || typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function"
  ) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function toCredentialOptions(options: CustomerBiometricOptionsOptions): PublicKeyCredentialRequestOptions | PublicKeyCredentialCreationOptions {
  const raw = options as Record<string, unknown>;
  const common = { ...raw, challenge: decodeBase64Url(String(raw.challenge ?? "")) };
  if ("user" in raw && typeof raw.user === "object" && raw.user !== null) {
    const user = raw.user as Record<string, unknown>;
    const excludeCredentials = Array.isArray(raw.excludeCredentials)
      ? raw.excludeCredentials.map((entry) => {
          const credential = entry as Record<string, unknown>;
          return { ...credential, id: decodeBase64Url(String(credential.id ?? "")) };
        })
      : undefined;
    return {
      ...common,
      user: { ...user, id: decodeBase64Url(String(user.id ?? "")) },
      excludeCredentials,
    } as unknown as PublicKeyCredentialCreationOptions;
  }
  const allowCredentials = Array.isArray(raw.allowCredentials)
    ? raw.allowCredentials.map((entry) => {
        const credential = entry as Record<string, unknown>;
        return { ...credential, id: decodeBase64Url(String(credential.id ?? "")) };
      })
    : undefined;
  return { ...common, allowCredentials } as unknown as PublicKeyCredentialRequestOptions;
}

export async function createPlatformBiometricCredential(options: CustomerBiometricOptionsOptions) {
  const credential = await navigator.credentials.create({
    publicKey: toCredentialOptions(options) as PublicKeyCredentialCreationOptions,
  });
  if (!(credential instanceof PublicKeyCredential)) return null;
  return serializeCredential(credential);
}

export async function getPlatformBiometricAssertion(options: CustomerBiometricOptionsOptions) {
  const credential = await navigator.credentials.get({
    publicKey: toCredentialOptions(options) as PublicKeyCredentialRequestOptions,
  });
  if (!(credential instanceof PublicKeyCredential)) return null;
  return serializeCredential(credential);
}

function serializeCredential(credential: PublicKeyCredential): JsonCredential {
  const response = credential.response;
  const serializedResponse: Record<string, unknown> = {
    clientDataJSON: encodeBase64Url(response.clientDataJSON),
  };
  if (response instanceof AuthenticatorAttestationResponse) {
    serializedResponse.attestationObject = encodeBase64Url(response.attestationObject);
    if (typeof response.getTransports === "function") {
      serializedResponse.transports = response.getTransports();
    }
  } else if (response instanceof AuthenticatorAssertionResponse) {
    serializedResponse.authenticatorData = encodeBase64Url(response.authenticatorData);
    serializedResponse.signature = encodeBase64Url(response.signature);
    serializedResponse.userHandle = response.userHandle ? encodeBase64Url(response.userHandle) : null;
  } else {
    throw new Error("Réponse biométrique non reconnue.");
  }
  return {
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: serializedResponse,
  };
}
