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
  const server = instance.start({ port: 0, signals: false });
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

  const server = start({ port: 0, signals: false });
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

  const server = start({ port: 0, signals: false });
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
  assert.throws(() => start({ port: 0, signals: false }), /already called/);
});

test('an /api router added after the factory still wins over the JSON 404', async (t) => {
  const project = makeProject('production');
  const instance = createSliceServer({ projectRoot: project.root, mode: 'production', port: 0 });
  instance.app.get('/api/hooks', (req, res) => res.json({ hook: true }));

  const server = instance.start({ port: 0, signals: false });
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
