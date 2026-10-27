import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// Boots the real dev server against a temp project and checks the two moving
// parts of external-dependency support in development: bare-import rewriting of
// served src modules, and on-demand esbuild bundling at /@slice-modules/.
test('dev server rewrites bare imports and serves bundled packages', async () => {
  process.env.NODE_ENV = 'development';
  // `new URL(...).pathname` yields `/C:/…` on Windows, which `path.join` turns
  // into `C:\C:\…`. fileURLToPath is the only portable form.
  const frameworkRoot = fileURLToPath(new URL('../../', import.meta.url));
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'slice-dev-'));

  try {
    await fsp.mkdir(path.join(tmp, 'src', 'Components', 'Demo'), { recursive: true });
    await fsp.writeFile(
      path.join(tmp, 'src', 'sliceConfig.json'),
      JSON.stringify({ externalDependencies: { enabled: true } })
    );
    await fsp.writeFile(
      path.join(tmp, 'src', 'Components', 'Demo', 'Demo.js'),
      "import { parse } from 'es-module-lexer';\nimport './local.js';\nexport default class Demo { run(){ return typeof parse; } }\n"
    );
    // Make es-module-lexer resolvable from the temp project for esbuild.
    const frameworkModules = path.join(frameworkRoot, 'node_modules');
    try {
      fs.symlinkSync(frameworkModules, path.join(tmp, 'node_modules'), 'dir');
    } catch (error) {
      if (error.code !== 'EPERM' && error.code !== 'EACCES') throw error;
      // Windows without Developer Mode: a junction needs no elevation and is
      // resolved exactly like a symlinked directory by Node and esbuild.
      fs.symlinkSync(frameworkModules, path.join(tmp, 'node_modules'), 'junction');
    }

    const { createSliceServer } = await import('../framework/server.js');
    const { app } = createSliceServer({ projectRoot: tmp });
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    try {
      // 1. The component's bare import is rewritten; the relative one is not.
      const compRes = await fetch(`${base}/Components/Demo/Demo.js`);
      const compText = await compRes.text();
      assert.equal(compRes.status, 200);
      assert.match(compText, /from ['"]\/@slice-modules\/es-module-lexer['"]/);
      assert.match(compText, /import ['"]\.\/local\.js['"]/);

      // 2. The virtual endpoint returns a self-contained ESM bundle of the pkg.
      const modRes = await fetch(`${base}/@slice-modules/es-module-lexer`);
      const modText = await modRes.text();
      assert.equal(modRes.status, 200);
      assert.match(modRes.headers.get('content-type') || '', /javascript/);
      assert.match(modText, /export\s*\{/);
      assert.doesNotMatch(modText, /^\s*import\s+.*from\s+['"][^./]/m);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true });
  }
});
