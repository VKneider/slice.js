// api/framework/content.js — read and resolve the app's content documents on the server.
//
// Content lives in `<translator.path>/content/<name>.json` (the same files the browser
// fetches through `slice.t.content()`). The resolver is the runtime's pure helper, so the
// server and the browser cannot disagree about `copy` branches or fallbacks.

import fs from 'node:fs';
import path from 'node:path';
import { localize } from '../../Slice/Components/Structural/Translator/localized.js';
import { resolveContent } from '../../Slice/Components/Structural/Translator/content.js';

/**
 * The folder that holds the content documents for a deployed app.
 * @param {string} projectRoot
 * @param {{ deployedFolder?: string, translator?: { path?: string } }} [options]
 * @returns {string}
 */
export function contentDirectory(projectRoot, options = {}) {
   const deployedFolder = options.deployedFolder || 'src';
   const configured = typeof options.translator?.path === 'string' && options.translator.path.trim()
      ? options.translator.path
      : '/locales';
   const folder = configured.replace(/^\/+|\/+$/g, '') || 'locales';
   return path.join(projectRoot, deployedFolder, folder, 'content');
}

/**
 * Validate a document name before turning it into a path: `experience` or `teaching/pr2`,
 * never an absolute path or a `..` segment.
 * @param {string} name
 * @returns {string}
 */
export function normalizeContentName(name) {
   const value = String(name ?? '').trim().replace(/^\/+|\/+$/g, '');
   const valid = value && /^[a-z0-9][a-z0-9/_-]*$/i.test(value) && !value.split('/').some((segment) => !segment || segment === '.' || segment === '..');
   if (!valid) throw new Error(`[slice.content] invalid content document name "${name}"`);
   return value;
}

/**
 * Read a content document from `<deployedFolder>/<translator.path>/content/<name>.json`.
 * Throws with the full path when it cannot be read or parsed.
 * @param {string} projectRoot
 * @param {string} name
 * @param {{ deployedFolder?: string, translator?: { path?: string } }} [options]
 * @returns {Record<string, any>}
 */
export function readContent(projectRoot, name, options = {}) {
   const document = normalizeContentName(name);
   const file = path.join(contentDirectory(projectRoot, options), `${document}.json`);
   try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
   } catch (error) {
      throw new Error(`[slice.content] could not read "${document}" (${file}): ${error.message}`);
   }
}

/**
 * Resolve a content document for one locale (`copy` branches replaced, nested nodes flat).
 * @param {any} document
 * @param {{ defaultLocale?: string, fallbackLocale?: string|null, locales?: string[] }} [translator]
 * @param {string} [locale]
 * @returns {any}
 */
export function resolveContentFor(document, translator = {}, locale = translator.defaultLocale || 'en') {
   const defaultLocale = translator.defaultLocale || 'en';
   return resolveContent(document, (value) => localize(value, {
      locale: locale || defaultLocale,
      fallbackLocale: translator.fallbackLocale || null,
      defaultLocale,
      locales: Array.isArray(translator.locales) && translator.locales.length ? translator.locales : [defaultLocale],
   }));
}
