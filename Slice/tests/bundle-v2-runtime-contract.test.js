import test from 'node:test';
import assert from 'node:assert/strict';

test('validateBundleModule rejects module missing Bundling V2 exports contract', async () => {
   const runtime = {};

   assert.equal(typeof runtime.validateBundleModule, 'function');

   await assert.rejects(() =>
      runtime.validateBundleModule(
         {
            default: {},
         },
         {
            bundleKey: 'critical',
         }
      )
   );
});
