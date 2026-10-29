/**
 * Localized content values: `{ en: ..., es: ... }` → the branch for the active locale.
 *
 * Pure on purpose (no DOM, no `slice` global, no imports) so the browser runtime, the CLI
 * and the server can share exactly one resolver. This is not a dictionary lookup: it never
 * sees keys, only a value that carries one branch per locale. UI messages still live in
 * dictionaries and go through `t()`; content records use this.
 */

const LOCALE_TAG = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;
const MAX_DEPTH = 24;

/** `en` and `en-US` are the same language for branch selection. */
function sameLocale(a, b) {
   const left = String(a).toLowerCase();
   const right = String(b).toLowerCase();
   return left === right || left.split('-')[0] === right.split('-')[0];
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isPlainObject(value) {
   if (!value || typeof value !== 'object') return false;
   const proto = Object.getPrototypeOf(value);
   return proto === Object.prototype || proto === null;
}

/**
 * Whether `value` is an object whose keys are locale tags (`{ en: …, es: … }`).
 * With a configured list, every key must be one of those locales; without one (translator
 * disabled), every key has to look like a language tag.
 * @param {unknown} value
 * @param {readonly string[]} [locales]
 * @returns {boolean}
 */
export function isLocalizedObject(value, locales) {
   if (!isPlainObject(value)) return false;
   const keys = Object.keys(value);
   if (keys.length === 0) return false;
   if (Array.isArray(locales) && locales.length > 0) {
      const configured = new Set(locales.map((locale) => String(locale).toLowerCase()));
      // Every key must be a locale tag, and at least one must be configured. The extra tags
      // still count: with the translator off (locales = [browser]) `{ en, es }` must resolve
      // to the browser branch instead of leaking the whole object into the UI.
      return keys.every((key) => configured.has(key.toLowerCase()) || LOCALE_TAG.test(key))
         && keys.some((key) => [...configured].some((locale) => sameLocale(key, locale)));
   }
   return keys.every((key) => LOCALE_TAG.test(key));
}

/**
 * Resolve a value for one locale. Localized objects pick their branch; arrays and plain
 * objects are walked recursively; everything else is returned untouched.
 *
 * Fallback order: `locale` → `fallbackLocale` → `defaultLocale`. A localized object with
 * none of those branches resolves to `undefined` (the caller decides whether that is an
 * error; the content validator catches it before deploy).
 * @param {any} value
 * @param {{ locale?: string, fallbackLocale?: string|null, defaultLocale?: string, locales?: readonly string[] }} [options]
 * @param {number} [depth]
 * @returns {any}
 */
export function localize(value, options = {}, depth = 0) {
   if (value === null || value === undefined || depth > MAX_DEPTH) return value;
   if (Array.isArray(value)) return value.map((item) => localize(item, options, depth + 1));
   if (!isPlainObject(value)) return value;

   if (isLocalizedObject(value, options.locales)) {
      const chain = [options.locale, options.fallbackLocale, options.defaultLocale]
         .filter((locale) => typeof locale === 'string' && locale);
      for (const locale of chain) {
         const key = Object.keys(value).find((candidate) => sameLocale(candidate, locale));
         if (key !== undefined) return localize(value[key], options, depth + 1);
      }
      return undefined;
   }

   const out = {};
   for (const [key, item] of Object.entries(value)) out[key] = localize(item, options, depth + 1);
   return out;
}
