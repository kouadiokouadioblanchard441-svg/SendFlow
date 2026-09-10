import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

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

const blockLegacyAdminPath = () => ({
  name: 'sendflow-block-legacy-admin-path',
  enforce: 'pre' as const,
  configureServer(server: { middlewares: { use: (handler: (req: { url?: string }, res: { statusCode: number; end: (body: string) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((req, res, next) => {
      if (!isLegacyAdminPath(req.url)) {
        next();
        return;
      }
      res.statusCode = 404;
      res.end('Not Found');
    });
  },
  configurePreviewServer(server: { middlewares: { use: (handler: (req: { url?: string }, res: { statusCode: number; end: (body: string) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((req, res, next) => {
      if (!isLegacyAdminPath(req.url)) {
        next();
        return;
      }
      res.statusCode = 404;
      res.end('Not Found');
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
