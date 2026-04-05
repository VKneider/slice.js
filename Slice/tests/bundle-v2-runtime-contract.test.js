import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

test('validateBundleModule rejects module missing Bundling V2 exports contract', async () => {
   const tempDir = await mkdtemp(path.join(tmpdir(), 'slice-controller-loader-'));
   const loaderPath = path.join(tempDir, 'components-alias-loader.mjs');
   await writeFile(
      loaderPath,
      `export async function resolve(specifier, context, nextResolve) {
   if (specifier === '/Components/components.js') {
      return {
         shortCircuit: true,
         url: 'data:text/javascript,export default {};',
      };
   }
   return nextResolve(specifier, context);
}
`,
      'utf8'
   );
   register(pathToFileURL(loaderPath).href);

   const controllerModuleUrl = new URL('../Components/Structural/Controller/Controller.js', import.meta.url).href;
   const { default: Controller } = await import(controllerModuleUrl);
   const controller = new Controller();
   const originalWindow = globalThis.window;

   try {
      globalThis.window = {
         __slicePendingRegistrations: [],
      };

      assert.equal(
         typeof controller.validateBundleModule,
         'function',
         'Controller must expose validateBundleModule for Bundling V2 runtime contract checks'
      );

      if (typeof controller.validateBundleModule === 'function') {
         await assert.rejects(
            () => Promise.resolve(controller.validateBundleModule({ default: {} }, 'critical.js')),
            /missing bundling v2 exports contract/i
         );
      }
   } finally {
      globalThis.window = originalWindow;
      await rm(tempDir, { recursive: true, force: true });
   }
});

test('loadBundle marks requested bundle key and metadata bundleKey as loaded', async () => {
   const tempDir = await mkdtemp(path.join(tmpdir(), 'slice-controller-loader-'));
   const loaderPath = path.join(tempDir, 'components-alias-loader.mjs');
   await writeFile(
      loaderPath,
      `export async function resolve(specifier, context, nextResolve) {
   if (specifier === '/Components/components.js') {
      return {
         shortCircuit: true,
         url: 'data:text/javascript,export default {};',
      };
   }
   return nextResolve(specifier, context);
}
`,
      'utf8'
   );
   register(pathToFileURL(loaderPath).href);

   const controllerModuleUrl = new URL('../Components/Structural/Controller/Controller.js', import.meta.url).href;
   const { default: Controller } = await import(controllerModuleUrl);
   const controller = new Controller();
   const originalSlice = globalThis.slice;

   controller.bundleConfig = {
      bundles: {
         routes: {
            dashboard: {
               file: 'dashboard.js',
            },
         },
      },
   };

   controller.importBundleOnce = async () => ({});
   controller.validateBundleModule = async () => ({
      metadata: {
         bundleKey: 'routes.dashboard.v2',
         type: 'route',
      },
      registerAll: async () => {},
   });

   try {
      globalThis.slice = {
         stylesManager: {},
      };

      await controller.loadBundle('dashboard');

      assert.equal(controller.loadedBundles.has('dashboard'), true);
      assert.equal(controller.loadedBundles.has('routes.dashboard.v2'), true);
      assert.equal(controller.criticalBundleLoaded, false);
   } finally {
      globalThis.slice = originalSlice;
      await rm(tempDir, { recursive: true, force: true });
   }
});
