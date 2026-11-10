import path from 'path';
import postcss from 'postcss';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import { publicClientDefinitions } from '../../scripts/security/public-client-env.mjs';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';
import { ipGatePlugin } from './server/ip-gate-plugin';
import { adminDevGatePlugin } from './server/admin-dev-gate-plugin';
import { getRetiredAdminSignupRedirect, isKnownSitePage } from './server/site-route-matcher';

const rawPort = process.env.PORT ?? '5173';

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? '/';
const privateBundleBase = '/__sendflow_private_bundle__/';

const envDir = path.resolve(import.meta.dirname, '../..');

function stripPrivateSurfaceFromPublicCss(): Plugin {
  return {
    name: 'sendflow-public-surface-boundary',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const privateMarker = /admin|administration|administrateur|administratrice|administrator|sendflow-app-surface/i;
      for (const output of Object.values(bundle)) {
        if (output.type !== 'asset' || !output.fileName.endsWith('.css')) continue;
        const css = String(output.source);
        const root = postcss.parse(css);
        root.walkComments((comment) => {
          if (privateMarker.test(comment.text)) comment.remove();
        });
        root.walkAtRules((rule) => {
          if (/keyframes/i.test(rule.name) && privateMarker.test(rule.params)) rule.remove();
        });
        root.walkRules((rule) => {
          if (rule.selectors) {
            const publicSelectors = rule.selectors.filter((selector) => !privateMarker.test(selector));
            if (!publicSelectors.length) {
              rule.remove();
              return;
            }
            rule.selectors = publicSelectors;
          }
          rule.walkDecls((declaration) => {
            if (privateMarker.test(declaration.prop) || /--admin-|var\(--admin-/i.test(declaration.value)) {
              declaration.remove();
            }
          });
          if (!rule.nodes?.some((node) => node.type === 'decl' || node.type === 'rule')) rule.remove();
        });
        output.source = root.toString();
      }

      for (const output of Object.values(bundle)) {
        if (output.type !== 'asset' || !/\.(?:html|js|css)$/i.test(output.fileName)) continue;
        if (privateMarker.test(String(output.source))) {
          throw new Error('The public SendFlow bundle contains private interface code.');
        }
      }
    },
  };
}

const serverNotFoundMiddleware: Connect.NextHandleFunction = (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://internal.invalid').pathname);
  } catch {
    pathname = '';
  }

  const basePrefix = basePath === '/' ? '' : `/${basePath.split('/').filter(Boolean).join('/')}`;
  const routePath = basePrefix && (pathname === basePrefix || pathname.startsWith(`${basePrefix}/`))
    ? pathname.slice(basePrefix.length) || '/'
    : pathname;

  if (req.method === 'GET' || req.method === 'HEAD') {
    const redirect = getRetiredAdminSignupRedirect(
      req.headers.host ?? '',
      pathname,
      basePath,
    );
    if (redirect) {
      res.statusCode = 302;
      res.setHeader('Location', redirect);
      res.setHeader('Cache-Control', 'no-store, private');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.end();
      return;
    }
  }

  if (
    !pathname
    || pathname.startsWith('/@')
    || pathname.startsWith('/src/')
    || pathname.startsWith('/node_modules/')
    || pathname.startsWith('/__open-in-editor')
    || path.extname(pathname)
    || routePath === '/api'
    || routePath.startsWith('/api/')
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

export default defineConfig(async ({ mode }) => {
  const adminBuild = mode === 'admin';
  return {
  base: adminBuild ? privateBundleBase : basePath,
  // Keep environment files at the workspace root; capacitor mode has its own public API origin.
  envDir,
  // No automatic VITE_* exposure: only explicit public routing values and the
  // Cloudflare site key are embedded. Verification secrets stay server-side.
  envPrefix: [],
  define: publicClientDefinitions(loadEnv(mode, envDir, 'VITE_')),
  plugins: [
    ipGatePlugin(),
    adminDevGatePlugin(basePath),
    serverNotFoundPlugin,
    ...(!adminBuild ? [stripPrivateSurfaceFromPublicCss()] : []),
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
    outDir: path.resolve(import.meta.dirname, adminBuild ? 'dist/admin' : 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      ...(adminBuild
        ? { input: { index: path.resolve(import.meta.dirname, 'admin.html') } }
        : {}),
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
  };
});
