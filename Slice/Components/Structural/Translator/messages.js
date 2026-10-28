/**
 * Pure message logic for slice.translator: no DOM, no fetch, no `slice` global.
 * Kept apart so it runs under node:test and is shared with the server-side SEO
 * code later (feature 0003 §9).
 */

/** Plural categories `Intl.PluralRules` can return, plus the explicit `zero`. */
export const PLURAL_CATEGORIES = Object.freeze(['zero', 'one', 'two', 'few', 'many', 'other']);

/** Base languages written right to left. */
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

/**
 * True for a plain object (dictionary group, params bag) — not an array, a Date, a marker…
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
export function isPlainObject(value) {
   if (!value || typeof value !== 'object') return false;
   const proto = Object.getPrototypeOf(value);
   return proto === Object.prototype || proto === null;
}

/**
 * A plural message: an object with `other` whose keys are all plural categories.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPluralMessage(value) {
   if (!isPlainObject(value) || typeof value.other !== 'string') return false;
   return Object.keys(value).every((key) => PLURAL_CATEGORIES.includes(key));
}

/**
 * Deep-merge `source` into `target` (mutates and returns `target`). Plain objects merge,
 * anything else replaces. Plural objects replace as a whole so categories never mix.
 * @param {Record<string, any>} target
 * @param {Record<string, any>} source
 * @returns {Record<string, any>}
 */
export function mergeMessages(target, source) {
   if (!isPlainObject(source)) return target;
   for (const [key, value] of Object.entries(source)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      if (isPlainObject(value) && !isPluralMessage(value) && isPlainObject(target[key]) && !isPluralMessage(target[key])) {
         mergeMessages(target[key], value);
      } else if (isPlainObject(value) && !isPluralMessage(value)) {
         target[key] = mergeMessages({}, value);
      } else {
         target[key] = value;
      }
   }
   return target;
}

/**
 * Read a dotted key from a dictionary. Returns `undefined` when any segment is missing.
 * @param {Record<string, any>|undefined} dictionary
 * @param {string} key
 * @returns {any}
 */
export function lookup(dictionary, key) {
   if (!dictionary || typeof key !== 'string' || key === '') return undefined;
   let node = dictionary;
   for (const segment of key.split('.')) {
      if (!node || typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, segment)) return undefined;
      node = node[segment];
   }
   return node;
}

/**
 * Pick the supported locale for a requested tag: exact match (case-insensitive), then the
 * base language (`es-VE` → `es`), then a supported regional variant of the same language
 * (`pt` → `pt-BR`). Returns null when nothing matches.
 * @param {string|null|undefined} requested
 * @param {string[]} supported
 * @returns {string|null}
 */
export function matchLocale(requested, supported) {
   if (!requested || typeof requested !== 'string' || !Array.isArray(supported)) return null;
   const wanted = requested.trim().replace('_', '-').toLowerCase();
   if (!wanted) return null;
   const exact = supported.find((locale) => locale.toLowerCase() === wanted);
   if (exact) return exact;
   const base = wanted.split('-')[0];
   return (
      supported.find((locale) => locale.toLowerCase() === base) ||
      supported.find((locale) => locale.toLowerCase().split('-')[0] === base) ||
      null
   );
}

/**
 * `rtl` for Arabic, Hebrew, Persian and Urdu (any region), `ltr` otherwise.
 * @param {string} locale
 * @returns {'rtl'|'ltr'}
 */
export function directionOf(locale) {
   const base = String(locale || '').toLowerCase().split(/[-_]/)[0];
   return RTL_LANGUAGES.has(base) ? 'rtl' : 'ltr';
}

/**
 * Cache of Intl objects per constructor, locale and options.
 */
export class IntlCache {
   constructor() {
      /** @type {Map<string, any>} */
      this.cache = new Map();
   }

   /**
    * @template T
    * @param {new (locale: string, options?: any) => T} Ctor
    * @param {string} locale
    * @param {Record<string, any>} [options]
    * @returns {T}
    */
   get(Ctor, locale, options = {}) {
      const id = `${Ctor.name}|${locale}|${JSON.stringify(options)}`;
      let instance = this.cache.get(id);
      if (!instance) {
         instance = new Ctor(locale, options);
         this.cache.set(id, instance);
      }
      return instance;
   }
}

/**
 * Choose the variant of a plural message for `count`. An explicit `zero` wins for 0;
 * otherwise the locale's plural category, falling back to `other`.
 * @param {Record<string, string>} message
 * @param {number} count
 * @param {string} locale
 * @param {IntlCache} intl
 * @returns {string}
 */
export function selectPlural(message, count, locale, intl) {
   if (count === 0 && typeof message.zero === 'string') return message.zero;
   let category = 'other';
   try {
      category = intl.get(Intl.PluralRules, locale).select(count);
   } catch {
      category = 'other';
   }
   return typeof message[category] === 'string' ? message[category] : message.other;
}

/**
 * Replace `{name}` with `params.name`. Numbers are formatted for the locale; `{{` and `}}`
 * are literal braces. A missing param leaves `{name}` in place and is reported through
 * `onMissing(name)`.
 * @param {string} template
 * @param {Record<string, any>} params
 * @param {string} locale
 * @param {IntlCache} intl
 * @param {(name: string) => void} [onMissing]
 * @returns {string}
 */
export function interpolate(template, params, locale, intl, onMissing) {
   if (typeof template !== 'string' || template.indexOf('{') === -1 && template.indexOf('}') === -1) {
      return template;
   }
   return template.replace(/\{\{|\}\}|\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (match, name) => {
      if (match === '{{') return '{';
      if (match === '}}') return '}';
      if (!params || !Object.prototype.hasOwnProperty.call(params, name) || params[name] === undefined) {
         onMissing?.(name);
         return match;
      }
      const value = params[name];
      if (typeof value === 'number' && Number.isFinite(value)) {
         try {
            return intl.get(Intl.NumberFormat, locale).format(value);
         } catch {
            return String(value);
         }
      }
      return String(value);
   });
}

/**
 * Turn a dictionary entry into text: plural selection, then interpolation.
 * Returns `null` when the entry is not a message (missing, or a group).
 * @param {any} entry
 * @param {Record<string, any>|undefined} params
 * @param {string} locale
 * @param {IntlCache} intl
 * @param {{ onMissingParam?: (name: string) => void, onMissingCount?: () => void }} [hooks]
 * @returns {string|null}
 */
export function formatMessage(entry, params, locale, intl, hooks = {}) {
   let template = null;
   if (typeof entry === 'string') {
      template = entry;
   } else if (isPluralMessage(entry)) {
      const count = Number(params?.count);
      if (params?.count === undefined || Number.isNaN(count)) {
         hooks.onMissingCount?.();
         template = entry.other;
      } else {
         template = selectPlural(entry, count, locale, intl);
      }
   } else {
      return null;
   }
   return interpolate(template, params || {}, locale, intl, hooks.onMissingParam);
}
