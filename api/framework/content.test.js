import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { contentDirectory, normalizeContentName, readContent, resolveContentFor } from './content.js';

function makeProject(document = { records: [] }) {
   const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slice-content-'));
   const folder = path.join(root, 'src', 'locales', 'content');
   fs.mkdirSync(folder, { recursive: true });
   fs.writeFileSync(path.join(folder, 'experience.json'), JSON.stringify(document, null, 2));
   return root;
}

const DOCUMENT = {
   records: [
      {
         id: 1,
         logo: '/images/x.png',
         copy: {
            en: { position: 'Engineer', responsibilities: ['Build', 'Teach'] },
            es: { position: 'Ingeniero', responsibilities: ['Construir', 'Enseñar'] }
         }
      }
   ]
};

test('readContent reads a document from src/locales/content and resolves the locale', () => {
   const root = makeProject(DOCUMENT);
   try {
      assert.equal(contentDirectory(root), path.join(root, 'src', 'locales', 'content'));

      const document = readContent(root, 'experience');
      assert.equal(document.records[0].logo, '/images/x.png');

      const spanish = resolveContentFor(document, { defaultLocale: 'es', locales: ['es', 'en'] }, 'es');
      assert.equal(spanish.records[0].position, 'Ingeniero');
      assert.deepEqual(spanish.records[0].responsibilities, ['Construir', 'Enseñar']);

      const english = resolveContentFor(document, { defaultLocale: 'es', locales: ['es', 'en'] }, 'en');
      assert.equal(english.records[0].position, 'Engineer');
   } finally {
      fs.rmSync(root, { recursive: true, force: true });
   }
});

test('readContent accepts a custom translator path and a dist deployment', () => {
   const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slice-content-'));
   try {
      const folder = path.join(root, 'dist', 'i18n', 'content');
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, 'teaching.json'), JSON.stringify({ courses: [] }));

      assert.deepEqual(
         readContent(root, 'teaching', { deployedFolder: 'dist', translator: { path: '/i18n' } }),
         { courses: [] }
      );
   } finally {
      fs.rmSync(root, { recursive: true, force: true });
   }
});

test('readContent rejects path traversal and reports the full path on failure', () => {
   const root = makeProject(DOCUMENT);
   try {
      assert.throws(() => normalizeContentName('../secrets'), /invalid content document name/);
      assert.throws(() => readContent(root, 'missing'), /could not read "missing"/);
   } finally {
      fs.rmSync(root, { recursive: true, force: true });
   }
});
