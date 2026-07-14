import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createDevDepsOptimizer, MODULES_PREFIX } from '../framework/devDepsOptimizer.js';

// projectRoot for esbuild resolution: this framework package's own root, whose
// node_modules contains es-module-lexer (used here as a real ESM package to
// bundle). Two dirs up from api/tests/.
const projectRoot = new URL('../../', import.meta.url).pathname;

test('rewriteBareImports rewrites bare specifiers to the virtual endpoint', async () => {
  const opt = createDevDepsOptimizer({ projectRoot, enabled: true });
  const code = [
    "import dayjs from 'dayjs';",
    "import { a, b } from '@scope/pkg';",
    "import './local.js';",
    "import '/libs/x.js';",
    "import x from 'https://cdn/x.js';",
    "const d = import('lodash/fp');"
  ].join('\n');

  const out = await opt.rewriteBareImports(code);

  assert.match(out, new RegExp(`from '${MODULES_PREFIX}dayjs'`));
  assert.match(out, new RegExp(`from '${MODULES_PREFIX}@scope/pkg'`));
  assert.match(out, new RegExp(`import\\('${MODULES_PREFIX}lodash/fp'\\)`));
  // Relative, absolute (public/) and URL imports are untouched.
  assert.match(out, /import '\.\/local\.js'/);
  assert.match(out, /import '\/libs\/x\.js'/);
  assert.match(out, /from 'https:\/\/cdn\/x\.js'/);
});

test('rewriteBareImports is a no-op when disabled', async () => {
  const opt = createDevDepsOptimizer({ projectRoot, enabled: false });
  const code = "import dayjs from 'dayjs';";
  assert.equal(await opt.rewriteBareImports(code), code);
});

test('rewriteBareImports returns source unchanged when there is nothing bare', async () => {
  const opt = createDevDepsOptimizer({ projectRoot, enabled: true });
  const code = "import './a.js';\nexport const x = 1;\n";
  assert.equal(await opt.rewriteBareImports(code), code);
});

test('specifierFromRequest extracts the package from the virtual path', () => {
  const opt = createDevDepsOptimizer({ projectRoot, enabled: true });
  assert.equal(opt.specifierFromRequest(`${MODULES_PREFIX}dayjs`), 'dayjs');
  assert.equal(opt.specifierFromRequest(`${MODULES_PREFIX}@scope/pkg/sub`), '@scope/pkg/sub');
  assert.equal(opt.specifierFromRequest('/Components/x.js'), null);
});

test('bundlePackage resolves a real ESM package to self-contained ESM', async () => {
  const opt = createDevDepsOptimizer({ projectRoot, enabled: true });
  // es-module-lexer is a named-export ESM package (no default) — exercises the
  // namespace-only fallback path in bundlePackage.
  const { code } = await opt.bundlePackage('es-module-lexer');
  assert.ok(code.length > 0, 'expected bundled code');
  // Self-contained: no bare imports left to resolve at runtime.
  assert.doesNotMatch(code, /^\s*import\s+.*from\s+['"][^./]/m);
  // Exposes the package's named API.
  assert.match(code, /\bparse\b/);
  assert.match(code, /export\s*\{/);
});

test('bundlePackage caches and shares a single build per specifier', async () => {
  const opt = createDevDepsOptimizer({ projectRoot, enabled: true });
  const [a, b] = await Promise.all([
    opt.bundlePackage('es-module-lexer'),
    opt.bundlePackage('es-module-lexer')
  ]);
  assert.equal(a, b, 'concurrent requests should share the same cached result');
});

test('bundlePackage persists a disk cache keyed by version, reused by a fresh optimizer', async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'slice-devcache-'));
  try {
    // Minimal installed package in the temp project's node_modules.
    const pkgDir = path.join(tmp, 'node_modules', 'mini-pkg');
    await fsp.mkdir(pkgDir, { recursive: true });
    await fsp.writeFile(path.join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'mini-pkg', version: '2.3.4', type: 'module', main: 'index.js' }));
    await fsp.writeFile(path.join(pkgDir, 'index.js'), 'export const hi = () => "hi";');

    const opt1 = createDevDepsOptimizer({ projectRoot: tmp, enabled: true });
    const first = await opt1.bundlePackage('mini-pkg');
    assert.match(first.code, /hi/);

    // A cache file keyed by the installed version must now exist.
    const cacheFile = path.join(tmp, 'node_modules', '.slice-deps', 'mini-pkg@2.3.4.js');
    const cached = await fsp.readFile(cacheFile, 'utf8');
    assert.equal(cached, first.code);

    // A brand-new optimizer (empty in-memory cache) reads the same bytes from disk.
    const opt2 = createDevDepsOptimizer({ projectRoot: tmp, enabled: true });
    const second = await opt2.bundlePackage('mini-pkg');
    assert.equal(second.code, first.code);
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true });
  }
});

test('bundlePackage prunes stale cache files when a package version changes', async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'slice-devcache-gc-'));
  try {
    const pkgDir = path.join(tmp, 'node_modules', 'mini-pkg');
    const pkgJson = path.join(pkgDir, 'package.json');
    const cacheDir = path.join(tmp, 'node_modules', '.slice-deps');
    await fsp.mkdir(pkgDir, { recursive: true });
    await fsp.writeFile(pkgJson, JSON.stringify({ name: 'mini-pkg', version: '1.0.0', type: 'module', main: 'index.js' }));
    await fsp.writeFile(path.join(pkgDir, 'index.js'), 'export const v = 1;');

    // A sibling package must survive the prune (its name is not a prefix match).
    const otherDir = path.join(tmp, 'node_modules', 'mini-pkg-extra');
    await fsp.mkdir(otherDir, { recursive: true });
    await fsp.writeFile(path.join(otherDir, 'package.json'), JSON.stringify({ name: 'mini-pkg-extra', version: '9.0.0', type: 'module', main: 'index.js' }));
    await fsp.writeFile(path.join(otherDir, 'index.js'), 'export const e = 1;');

    await createDevDepsOptimizer({ projectRoot: tmp, enabled: true }).bundlePackage('mini-pkg');
    await createDevDepsOptimizer({ projectRoot: tmp, enabled: true }).bundlePackage('mini-pkg-extra');
    assert.ok(await fsp.stat(path.join(cacheDir, 'mini-pkg@1.0.0.js')).then(() => true));

    // Simulate an upgrade: bump the installed version, then rebundle.
    await fsp.writeFile(pkgJson, JSON.stringify({ name: 'mini-pkg', version: '1.1.0', type: 'module', main: 'index.js' }));
    await fsp.writeFile(path.join(pkgDir, 'index.js'), 'export const v = 2;');
    await createDevDepsOptimizer({ projectRoot: tmp, enabled: true }).bundlePackage('mini-pkg');

    const remaining = (await fsp.readdir(cacheDir)).sort();
    // Old version gone, new version present, sibling untouched.
    assert.ok(!remaining.includes('mini-pkg@1.0.0.js'), 'stale version should be pruned');
    assert.ok(remaining.includes('mini-pkg@1.1.0.js'), 'new version should be cached');
    assert.ok(remaining.includes('mini-pkg-extra@9.0.0.js'), 'sibling package must not be pruned');
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true });
  }
});
