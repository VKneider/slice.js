// api/framework/server.js - Servidor Express encapsulado del framework
import express from 'express';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import {
  securityMiddleware,
  sliceFrameworkProtection,
  suspiciousRequestLogger
} from './securityMiddleware.js';
import { createPublicEnvProvider } from './publicEnvResolver.js';
import { createDevDepsOptimizer } from './devDepsOptimizer.js';
import { createPrecompressedStatic } from './precompressedStatic.js';

// ── Shared runtime context ─────────────────────────────────────────
// `createSliceServer` and the standalone `sliceFallback` must agree on where the
// app lives and which folder it serves, without one having to call the other.

function resolveRuntimeContext(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const runMode = options.mode || (process.env.NODE_ENV === 'production' ? 'production' : 'development');
  const folderDeployed = runMode === 'production' ? 'dist' : 'src';
  return { projectRoot, runMode, folderDeployed };
}

/** Component URL prefixes, from sliceConfig. Used by the development carve-outs. */
function readComponentPrefixes(projectRoot) {
  for (const folder of ['src', 'dist']) {
    const file = path.join(projectRoot, folder, 'sliceConfig.json');
    if (!fs.existsSync(file)) continue;
    try {
      const config = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Object.values(config.paths?.components || {})
        .map((entry) => entry?.path)
        .filter(Boolean);
    } catch {
      // unreadable config: fall through to "no prefixes" (no carve-out, as before)
    }
  }
  return [];
}

/**
 * True for `/Components/<Category>/<Name>/<Name>.css` when the component's `.js`
 * exists but it has no stylesheet. JS-only Visual components (MultiRoute,
 * DemoButton…) legitimately ship no CSS, and a 404 there makes `slice.build`
 * return null in development.
 */
function isComponentWithoutStylesheet(pathname, projectRoot, folderDeployed, prefixes) {
  if (!pathname.endsWith('.css') || pathname.includes('..')) return false;
  if (!prefixes.some((prefix) => pathname.startsWith(`${prefix}/`))) return false;
  const file = path.join(projectRoot, folderDeployed, pathname);
  return !fs.existsSync(file) && fs.existsSync(file.replace(/\.css$/, '.js'));
}

/**
 * The terminal middleware: everything the app did not answer lands here.
 *
 * Mounted by `start()` — and exported so an app that never calls `start()` (a
 * serverless adapter, a supertest harness) can close the chain by hand. It must
 * be the last middleware; mounting it twice is harmless (the first one ends the
 * response) but pointless, and `start()` skips it when it is already there.
 */
export function sliceFallback(options = {}) {
  const { projectRoot, runMode, folderDeployed } = resolveRuntimeContext(options);
  const isDev = runMode === 'development';
  const shellPath = path.join(projectRoot, folderDeployed, 'App', 'index.html');
  const prefixes = options.componentPrefixes || readComponentPrefixes(projectRoot);

  const sendShell = (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(shellPath, (error) => {
      if (!error) return;
      if (res.headersSent) return;
      console.error(`[SPA Fallback] Error sending ${shellPath}:`, error);
      res.status(500).send('<h1>500 - Internal Server Error</h1><p>Could not serve application file</p>');
    });
  };

  const fallback = (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const pathname = decodeURI(req.path).replace(/\/+$/, '') || '/';

    // Unknown /api paths answer JSON, never the shell. This used to live in the
    // factory, where it swallowed every API router the app mounted afterwards.
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return res.status(404).json({ error: 'API route not found', path: req.originalUrl });
    }

    if (isDev) {
      // Development serves components unbundled: the framework fetches
      // `<Component>.html` and `.css` over HTTP, and a JS-only component has
      // neither. A 404 here makes `slice.build` return null and the page dies.
      if (pathname.endsWith('.html')) return sendShell(req, res);
      if (isComponentWithoutStylesheet(pathname, projectRoot, folderDeployed, prefixes)) {
        res.status(200);
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.end('/* component ships no stylesheet */');
      }
    }

    return sendShell(req, res);
  };

  fallback.__sliceFallback = true;
  return fallback;
}

/**
 * The error handler that has to sit after the fallback (Express only routes an
 * error to middleware registered later in the stack). Exported for the same
 * no-`start()` case as `sliceFallback`.
 */
export function sliceErrorHandler(options = {}) {
  const { runMode } = resolveRuntimeContext(options);
  return (error, req, res, next) => {
    console.error('[Server Error]', error.stack || error.message || error);
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({
      error: 'Internal Server Error',
      message: runMode === 'production' ? 'An unexpected error occurred' : error.message
    });
  };
}

export function createSliceServer(options = {}) {
  const { projectRoot, runMode, folderDeployed } = resolveRuntimeContext(options);

  let sliceConfig = {};
  try {
    const configPath = path.join(projectRoot, 'src', 'sliceConfig.json');
    if (fs.existsSync(configPath)) {
      sliceConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch {
    // usa defaults si no se puede leer la config
  }

  let frameworkVersion = '';
  try {
    const pkgPath = new URL('../../package.json', import.meta.url);
    frameworkVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  } catch {
    frameworkVersion = 'unknown';
  }

  const PORT = options.port ?? process.env.PORT ?? sliceConfig.server?.port ?? 3001;

  const publicEnvProvider = createPublicEnvProvider({
    mode: runMode,
    envFilePath: path.join(projectRoot, '.env')
  });

  const app = express();

  // ==============================================
  // MIDDLEWARES DE SEGURIDAD (APLICAR PRIMERO)
  // ==============================================

  // 1. Logger de peticiones sospechosas (solo observación, no bloquea)
  app.use(suspiciousRequestLogger());

  // 2. Protección del framework - TOTALMENTE AUTOMÁTICA
  app.use(sliceFrameworkProtection({ port: PORT }));

  app.use(securityMiddleware());

  // ==============================================
  // MIDDLEWARES DE APLICACIÓN
  // ==============================================

  // Compresión gzip/brotli para respuestas (threshold 0 = comprimir todo)
  app.use(compression({ threshold: 0 }));

  // Security headers básicos
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Middleware global para archivos JavaScript con MIME types correctos
  app.use((req, res, next) => {
    if (req.path.endsWith('.js') || req.path.endsWith('.mjs') || req.path.endsWith('.cjs')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    next();
  });

  // Middleware para parsear JSON y formularios
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Configurar headers de CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // ==============================================
  // RUNTIME MODE ENDPOINT
  // ==============================================

  app.get('/slice-env.json', (req, res) => {
    const payload = publicEnvProvider.getPayload();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(payload);
  });

  // ==============================================
  // PWA — manifest + service worker (dev y prod)
  // ==============================================

  // Resolve a deployed asset preferring the public/ folder (the convention),
  // falling back to the deploy root for pre-`public/` projects.
  const resolveDeployedFile = (fileName) => {
    const inPublic = path.join(projectRoot, folderDeployed, 'public', fileName);
    return fs.existsSync(inPublic) ? inPublic : path.join(projectRoot, folderDeployed, fileName);
  };

  const servePwaFile = (res, fileName, contentType, extraHeaders = {}) => {
    const filePath = resolveDeployedFile(fileName);
    try {
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', contentType);
        for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
        return res.send(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (error) {
      console.error(`Error reading ${fileName}:`, error);
      return res.status(500).send(`Error reading ${fileName}`);
    }
    return res.status(404).send(`${fileName} not found`);
  };

  app.get('/service-worker.js', (req, res) => {
    servePwaFile(res, 'service-worker.js', 'application/javascript; charset=utf-8', {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    });
  });

  app.get('/manifest.json', (req, res) => {
    servePwaFile(res, 'manifest.json', 'application/manifest+json; charset=utf-8');
  });

  // ==============================================
  // ARCHIVOS ESTÁTICOS (DESPUÉS DE SEGURIDAD)
  // ==============================================

  if (runMode === 'production') {
    app.get('/Slice/Slice.js', (req, res) => {
      // Prefer the self-contained copy emitted into dist by `slice build`: it is
      // the only location guaranteed to ship inside a serverless function (Vercel
      // bundles dist/** via includeFiles, but prunes node_modules that aren't
      // statically imported — and under pnpm the package sits behind a symlink).
      // Fall back to node_modules for non-serverless production (`slice start`).
      const distSlice = path.join(projectRoot, folderDeployed, 'Slice', 'Slice.js');
      const nodeModulesSlice = path.join(projectRoot, 'node_modules', 'slicejs-web-framework', 'Slice', 'Slice.js');
      const slicePath = fs.existsSync(distSlice) ? distSlice : nodeModulesSlice;
      try {
        if (fs.existsSync(slicePath)) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          return res.send(fs.readFileSync(slicePath, 'utf8'));
        }
      } catch (error) {
        console.error(`Error reading Slice.js:`, error);
        return res.status(500).send('Error loading framework');
      }
      return res.status(404).send('Slice.js not found');
    });

    app.use('/Slice', (req, res) => res.status(404).send('Not found'));
    app.use('/Components', (req, res) => res.status(404).send('Not found'));
  }

  // Serve precompressed .br/.gz siblings (from `slice build --compress`) when the
  // client accepts them. Mounted before the bundle handler and static serves so
  // it wins, and its Content-Encoding makes the runtime `compression` middleware
  // skip re-compressing. Production only (dist holds the precompressed files).
  if (runMode === 'production') {
    const distRoot = path.join(projectRoot, folderDeployed);
    app.use(createPrecompressedStatic([path.join(distRoot, 'public'), distRoot]));
  }

  // Middleware personalizado para archivos de bundles con MIME types correctos
  app.use('/bundles/', (req, res, next) => {
    if (req.path.endsWith('.js')) {
      const filePath = path.join(projectRoot, folderDeployed, 'bundles', req.path);
      console.log(`📂 Processing bundle: ${req.path} -> ${filePath}`);

      if (fs.existsSync(filePath)) {
        try {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          console.log(`✅ Serving bundle: ${req.path} (${fileContent.length} bytes, ${Buffer.byteLength(fileContent, 'utf8')} bytes UTF-8)`);
          return res.send(fileContent);
        } catch (error) {
          console.error(`Error reading bundle file:`, error);
          return res.status(500).send('Error reading bundle file');
        }
      } else {
        console.log(`❌ Bundle file not found: ${filePath}`);
        return res.status(404).send('Bundle file not found');
      }
    }

    next();
  });

  app.use('/bundles/', express.static(path.join(projectRoot, folderDeployed, 'bundles')));
  console.log(`📦 Serving bundles from /${folderDeployed}/bundles`);

  // Servir framework Slice.js (solo development)
  if (runMode === 'development') {
    app.use('/Slice/', express.static(path.join(projectRoot, 'node_modules', 'slicejs-web-framework', 'Slice')));
  }

  if (runMode === 'development') {
    // External (node_modules) dependency support in dev — always on, no app
    // bundling. Rewrites bare imports in served src modules to /@slice-modules/…
    // and serves each package pre-bundled on demand with esbuild (same resolver
    // as the production build → dev/prod parity for CommonJS and ESM packages).
    const devDeps = createDevDepsOptimizer({ projectRoot });

    if (devDeps.enabled) {
      const srcRoot = path.join(projectRoot, folderDeployed);

      // Serve a node_modules package pre-bundled as a single ESM module.
      app.get(/^\/@slice-modules\/(.+)$/, async (req, res) => {
        const spec = req.params[0];
        try {
          const { code } = await devDeps.bundlePackage(spec);
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          return res.send(code);
        } catch (error) {
          const message = `Failed to load external dependency "${spec}": ${error.message}`;
          console.error(`[slice:dev] ${message}`);
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          return res
            .status(502)
            .send(`throw new Error(${JSON.stringify(message)});`);
        }
      });

      // Rewrite bare imports in served src JavaScript to the virtual endpoint.
      app.use(async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const reqPath = req.path;
        if (!(reqPath.endsWith('.js') || reqPath.endsWith('.mjs'))) return next();
        // Framework internals, generated bundles and the virtual endpoint are
        // served elsewhere and must not be rewritten.
        if (reqPath.startsWith('/@slice-modules/') || reqPath.startsWith('/bundles/') || reqPath.startsWith('/Slice/')) {
          return next();
        }

        const filePath = path.join(srcRoot, decodeURIComponent(reqPath));
        const normalized = path.normalize(filePath);
        if (normalized !== srcRoot && !normalized.startsWith(srcRoot + path.sep)) {
          return next(); // path traversal guard
        }
        if (!fs.existsSync(normalized) || !fs.statSync(normalized).isFile()) {
          return next();
        }

        try {
          const original = fs.readFileSync(normalized, 'utf8');
          const rewritten = await devDeps.rewriteBareImports(original);
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          return res.send(rewritten);
        } catch (error) {
          console.error(`[slice:dev] Failed to rewrite ${reqPath}: ${error.message}`);
          return next();
        }
      });
    }

    // Centralized public/ folder served at the root URL (Themes, Styles,
    // images…). Mounted before the general src static so its files win.
    app.use(express.static(path.join(projectRoot, folderDeployed, 'public')));
    app.use(express.static(path.join(projectRoot, folderDeployed)));
  } else {
    // Serve the built public/ assets at the root URL.
    app.use(express.static(path.join(projectRoot, folderDeployed, 'public')));
    app.use('/App', express.static(path.join(projectRoot, folderDeployed, 'App')));
    const serveStaticFile = (req, res, filePath, contentType, fileName) => {
      try {
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', contentType);
          return res.send(fs.readFileSync(filePath, 'utf8'));
        }
      } catch (error) {
        console.error(`Error reading ${fileName}:`, error);
        return res.status(500).send(`Error reading ${fileName}`);
      }
      return res.status(404).send(`${fileName} not found`);
    };

    app.get('/routes.js', (req, res) => {
      const routesPath = path.join(projectRoot, folderDeployed, 'routes.js');
      serveStaticFile(req, res, routesPath, 'application/javascript; charset=utf-8', 'routes.js');
    });
    app.get('/sliceConfig.json', (req, res) => {
      const configPath = path.join(projectRoot, folderDeployed, 'sliceConfig.json');
      serveStaticFile(req, res, configPath, 'application/json; charset=utf-8', 'sliceConfig.json');
    });
    app.use('/bundles/', express.static(path.join(projectRoot, folderDeployed, 'bundles')));
    app.use('/dist/', express.static(path.join(projectRoot, 'dist')));
  }

  // ==============================================
  // RUTAS DE API
  // ==============================================

  // Ruta de ejemplo para API
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'ok',
      mode: runMode,
      folder: folderDeployed,
      timestamp: new Date().toISOString(),
      framework: 'Slice.js',
      version: frameworkVersion,
      security: {
        enabled: true,
        mode: 'automatic',
        description: 'Zero-config security - works with any domain'
      }
    });
  });

  // ==============================================
  // SEO: robots.txt & sitemap.xml
  // ==============================================

  // `sendFile` on a missing artifact routes to the error handler and answers
  // 500; the files are optional, so a missing one is a 404.
  const sendDeployedFile = (res, fileName) => {
    const file = resolveDeployedFile(fileName);
    if (!fs.existsSync(file)) return res.status(404).send(`${fileName} not found`);
    return res.sendFile(file);
  };

  app.get('/robots.txt', (req, res) => sendDeployedFile(res, 'robots.txt'));
  app.get('/sitemap.xml', (req, res) => sendDeployedFile(res, 'sitemap.xml'));

  // ==============================================
  // FIN DEL STACK — el fallback y el error handler los monta start()
  // ==============================================
  // Nothing terminal is registered here on purpose: a catch-all placed inside
  // the factory makes every `app.use()` the app adds afterwards dead code.
  // `sliceFallback()` owns "nobody answered" (shell, dev carve-outs, /api 404).

  let started = false;

  const hasFallbackMounted = () => {
    // Express 4 exposes `app._router`; Express 5 exposes `app.router` (and keeps
    // `_router`). On 4 the public getter throws when accessed, so both are read
    // defensively: worst case the answer is "not mounted" and the fallback is
    // added once more, which is harmless (the first one ends the response).
    let stack = [];
    try {
      stack = app._router?.stack || [];
    } catch {
      stack = [];
    }
    if (!stack.length) {
      try {
        stack = app.router?.stack || [];
      } catch {
        stack = [];
      }
    }
    return stack.some((layer) => layer?.handle?.__sliceFallback === true);
  };

  /**
   * Finishes the app and starts listening.
   * @param {{ port?: number, host?: string, signals?: boolean }} [startOptions]
   * @returns {import('http').Server}
   */
  function start(startOptions = {}) {
    if (started) throw new Error('Slice server: start() was already called');
    started = true;

    const { port = PORT, host, signals = true } = startOptions;

    if (!hasFallbackMounted()) {
      app.use(sliceFallback(options));
      app.use(sliceErrorHandler(options));
    }

    if (port !== 0 && Number(port) !== Number(PORT)) {
      console.warn(
        `[slice] starting on port ${port}, but the security middleware was configured for ${PORT}. ` +
        'Pass `port` to createSliceServer() as well, or set PORT, if the local app is refused.'
      );
    }

    const server = app.listen(port, host, () => {
      console.log('🔒 Security middleware: active (zero-config, automatic)');
      console.log(`🚀 Slice.js server running on port ${server.address()?.port ?? port}`);
    });

    if (signals) {
      const shutdown = (label) => () => {
        console.log(label);
        const force = setTimeout(() => process.exit(0), 5000);
        force.unref?.();
        server.close(() => process.exit(0));
      };
      process.once('SIGINT', shutdown('\n🛑 Slice server stopped'));
      process.once('SIGTERM', shutdown('\n🛑 Server terminated'));
    }

    return server;
  }

  return { app, start };
}
