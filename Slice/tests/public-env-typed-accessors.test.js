import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.alert = () => {};

const { default: Slice } = await import('../Slice.js');

function createSliceInstance() {
  return new Slice({
    paths: {},
    themeManager: {},
    stylesManager: {},
    logger: {},
    debugger: {},
    loading: {},
    events: {}
  });
}

test('slice.env.get / has / all', () => {
  const s = createSliceInstance();
  s.setPublicEnv({ SLICE_PUBLIC_API_URL: 'https://api.example.com', INTERNAL: 'hidden' });

  assert.equal(s.env.get('SLICE_PUBLIC_API_URL'), 'https://api.example.com');
  assert.equal(s.env.get('SLICE_PUBLIC_MISSING', 'fb'), 'fb');
  assert.equal(s.env.has('SLICE_PUBLIC_API_URL'), true);
  assert.equal(s.env.has('SLICE_PUBLIC_MISSING'), false);
  assert.deepEqual(s.env.all(), { SLICE_PUBLIC_API_URL: 'https://api.example.com' }); // only SLICE_PUBLIC_*
});

test('slice.env.bool parses truthy strings and falls back', () => {
  const s = createSliceInstance();
  s.setPublicEnv({
    SLICE_PUBLIC_ON: 'true',
    SLICE_PUBLIC_ON2: 'YES',
    SLICE_PUBLIC_ON3: '1',
    SLICE_PUBLIC_OFF: 'false',
    SLICE_PUBLIC_EMPTY: ''
  });

  assert.equal(s.env.bool('SLICE_PUBLIC_ON'), true);
  assert.equal(s.env.bool('SLICE_PUBLIC_ON2'), true);
  assert.equal(s.env.bool('SLICE_PUBLIC_ON3'), true);
  assert.equal(s.env.bool('SLICE_PUBLIC_OFF'), false);
  assert.equal(s.env.bool('SLICE_PUBLIC_EMPTY', true), true);   // empty → fallback
  assert.equal(s.env.bool('SLICE_PUBLIC_MISSING'), false);       // missing → default false
  assert.equal(s.env.bool('SLICE_PUBLIC_MISSING', true), true);  // missing → custom fallback
});

test('slice.env.int parses integers and falls back', () => {
  const s = createSliceInstance();
  s.setPublicEnv({ SLICE_PUBLIC_TIMEOUT: '5000', SLICE_PUBLIC_BAD: 'nope' });

  assert.equal(s.env.int('SLICE_PUBLIC_TIMEOUT'), 5000);
  assert.equal(s.env.int('SLICE_PUBLIC_BAD', 10), 10);       // non-numeric → fallback
  assert.equal(s.env.int('SLICE_PUBLIC_MISSING', 42), 42);   // missing → fallback
});

test('slice.env.list splits CSV, trims, drops empties', () => {
  const s = createSliceInstance();
  s.setPublicEnv({ SLICE_PUBLIC_MODELS: ' a , b ,, c ', SLICE_PUBLIC_EMPTY: '' });

  assert.deepEqual(s.env.list('SLICE_PUBLIC_MODELS'), ['a', 'b', 'c']);
  assert.deepEqual(s.env.list('SLICE_PUBLIC_EMPTY', ['x']), ['x']);     // empty → fallback
  assert.deepEqual(s.env.list('SLICE_PUBLIC_MISSING'), []);             // missing → default []
});
