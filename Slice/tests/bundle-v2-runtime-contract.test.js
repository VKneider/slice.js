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

test('loadBundle resolves dependencies first and registers vendor-shared exports once', async () => {
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
   const originalWindow = globalThis.window;

   controller.bundleConfig = {
      bundles: {
         shared: {
            'vendor-shared': {
               file: 'slice-bundle.vendor-shared.js',
            },
         },
         routes: {
            dashboard: {
               file: 'slice-bundle.dashboard.js',
               dependencies: ['vendor-shared'],
            },
         },
      },
   };

   const importOrder = [];
   const registerOrder = [];
   const importsByPath = {
      '/bundles/slice-bundle.vendor-shared.js': {
         SLICE_BUNDLE_META: {
            bundleKey: 'vendor-shared',
            type: 'shared',
         },
         SLICE_SHARED_DEPS: {
            'vendors/dompurify': {
               sanitize: () => 'ok',
            },
         },
         registerAll: async () => {
            registerOrder.push('vendor-shared');
         },
      },
      '/bundles/slice-bundle.dashboard.js': {
         SLICE_BUNDLE_META: {
            bundleKey: 'dashboard',
            type: 'route',
         },
         registerAll: async () => {
            registerOrder.push('dashboard');
         },
      },
   };

   controller.importBundleOnce = async (bundlePath) => {
      importOrder.push(bundlePath);
      return importsByPath[bundlePath];
   };

   try {
      globalThis.slice = {
         stylesManager: {},
      };
      globalThis.window = {
         __SLICE_SHARED_DEPS__: {},
      };

      await controller.loadBundle('dashboard');
      await controller.loadBundle('dashboard');

      assert.deepEqual(importOrder, ['/bundles/slice-bundle.vendor-shared.js', '/bundles/slice-bundle.dashboard.js']);
      assert.deepEqual(registerOrder, ['vendor-shared', 'dashboard']);
      assert.equal(typeof globalThis.window.__SLICE_SHARED_DEPS__['vendors/dompurify']?.sanitize, 'function');
   } finally {
      globalThis.slice = originalSlice;
      globalThis.window = originalWindow;
      await rm(tempDir, { recursive: true, force: true });
   }
});

test('Slice init fails fast with contextual error on invalid Bundling V2 contract path', async () => {
   const tempDir = await mkdtemp(path.join(tmpdir(), 'slice-init-loader-'));
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

   const originalWindow = globalThis.window;
   const originalDocument = globalThis.document;
   const originalFetch = globalThis.fetch;
   const originalAlert = globalThis.alert;
   const originalSliceDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'slice');
   const originalConsoleLog = console.log;
   const originalConsoleWarn = console.warn;
   const controllerModuleUrl = new URL('../Components/Structural/Controller/Controller.js', import.meta.url).href;
   const { default: Controller } = await import(controllerModuleUrl);
   const originalLoadBundle = Controller.prototype.loadBundle;

   const loggedMessages = [];

   try {
      globalThis.window = {
         location: {
            pathname: '/dashboard',
            origin: 'http://localhost',
         },
      };

      Object.defineProperty(globalThis, 'slice', {
         configurable: true,
         get() {
            return globalThis.window?.slice;
         },
         set(value) {
            if (!globalThis.window) {
               globalThis.window = {};
            }
            globalThis.window.slice = value;
         },
      });

      Controller.prototype.loadBundle = async () => {
         throw new Error(
            'Bundle "critical" missing Bundling V2 exports contract: requires SLICE_BUNDLE_META and registerAll'
         );
      };

      globalThis.document = {
         head: {
            appendChild() {},
         },
         body: {
            appendChild() {},
         },
         createElement() {
            return {
               appendChild() {},
               innerHTML: '',
               id: '',
            };
         },
         createTextNode() {
            return {};
         },
         addEventListener() {},
      };

      globalThis.alert = () => {};
      console.log = (...args) => {
         loggedMessages.push(args.map(String).join(' '));
      };
      console.warn = () => {};

      globalThis.fetch = async (url) => {
         if (url === '/sliceConfig.json') {
            return {
               ok: true,
               json: async () => ({
                  paths: {
                     routesFile: '/routes.js',
                     components: {},
                  },
                  themeManager: { enabled: false },
                  stylesManager: { requestedStyles: [] },
                  logger: { enabled: false },
                  debugger: { enabled: false },
                  loading: { enabled: false },
                  events: { enabled: false },
                  context: { enabled: false },
               }),
            };
         }

         if (url === '/slice-env.json') {
            return {
               ok: true,
               json: async () => ({ mode: 'production' }),
            };
         }

         if (url === '/bundles/bundle.config.json') {
            return {
               ok: true,
               json: async () => ({
                  production: true,
                  bundles: {
                     critical: { file: 'critical.js' },
                     routes: {},
                  },
                  routeBundles: {},
               }),
            };
         }

         throw new Error(`Unexpected fetch URL: ${url}`);
      };

      const sliceModuleUrl = new URL(`../Slice.js?fail-fast-test=${Date.now()}`, import.meta.url).href;

      await assert.rejects(() => import(sliceModuleUrl), /Bundling V2 initialization failed/i);

      assert.equal(
         loggedMessages.some((message) => message.includes('Using individual component loading (no bundles found)')),
         false,
         'init must not log fallback bundle message on Bundling V2 contract failure'
      );
   } finally {
      Controller.prototype.loadBundle = originalLoadBundle;
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
      globalThis.fetch = originalFetch;
      globalThis.alert = originalAlert;
      if (originalSliceDescriptor) {
         Object.defineProperty(globalThis, 'slice', originalSliceDescriptor);
      } else {
         delete globalThis.slice;
      }
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      await rm(tempDir, { recursive: true, force: true });
   }
});
