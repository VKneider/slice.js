#!/usr/bin/env node
// What npm would install, checked before a release instead of after.
//
// The framework repo has no `files` allowlist, so `.npmignore` decides. It drifted:
// the published tarball carried `Slice/tests/**` and `.opencode/`. This asserts the
// shape npm actually packs — no registry, no publish.
//
//   node scripts/check-pack.mjs

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED = [
  'package.json',
  'Slice/Slice.js',
  'api/framework/server.js',
  'api/framework/seo.js',
  'sliceConfig.schema.json'
];

const FORBIDDEN = /^(Slice\/tests|api\/tests|features|tests|\.opencode|\.github|scripts|node_modules)\//;

const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: process.platform === 'win32',
  timeout: 120_000
});

if (result.status !== 0) {
  console.error(`[FAIL] npm pack failed\n${`${result.stdout || ''}${result.stderr || ''}`.trim()}`);
  process.exit(1);
}

const pack = JSON.parse(result.stdout)[0];
const entries = pack.files.map((file) => file.path);
const missing = REQUIRED.filter((path) => !entries.includes(path));
const leaked = entries.filter((entry) => FORBIDDEN.test(entry));

for (const path of REQUIRED) {
  if (!entries.includes(path)) console.log(`[FAIL] missing ${path}`);
}
for (const entry of leaked.slice(0, 10)) {
  console.log(`[FAIL] unexpected ${entry}`);
}

if (!missing.length && !leaked.length) {
  console.log(`[ok] ${entries.length} files, ${(pack.size / 1024).toFixed(0)} KB packed — nothing leaked`);
  process.exit(0);
}

console.log(`\n${missing.length + leaked.length} problem(s) in the package contents.`);
process.exit(1);
