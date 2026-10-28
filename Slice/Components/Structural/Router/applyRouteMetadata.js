/**
 * Apply a route's `metadata` to the document head.
 *
 * Only what the route declares is touched. A route without `metadata.title`
 * keeps whatever the server sent: with native SEO the prerendered HTML already
 * carries the right title, and writing a generic one here would undo it.
 *
 * `canonical` and `robots` are deliberately **never** written from here.
 * Crawlers do not run this code, so rewriting them client-side could only
 * desync the SPA from the HTML that was actually served.
 *
 * Any field may be `{ t: 'key', params? }` instead of a string: it is translated
 * with `slice.t()` (feature 0003), so the title follows the active locale.
 *
 * @param {Object|null} metadata route metadata (`metadata.title`, ...)
 * @param {Document|null} doc injectable for tests
 * @param {(key: string, params?: Object) => string} [translate] injectable for tests
 * @returns {void}
 */
export function applyRouteMetadata(
   metadata,
   doc = typeof document !== 'undefined' ? document : null,
   translate = defaultTranslate
) {
   if (!doc || !metadata || typeof metadata !== 'object') return;

   const title = resolveText(metadata.title, translate);
   const titleTemplate = resolveText(metadata.titleTemplate, translate);
   const description = resolveText(metadata.description, translate);

   if (title) {
      const next = titleTemplate && titleTemplate !== '%s'
         ? titleTemplate.replace('%s', String(title))
         : String(title);
      if (doc.title !== next) doc.title = next;
   }

   if (description) {
      let meta = doc.querySelector('meta[name="description"]');
      if (!meta) {
         meta = doc.createElement('meta');
         meta.setAttribute('name', 'description');
         doc.head.appendChild(meta);
      }
      if (meta.getAttribute('content') !== description) {
         meta.setAttribute('content', description);
      }
   }
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

/** @param {string} key @param {Object} [params] */
function defaultTranslate(key, params) {
   const s = /** @type {any} */ (globalThis).slice;
   return typeof s?.t === 'function' ? s.t(key, params) : key;
}
