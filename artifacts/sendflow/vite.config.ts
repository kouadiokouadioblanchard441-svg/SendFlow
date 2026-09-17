import path from 'path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT ?? '5173';

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? '/';

const isLegacyAdminPath = (requestUrl = '') => {
  const requestPath = requestUrl.split('?')[0].replace(/\/+$/, '') || '/';
  const normalizedBasePath = basePath.replace(/\/+$/, '');
  return (
    requestPath === '/admin' ||
    requestPath.startsWith('/admin/') ||
    requestPath === `${normalizedBasePath}/admin` ||
    requestPath.startsWith(`${normalizedBasePath}/admin/`)
  );
};

type ViteMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void;

const blockLegacyAdminPath = () => ({
  name: 'sendflow-block-legacy-admin-path',
  enforce: 'pre' as const,
  configureServer(server: { middlewares: { use: (handler: ViteMiddleware) => void } }) {
    server.middlewares.use((req, res, next) => {
      if (!isLegacyAdminPath(req.url)) {
        next();
        return;
      }
      const homePath = basePath.replace(/\/+$/, '') || '/';
      res.statusCode = 302;
      res.setHeader('Location', homePath);
      res.end();
    });
  },
  configurePreviewServer(server: { middlewares: { use: (handler: ViteMiddleware) => void } }) {
    server.middlewares.use((req, res, next) => {
      if (!isLegacyAdminPath(req.url)) {
        next();
        return;
      }
      const homePath = basePath.replace(/\/+$/, '') || '/';
      res.statusCode = 302;
      res.setHeader('Location', homePath);
      res.end();
    });
  },
});

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    runtimeErrorOverlay(),
    blockLegacyAdminPath(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
