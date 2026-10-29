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
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
import {
  buildTranslatorContext,
  injectHead,
  loadSeoManifest,
  loadTranslatorDictionaries,
  matchPathPattern,
  normalizeOrigin,
  pickRouteEntry,
  renderHead,
  resolveMetadata,
  routePaths
} from './seo.js';

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

/** The `translator` block from the deployed config (`dist` wins in production). */
function readTranslatorConfig(projectRoot, folderDeployed) {
  for (const folder of [folderDeployed, 'src']) {
    const file = path.join(projectRoot, folder, 'sliceConfig.json');
    if (!fs.existsSync(file)) continue;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')).translator || null;
    } catch {
      // unreadable config: SEO stays single-language, as before
    }
  }
  return null;
}

/** The `router` block from the deployed config (`dist` wins in production). */
function readRouterConfig(projectRoot, folderDeployed) {
  for (const folder of [folderDeployed, 'src']) {
    const file = path.join(projectRoot, folder, 'sliceConfig.json');
    if (!fs.existsSync(file)) continue;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')).router || {};
    } catch {
      // unreadable config: no title affixes, as before
    }
  }
  return {};
}

/**
 * Folder holding the translator dictionaries, from the deployed config (`translator.path`,
 * `/locales` by default). Null when the translator is off or the path is unusable, so no
 * extra mount is added. `slice build` copies `src/<path>` into `dist/<path>`; without this
 * mount production answers the SPA shell for every dictionary and the runtime shows keys.
 */
function readTranslatorFolder(projectRoot, folderDeployed) {
  const file = path.join(projectRoot, folderDeployed, 'sliceConfig.json');
  if (!fs.existsSync(file)) return null;
  try {
    const translator = JSON.parse(fs.readFileSync(file, 'utf8')).translator;
    if (!translator?.enabled) return null;
    const value = typeof translator.path === 'string' && translator.path.trim() ? translator.path : '/locales';
    const folder = value.replace(/^\/+|\/+$/g, '');
    return folder && !folder.includes('..') ? folder : null;
  } catch {
    return null;
  }
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
 *
 * `options.seo` is the **prepared** context from `prepareSeo()`, not the config.
 */
export function sliceFallback(options = {}) {
  const { projectRoot, runMode, folderDeployed } = resolveRuntimeContext(options);
  const isDev = runMode === 'development';
  const shellPath = path.join(projectRoot, folderDeployed, 'App', 'index.html');
  const prefixes = options.componentPrefixes || readComponentPrefixes(projectRoot);
  const seo = options.seo?.resolve ? options.seo : null;

  const sendShell = (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(shellPath, (error) => {
      if (!error) return;
      if (res.headersSent) return;
      console.error(`[SPA Fallback] Error sending ${shellPath}:`, error);
      res.status(500).send('<h1>500 - Internal Server Error</h1><p>Could not serve application file</p>');
    });
  };

  /** Precomputed HTML, or the shell: same encoding dance either way. */
  const sendRendered = (req, res, page, status) => {
    res.status(status);
    res.setHeader('Cache-Control', status === 200 ? 'no-cache' : 'no-store');
    if (page.etag) {
      res.setHeader('ETag', page.etag);
      if (req.headers['if-none-match'] === page.etag) return res.status(304).end();
    }

    const accept = String(req.headers['accept-encoding'] || '');
    let body = page.html;
    if (page.br && /\bbr\b/.test(accept)) {
      res.setHeader('Content-Encoding', 'br');
      body = page.br;
    } else if (page.gzip && /\bgzip\b/.test(accept)) {
      res.setHeader('Content-Encoding', 'gzip');
      body = page.gzip;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Content-Length', String(body.length));
    return res.end(body);
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

    // With SEO configured the route set is known, so this is also where the
    // 200-vs-404 decision happens.
    if (seo) {
      const result = seo.resolve(pathname);
      if (result.location) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.redirect(result.status, result.location);
      }
      return sendRendered(req, res, result.page, result.status);
    }

    return sendShell(req, res);
  };

  fallback.__sliceFallback = true;
  return fallback;
}

const encodeSeoPage = (html) => {
  const raw = Buffer.from(html, 'utf8');
  return {
    html: raw,
    gzip: zlib.gzipSync(raw, { level: 9 }),
    br: zlib.brotliCompressSync(raw, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 }
    }),
    etag: `W/"${createHash('sha1').update(raw).digest('base64url')}"`
  };
};

/**
 * Resolve a manifest (or image manifest) path. A relative path is tried at the
 * project root first (small apps keep `seo.json` there), then inside the
 * deployed `public/` folder, which is where generated artifacts live.
 */
function resolveSeoFile(projectRoot, folderDeployed, file) {
  const candidates = [
    path.resolve(projectRoot, file),
    path.join(projectRoot, folderDeployed, 'public', file),
    path.join(projectRoot, folderDeployed, file)
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

async function loadRouteDefinitions(projectRoot, folderDeployed) {
  const candidates = [
    path.join(projectRoot, folderDeployed, 'routes.js'),
    path.join(projectRoot, 'src', 'routes.js')
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const module = await import(pathToFileURL(candidate).href);
    const routes = module.default ?? module.routes ?? [];
    return (Array.isArray(routes) ? routes : []).map((route) => ({
      path: String(route?.path ?? '').replace(/\/+$/, '') || '/',
      metadata: route?.metadata || {}
    })).filter((route) => route.path);
  }
  return [];
}

/**
 * Reads the manifest and `routes.js`, renders every literal route once and
 * returns the resolver `sliceFallback` uses. Async because `routes.js` is an
 * ESM import — `start()` awaits it, so the first request never pays for it.
 *
 * `config` is the `seo` block from `createSliceServer({ seo })`: a JSON path (or
 * an already-loaded object) plus an optional origin override.
 */
export async function prepareSeo(options = {}) {
  const { projectRoot, runMode, folderDeployed } = resolveRuntimeContext(options);
  const config = options.seo || {};
  if (!config || (typeof config === 'object' && !config.manifest && !config.routes)) return null;

  const manifest = typeof config.manifest === 'object'
    ? config.manifest
    : loadSeoManifest(resolveSeoFile(projectRoot, folderDeployed, config.manifest || 'seo.json'));
  if (!manifest) return null;

  // Social cards are generated after the manifest (they need a browser), so the
  // app points at that file instead of inlining 70 image paths. An entry that
  // declares its own image always wins.
  const imageManifest = typeof config.images === 'object'
    ? config.images
    : config.images
      ? loadSeoManifest(resolveSeoFile(projectRoot, folderDeployed, config.images))
      : null;
  const cards = imageManifest?.images || {};

  const port = options.port || process.env.PORT || 3001;
  const origin = normalizeOrigin(config.origin)
    || normalizeOrigin(process.env.SLICE_ORIGIN)
    || normalizeOrigin(manifest.origin)
    || (runMode === 'development' ? `http://localhost:${port}` : null);

  if (!origin) {
    throw new Error(
      'seo: an absolute origin is required in production. Set seo.origin, SLICE_ORIGIN or seo.json origin.'
    );
  }

  const shellPath = path.join(projectRoot, folderDeployed, 'App', 'index.html');
  const shell = fs.readFileSync(shellPath, 'utf8');
  const siteName = config.siteName || manifest.defaults?.siteName || null;
  const locale = config.locale || manifest.defaults?.locale || null;
  const routes = await loadRouteDefinitions(projectRoot, folderDeployed);

  // Multilingual SEO (translator feature 0003, phase 5). Without a translator this is
  // one `null` locale and every rule below collapses to the old single-language path.
  const translatorConfig = config.translator || readTranslatorConfig(projectRoot, folderDeployed);
  const routerConfig = readRouterConfig(projectRoot, folderDeployed);
  const translator = buildTranslatorContext(
    translatorConfig,
    loadTranslatorDictionaries(projectRoot, folderDeployed, translatorConfig)
  );
  const locales = translator.enabled ? translator.locales : [null];
  const ogLocaleConfig = manifest.locales && typeof manifest.locales === 'object' ? manifest.locales : {};

  const render = (activeLocale, pathname, routeMetadata) => {
    const translate = activeLocale
      ? (key, params) => translator.t(activeLocale, key, params)
      : null;
    const url = translator.enabled ? translator.localize(pathname, activeLocale) : pathname;
    const meta = resolveMetadata({ pathname, routeMetadata, manifest, origin, translate, url, routerConfig });

    // Precedence: an image declared on the route entry wins, then the generated
    // card, then `defaults.image` (the generic banner). Comparing against the raw
    // entry keeps the framework from guessing where the image came from.
    const explicitImage = pickRouteEntry(pathname, manifest)?.entry?.image;
    const card = cards[url] || cards[pathname];
    if (card && !explicitImage && !routeMetadata?.image) {
      meta.image = /^https?:\/\//i.test(card.path) ? card.path : `${origin}${card.path}`;
      meta.imageWidth = card.width ?? null;
      meta.imageHeight = card.height ?? null;
      meta.imageType = card.type || null;
      meta.imageAlt = meta.imageAlt || meta.title;
    }

    const alternates = translator.enabled && activeLocale
      ? translator.locales
        .map((code) => ({
          hreflang: code,
          href: `${origin}${translator.localize(pathname, code)}`
        }))
        .concat([{
          hreflang: 'x-default',
          href: `${origin}${translator.localize(pathname, translator.defaultLocale)}`
        }])
      : null;

    const ogLocale = translator.enabled && activeLocale
      ? (ogLocaleConfig[activeLocale]?.ogLocale || translator.ogLocale(activeLocale))
      : locale;

    const head = renderHead(meta, { siteName, locale: ogLocale, alternates });
    return encodeSeoPage(injectHead(shell, head, translator.enabled && activeLocale
      ? { lang: activeLocale, dir: translator.direction(activeLocale) }
      : {}));
  };

  const pages = new Map();
  const patterns = [];
  for (const route of routes) {
    if (/\$\{[^}]+\}/.test(route.path)) {
      patterns.push(route);
      continue;
    }
    for (const activeLocale of locales) {
      const url = translator.enabled ? translator.localize(route.path, activeLocale) : route.path;
      pages.set(url, render(activeLocale, route.path, route.metadata));
    }
  }
  // Longest pattern first so `/p/${id}/detail` wins over `/p/${id}`.
  patterns.sort((a, b) => b.path.length - a.path.length);

  const notFound = new Map();
  for (const activeLocale of locales) {
    notFound.set(activeLocale, encodeSeoPage(injectHead(
      shell,
      '<title>Not found</title>\n    <meta name="robots" content="noindex, nofollow" />',
      translator.enabled && activeLocale
        ? { lang: activeLocale, dir: translator.direction(activeLocale) }
        : {}
    )));
  }

  // A `${param}` route cannot be enumerated, so it is rendered per path. The
  // cache keeps repeated visits of the same product from recompressing.
  const dynamicPages = new Map();
  const DYNAMIC_LIMIT = 200;

  /** The page for an app path in one locale: prerendered, cached dynamic, or 404. */
  const settle = (appPath, activeLocale) => {
    const url = translator.enabled ? translator.localize(appPath, activeLocale) : appPath;
    const exact = pages.get(url);
    if (exact) return { status: 200, page: exact };

    const dynamic = dynamicPages.get(url);
    if (dynamic) return { status: 200, page: dynamic };

    for (const route of patterns) {
      if (!matchPathPattern(route.path, appPath)) continue;
      const page = render(activeLocale, appPath, route.metadata);
      if (dynamicPages.size >= DYNAMIC_LIMIT) {
        dynamicPages.delete(dynamicPages.keys().next().value);
      }
      dynamicPages.set(url, page);
      return { status: 200, page };
    }

    return { status: 404, page: notFound.get(activeLocale) || notFound.get(null) };
  };

  return {
    origin,
    manifest,
    routes,
    translator,
    prerendered: pages.size,
    resolve(pathname) {
      if (!translator.enabled || !translator.routing) {
        return settle(pathname, translator.defaultLocale);
      }

      const { locale: urlLocale, path: appPath } = translator.split(pathname);

      if (urlLocale) {
        // `/es/pricing` under "prefix-except-default": the canonical URL is `/pricing`.
        if (translator.routing === 'prefix-except-default' && urlLocale === translator.defaultLocale) {
          return { status: 301, location: appPath };
        }
        return settle(appPath, urlLocale);
      }

      // With "prefix" every page has a locale in the URL. `/` picks the default (the
      // client may then apply the saved/browser choice); anything else is not a page,
      // including an unknown prefix such as `/fr/...`.
      if (translator.routing === 'prefix') {
        if (pathname === '/') {
          return { status: 302, location: translator.localize('/', translator.defaultLocale) };
        }
        return { status: 404, page: notFound.get(translator.defaultLocale) };
      }

      return settle(pathname, translator.defaultLocale);
    }
  };
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

  // Bundles are unversioned build output: never cache them. Set before every
  // handler that can answer a bundle (precompressed, the .js handler, static
  // files and the /dist mirror) so the policy cannot depend on which one wins.
  const noStoreBundlePaths = ['/bundles/', '/dist/bundles/'];
  app.use(noStoreBundlePaths, (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Serve precompressed .br/.gz siblings (from `slice build --compress`) when the
  // client accepts them. Mounted before the bundle handler and static serves so
  // it wins, and its Content-Encoding makes the runtime `compression` middleware
  // skip re-compressing. Production only (dist holds the precompressed files).
  if (runMode === 'production') {
    const distRoot = path.join(projectRoot, folderDeployed);
    app.use(createPrecompressedStatic([path.join(distRoot, 'public'), distRoot], {
      noStorePrefixes: noStoreBundlePaths
    }));
  }

  // Middleware personalizado para archivos de bundles con MIME types correctos
  app.use('/bundles/', (req, res, next) => {
    if (req.path.endsWith('.js') || req.path.endsWith('.mjs')) {
      const cleanedPath = req.path.replace(/^\//, '');
      let filePath = path.join(projectRoot, folderDeployed, 'bundles', cleanedPath);

      // Bundler v2 emits this import relative to /bundles even when the source
      // file lives under Components/AppComponents/ComponentsPage. Without this,
      // a production build 404s on a module it imported itself.
      if (cleanedPath === 'documentationRoutes.generated.js' || cleanedPath === 'docsIndex.js') {
        filePath = path.join(
          projectRoot,
          folderDeployed,
          'Components',
          'AppComponents',
          'ComponentsPage',
          cleanedPath
        );
      }
      console.log(`📂 Processing bundle: ${req.path} -> ${filePath}`);

      if (fs.existsSync(filePath)) {
        try {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
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

  // Translator dictionaries (`translator.path`, `/locales` by default): app data copied
  // into dist by `slice build`. Mounted in both modes so the path is explicit; without it
  // production answered the SPA shell for every dictionary and the runtime showed keys.
  const translatorFolder = readTranslatorFolder(projectRoot, folderDeployed);
  if (translatorFolder) {
    app.use(
      `/${translatorFolder}`,
      express.static(path.join(projectRoot, folderDeployed, translatorFolder), {
        setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400')
      })
    );
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
    let stack;
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
   * Finishes the app and starts listening. Async because the SEO context is
   * prepared (manifest read, `routes.js` imported, every literal route
   * prerendered) before the first request can arrive.
   * @param {{ port?: number, host?: string, signals?: boolean }} [startOptions]
   * @returns {Promise<import('http').Server>}
   */
  async function start(startOptions = {}) {
    if (started) throw new Error('Slice server: start() was already called');
    started = true;

    const { port = PORT, host, signals = true } = startOptions;

    let seo = null;
    if (options.seo) {
      seo = await prepareSeo({ ...options, port });
      if (seo) {
        const localeCount = seo.translator?.enabled ? seo.translator.locales.length : 0;
        console.log(`🔎 SEO: ${seo.prerendered} pages prerendered${localeCount ? ` (${localeCount} locales)` : ''} (${seo.origin})`);
      } else {
        console.warn('[slice] seo options were given but no manifest was found; SEO is off.');
      }
    }

    if (!hasFallbackMounted()) {
      app.use(sliceFallback({ ...options, seo }));
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
