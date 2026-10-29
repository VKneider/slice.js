// Contract tests for the composable server.
//
// The whole point of the feature: anything the app adds between
// `createSliceServer()` and `start()` must run BEFORE the terminal fallback.
// Before this change the catch-all lived inside the factory, so user middleware
// was dead code for every page route.
//
// Runs against Express 4 and 5 (the repo resolves 4, apps on 5.x also import
// this module), so nothing here touches internals beyond the guarded stack probe.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { brotliCompressSync } from 'node:zlib';
import {
  createSliceServer,
  sliceFallback,
  sliceErrorHandler
} from './server.js';

const SHELL = '<!DOCTYPE html><html><head><title>Fixture</title></head><body><div id="app"></div></body></html>';
const CONFIG = JSON.stringify({
  paths: { components: { Visual: { path: '/Components/Visual' } } },
  server: { port: 3001 }
});

const makeProject = (mode, { shell = true } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slice-server-'));
  const folder = mode === 'production' ? 'dist' : 'src';
  fs.mkdirSync(path.join(root, folder, 'App'), { recursive: true });
  fs.writeFileSync(path.join(root, folder, 'sliceConfig.json'), CONFIG);
  if (shell) fs.writeFileSync(path.join(root, folder, 'App', 'index.html'), SHELL);
  return { root, folder };
};

const boot = async (t, mode = 'production', options = {}) => {
  const { root, folder } = makeProject(mode);
  const instance = createSliceServer({ projectRoot: root, mode, port: 0, ...options });
  const server = await instance.start({ port: 0, signals: false });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  t.after(() => {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  return { ...instance, server, base, root, folder };
};

const get = (base, pathname, init = {}) => fetch(`${base}${pathname}`, init);

test('middleware added between the factory and start() runs before the fallback', async (t) => {
  const { root } = makeProject('production');
  const { app, start } = createSliceServer({ projectRoot: root, mode: 'production', port: 0 });
  app.get('/health', (req, res) => res.json({ ok: true }));

  const server = await start({ port: 0, signals: false });
  await once(server, 'listening');
  t.after(() => {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const health = await get(base, '/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const page = await get(base, '/docs/anything');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /id="app"/);
});

test('a middleware that touches every page response is not skipped', async (t) => {
  const { root } = makeProject('production');
  const { app, start } = createSliceServer({ projectRoot: root, mode: 'production', port: 0 });
  app.use((req, res, next) => {
    res.setHeader('X-Test-Layer', 'before-fallback');
    next();
  });

  const server = await start({ port: 0, signals: false });
  await once(server, 'listening');
  t.after(() => {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  const response = await get(`http://127.0.0.1:${server.address().port}`, '/');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-test-layer'), 'before-fallback');
  assert.match(await response.text(), /id="app"/);
});

test('start() mounts the fallback when the app mounted none', async (t) => {
  const { base } = await boot(t);

  const response = await get(base, '/whatever');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /id="app"/);
});

test('start() twice is an error', async (t) => {
  const { start } = await boot(t);
  await assert.rejects(start({ port: 0, signals: false }), /already called/);
});

test('an /api router added after the factory still wins over the JSON 404', async (t) => {
  const project = makeProject('production');
  const instance = createSliceServer({ projectRoot: project.root, mode: 'production', port: 0 });
  instance.app.get('/api/hooks', (req, res) => res.json({ hook: true }));

  const server = await instance.start({ port: 0, signals: false });
  await once(server, 'listening');
  t.after(() => {
    server.close();
    fs.rmSync(project.root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const known = await get(base, '/api/hooks');
  assert.equal(known.status, 200);
  assert.deepEqual(await known.json(), { hook: true });

  const unknown = await get(base, '/api/nope');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.headers.get('content-type'), 'application/json; charset=utf-8');
});

test('a non-GET request never gets the SPA shell', async (t) => {
  const { base } = await boot(t);

  const response = await get(base, '/anything', { method: 'POST' });
  assert.equal(response.status, 404);
  assert.doesNotMatch(await response.text(), /id="app"/);
});

test('a missing robots.txt or sitemap.xml is a 404, not a 500', async (t) => {
  const { base } = await boot(t);

  for (const file of ['/robots.txt', '/sitemap.xml']) {
    const response = await get(base, file);
    assert.equal(response.status, 404, file);
  }
});

test('development: a component without a stylesheet answers an empty 200', async (t) => {
  const { base, root, folder } = await boot(t, 'development');
  const componentDir = path.join(root, folder, 'Components', 'Visual', 'Foo');
  fs.mkdirSync(componentDir, { recursive: true });
  fs.writeFileSync(path.join(componentDir, 'Foo.js'), 'export default class Foo {}');

  const response = await get(base, '/Components/Visual/Foo/Foo.css');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/css/);
  assert.doesNotMatch(await response.text(), /<html/);
});

test('development: a request that is not a real component is not treated as a stylesheet', async (t) => {
  const { base } = await boot(t, 'development');
  const response = await get(base, '/Components/Visual/Nope/Nope.css');

  // The carve-out only applies when the component's `.js` exists. Anything else
  // still gets the shell (200) — the 404 for unknown paths lands with the SEO
  // module, which is the piece that knows the route set.
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
});

test('development: a missing .html request still gets the shell', async (t) => {
  const { base } = await boot(t, 'development');
  const response = await get(base, '/Components/Visual/Foo/Foo.html');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /id="app"/);
});

test('sliceFallback can be mounted by hand for an app that never calls start()', async (t) => {
  const { root } = makeProject('production');
  const app = (await import('express')).default();
  app.get('/boom', () => {
    throw new Error('exploded');
  });
  app.use(sliceFallback({ projectRoot: root, mode: 'production' }));
  app.use(sliceErrorHandler({ projectRoot: root, mode: 'production' }));

  const server = app.listen(0);
  await once(server, 'listening');
  t.after(() => {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const page = await get(base, '/anything');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /id="app"/);

  const boom = await get(base, '/boom');
  assert.equal(boom.status, 500);
  assert.deepEqual(await boom.json(), {
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

// ── SEO ──────────────────────────────────────────────────────────────
// With a manifest the fallback knows the route set, so it owns the 200-vs-404
// decision and serves prerendered HTML with that route's head.

const makeSeoProject = () => {
  const project = makeProject('production');
  const routes = [
    "  { path: '/', metadata: { title: 'Home' } },",
    "  { path: '/pricing', metadata: { title: 'Pricing' } },",
    "  { path: '/private', metadata: { robots: false } },",
    "  { path: '/producto/${id}' }"
  ].join('\n');
  fs.writeFileSync(
    path.join(project.root, 'dist', 'routes.js'),
    `export default [\n${routes}\n];\n`
  );
  fs.writeFileSync(path.join(project.root, 'seo.json'), JSON.stringify({
    version: 1,
    origin: 'https://acme.dev',
    defaults: { titleSuffix: ' | Acme', description: 'Acme.' },
    routes: {
      '/': { title: 'Home', titleSuffix: false },
      '/pricing': { title: 'Pricing', description: 'Plans.' },
      '/private': { title: 'Private', robots: false },
      '/producto/${id}': { title: 'Producto' }
    }
  }));
  return project;
};

const bootSeo = async (t) => {
  const project = makeSeoProject();
  const instance = createSliceServer({
    projectRoot: project.root,
    mode: 'production',
    port: 0,
    seo: { manifest: 'seo.json' }
  });
  const server = await instance.start({ port: 0, signals: false });
  t.after(() => {
    server.close();
    fs.rmSync(project.root, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${server.address().port}`, ...instance };
};

test('seo: a known route gets its own head and a 304 on the second visit', async (t) => {
  const { base } = await bootSeo(t);

  const response = await get(base, '/pricing');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Pricing \| Acme<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/acme.dev\/pricing" \/>/);
  assert.match(html, /property="og:url" content="https:\/\/acme.dev\/pricing"/);

  const etag = response.headers.get('etag');
  assert.ok(etag);
  const again = await get(base, '/pricing', { headers: { 'If-None-Match': etag } });
  assert.equal(again.status, 304);
});

test('seo: an unknown path is a real 404 with no fabricated canonical', async (t) => {
  const { base } = await bootSeo(t);

  const response = await get(base, '/nope');
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /noindex, nofollow/);
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(html, /id="app"/, 'the shell still boots the client router');
});

test('seo: a ${param} route uses the pattern metadata and the real canonical', async (t) => {
  const { base } = await bootSeo(t);

  const response = await get(base, '/producto/42');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Producto \| Acme<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/acme.dev\/producto\/42"/);

  // The arbitrary instance is not a page of its own.
  assert.equal((await get(base, '/producto/42/detalle')).status, 404);
});

test('seo: robots:false is noindex but still 200', async (t) => {
  const { base } = await bootSeo(t);

  const response = await get(base, '/private');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /name="robots" content="noindex, nofollow"/);
});

test('seo: in development the origin falls back to localhost', async (t) => {  const project = makeSeoProject();
  // A manifest without origin is valid in dev: the canonical points at the dev
  // server so the metadata is still inspectable.
  const manifestPath = path.join(project.root, 'seo.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  delete manifest.origin;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  // The dev server reads src/, so the shell and the routes have to exist there.
  fs.mkdirSync(path.join(project.root, 'src', 'App'), { recursive: true });
  fs.copyFileSync(
    path.join(project.root, 'dist', 'App', 'index.html'),
    path.join(project.root, 'src', 'App', 'index.html')
  );
  fs.writeFileSync(
    path.join(project.root, 'src', 'routes.js'),
    "export default [{ path: '/pricing', metadata: { title: 'Pricing' } }];\n"
  );

  const instance = createSliceServer({
    projectRoot: project.root,
    mode: 'development',
    port: 0,
    seo: { manifest: 'seo.json' }
  });
  const server = await instance.start({ port: 0, signals: false });
  t.after(() => {
    server.close();
    fs.rmSync(project.root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const html = await (await get(base, '/pricing')).text();
  assert.match(html, /rel="canonical" href="http:\/\/localhost:\d+\/pricing"/);
});

test('seo: a separate image manifest fills in the social card', async (t) => {
  const project = makeSeoProject();
  // The generated layout: the manifest and the cards live under public/, so a
  // relative path must resolve inside the deployed folder, not the project root.
  fs.mkdirSync(path.join(project.root, 'dist', 'public', 'og'), { recursive: true });
  fs.renameSync(
    path.join(project.root, 'seo.json'),
    path.join(project.root, 'dist', 'public', 'seo.json')
  );
  fs.writeFileSync(
    path.join(project.root, 'dist', 'public', 'og', 'manifest.json'),
    JSON.stringify({
      images: {
        '/pricing': { path: '/og/pricing-abc123.png', width: 1200, height: 630, type: 'image/png' }
      }
    })
  );

  const instance = createSliceServer({
    projectRoot: project.root,
    mode: 'production',
    port: 0,
    seo: { manifest: 'seo.json', images: 'og/manifest.json' }
  });
  const server = await instance.start({ port: 0, signals: false });
  t.after(() => {
    server.close();
    fs.rmSync(project.root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const html = await (await get(base, '/pricing')).text();
  assert.match(html, /property="og:image" content="https:\/\/acme.dev\/og\/pricing-abc123.png"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:type" content="image\/png"/);

  // A route the image manifest does not know about keeps the generic head.
  const other = await (await get(base, '/')).text();
  assert.doesNotMatch(other, /og\/pricing-abc123/);
});

test('seo: an explicit image on the route wins over the image manifest', async (t) => {
  const project = makeSeoProject();
  fs.mkdirSync(path.join(project.root, 'dist', 'public', 'og'), { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(project.root, 'seo.json'), 'utf8'));
  manifest.routes['/pricing'].image = '/images/explicit.png';
  fs.writeFileSync(path.join(project.root, 'seo.json'), JSON.stringify(manifest));
  fs.writeFileSync(
    path.join(project.root, 'dist', 'public', 'og', 'manifest.json'),
    JSON.stringify({ images: { '/pricing': { path: '/og/generated.png' } } })
  );

  const instance = createSliceServer({
    projectRoot: project.root,
    mode: 'production',
    port: 0,
    seo: { manifest: 'seo.json', images: 'dist/public/og/manifest.json' }
  });
  const server = await instance.start({ port: 0, signals: false });
  t.after(() => {
    server.close();
    fs.rmSync(project.root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const html = await (await get(base, '/pricing')).text();
  assert.match(html, /property="og:image" content="https:\/\/acme.dev\/images\/explicit.png"/);
  assert.doesNotMatch(html, /og\/generated\.png/);
});


// Bundles are unversioned: they must never be cached, whether the `/bundles/`
// handler serves them or a `--compress` build's .br/.gz sibling does. The
// precompressed handler runs first, so a missing policy there silently
// reintroduces heuristic caching for the whole bundle graph.
test('bundles: the plain bundle keeps the no-store policy', async (t) => {
  const { base, root } = await boot(t, 'production');
  const bundles = path.join(root, 'dist', 'bundles');
  fs.mkdirSync(bundles, { recursive: true });
  fs.writeFileSync(path.join(bundles, 'slice-bundle.critical.js'), 'export const SLICE_BUNDLE_META = {};');

  const response = await get(base, '/bundles/slice-bundle.critical.js');

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/);
  assert.equal(response.headers.get('cache-control'), 'no-cache, no-store, must-revalidate');
  assert.match(await response.text(), /SLICE_BUNDLE_META/);
});

test('bundles: a precompressed bundle is served with the same no-store policy', async (t) => {
  const { base, root } = await boot(t, 'production');
  const bundles = path.join(root, 'dist', 'bundles');
  fs.mkdirSync(bundles, { recursive: true });
  const source = 'export const SLICE_BUNDLE_META = { size: 1 };';
  const file = path.join(bundles, 'slice-bundle.critical.js');
  fs.writeFileSync(file, source);
  fs.writeFileSync(`${file}.br`, brotliCompressSync(Buffer.from(source)));

  const response = await get(base, '/bundles/slice-bundle.critical.js', {
    headers: { 'Accept-Encoding': 'br' }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-encoding'), 'br');
  assert.equal(response.headers.get('cache-control'), 'no-cache, no-store, must-revalidate');
  assert.match(await response.text(), /SLICE_BUNDLE_META/);
});

test('bundles: a precompressed bundle config is not cached either', async (t) => {
  const { base, root } = await boot(t, 'production');
  const bundles = path.join(root, 'dist', 'bundles');
  fs.mkdirSync(bundles, { recursive: true });
  const config = JSON.stringify({ production: true, bundles: {} });
  const file = path.join(bundles, 'bundle.config.json');
  fs.writeFileSync(file, config);
  fs.writeFileSync(`${file}.br`, brotliCompressSync(Buffer.from(config)));

  const response = await get(base, '/bundles/bundle.config.json', {
    headers: { 'Accept-Encoding': 'br' }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-cache, no-store, must-revalidate');
  assert.match(response.headers.get('content-type'), /json/);
});

test('bundles: the plain config and the /dist mirror are no-store as well', async (t) => {
  const { base, root } = await boot(t, 'production');
  const bundles = path.join(root, 'dist', 'bundles');
  fs.mkdirSync(bundles, { recursive: true });
  fs.writeFileSync(path.join(bundles, 'bundle.config.json'), JSON.stringify({ production: true }));
  fs.writeFileSync(path.join(bundles, 'slice-bundle.critical.js'), 'export const SLICE_BUNDLE_META = {};');

  const config = await get(base, '/bundles/bundle.config.json');
  assert.equal(config.status, 200);
  assert.equal(config.headers.get('cache-control'), 'no-cache, no-store, must-revalidate');

  const mirror = await get(base, '/dist/bundles/slice-bundle.critical.js');
  assert.equal(mirror.status, 200);
  assert.equal(mirror.headers.get('cache-control'), 'no-cache, no-store, must-revalidate');
});

test('bundles: the no-store policy does not leak into public assets', async (t) => {
  const { base, root } = await boot(t, 'production');
  const publicDir = path.join(root, 'dist', 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  const css = 'body { color: #111; }';
  fs.writeFileSync(path.join(publicDir, 'app.css'), css);
  fs.writeFileSync(path.join(publicDir, 'app.css.br'), brotliCompressSync(Buffer.from(css)));

  const response = await get(base, '/app.css', { headers: { 'Accept-Encoding': 'br' } });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-encoding'), 'br');
  assert.notEqual(response.headers.get('cache-control'), 'no-cache, no-store, must-revalidate');
});

test('translator: the configured dictionaries folder is served from dist, not the shell', async (t) => {
  const { root, folder } = makeProject('production');
  fs.writeFileSync(path.join(root, folder, 'sliceConfig.json'), JSON.stringify({
    paths: { components: { Visual: { path: '/Components/Visual' } } },
    translator: { enabled: true, defaultLocale: 'es', path: '/locales' }
  }));
  fs.mkdirSync(path.join(root, folder, 'locales'), { recursive: true });
  fs.writeFileSync(path.join(root, folder, 'locales', 'es.json'), JSON.stringify({ lab: { tagline: 'app completa' } }));

  const { start } = createSliceServer({ projectRoot: root, mode: 'production', port: 0 });
  const server = await start({ port: 0, signals: false });
  await once(server, 'listening');
  t.after(() => {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const dictionary = await get(base, '/locales/es.json');
  assert.equal(dictionary.status, 200);
  assert.match(dictionary.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await dictionary.json(), { lab: { tagline: 'app completa' } });

  const cached = await get(base, '/locales/es.json');
  assert.match(cached.headers.get('cache-control'), /max-age=300/);
});

test('translator: no dictionary mount when the translator is off', async (t) => {
  const { root, folder } = makeProject('production');
  fs.mkdirSync(path.join(root, folder, 'locales'), { recursive: true });
  fs.writeFileSync(path.join(root, folder, 'locales', 'es.json'), JSON.stringify({ lab: { tagline: 'app completa' } }));

  const { start } = createSliceServer({ projectRoot: root, mode: 'production', port: 0 });
  const server = await start({ port: 0, signals: false });
  await once(server, 'listening');
  t.after(() => {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  // Without the translator the path is just another SPA route: the shell, never the JSON.
  const response = await get(base, '/locales/es.json');
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(await response.text(), /id="app"/);
});

// -- SEO + translator (feature 0003, phase 5) -------------------------
// With a locale prefix, the server prerenders every route once per locale,
// strips/canonicalizes the prefix and answers an unknown prefix with a 404.

const makeTranslatedSeoProject = ({ localePrefix = 'except-default' } = {}) => {
  const project = makeSeoProject();
  const root = project.root;

  fs.writeFileSync(path.join(root, 'dist', 'sliceConfig.json'), JSON.stringify({
    paths: { components: { Visual: { path: '/Components/Visual' } } },
    server: { port: 3001 },
    translator: {
      enabled: true,
      defaultLocale: 'es',
      fallbackLocale: 'en',
      locales: ['es', 'en'],
      path: '/locales',
      localePrefix
    }
  }));

  fs.mkdirSync(path.join(root, 'dist', 'locales'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'locales', 'es.json'), JSON.stringify({
    seo: { titleSuffix: ' | Acme', description: 'Acme en español.' },
    home: { title: 'Inicio' },
    pricing: { title: 'Precios', description: 'Planes.' },
    product: { title: 'Producto' }
  }));
  fs.writeFileSync(path.join(root, 'dist', 'locales', 'en.json'), JSON.stringify({
    seo: { titleSuffix: ' | Acme', description: 'Acme in English.' },
    home: { title: 'Home' },
    pricing: { title: 'Pricing', description: 'Plans.' },
    product: { title: 'Product' }
  }));

  // Titles come from the dictionaries, not from inline routes.js metadata.
  fs.writeFileSync(
    path.join(root, 'dist', 'routes.js'),
    "export default [\n  { path: '/' },\n  { path: '/pricing' },\n  { path: '/private' },\n  { path: '/producto/${id}' }\n];\n"
  );

  fs.writeFileSync(path.join(root, 'seo.json'), JSON.stringify({
    version: 1,
    origin: 'https://acme.dev',
    locales: { es: { ogLocale: 'es_ES' }, en: { ogLocale: 'en_US' } },
    defaults: {
      titleSuffix: { t: 'seo.titleSuffix' },
      description: { t: 'seo.description' }
    },
    routes: {
      '/': { title: { t: 'home.title' }, titleSuffix: false },
      '/pricing': { title: { t: 'pricing.title' }, description: { t: 'pricing.description' } },
      '/private': { title: 'Private', robots: false },
      '/producto/${id}': { title: { t: 'product.title' } }
    }
  }));

  return project;
};

const bootTranslatedSeo = async (t, options) => {
  const project = makeTranslatedSeoProject(options);
  const instance = createSliceServer({
    projectRoot: project.root,
    mode: 'production',
    port: 0,
    seo: { manifest: 'seo.json' }
  });
  const server = await instance.start({ port: 0, signals: false });
  t.after(() => {
    server.close();
    fs.rmSync(project.root, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${server.address().port}`, ...instance };
};

test('seo+translator: without a locale prefix the server prerenders one page per route', async (t) => {
  const { base } = await bootTranslatedSeo(t, { localePrefix: false });

  const pricing = await get(base, '/pricing');
  assert.equal(pricing.status, 200);
  const html = await pricing.text();
  assert.match(html, /<title>Precios \| Acme<\/title>/);
  assert.doesNotMatch(html, /hreflang=/);

  // Without a locale prefix /en is not a locale prefix: it is an unknown path.
  const prefixed = await get(base, '/en/pricing');
  assert.equal(prefixed.status, 404);
});

test('seo+translator: "always" redirects a known unprefixed path instead of 404', async (t) => {
  const { base } = await bootTranslatedSeo(t, { localePrefix: 'always' });

  const response = await get(base, '/pricing', { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.match(response.headers.get('location') || '', /\/es\/pricing$/);

  const prefixed = await get(base, '/es/pricing');
  assert.equal(prefixed.status, 200);
});

test('seo+translator: each locale is prerendered with its own head and alternates', async (t) => {
  const { base } = await bootTranslatedSeo(t);

  const esResponse = await get(base, '/pricing');
  assert.equal(esResponse.status, 200);
  const es = await esResponse.text();
  assert.match(es, /<html lang="es" dir="ltr">/);
  assert.match(es, /<title>Precios \| Acme<\/title>/);
  assert.match(es, /<meta name="description" content="Planes\." \/>/);
  assert.match(es, /rel="canonical" href="https:\/\/acme.dev\/pricing"/);
  assert.match(es, /rel="alternate" hreflang="es" href="https:\/\/acme.dev\/pricing"/);
  assert.match(es, /rel="alternate" hreflang="en" href="https:\/\/acme.dev\/en\/pricing"/);
  assert.match(es, /rel="alternate" hreflang="x-default" href="https:\/\/acme.dev\/pricing"/);
  assert.match(es, /property="og:locale" content="es_ES"/);

  const enResponse = await get(base, '/en/pricing');
  assert.equal(enResponse.status, 200);
  const en = await enResponse.text();
  assert.match(en, /<html lang="en" dir="ltr">/);
  assert.match(en, /<title>Pricing \| Acme<\/title>/);
  assert.match(en, /rel="canonical" href="https:\/\/acme.dev\/en\/pricing"/);
  assert.match(en, /property="og:locale" content="en_US"/);
});

test('seo+translator: the default prefix is canonicalized and unknown prefixes are 404', async (t) => {
  const { base } = await bootTranslatedSeo(t);

  const canonical = await get(base, '/es/pricing', { redirect: 'manual' });
  assert.equal(canonical.status, 301);
  assert.equal(canonical.headers.get('location'), '/pricing');

  const unknown = await get(base, '/fr/pricing');
  assert.equal(unknown.status, 404);
  assert.match(await unknown.text(), /noindex, nofollow/);
});

test('seo+translator: ${param} routes render per locale', async (t) => {
  const { base } = await bootTranslatedSeo(t);

  const es = await get(base, '/producto/42');
  assert.equal(es.status, 200);
  assert.match(await es.text(), /<title>Producto \| Acme<\/title>/);

  const enResponse = await get(base, '/en/producto/42');
  assert.equal(enResponse.status, 200);
  const en = await enResponse.text();
  assert.match(en, /<title>Product \| Acme<\/title>/);
  assert.match(en, /rel="canonical" href="https:\/\/acme.dev\/en\/producto\/42"/);
});
