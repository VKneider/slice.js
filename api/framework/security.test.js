import test from 'node:test';
import assert from 'node:assert/strict';
import {
  securityMiddleware,
  sliceFrameworkProtection,
  suspiciousRequestLogger
} from './securityMiddleware.js';

function call(middleware, { path = '/', headers = {} } = {}) {
  const result = { status: null, body: null, next: false };
  const req = {
    path,
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
    get(name) {
      const key = String(name).toLowerCase();
      return headers[key] ?? headers[name];
    }
  };
  const res = {
    status(code) {
      result.status = code;
      return this;
    },
    json(payload) {
      result.body = payload;
      return this;
    },
    send(payload) {
      result.body = payload;
      return this;
    }
  };

  middleware(req, res, () => {
    result.next = true;
  });

  return result;
}

function captureWarnings(fn) {
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    fn();
  } finally {
    console.warn = original;
  }
  return warnings;
}

function withDebug(value, fn) {
  const previous = process.env.SLICE_DEBUG;
  if (value === undefined) delete process.env.SLICE_DEBUG;
  else process.env.SLICE_DEBUG = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.SLICE_DEBUG;
    else process.env.SLICE_DEBUG = previous;
  }
}

test('a direct framework module hit is allowed and silent by default', () => {
  const middleware = sliceFrameworkProtection({ port: 3000 });
  const warnings = captureWarnings(() =>
    withDebug(undefined, () => {
      const result = call(middleware, { path: '/Slice/Components/Structural/Router/Router.js' });
      assert.equal(result.next, true);
      assert.equal(result.status, null);
    })
  );

  assert.deepEqual(warnings, []);
});

test('a direct framework module hit is reported with SLICE_DEBUG=1', () => {
  const middleware = sliceFrameworkProtection({ port: 3000 });
  const warnings = captureWarnings(() =>
    withDebug('1', () => {
      call(middleware, { path: '/Slice/Components/Structural/Router/Router.js' });
    })
  );

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^\[slice:security\] Framework file accessed without a valid referer:/);
});

test('strict mode still blocks a framework module without a referer', () => {
  const middleware = sliceFrameworkProtection({ port: 3000, strictMode: true });
  const warnings = captureWarnings(() => {
    const result = call(middleware, { path: '/Slice/Components/Structural/Router/Router.js' });
    assert.equal(result.status, 403);
    assert.equal(result.body.error, 'Framework Protection');
  });

  // Real blocks are useful even without debug, but deduplicated.
  assert.equal(warnings.length, 1);
});

test('blocked paths answer 403 and warn once per category', () => {
  const middleware = securityMiddleware();
  const warnings = captureWarnings(() => {
    const first = call(middleware, { path: '/node_modules/secret.js' });
    const second = call(middleware, { path: '/package.json' });

    assert.equal(first.status, 403);
    assert.equal(second.status, 403);
  });

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^\[slice:security\] Blocked access to sensitive path:/);
});

test('public assets skip the extension checks', () => {
  const middleware = securityMiddleware();
  const result = call(middleware, { path: '/images/logo.avif' });
  assert.equal(result.next, true);
});

test('suspicious requests are only logged with SLICE_DEBUG=1', () => {
  const middleware = suspiciousRequestLogger();

  const quiet = captureWarnings(() =>
    withDebug(undefined, () => call(middleware, { path: '/.env' }))
  );
  assert.deepEqual(quiet, []);

  const verbose = captureWarnings(() =>
    withDebug('1', () => call(middleware, { path: '/.env' }))
  );
  assert.equal(verbose.length, 1);
  assert.match(verbose[0], /^\[slice:security\] Suspicious request:/);
});
