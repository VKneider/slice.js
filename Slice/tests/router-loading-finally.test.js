import test from 'node:test';
import assert from 'node:assert/strict';

import Router from '../Components/Structural/Router/Router.js';

test('handleRoute stops loading when build throws on error path', async () => {
   const originalSlice = globalThis.slice;
   const originalDocument = globalThis.document;

   const targetElement = {
      innerHTML: 'existing',
      appendChild() {},
   };

   try {
      globalThis.document = {
         querySelector(selector) {
            if (selector === '#app') {
               return targetElement;
            }
            return null;
         },
      };

      const loadingCalls = [];

      globalThis.slice = {
         loading: {
            start() {
               loadingCalls.push('start');
            },
            stop() {
               loadingCalls.push('stop');
            },
         },
         controller: {
            getComponent() {
               return null;
            },
         },
         build: async () => {
            throw new Error('build failed');
         },
         router: {
            activeRoute: null,
         },
      };

      const router = new Router([]);

      await assert.rejects(() =>
         router.handleRoute(
            {
               component: 'Dashboard',
               parentRoute: null,
            },
            {}
         )
      );

      assert.deepEqual(loadingCalls, ['start', 'stop']);
   } finally {
      globalThis.slice = originalSlice;
      globalThis.document = originalDocument;
   }
});
