import type { Response } from "express";

const INLINE_IMAGE_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/svg+xml",
]);

export function validatePublicObjectUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash
    || !(url.hostname === "storage.googleapis.com" || url.hostname.endsWith(".storage.googleapis.com"))) {
    throw new Error("Invalid public object storage origin");
  }
  return url.href;
}

/** Never relay upstream cookies, security policies or arbitrary response headers. */
export function setPublicObjectResponseHeaders(res: Response, headers: Headers) {
  // fetch may decode upstream compression; its original byte length must not
  // truncate or corrupt the streamed response.
  for (const name of ["content-type", "etag", "last-modified"]) {
    const value = headers.get(name);
    if (value) res.setHeader(name, value);
  }
  const type = headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!type) res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", INLINE_IMAGE_TYPES.has(type) ? "inline" : "attachment");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  // SVGs remain usable as images, but direct navigation must not execute scripts
  // in the application origin. HTML and other active types are downloads.
  res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'");
}
