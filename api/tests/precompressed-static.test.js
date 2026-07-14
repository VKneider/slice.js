import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createPrecompressedStatic } from '../framework/precompressedStatic.js';

function fakeRes() {
  return {
    headers: {},
    body: null,
    sent: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    send(body) { this.body = body; this.sent = true; return this; }
  };
}

function run(mw, req) {
  const res = fakeRes();
  let nextCalled = false;
  mw(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

async function withRoot(fn) {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'slice-precomp-'));
  try {
    await fn(tmp);
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true });
  }
}

test('serves the .br variant when the client accepts brotli', async () => {
  await withRoot(async (root) => {
    await fsp.mkdir(path.join(root, 'bundles'), { recursive: true });
    await fsp.writeFile(path.join(root, 'bundles', 'app.js'), 'ORIGINAL');
    await fsp.writeFile(path.join(root, 'bundles', 'app.js.br'), 'BROTLI-BYTES');
    await fsp.writeFile(path.join(root, 'bundles', 'app.js.gz'), 'GZIP-BYTES');

    const mw = createPrecompressedStatic([root]);
    const { res, nextCalled } = run(mw, {
      method: 'GET', path: '/bundles/app.js', headers: { 'accept-encoding': 'gzip, br' }
    });

    assert.equal(nextCalled, false);
    assert.equal(res.sent, true);
    assert.equal(res.body.toString(), 'BROTLI-BYTES'); // brotli preferred over gzip
    assert.equal(res.headers['content-encoding'], 'br');
    assert.equal(res.headers['content-type'], 'application/javascript; charset=utf-8');
    assert.equal(res.headers['vary'], 'Accept-Encoding');
  });
});

test('falls back to gzip when brotli is not accepted', async () => {
  await withRoot(async (root) => {
    await fsp.writeFile(path.join(root, 'style.css'), 'ORIGINAL');
    await fsp.writeFile(path.join(root, 'style.css.gz'), 'GZIP-BYTES');

    const mw = createPrecompressedStatic([root]);
    const { res } = run(mw, { method: 'GET', path: '/style.css', headers: { 'accept-encoding': 'gzip' } });
    assert.equal(res.headers['content-encoding'], 'gzip');
    assert.equal(res.headers['content-type'], 'text/css; charset=utf-8');
    assert.equal(res.body.toString(), 'GZIP-BYTES');
  });
});

test('passes through when the client accepts no encoding', async () => {
  await withRoot(async (root) => {
    await fsp.writeFile(path.join(root, 'app.js'), 'ORIGINAL');
    await fsp.writeFile(path.join(root, 'app.js.br'), 'BROTLI-BYTES');
    const mw = createPrecompressedStatic([root]);
    const { res, nextCalled } = run(mw, { method: 'GET', path: '/app.js', headers: {} });
    assert.equal(nextCalled, true);
    assert.equal(res.sent, false);
  });
});

test('passes through when no precompressed variant exists', async () => {
  await withRoot(async (root) => {
    await fsp.writeFile(path.join(root, 'app.js'), 'ORIGINAL'); // no .br/.gz
    const mw = createPrecompressedStatic([root]);
    const { res, nextCalled } = run(mw, { method: 'GET', path: '/app.js', headers: { 'accept-encoding': 'br' } });
    assert.equal(nextCalled, true);
    assert.equal(res.sent, false);
  });
});

test('passes through for non-text extensions', async () => {
  await withRoot(async (root) => {
    await fsp.writeFile(path.join(root, 'img.png.br'), 'X');
    const mw = createPrecompressedStatic([root]);
    const { nextCalled } = run(mw, { method: 'GET', path: '/img.png', headers: { 'accept-encoding': 'br' } });
    assert.equal(nextCalled, true);
  });
});

test('honors root priority (public over dist root)', async () => {
  await withRoot(async (root) => {
    const pub = path.join(root, 'public');
    await fsp.mkdir(pub, { recursive: true });
    await fsp.writeFile(path.join(pub, 'theme.css.br'), 'PUBLIC');
    await fsp.writeFile(path.join(root, 'theme.css.br'), 'ROOT');
    const mw = createPrecompressedStatic([pub, root]);
    const { res } = run(mw, { method: 'GET', path: '/theme.css', headers: { 'accept-encoding': 'br' } });
    assert.equal(res.body.toString(), 'PUBLIC');
  });
});

test('blocks path traversal', async () => {
  await withRoot(async (root) => {
    const mw = createPrecompressedStatic([path.join(root, 'public')]);
    const { nextCalled, res } = run(mw, {
      method: 'GET', path: '/../secret.js', headers: { 'accept-encoding': 'br' }
    });
    assert.equal(nextCalled, true);
    assert.equal(res.sent, false);
  });
});
