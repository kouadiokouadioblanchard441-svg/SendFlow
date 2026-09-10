import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
const sidecarEndpoint = "http://127.0.0.1:1106";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dryRun = process.argv.includes("--dry-run");

if (!connectionString) {
  throw new Error("NEON_DATABASE_URL or DATABASE_URL must be set");
}

function parseStoragePath(storagePath) {
  const normalized = storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
  const parts = normalized.split("/");
  const bucketName = parts[1];
  const prefix = parts.slice(2).join("/");

  if (!bucketName) {
    throw new Error(`Invalid public storage path: ${storagePath}`);
  }

  return { bucketName, prefix };
}

function getPublicStorageRoot() {
  const searchPath = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "")
    .split(",")
    .map((value) => value.trim())
    .find(Boolean);

  if (!searchPath) {
    throw new Error(
      "PUBLIC_OBJECT_SEARCH_PATHS is not configured. Provision App Storage first.",
    );
  }

  return searchPath.replace(/\/+$/, "");
}

async function getSignedObjectUrl({ bucketName, objectName, method }) {
  const response = await fetch(`${sidecarEndpoint}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + 900_000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to sign ${method} object URL: ${response.status}`);
  }

  const body = await response.json();
  if (!body.signed_url) {
    throw new Error(`App Storage returned no signed URL for ${method}`);
  }

  return body.signed_url;
}

async function uploadAsset({ bucketName, objectName, sourcePath, mimeType }) {
  const contents = await fs.readFile(sourcePath);
  const uploadUrl = await getSignedObjectUrl({
    bucketName,
    objectName,
    method: "PUT",
  });
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: contents,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload ${sourcePath}: ${response.status}`);
  }
}

async function migrate() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    const { rows } = await client.query(
      "SELECT slug, source_path, mime_type FROM landing_media ORDER BY id",
    );
    if (rows.length !== 35) {
      throw new Error(`Expected 35 landing assets, found ${rows.length}`);
    }

    const publicRoot = getPublicStorageRoot();
    const { bucketName, prefix } = parseStoragePath(publicRoot);
    const assets = rows.map((row) => {
      const sourcePath = path.resolve(repoRoot, row.source_path);
      if (!sourcePath.startsWith(`${repoRoot}${path.sep}`)) {
        throw new Error(`Asset source must stay inside the repository: ${row.source_path}`);
      }

      const extension = path.extname(sourcePath).toLowerCase();
      const relativePath = `landing/${row.slug}${extension}`;
      const objectName = [prefix, relativePath].filter(Boolean).join("/");
      return {
        ...row,
        sourcePath,
        relativePath,
        objectName,
        storagePath: `${publicRoot}/${relativePath}`,
        publicUrl: `/api/storage/public-objects/${relativePath}`,
      };
    });

    await Promise.all(
      assets.map(async (asset) => {
        await fs.access(asset.sourcePath);
      }),
    );

    if (dryRun) {
      console.log(`Validated ${assets.length} landing assets; no uploads made.`);
      return;
    }

    await client.query("BEGIN");
    for (const asset of assets) {
      await uploadAsset({
        bucketName,
        objectName: asset.objectName,
        sourcePath: asset.sourcePath,
        mimeType: asset.mime_type,
      });
      await client.query(
        `UPDATE landing_media
         SET storage_path = $1, public_url = $2, updated_at = NOW()
         WHERE slug = $3`,
        [asset.storagePath, asset.publicUrl, asset.slug],
      );
      console.log(`Uploaded ${asset.slug}`);
    }
    await client.query("COMMIT");
    console.log(`Migrated ${assets.length} landing assets to App Storage.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});