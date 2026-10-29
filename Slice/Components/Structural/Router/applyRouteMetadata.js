/**
 * Apply a route's `metadata` to the document head.
 *
 * Only what the route declares is touched. A route without a title keeps
 * whatever the server sent: with native SEO the prerendered HTML already
 * carries the right title, and writing a generic one here would undo it.
 *
 * `canonical` and `robots` are deliberately **never** written from here.
 * Crawlers do not run this code, so rewriting them client-side could only
 * desync the SPA from the HTML that was actually served.
 *
 * Titles:
 *   title: 'Pricing'                 literal
 *   titleKey: 'pricing.title'        a dictionary key; it wins over `title`
 *   titlePrefix / titleSuffix        per-route overrides of router.titlePrefix /
 *                                    router.titleSuffix; the separator is part of
 *                                    the string and `false` disables it
 *   titleTemplate: '%s | Acme'       legacy escape hatch; owns the full title
 *
 * `description` / `descriptionKey` follow the same rules. Any field may also be
 * `{ t: 'key', params? }` (feature 0003).
 *
 * A `titleKey` with the translator off shows the key and logs one warning per
 * key: a silent fallback would hide a page that was never translated.
 *
 * @param {Object|null} metadata route metadata (`metadata.title`, ...)
 * @param {Document|null} doc injectable for tests
 * @param {(key: string, params?: Object) => string} [translate] injectable for tests
 * @param {{ translatorEnabled?: boolean, routerConfig?: Object, warn?: (field: string, key: string) => void }} [options]
 * @returns {void}
 */
export function applyRouteMetadata(
   metadata,
   doc = typeof document !== 'undefined' ? document : null,
   translate = defaultTranslate,
   options = {}
) {
   if (!doc || !metadata || typeof metadata !== 'object') return;

   const enabled = options.translatorEnabled ?? translatorEnabled();
   const routerConfig = options.routerConfig ?? globalThis.slice?.routerConfig ?? {};
   const warn = options.warn ?? warnKey;

   const title = keyedText(metadata, 'title', 'titleKey', translate, enabled, warn);
   const titleTemplate = resolveText(metadata.titleTemplate, translate);
   const description = keyedText(metadata, 'description', 'descriptionKey', translate, enabled, warn);
   const state = stateOf(doc);
   const descriptionMeta = doc.querySelector('meta[name="description"]');

   if (title) {
      const prefix = affix(metadata.titlePrefix, routerConfig.titlePrefix);
      const suffix = affix(metadata.titleSuffix, routerConfig.titleSuffix);
      const next = titleTemplate && titleTemplate !== '%s'
         ? titleTemplate.replace('%s', String(title))
         : `${prefix}${String(title)}${suffix}`;
      if (doc.title !== next) doc.title = next;
      state.appliedTitle = next;
   } else if (state.appliedTitle !== null && doc.title === state.appliedTitle) {
      // The route has no title: put back what the server sent, but never clobber a
      // title a component set after the router's last write.
      if (doc.title !== state.title) doc.title = state.title;
      state.appliedTitle = null;
   }

   if (description) {
      let meta = descriptionMeta;
      if (!meta) {
         meta = doc.createElement('meta');
         meta.setAttribute('name', 'description');
         doc.head.appendChild(meta);
      }
      if (meta.getAttribute('content') !== description) {
         meta.setAttribute('content', description);
      }
      state.appliedDescription = description;
   } else if (state.appliedDescription !== null && descriptionMeta?.getAttribute('content') === state.appliedDescription) {
      if (state.description === null) descriptionMeta.removeAttribute('content');
      else if (descriptionMeta.getAttribute('content') !== state.description) {
         descriptionMeta.setAttribute('content', state.description);
      }
      state.appliedDescription = null;
   }
}

/**
 * Per-document baseline: what the server sent, and what this helper wrote last.
 * @param {Document} doc
 * @returns {{ title: string, description: string|null, appliedTitle: string|null, appliedDescription: string|null }}
 */
function stateOf(doc) {
   let state = states.get(doc);
   if (!state) {
      const meta = doc.querySelector('meta[name="description"]');
      state = {
         title: doc.title,
         description: meta ? meta.getAttribute('content') : null,
         appliedTitle: null,
         appliedDescription: null
      };
      states.set(doc, state);
   }
   return state;
}

/**
 * `titleKey` / `descriptionKey` (translated, and winning over the literal)
 * or the literal `title` / `description` (`{ t }` included).
 * @param {Object} metadata
 * @param {string} field
 * @param {string} keyField
 * @param {(key: string, params?: Object) => string} translate
 * @param {boolean} enabled
 * @param {(field: string, key: string) => void} warn
 * @returns {any}
 */
function keyedText(metadata, field, keyField, translate, enabled, warn) {
   const key = typeof metadata[keyField] === 'string' ? metadata[keyField].trim() : '';
   if (!key) return resolveText(metadata[field], translate);
   if (enabled) return translate(key);
   warn(keyField, key);
   return key;
}

/**
 * A per-route affix, or the router-wide default. `false` disables it; the
 * separator belongs to the string (`" · Site"`).
 * @param {unknown} own
 * @param {unknown} fallback
 * @returns {string}
 */
function affix(own, fallback) {
   if (own === false) return '';
   if (typeof own === 'string') return own;
   return typeof fallback === 'string' ? fallback : '';
}

/** @type {Set<string>} */
const warned = new Set();

/** @type {WeakMap<Document, { title: string, description: string|null, appliedTitle: string|null, appliedDescription: string|null }>} */
const states = new WeakMap();

/**
 * One warning per key and field, not one per navigation.
 * @param {string} field
 * @param {string} key
 */
function warnKey(field, key) {
   const id = `${field}:${key}`;
   if (warned.has(id)) return;
   warned.add(id);
   const message = `Route metadata uses ${field} "${key}" while slice.translator is disabled; the page will show the key.`;
   const logger = /** @type {any} */ (globalThis).slice?.logger;
   if (typeof logger?.logWarning === 'function') logger.logWarning('Router', message);
   else if (typeof logger?.warn === 'function') logger.warn('Router', message);
   else console.warn(`[slice.router] ${message}`);
}

/**
 * `{ t: 'key', params? }` → the translated text; anything else is returned as is.
 * @param {unknown} value
 * @param {(key: string, params?: Object) => string} translate
 * @returns {any}
 */
export function resolveText(value, translate) {
   if (value && typeof value === 'object' && typeof /** @type {any} */ (value).t === 'string') {
      const { t: key, params } = /** @type {{ t: string, params?: Object }} */ (value);
      return translate(key, params);
   }
   return value;
}

/**
 * `slice.translator.enabled`, read lazily: the Router can apply metadata before
 * a test (or a very early navigation) has wired the global.
 * @returns {boolean}
 */
function translatorEnabled() {
   return /** @type {any} */ (globalThis).slice?.translator?.enabled === true;
}

/** @param {string} key @param {Object} [params] */
function defaultTranslate(key, params) {
   const s = /** @type {any} */ (globalThis).slice;
   return typeof s?.t === 'function' ? s.t(key, params) : key;
}
