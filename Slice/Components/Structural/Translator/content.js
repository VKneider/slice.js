/**
 * Content documents: JSON records with a `copy: { en: …, es: … }` branch per node.
 *
 * A content document keeps the structure (ids, URLs, dates, images, technologies) once and
 * the prose once per locale. `resolveContent()` replaces every `copy` with the branch of the
 * active locale and flattens nested nodes, so a component receives plain records — the same
 * shape it had before the content was translated.
 *
 * `validateContentDocument()` is the static counterpart: the CLI runs it over every file in
 * `<translator.path>/content/` and fails when a locale is missing or the branches disagree.
 *
 * Pure on purpose (no DOM, no `slice` global, no imports): the browser runtime, the CLI and
 * the server all load this module.
 */

const MAX_DEPTH = 24;

/** @param {unknown} value @returns {value is Record<string, any>} */
function isPlainObject(value) {
   if (!value || typeof value !== 'object') return false;
   const proto = Object.getPrototypeOf(value);
   return proto === Object.prototype || proto === null;
}

/** @param {unknown} value @returns {string} */
function typeOf(value) {
   if (Array.isArray(value)) return 'array';
   if (value === null) return 'null';
   return typeof value;
}

/**
 * Resolve a content document (or a fragment of it) for one locale.
 *
 * - arrays and plain objects are walked;
 * - a node's `copy` is resolved with `localize()` and merged over the node's structural
 *   fields (text wins on a name clash);
 * - a node that only carries `copy` collapses to the localized value itself (string/array);
 * - a `copy` without a branch for the active locale is reported through `onMissing` and the
 *   node keeps its structural fields.
 *
 * @param {any} value
 * @param {(value: any) => any} localize
 * @param {{ onMissing?: (path: string) => void, onInvalid?: (path: string) => void }} [options]
 * @param {string} [path]
 * @param {number} [depth]
 * @returns {any}
 */
export function resolveContent(value, localize, options = {}, path = '', depth = 0) {
   if (value === null || value === undefined || depth > MAX_DEPTH) return value;
   if (Array.isArray(value)) {
      return value.map((item, index) => resolveContent(item, localize, options, `${path}[${index}]`, depth + 1));
   }
   if (!isPlainObject(value)) return value;

   const { copy, ...rest } = value;
   const out = {};
   for (const [key, item] of Object.entries(rest)) {
      out[key] = resolveContent(item, localize, options, path ? `${path}.${key}` : key, depth + 1);
   }
   if (copy === undefined) return out;

   const localized = localize(copy);
   if (localized === undefined) {
      options.onMissing?.(path ? `${path}.copy` : 'copy');
      return out;
   }

   const copyPath = path ? `${path}.copy` : 'copy';
   const resolved = resolveContent(localized, localize, options, copyPath, depth + 1);
   if (isPlainObject(resolved)) return { ...out, ...resolved };
   if (Object.keys(out).length === 0) return resolved;

   // A node with structural fields and a scalar/array copy is ambiguous: there is no field
   // name to put the text under. Report it instead of guessing.
   options.onInvalid?.(copyPath);
   return out;
}

/**
 * Compare two branches of a `copy` block.
 * @param {any} reference
 * @param {any} value
 * @param {string} path
 * @param {{ path: string, message: string }[]} errors
 * @returns {void}
 */
function compareShape(reference, value, path, errors) {
   const expected = typeOf(reference);
   const actual = typeOf(value);
   if (expected !== actual) {
      errors.push({ path, message: `expected ${expected} (as in the first locale), found ${actual}` });
      return;
   }
   if (expected === 'array') {
      if (reference.length !== value.length) {
         errors.push({ path, message: `expected ${reference.length} item(s), found ${value.length}` });
      }
      for (let index = 0; index < Math.min(reference.length, value.length); index += 1) {
         compareShape(reference[index], value[index], `${path}[${index}]`, errors);
      }
      return;
   }
   if (expected === 'object') {
      for (const key of Object.keys(reference)) {
         if (!(key in value)) errors.push({ path: `${path}.${key}`, message: 'missing in this locale' });
      }
      for (const key of Object.keys(value)) {
         if (!(key in reference)) errors.push({ path: `${path}.${key}`, message: 'not present in the first locale' });
      }
      for (const key of Object.keys(reference)) {
         if (key in value) compareShape(reference[key], value[key], `${path}.${key}`, errors);
      }
   }
}

/** @param {any} value @param {string} path @param {{ path: string, message: string }[]} errors */
function validateText(value, path, errors) {
   if (typeof value === 'string') {
      if (!value.trim()) errors.push({ path, message: 'empty text' });
      return;
   }
   if (Array.isArray(value)) {
      value.forEach((item, index) => validateText(item, `${path}[${index}]`, errors));
      return;
   }
   if (isPlainObject(value)) {
      for (const [key, item] of Object.entries(value)) validateText(item, `${path}.${key}`, errors);
   }
}

/**
 * Validate a content document: every `copy` has a branch for every configured locale, the
 * branches have the same shape, and no translated string is empty.
 * @param {any} document
 * @param {readonly string[]} locales
 * @returns {{ path: string, message: string }[]}
 */
export function validateContentDocument(document, locales) {
   const errors = [];
   const configured = [...new Set((locales || []).filter((locale) => typeof locale === 'string' && locale))];
   if (configured.length === 0) {
      return [{ path: '', message: 'no locales configured to validate the content document' }];
   }

   const validateCopy = (copy, path) => {
      if (!isPlainObject(copy)) {
         errors.push({ path, message: 'copy must be an object with one branch per locale' });
         return;
      }
      const keys = Object.keys(copy);
      if (keys.length === 0) {
         errors.push({ path, message: 'copy has no locale branches' });
         return;
      }
      for (const locale of configured) {
         if (!keys.some((key) => key.toLowerCase() === locale.toLowerCase())) {
            errors.push({ path, message: `copy is missing "${locale}"` });
         }
      }
      for (const key of keys) {
         if (!configured.some((locale) => locale.toLowerCase() === key.toLowerCase())) {
            errors.push({ path, message: `copy has "${key}", which is not a configured locale` });
         }
      }
      const reference = copy[keys[0]];
      for (const key of keys.slice(1)) compareShape(reference, copy[key], `${path}.${key}`, errors);
      for (const key of keys) validateText(copy[key], `${path}.${key}`, errors);
   };

   const walk = (node, path, depth) => {
      if (node === null || typeof node !== 'object' || depth > MAX_DEPTH) return;
      if (Array.isArray(node)) {
         node.forEach((item, index) => walk(item, `${path}[${index}]`, depth + 1));
         return;
      }
      if (Object.prototype.hasOwnProperty.call(node, 'copy')) {
         validateCopy(node.copy, path ? `${path}.copy` : 'copy');
      }
      for (const [key, value] of Object.entries(node)) {
         if (key === 'copy') continue;
         walk(value, path ? `${path}.${key}` : key, depth + 1);
      }
   };

   walk(document, '', 0);
   return errors;
}
