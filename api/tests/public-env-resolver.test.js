import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

const resolverModulePath = new URL('../utils/publicEnvResolver.js', import.meta.url);

async function withTempEnvFile(contents, callback) {
   const dir = await mkdtemp(path.join(tmpdir(), 'slice-public-env-'));
   const envFilePath = path.join(dir, '.env');

   try {
      await writeFile(envFilePath, contents, 'utf8');
      await callback(envFilePath);
   } finally {
      await rm(dir, { recursive: true, force: true });
   }
}

test('resolvePublicEnv filters only SLICE_PUBLIC_ keys', async () => {
   const { resolvePublicEnv } = await import(resolverModulePath.href);

   await withTempEnvFile(
      ['SLICE_PUBLIC_FROM_FILE=file-visible', 'PRIVATE_KEY=hidden-file-value', 'SLICE_API_URL=hidden-file-api-url'].join('\n'),
      async (envFilePath) => {
         const payload = resolvePublicEnv({
            mode: 'development',
            envFilePath,
            processEnv: {
               SLICE_PUBLIC_FROM_PROCESS: 'process-visible',
               SECRET_TOKEN: 'hidden-process-token',
               NODE_ENV: 'development',
            },
         });

         assert.deepEqual(payload, {
            SLICE_PUBLIC_FROM_FILE: 'file-visible',
            SLICE_PUBLIC_FROM_PROCESS: 'process-visible',
         });
      }
   );
});

test('resolvePublicEnv uses process.env values over .env values', async () => {
   const { resolvePublicEnv } = await import(resolverModulePath.href);

   await withTempEnvFile('SLICE_PUBLIC_API_URL=https://from-file.example', async (envFilePath) => {
      const payload = resolvePublicEnv({
         mode: 'development',
         envFilePath,
         processEnv: {
            SLICE_PUBLIC_API_URL: 'https://from-process.example',
         },
      });

      assert.equal(payload.SLICE_PUBLIC_API_URL, 'https://from-process.example');
   });
});

test('resolvePublicEnv warns about suspicious public key names without exposing values', async () => {
   const { resolvePublicEnv } = await import(resolverModulePath.href);
   const warnings = [];
   const logger = {
      warn: (...args) => warnings.push(args.map(String).join(' ')),
   };

   await withTempEnvFile('SLICE_PUBLIC_API_KEY=super-secret-value', async (envFilePath) => {
      const payload = resolvePublicEnv({
         mode: 'development',
         envFilePath,
         processEnv: {},
         logger,
      });

      assert.equal(payload.SLICE_PUBLIC_API_KEY, 'super-secret-value');
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /SLICE_PUBLIC_API_KEY/);
      assert.doesNotMatch(warnings[0], /super-secret-value/);
   });
});

test('createPublicEnvProvider caches in production and recomputes in development', async () => {
   const { createPublicEnvProvider } = await import(resolverModulePath.href);

   await withTempEnvFile('SLICE_PUBLIC_COUNTER=from-file', async (envFilePath) => {
      let processValue = 'first-value';
      const processEnv = {
         get SLICE_PUBLIC_COUNTER() {
            return processValue;
         },
      };

      const productionProvider = createPublicEnvProvider({
         mode: 'production',
         envFilePath,
         processEnv,
      });

      const firstProduction = productionProvider();
      processValue = 'second-value';
      const secondProduction = productionProvider();

      assert.equal(firstProduction.SLICE_PUBLIC_COUNTER, 'first-value');
      assert.equal(secondProduction.SLICE_PUBLIC_COUNTER, 'first-value');

      const developmentProvider = createPublicEnvProvider({
         mode: 'development',
         envFilePath,
         processEnv,
      });

      const firstDevelopment = developmentProvider();
      processValue = 'third-value';
      const secondDevelopment = developmentProvider();

      assert.equal(firstDevelopment.SLICE_PUBLIC_COUNTER, 'second-value');
      assert.equal(secondDevelopment.SLICE_PUBLIC_COUNTER, 'third-value');
   });
});
