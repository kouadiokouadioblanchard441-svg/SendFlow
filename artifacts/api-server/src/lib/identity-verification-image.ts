import sharp from "sharp";

export const IDENTITY_IMAGE_MIN_BYTES = 8 * 1024;
export const IDENTITY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 20_000_000;
const MIN_IMAGE_DIMENSION = 200;
const MAX_IMAGE_DIMENSION = 8_000;

export class IdentityImageValidationError extends Error {
  constructor() {
    super("Identity image is invalid");
    this.name = "IdentityImageValidationError";
  }
}

function expectedFormat(contentType: string) {
  if (contentType === "image/jpeg") return "jpeg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return null;
}

function assertSupportedDimensions(width?: number, height?: number) {
  if (
    !width
    || !height
    || width < MIN_IMAGE_DIMENSION
    || height < MIN_IMAGE_DIMENSION
    || width > MAX_IMAGE_DIMENSION
    || height > MAX_IMAGE_DIMENSION
    || width * height > MAX_IMAGE_PIXELS
  ) {
    throw new IdentityImageValidationError();
  }
}

export async function normalizeIdentityImage(
  input: Buffer,
  contentType: string,
): Promise<{ buffer: Buffer; contentType: "image/jpeg" }> {
  if (
    input.length < IDENTITY_IMAGE_MIN_BYTES
    || input.length > IDENTITY_IMAGE_MAX_BYTES
    || !expectedFormat(contentType)
  ) {
    throw new IdentityImageValidationError();
  }

  try {
    const metadata = await sharp(input, {
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).metadata();
    if (metadata.format !== expectedFormat(contentType)) {
      throw new IdentityImageValidationError();
    }
    assertSupportedDimensions(metadata.width, metadata.height);

    // Re-encoding corrects orientation and removes EXIF, GPS, and other source
    // metadata before the private object becomes part of a submitted dossier.
    const buffer = await sharp(input, {
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
    })
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({
        width: 4_000,
        height: 4_000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    if (buffer.length < IDENTITY_IMAGE_MIN_BYTES || buffer.length > IDENTITY_IMAGE_MAX_BYTES) {
      throw new IdentityImageValidationError();
    }

    return { buffer, contentType: "image/jpeg" };
  } catch (error) {
    if (error instanceof IdentityImageValidationError) throw error;
    throw new IdentityImageValidationError();
  }
}

export async function verifyStoredIdentityImage(
  buffer: Buffer,
  contentType: string,
  expectedSizeBytes: number,
): Promise<void> {
  if (
    buffer.length < IDENTITY_IMAGE_MIN_BYTES
    || buffer.length > IDENTITY_IMAGE_MAX_BYTES
    || buffer.length !== expectedSizeBytes
  ) {
    throw new IdentityImageValidationError();
  }

  try {
    const image = sharp(buffer, {
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
    });
    const metadata = await image.metadata();
    if (metadata.format !== expectedFormat(contentType)) {
      throw new IdentityImageValidationError();
    }
    assertSupportedDimensions(metadata.width, metadata.height);
    await image.stats();
  } catch (error) {
    if (error instanceof IdentityImageValidationError) throw error;
    throw new IdentityImageValidationError();
  }
}
