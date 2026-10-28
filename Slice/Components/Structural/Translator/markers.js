/**
 * Key references for component props: `slice.translator.key('orders.save')`.
 *
 * A marker is what an app passes instead of a string. The framework resolves it before
 * the component sees it (the component only ever receives text) and assigns the prop
 * again when the locale changes. Pure: no DOM, no `slice` global.
 */

// Self-contained on purpose: the CLI bundler inlines the helpers a Structural component
// imports, but not helpers imported by those helpers.
/** @param {unknown} value @returns {value is Record<string, any>} */
function isPlainObject(value) {
   if (!value || typeof value !== 'object') return false;
   const proto = Object.getPrototypeOf(value);
   return proto === Object.prototype || proto === null;
}

export class TranslationKey {
   /** @type {(() => void) | undefined} */
   #onStringify;

   /**
    * @param {string} key
    * @param {Record<string, any>} [params]
    * @param {() => void} [onStringify] called when the marker is used as text by mistake
    */
   constructor(key, params, onStringify) {
      this.key = String(key);
      this.params = params && typeof params === 'object' ? Object.freeze({ ...params }) : undefined;
      this.#onStringify = onStringify;
      Object.freeze(this);
   }

   /**
    * A marker that ends up as text (`'Save: ' + marker`) shows its key, and warns in
    * development: it was meant for a prop, not for string concatenation.
    * @returns {string}
    */
   toString() {
      this.#onStringify?.();
      return this.key;
   }

   /** @param {string} hint */
   [Symbol.toPrimitive](hint) {
      return hint === 'number' ? NaN : this.toString();
   }

   toJSON() {
      return this.toString();
   }
}

/**
 * @param {unknown} value
 * @returns {value is TranslationKey}
 */
export function isMarker(value) {
   return value instanceof TranslationKey;
}

/**
 * Whether a prop value holds a marker: itself, or nested in arrays and plain objects.
 * Class instances (components, Dates, Maps…) are not walked.
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {boolean}
 */
export function containsMarker(value, depth = 0) {
   if (isMarker(value)) return true;
   if (depth > 8) return false;
   if (Array.isArray(value)) return value.some((item) => containsMarker(item, depth + 1));
   if (isPlainObject(value)) return Object.values(value).some((item) => containsMarker(item, depth + 1));
   return false;
}

/**
 * A copy of `value` with every marker replaced by `translate(key, params)`. Arrays and
 * plain objects are copied only along the paths that hold markers; everything else keeps
 * its identity. Markers inside a marker's params resolve too.
 * @param {unknown} value
 * @param {(key: string, params?: Record<string, any>) => string} translate
 * @param {number} [depth]
 * @returns {any}
 */
export function resolveMarkers(value, translate, depth = 0) {
   if (isMarker(value)) {
      const params = value.params ? resolveMarkers(value.params, translate, depth + 1) : undefined;
      return translate(value.key, params);
   }
   if (depth > 8 || !containsMarker(value, depth)) return value;
   if (Array.isArray(value)) return value.map((item) => resolveMarkers(item, translate, depth + 1));
   /** @type {Record<string, any>} */
   const copy = {};
   for (const [key, item] of Object.entries(/** @type {Record<string, any>} */ (value))) {
      copy[key] = resolveMarkers(item, translate, depth + 1);
   }
   return copy;
}
