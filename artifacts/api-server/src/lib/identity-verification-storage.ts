import { getSignedObjectUrl, parseStoragePath } from "./publicObjectStorage";

export type IdentityStorageMethod = "GET" | "PUT" | "DELETE";

export function getIdentityPrivateObjectPath(uploadId: string) {
  const directory = process.env.PRIVATE_OBJECT_DIR?.replace(/\/+$/, "");
  if (!directory) throw new Error("Private object storage is not configured");
  return `${directory}/identity-verification/${uploadId}`;
}

export async function getIdentityPrivateObjectUrl(
  objectPath: string,
  method: IdentityStorageMethod,
) {
  const { bucketName, objectName } = parseStoragePath(objectPath);
  return getSignedObjectUrl({ bucketName, objectName, method });
}

export async function storePrivateIdentityImage(objectPath: string, image: Buffer) {
  const signedUrl = await getIdentityPrivateObjectUrl(objectPath, "PUT");
  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: image,
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Private identity image storage failed");
}

export async function deletePrivateIdentityObject(objectPath: string) {
  const signedUrl = await getIdentityPrivateObjectUrl(objectPath, "DELETE");
  const response = await fetch(signedUrl, {
    method: "DELETE",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error("Private identity image cleanup failed");
  }
}
