#!/usr/bin/env node
// Prove that a real app still works on the framework in this checkout.
//
// The workspace has `pnpm verify:conclave` for the linked dev loop. CI cannot use
// it (the workspace is not published, and the app is a fresh clone), so this
// script does the same job with nothing but Node: point the app at this
// framework, build it with the app's own CLI, boot its server, and check that
// what it serves is this checkout — not a registry copy and not a stale dist/.
//
//   node scripts/verify-app.mjs --app ../conclave --replace
//
// Exit codes: 0 ok, 1 failure (with the reason and the server output tail).

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FRAMEWORK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIME = path.join(FRAMEWORK_ROOT, 'Slice', 'Slice.js');
const IS_WINDOWS = process.platform === 'win32';
const MAX_OUTPUT = 200_000;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name, fallback) => {
  const index = argv.indexOf(name);
  return index !== -1 && argv[index + 1] ? argv[index + 1] : fallback;
};

const appDir = path.resolve(FRAMEWORK_ROOT, value('--app', '../conclave'));
const replace = flag('--replace');
const skipBuild = flag('--no-build');
const verbose = flag('--verbose');

let child = null;
const log = {
  step: (message) => console.log(`\n==> ${message}`),
  ok: (message) => console.log(`[ok]   ${message}`),
  info: (message) => console.log(`       ${message}`),
  error: (message) => console.error(`[FAIL] ${message}`)
};

const fail = (message) => {
  throw new Error(message);
};

const tail = (text, lines = 60) => text.trimEnd().split('\n').slice(-lines).join('\n');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function stop() {
  if (!child || child.exitCode !== null) return;
  if (IS_WINDOWS) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

async function waitFor(url, deadline) {
  let last = '';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) fail(`the app exited early with code ${child.exitCode}\n${last}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
      if (response.ok) return response;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  fail(`timed out waiting for ${url} (${last})`);
}

/** Point `<app>/node_modules/slicejs-web-framework` at this checkout. */
function linkFramework() {
  const target = path.join(appDir, 'node_modules', 'slicejs-web-framework');
  const exists = fs.existsSync(target) || fs.lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink();

  if (exists) {
    // Already the checkout (the workspace links it): nothing to do.
    try {
      if (fs.realpathSync(target) === fs.realpathSync(FRAMEWORK_ROOT)) {
        log.ok(`app already resolves the framework from ${FRAMEWORK_ROOT}`);
        return;
      }
    } catch {
      // fall through to the replacement checks
    }

    if (!replace) {
      fail(
        `${path.relative(process.cwd(), target)} already exists.\n` +
        '       Pass --replace to point the app at this checkout (the CI checkout is disposable;\n' +
        '       in a working tree, run "pnpm doctor" and the workspace links instead).'
      );
    }
    fs.rmSync(target, { recursive: true, force: true });
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(FRAMEWORK_ROOT, target, IS_WINDOWS ? 'junction' : 'dir');

  const resolved = fs.realpathSync(target);
  const expected = fs.realpathSync(FRAMEWORK_ROOT);
  if (resolved !== expected) fail(`the link did not take: ${resolved} !== ${expected}`);
  log.ok(`app resolves the framework from ${resolved}`);
}

function build() {
  const cli = path.join(appDir, 'node_modules', 'slicejs-cli', 'client.js');
  if (!fs.existsSync(cli)) {
    fail(`the app has no local CLI at ${path.relative(process.cwd(), cli)}.\n       Run its package manager install first.`);
  }

  log.step('Building the app with its own CLI');
  const result = spawnSync(process.execPath, [cli, 'build'], {
    cwd: appDir,
    encoding: 'utf8',
    env: { ...process.env, INIT_CWD: appDir, SLICE_NO_LOCAL_DELEGATION: '1', NO_COLOR: '1' }
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (verbose) process.stdout.write(output);
  if (result.status !== 0) fail(`the build failed (exit ${result.status})\n${tail(output)}`);
  log.ok('the build finished');
}

async function smoke(port) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const localRuntime = fs.readFileSync(RUNTIME, 'utf8');
  const localHash = createHash('sha256').update(localRuntime).digest('hex');

  log.step(`Booting the app on ${baseUrl}`);
  child = spawn(process.execPath, ['api/index.js'], {
    cwd: appDir,
    env: {
      ...process.env,
      INIT_CWD: appDir,
      PORT: String(port),
      NODE_ENV: 'development',
      SLICE_NO_LOCAL_DELEGATION: '1',
      NO_COLOR: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !IS_WINDOWS,
    windowsHide: true
  });

  let output = '';
  const collect = (chunk) => {
    output += chunk.toString();
    if (output.length > MAX_OUTPUT) output = output.slice(-MAX_OUTPUT);
    if (verbose) process.stdout.write(chunk);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);

  try {
    await waitFor(`${baseUrl}/api/status`, Date.now() + 120_000);
    log.ok('/api/status responded');

    const runtime = await fetch(`${baseUrl}/Slice/Slice.js`, { signal: AbortSignal.timeout(20_000) });
    if (!runtime.ok) fail(`/Slice/Slice.js returned HTTP ${runtime.status}`);
    const served = await runtime.text();
    if (served !== localRuntime) {
      const servedHash = createHash('sha256').update(served).digest('hex');
      fail(
        'the app is not serving this checkout.\n' +
        `       local:  ${localHash.slice(0, 12)}… (${localRuntime.length} bytes)\n` +
        `       served: ${servedHash.slice(0, 12)}… (${served.length} bytes)\n` +
        '       A stale dist/ copy or an inactive link.'
      );
    }
    log.ok(`/Slice/Slice.js matches this checkout (${localRuntime.length} bytes, sha256 ${localHash.slice(0, 12)}…)`);

    const index = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(20_000) });
    if (!index.ok) fail(`/ returned HTTP ${index.status}`);
    const html = await index.text();
    if (!html.includes('/App/index.js')) fail('the shell loaded but does not reference /App/index.js');
    log.ok('the app served its shell');
  } catch (error) {
    if (output.trim()) error.message += `\n\n--- app output ---\n${tail(output)}`;
    throw error;
  }
}

async function main() {
  if (!fs.existsSync(path.join(appDir, 'package.json'))) fail(`not an app: ${appDir}`);
  if (!fs.existsSync(RUNTIME)) fail(`missing runtime: ${RUNTIME}`);

  log.step(`Verifying ${appDir}`);
  log.info(`framework: ${FRAMEWORK_ROOT}`);

  linkFramework();
  if (!skipBuild) build();

  await smoke(Number(process.env.VERIFY_PORT) || (await freePort()));

  log.step('Result');
  log.ok('The app builds and runs on this checkout.');
}

process.once('SIGINT', () => {
  stop();
  process.exit(130);
});

try {
  await main();
} catch (error) {
  log.step('Result');
  log.error(error.message);
  process.exitCode = 1;
} finally {
  stop();
}
