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

         assert.equal(payload.mode, 'development');
         assert.deepEqual(payload.env, {
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

      assert.equal(payload.mode, 'development');
      assert.equal(payload.env.SLICE_PUBLIC_API_URL, 'https://from-process.example');
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

      assert.equal(payload.mode, 'development');
      assert.equal(payload.env.SLICE_PUBLIC_API_KEY, 'super-secret-value');
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /SLICE_PUBLIC_API_KEY/);
      assert.doesNotMatch(warnings[0], /super-secret-value/);
   });
});

test('resolvePublicEnv warns once when suspicious key appears in .env and processEnv', async () => {
   const { resolvePublicEnv } = await import(resolverModulePath.href);
   const warnings = [];
   const logger = {
      warn: (...args) => warnings.push(args.map(String).join(' ')),
   };

   await withTempEnvFile('SLICE_PUBLIC_API_KEY=from-file-secret', async (envFilePath) => {
      const payload = resolvePublicEnv({
         mode: 'development',
         envFilePath,
         processEnv: {
            SLICE_PUBLIC_API_KEY: 'from-process-secret',
         },
         logger,
      });

      assert.equal(payload.env.SLICE_PUBLIC_API_KEY, 'from-process-secret');
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /SLICE_PUBLIC_API_KEY/);
      assert.doesNotMatch(warnings[0], /from-file-secret|from-process-secret/);
   });
});

test('resolvePublicEnv parses first key when .env starts with BOM', async () => {
   const { resolvePublicEnv } = await import(resolverModulePath.href);

   await withTempEnvFile('\uFEFFSLICE_PUBLIC_TITLE=Slice App', async (envFilePath) => {
      const payload = resolvePublicEnv({
         mode: 'development',
         envFilePath,
         processEnv: {},
      });

      assert.equal(payload.env.SLICE_PUBLIC_TITLE, 'Slice App');
   });
});

test('resolvePublicEnv strips inline comments for unquoted values', async () => {
   const { resolvePublicEnv } = await import(resolverModulePath.href);

   await withTempEnvFile('SLICE_PUBLIC_ORIGIN=https://slice.dev # dev origin', async (envFilePath) => {
      const payload = resolvePublicEnv({
         mode: 'development',
         envFilePath,
         processEnv: {},
      });

      assert.equal(payload.env.SLICE_PUBLIC_ORIGIN, 'https://slice.dev');
   });
});

test('resolvePublicEnv strips trailing comments after quoted values', async () => {
   const { resolvePublicEnv } = await import(resolverModulePath.href);

   await withTempEnvFile('SLICE_PUBLIC_X="value" # comment', async (envFilePath) => {
      const payload = resolvePublicEnv({
         mode: 'development',
         envFilePath,
         processEnv: {},
      });

      assert.equal(payload.env.SLICE_PUBLIC_X, 'value');
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
      assert.equal(typeof productionProvider.getPayload, 'function');

      const firstProduction = productionProvider.getPayload();
      processValue = 'second-value';
      const secondProduction = productionProvider.getPayload();

      assert.equal(firstProduction.mode, 'production');
      assert.equal(firstProduction.env.SLICE_PUBLIC_COUNTER, 'first-value');
      assert.equal(secondProduction.env.SLICE_PUBLIC_COUNTER, 'first-value');

      const developmentProvider = createPublicEnvProvider({
         mode: 'development',
         envFilePath,
         processEnv,
      });
      assert.equal(typeof developmentProvider.getPayload, 'function');

      const firstDevelopment = developmentProvider.getPayload();
      processValue = 'third-value';
      const secondDevelopment = developmentProvider.getPayload();

      assert.equal(firstDevelopment.mode, 'development');
      assert.equal(firstDevelopment.env.SLICE_PUBLIC_COUNTER, 'second-value');
      assert.equal(secondDevelopment.env.SLICE_PUBLIC_COUNTER, 'third-value');
   });
});
