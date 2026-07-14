// api/framework/devDepsOptimizer.js
//
// Development-only resolution of bare package imports (node_modules) for the
// Slice.js dev server. There is NO app bundling in dev: component files are
// still served and executed as native ES modules. This optimizer only does two
// small, Vite-style things so `import dayjs from 'dayjs'` works in the browser:
//
//   1. rewriteBareImports(code): rewrites bare specifiers in a served source
//      file to a virtual URL under `/@slice-modules/…` that the browser can
//      fetch as a normal ES module. Relative ('./'), absolute ('/…', served
//      from src/public/), and URL/data imports are left untouched.
//
//   2. bundlePackage(spec): on demand, pre-bundles a single node_modules
//      package with esbuild into a self-contained ESM file (CommonJS interop +
//      transitive third-party graph resolved by esbuild) and caches it. This is
//      the same esbuild resolver the production build uses, so a dependency
//      behaves identically in dev and in `slice build` / `slice start`.
//
// This module is the ONLY place in the framework runtime allowed to import
// esbuild / es-module-lexer (team rule: external libraries stay behind an
// internal abstraction).

import { init as lexerInit, parse as lexerParse } from 'es-module-lexer';
import { build as esbuildBuild } from 'esbuild';
import fsp from 'node:fs/promises';
import path from 'node:path';

export const MODULES_PREFIX = '/@slice-modules/';
const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

// Non-JS assets a package may import are inlined as data URLs so each served
// package module stays a single self-contained ESM file (matches the build).
const ASSET_LOADERS = {
  '.wasm': 'dataurl',
  '.png': 'dataurl',
  '.jpg': 'dataurl',
  '.jpeg': 'dataurl',
  '.gif': 'dataurl',
  '.svg': 'dataurl',
  '.webp': 'dataurl',
  '.avif': 'dataurl',
  '.woff': 'dataurl',
  '.woff2': 'dataurl',
  '.ttf': 'dataurl',
  '.eot': 'dataurl',
  // Text assets some packages import as strings (GLSL shaders, templates).
  // Kept identical to the production bundler so dev and build behave the same.
  '.txt': 'text',
  '.glsl': 'text',
  '.vert': 'text',
  '.frag': 'text',
  '.vs': 'text',
  '.fs': 'text'
};

/**
 * Minimal browser shims for the Node globals browser-targeted packages still
 * touch at runtime: `process` (env/platform/nextTick) and `global`. NOT a Node
 * polyfill (no Buffer/stream/fs) — it only prevents a ReferenceError on a
 * dynamic `process.platform` / `process.env[key]` / free `global`. Idempotent
 * and guarded; kept byte-identical to the production bundler's banner so a
 * package behaves the same in dev and after `slice build`.
 * @param {string} nodeEnv value exposed as process.env.NODE_ENV at runtime.
 */
function nodeGlobalsBanner(nodeEnv) {
  return [
    '(function(){',
    '  if (typeof globalThis === "undefined") return;',
    '  if (typeof globalThis.global === "undefined") globalThis.global = globalThis;',
    '  if (typeof globalThis.process === "undefined") {',
    `    globalThis.process = { env: { NODE_ENV: ${JSON.stringify(nodeEnv)} }, argv: [], platform: "browser", browser: true, version: "", versions: {}, cwd: function(){ return "/"; }, nextTick: function(cb){ Promise.resolve().then(cb); } };`,
    '  } else if (typeof globalThis.process.env === "undefined") {',
    `    globalThis.process.env = { NODE_ENV: ${JSON.stringify(nodeEnv)} };`,
    '  }',
    '})();'
  ].join('\n');
}

function cssInjectionKey(css) {
  let h = 5381;
  for (let i = 0; i < css.length; i += 1) {
    h = ((h << 5) + h + css.charCodeAt(i)) >>> 0;
  }
  return `ext-${h.toString(36)}`;
}

function buildCssInjectionSnippet(css) {
  const key = cssInjectionKey(css);
  return [
    '(function(){',
    '  if (typeof document === "undefined") return;',
    `  var __k = ${JSON.stringify(key)};`,
    "  if (document.querySelector('style[data-slice-external=\"' + __k + '\"]')) return;",
    '  var __sliceStyle = document.createElement("style");',
    '  __sliceStyle.setAttribute("data-slice-external", __k);',
    `  __sliceStyle.textContent = ${JSON.stringify(css)};`,
    '  document.head.appendChild(__sliceStyle);',
    '})();'
  ].join('\n');
}

function combineEsbuildOutputs(outputFiles = []) {
  const jsOut = outputFiles.find((f) => /\.(js|mjs|cjs)$/.test(f.path)) || outputFiles[0];
  const cssOut = outputFiles.find((f) => f.path.endsWith('.css'));
  let code = jsOut?.text || '';
  if (cssOut?.text && cssOut.text.trim()) {
    code += `\n${buildCssInjectionSnippet(cssOut.text)}`;
  }
  return code;
}

function isBareSpecifier(spec) {
  if (typeof spec !== 'string' || spec.length === 0) return false;
  if (spec.startsWith('.')) return false;
  if (spec.startsWith('/')) return false;
  if (spec.startsWith('#')) return false;
  if (URL_SCHEME_RE.test(spec)) return false;
  return true;
}

/**
 * @param {object} options
 * @param {string} options.projectRoot Root esbuild resolves node_modules from.
 * @param {boolean} [options.enabled] Whether the feature is active.
 * @param {string} [options.target] esbuild target (default 'es2020').
 */
export function createDevDepsOptimizer({ projectRoot, enabled = true, target = 'es2020' }) {
  // spec -> Promise<{ code }>. Store the promise so concurrent first requests
  // for the same package share a single esbuild run.
  const cache = new Map();
  let lexerReady = false;
  const lexerReadyPromise = lexerInit
    .then(() => { lexerReady = true; })
    .catch(() => { /* lexer failed to init; rewrite becomes a no-op */ });

  /**
   * Rewrites bare import specifiers in `code` to `/@slice-modules/<spec>`.
   * Returns the original code unchanged when there is nothing to rewrite.
   * @param {string} code
   * @returns {Promise<string>}
   */
  async function rewriteBareImports(code) {
    if (!enabled || typeof code !== 'string' || code.length === 0) return code;
    if (!lexerReady) await lexerReadyPromise;
    if (!lexerReady) return code;

    let imports;
    try {
      [imports] = lexerParse(code);
    } catch {
      return code; // unparseable → serve as-is
    }
    if (!imports || imports.length === 0) return code;

    let out = '';
    let cursor = 0;
    for (const imp of imports) {
      const spec = imp.n;
      // imp.s/imp.e delimit the specifier. For STATIC imports the range is the
      // inner text without quotes; for DYNAMIC imports (imp.d > -1) it includes
      // the surrounding quotes/backticks. imp.s is -1 when the specifier is not
      // a static string (e.g. import(variable)) — skip those.
      if (imp.s < 0 || imp.e < 0) continue;
      if (!spec || !isBareSpecifier(spec)) continue;

      out += code.slice(cursor, imp.s);
      if (imp.d > -1) {
        // Dynamic import: preserve the original quote character.
        const quote = code[imp.s];
        out += `${quote}${MODULES_PREFIX}${spec}${quote}`;
      } else {
        out += `${MODULES_PREFIX}${spec}`;
      }
      cursor = imp.e;
    }
    out += code.slice(cursor);
    return out;
  }

  async function runEsbuild(entryContents) {
    const result = await esbuildBuild({
      stdin: {
        contents: entryContents,
        resolveDir: projectRoot,
        sourcefile: 'slice-dev-external-entry.js',
        loader: 'js'
      },
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target,
      write: false,
      metafile: false,
      legalComments: 'none',
      logLevel: 'silent',
      // Standard browser-build substitutions (matches the production bundler):
      // packages that gate on NODE_ENV or reference `global` work without a
      // polyfill. esbuild respects local shadowing.
      define: {
        'process.env.NODE_ENV': JSON.stringify('development'),
        global: 'globalThis'
      },
      // Runtime shim for the Node globals `define` cannot fold statically; runs
      // once, guarded, before the package body. Matches the production bundler.
      banner: { js: nodeGlobalsBanner('development') },
      // Required for esbuild to emit a CSS output file when a package imports
      // CSS; nothing is written to disk (write:false).
      outdir: 'slice-external-out',
      // Inline WASM/images/fonts as data URLs and bundle imported CSS, so each
      // served package is a single self-contained ESM file.
      loader: ASSET_LOADERS
    });
    return combineEsbuildOutputs(result.outputFiles);
  }

  const diskCacheDir = path.join(projectRoot, 'node_modules', '.slice-deps');

  async function esbuildPackage(spec) {
    const quoted = JSON.stringify(spec);
    // Try re-exporting the default too (works for CJS and ESM-with-default).
    // Packages without a default export make esbuild fail on the explicit
    // default re-export, so fall back to a namespace-only bundle.
    try {
      return await runEsbuild(`export * from ${quoted};\nexport { default } from ${quoted};`);
    } catch {
      return await runEsbuild(`export * from ${quoted};`);
    }
  }

  /** Reads the installed version of a package so the disk cache invalidates on upgrade. */
  async function packageVersion(spec) {
    const root = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    try {
      const pkg = JSON.parse(await fsp.readFile(path.join(projectRoot, 'node_modules', root, 'package.json'), 'utf8'));
      return pkg.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  /** Sanitized `<spec>@` prefix shared by every cached version of a package. */
  function specCachePrefix(spec) {
    return `${spec.replace(/[^a-zA-Z0-9._@-]/g, '_')}@`;
  }

  async function diskCacheFileFor(spec) {
    const version = await packageVersion(spec);
    const safe = `${spec}@${version}`.replace(/[^a-zA-Z0-9._@-]/g, '_');
    return path.join(diskCacheDir, `${safe}.js`);
  }

  /**
   * Removes stale cache files for a package after a new version is written, so
   * `.slice-deps` doesn't accumulate one file per version across upgrades. The
   * `<spec>@` prefix is version-independent and the trailing `@` prevents a
   * package from matching another whose name is a prefix of it. Best-effort.
   * @param {string} spec bare specifier
   * @param {string} keepFileName basename of the just-written cache file
   */
  async function pruneOldCacheVersions(spec, keepFileName) {
    const prefix = specCachePrefix(spec);
    let entries;
    try {
      entries = await fsp.readdir(diskCacheDir);
    } catch {
      return; // dir missing → nothing to prune
    }
    await Promise.all(entries.map(async (name) => {
      if (name === keepFileName) return;
      if (!name.startsWith(prefix) || !name.endsWith('.js')) return;
      try {
        await fsp.unlink(path.join(diskCacheDir, name));
      } catch { /* ignore: another process may have removed it */ }
    }));
  }

  /**
   * Pre-bundles a single node_modules package to a self-contained ESM string.
   * Result is cached in memory (per process) and on disk (across dev-server
   * restarts), keyed by the installed package version.
   * @param {string} spec bare specifier (e.g. 'dayjs', '@scope/pkg', 'lodash/fp')
   * @returns {Promise<{ code: string }>}
   */
  function bundlePackage(spec) {
    if (!isBareSpecifier(spec)) {
      return Promise.reject(new Error(`Not a bare package specifier: ${spec}`));
    }
    if (cache.has(spec)) return cache.get(spec);

    const promise = (async () => {
      const cacheFile = await diskCacheFileFor(spec);

      // 1) Disk cache hit — skip esbuild entirely.
      try {
        const code = await fsp.readFile(cacheFile, 'utf8');
        return { code };
      } catch { /* miss → build */ }

      // 2) Build, then populate the disk cache (best-effort) and drop any
      // previously-cached versions of this same package.
      const code = await esbuildPackage(spec);
      try {
        await fsp.mkdir(diskCacheDir, { recursive: true });
        await fsp.writeFile(cacheFile, code);
        await pruneOldCacheVersions(spec, path.basename(cacheFile));
      } catch { /* cache is an optimization; ignore write failures */ }
      return { code };
    })();

    // Cache the promise; on failure, evict so a later request can retry.
    promise.catch(() => cache.delete(spec));
    cache.set(spec, promise);
    return promise;
  }

  /**
   * Extracts the package specifier from a `/@slice-modules/…` request path.
   * @param {string} reqPath
   * @returns {string|null}
   */
  function specifierFromRequest(reqPath) {
    if (typeof reqPath !== 'string' || !reqPath.startsWith(MODULES_PREFIX)) return null;
    const spec = reqPath.slice(MODULES_PREFIX.length);
    return spec.length > 0 ? spec : null;
  }

  return {
    enabled,
    MODULES_PREFIX,
    rewriteBareImports,
    bundlePackage,
    specifierFromRequest,
    isBareSpecifier
  };
}
