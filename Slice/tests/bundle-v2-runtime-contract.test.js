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

   const controllerModuleUrl = pathToFileURL(
      '/home/vkneider/projects/SLICE-LATEST/slice.js/.worktrees/bundling-v2-precompiled-registrars/Slice/Components/Structural/Controller/Controller.js'
   ).href;
   const { default: Controller } = await import(controllerModuleUrl);
   const controller = new Controller();
   const originalWindow = globalThis.window;

   try {
      globalThis.window = {
         __slicePendingRegistrations: [],
      };

      controller.initializeBundles({
         bundles: {
            critical: {
               file: 'critical.js',
            },
         },
      });

      controller.importBundleOnce = async () => ({
         default: {},
      });

      await assert.rejects(
         () => controller.loadBundle('critical'),
         /missing bundling v2 exports contract/i
      );
   } finally {
      globalThis.window = originalWindow;
      await rm(tempDir, { recursive: true, force: true });
   }
});
