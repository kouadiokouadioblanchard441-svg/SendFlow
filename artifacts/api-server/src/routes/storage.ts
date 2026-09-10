import { Readable } from 'stream';
import { Router, type IRouter, type Request, type Response } from 'express';
import {
  getPublicObjectSearchPaths,
  getSignedObjectUrl,
  parseStoragePath,
} from '../lib/publicObjectStorage';

const router: IRouter = Router();

router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;

      for (const searchPath of getPublicObjectSearchPaths()) {
        const { bucketName, objectName } = parseStoragePath(
          `${searchPath}/${filePath}`,
        );
        const response = await fetch(
          await getSignedObjectUrl({
            bucketName,
            objectName,
            method: 'GET',
          }),
        );

        if (response.status === 404) {
          continue;
        }

        if (!response.ok || !response.body) {
          throw new Error(`Failed to read public object: ${response.status}`);
        }

        res.status(response.status);
        response.headers.forEach((value, key) => res.setHeader(key, value));
        Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
        return;
      }

      res.status(404).json({ error: 'File not found' });
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

export default router;