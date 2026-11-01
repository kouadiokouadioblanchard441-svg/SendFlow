import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import {
  IDENTITY_IMAGE_MAX_BYTES,
  IDENTITY_IMAGE_MIN_BYTES,
  IdentityImageValidationError,
  normalizeIdentityImage,
  verifyStoredIdentityImage,
} from "./identity-verification-image.ts";

async function makeJpeg() {
  const width = 640;
  const height = 480;
  const pixels = randomBytes(width * height * 3);
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

test("normalizes supported identity images to metadata-free JPEG", async () => {
  const input = await sharp(await makeJpeg()).withMetadata({ orientation: 6 }).toBuffer();
  assert.ok((await sharp(input).metadata()).exif);
  const result = await normalizeIdentityImage(input, "image/jpeg");
  const metadata = await sharp(result.buffer).metadata();

  assert.equal(result.contentType, "image/jpeg");
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.exif, undefined);
  assert.ok(result.buffer.length >= IDENTITY_IMAGE_MIN_BYTES);
  assert.ok(result.buffer.length <= IDENTITY_IMAGE_MAX_BYTES);
});

test("rejects declared MIME types that do not match the actual image", async () => {
  const input = await makeJpeg();
  await assert.rejects(
    normalizeIdentityImage(input, "image/png"),
    IdentityImageValidationError,
  );
});

test("rejects files outside the server-enforced size range before decoding", async () => {
  await assert.rejects(
    normalizeIdentityImage(Buffer.alloc(IDENTITY_IMAGE_MIN_BYTES - 1), "image/jpeg"),
    IdentityImageValidationError,
  );
  await assert.rejects(
    normalizeIdentityImage(Buffer.alloc(IDENTITY_IMAGE_MAX_BYTES + 1), "image/jpeg"),
    IdentityImageValidationError,
  );
});

test("rejects truncated or undecodable image bytes", async () => {
  const input = await makeJpeg();
  await assert.rejects(
    normalizeIdentityImage(input.subarray(0, Math.floor(input.length / 2)), "image/jpeg"),
    IdentityImageValidationError,
  );
});

test("stored image verification checks type, exact size, and decodability", async () => {
  const normalized = await normalizeIdentityImage(await makeJpeg(), "image/jpeg");
  await verifyStoredIdentityImage(normalized.buffer, "image/jpeg", normalized.buffer.length);
  await assert.rejects(
    verifyStoredIdentityImage(normalized.buffer, "image/png", normalized.buffer.length),
    IdentityImageValidationError,
  );
  await assert.rejects(
    verifyStoredIdentityImage(normalized.buffer, "image/jpeg", normalized.buffer.length + 1),
    IdentityImageValidationError,
  );
});
