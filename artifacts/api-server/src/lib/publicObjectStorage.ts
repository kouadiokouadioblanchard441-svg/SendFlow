const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

export type SignedObjectMethod = 'GET' | 'PUT';

export function getPublicObjectSearchPaths(): string[] {
  const paths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (paths.length === 0) {
    throw new Error('PUBLIC_OBJECT_SEARCH_PATHS is not configured');
  }

  return paths;
}

export function parseStoragePath(storagePath: string): {
  bucketName: string;
  objectName: string;
} {
  const normalized = storagePath.startsWith('/')
    ? storagePath
    : `/${storagePath}`;
  const parts = normalized.split('/');
  const bucketName = parts[1];
  const objectName = parts.slice(2).join('/');

  if (!bucketName || !objectName) {
    throw new Error(`Invalid public storage path: ${storagePath}`);
  }

  if (
    objectName.includes("\\")
    || objectName.includes("\u0000")
    || objectName.split("/").some((part) => part === "." || part === "..")
  ) {
    throw new Error("Invalid public storage object path");
  }

  return { bucketName, objectName };
}

export async function getSignedObjectUrl({
  bucketName,
  objectName,
  method,
}: {
  bucketName: string;
  objectName: string;
  method: SignedObjectMethod;
}): Promise<string> {
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucket_name: bucketName,
        object_name: objectName,
        method,
        expires_at: new Date(Date.now() + 900_000).toISOString(),
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to sign object URL: ${response.status}`);
  }

  const body = (await response.json()) as { signed_url?: string };
  if (!body.signed_url) {
    throw new Error('Object storage returned no signed URL');
  }

  return body.signed_url;
}