import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import { publicClientDefinitions } from '../../scripts/security/public-client-env.mjs';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';
import { ipGatePlugin } from './server/ip-gate-plugin';
import { isKnownSitePage } from './server/site-route-matcher';

const rawPort = process.env.PORT ?? '5173';

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? '/';

const envDir = path.resolve(import.meta.dirname, '../..');

const serverNotFoundMiddleware: Connect.NextHandleFunction = (req, res, next) => {
  if ((req.method !== 'GET' && req.method !== 'HEAD') || !req.headers.accept?.includes('text/html')) {
    next();
    return;
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://internal.invalid').pathname);
  } catch {
    pathname = '';
  }

  if (
    !pathname
    || pathname.startsWith('/@')
    || pathname.startsWith('/src/')
    || pathname.startsWith('/node_modules/')
    || pathname.startsWith('/__open-in-editor')
    || path.extname(pathname)
  ) {
    next();
    return;
  }

  if (isKnownSitePage(req.headers.host ?? '', pathname, basePath)) {
    next();
    return;
  }

  const body = '404 Not Found';
  res.statusCode = 404;
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Length', String(Buffer.byteLength(body)));
  res.end(req.method === 'HEAD' ? undefined : body);
};

const serverNotFoundPlugin: Plugin = {
  name: 'sendflow-server-404',
  configureServer(server) {
    server.middlewares.use(serverNotFoundMiddleware);
  },
  configurePreviewServer(server) {
    server.middlewares.use(serverNotFoundMiddleware);
  },
};

export default defineConfig(async ({ mode }) => ({
  base: basePath,
  // Keep environment files at the workspace root; capacitor mode has its own public API origin.
  envDir,
  // No automatic VITE_* exposure: only explicit public routing values and the
  // Cloudflare site key are embedded. Verification secrets stay server-side.
  envPrefix: [],
  define: publicClientDefinitions(loadEnv(mode, envDir, 'VITE_')),
  plugins: [
    ipGatePlugin(),
    serverNotFoundPlugin,
    react(),
    tailwindcss({ optimize: false }),
    runtimeErrorOverlay(),
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
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/chunk-[hash].js',
      },
    },
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
}));
