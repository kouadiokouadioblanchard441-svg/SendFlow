import { Readable } from 'stream';
import { pipeline } from "node:stream/promises";
import { Router, type IRouter, type Request, type Response } from 'express';
import {
  getPublicObjectSearchPaths,
  getSignedObjectUrl,
  parseStoragePath,
} from '../lib/publicObjectStorage';
import { setPublicObjectResponseHeaders, validatePublicObjectUrl } from "../lib/public-object-response-policy";

const router: IRouter = Router();

router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      if (!filePath || filePath.length > 2048 || /[\\\u0000]/.test(filePath)
        || filePath.split("/").some((part) => part === "." || part === "..")) {
        res.status(400).json({ error: "Invalid public object path" });
        return;
      }

      for (const searchPath of getPublicObjectSearchPaths()) {
        const { bucketName, objectName } = parseStoragePath(
          `${searchPath}/${filePath}`,
        );
        const response = await fetch(
          validatePublicObjectUrl(await getSignedObjectUrl({
            bucketName,
            objectName,
            method: 'GET',
          })),
          { redirect: "error", signal: AbortSignal.timeout(15_000) },
        );

        if (response.status === 404) {
          continue;
        }

        if (!response.ok || !response.body) {
          throw new Error(`Failed to read public object: ${response.status}`);
        }

        res.status(response.status);
        setPublicObjectResponseHeaders(res, response.headers);
        await pipeline(Readable.fromWeb(response.body as ReadableStream<Uint8Array>), res);
        return;
      }

      res.status(404).json({ error: 'File not found' });
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      if (res.headersSent) {
        if (!res.destroyed) res.destroy();
        return;
      }
      res.status(503).json({ error: 'Public object storage unavailable' });
    }
  },
);

export default router;