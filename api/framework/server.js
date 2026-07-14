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

export function createSliceServer(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const runMode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const folderDeployed = runMode === 'production' ? 'dist' : 'src';

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

  const PORT = process.env.PORT || sliceConfig.server?.port || 3001;

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

  app.get('/robots.txt', (req, res) => {
    res.sendFile(resolveDeployedFile('robots.txt'));
  });

  app.get('/sitemap.xml', (req, res) => {
    res.sendFile(resolveDeployedFile('sitemap.xml'));
  });

  // ==============================================
  // API 404 — las rutas /api/* irreconocibles devuelven JSON, no HTML
  // ==============================================

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found', path: req.originalUrl });
  });

  // ==============================================
  // SPA FALLBACK
  // ==============================================

  app.get('*', (req, res) => {
    const indexPath = path.join(projectRoot, folderDeployed, 'App', 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error(`[SPA Fallback] Error sending ${indexPath}:`, err);
        res.status(500).send(`<h1>500 - Internal Server Error</h1><p>Could not serve application file</p>`);
      }
    });
  });

  // ==============================================
  // ERROR HANDLER CENTRALIZADO
  // ==============================================

  app.use((err, req, res, next) => {
    console.error('[Server Error]', err.stack || err.message || err);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
    });
  });

  // ==============================================
  // INICIO DEL SERVIDOR
  // ==============================================

  function startServer() {
    const server = app.listen(PORT, () => {
      console.log(`🔒 Security middleware: active (zero-config, automatic)`);
      console.log(`🚀 Slice.js server running on port ${PORT}`);
    });

    process.on('SIGINT', () => {
      console.log('\n🛑 Slice server stopped');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Server terminated');
      process.exit(0);
    });

    return server;
  }

  return {
    app,
    start: startServer
  };
}
