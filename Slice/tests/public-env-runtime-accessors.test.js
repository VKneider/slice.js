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

test('getEnv returns fallback for missing key and stored value for known key', () => {
  const sliceInstance = createSliceInstance();

  assert.equal(typeof sliceInstance.getEnv, 'function');
  assert.equal(typeof sliceInstance.setPublicEnv, 'function');
  assert.equal(sliceInstance.getEnv('SLICE_PUBLIC_MISSING', 'fallback'), 'fallback');

  sliceInstance.setPublicEnv({ SLICE_PUBLIC_API_URL: 'https://api.example.com' });
  assert.equal(sliceInstance.getEnv('SLICE_PUBLIC_API_URL'), 'https://api.example.com');
});

test('getPublicEnv returns a copy and only includes SLICE_PUBLIC_ keys', () => {
  const sliceInstance = createSliceInstance();

  sliceInstance.setPublicEnv({
    SLICE_PUBLIC_FLAG: 'true',
    INTERNAL_SECRET: 'hidden'
  });

  const snapshot = sliceInstance.getPublicEnv();
  assert.deepEqual(snapshot, { SLICE_PUBLIC_FLAG: 'true' });

  snapshot.SLICE_PUBLIC_FLAG = 'mutated';
  assert.equal(sliceInstance.getEnv('SLICE_PUBLIC_FLAG'), 'true');
});
