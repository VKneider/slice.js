import {
   IntlCache,
   directionOf,
   formatMessage,
   isPlainObject,
   isPluralMessage,
   lookup,
   matchLocale,
   mergeMessages,
} from './messages.js';
import { TranslationKey, containsMarker, resolveMarkers } from './markers.js';
import { translateTree } from './dom.js';
import { isExternalHref, localeOfUrl, localizePath, normalizeRouting, splitLocalePath } from './localePath.js';

const STORAGE_KEY = 'slice:locale';
const WRAPPED = Symbol('slice.translator.wrapped');

/**
 * @typedef {Object} TranslatorConfig
 * @property {boolean} [enabled]
 * @property {string} [defaultLocale]
 * @property {string|null} [fallbackLocale]
 * @property {string[]} [locales]
 * @property {string} [path]
 * @property {boolean} [saveLocally]
 * @property {boolean} [useBrowserLocale]
 * @property {false|'prefix'|'prefix-except-default'} [routing]
 */

/**
 * slice.translator — translations and locale formatting as part of the framework.
 *
 *   slice.t('orders.count', { count: 3 })            → '3 pedidos'
 *   <h1 data-t="home.title"></h1>                    → translated, and kept translated
 *   slice.build('Button', { value: slice.translator.key('orders.save') })
 *
 * Texts in the DOM are *marked*, not written: any element with `data-t` (in a template, in
 * App/index.html, or created later from JS) is translated when it enters the document and
 * again on every locale change. Changing a `data-t` or `data-t-*` attribute re-translates
 * that element. Props passed as `key()` markers are resolved before the component sees them
 * and assigned again on a locale change. `watch()` covers what lives outside the DOM.
 *
 * With `enabled: false` nothing is loaded or observed: `t()` returns the key, markers resolve
 * to their key, `format.*` uses the browser's language.
 */
export default class Translator {
   /**
    * @param {TranslatorConfig} [config]
    */
   constructor(config = {}) {
      const options = config && typeof config === 'object' ? config : {};
      const browserLocale = Translator.browserLocales()[0] || 'en';

      /** @type {boolean} */
      this.enabled = options.enabled === true && typeof options.defaultLocale === 'string' && options.defaultLocale !== '';
      /** @type {string} */
      this.defaultLocale = this.enabled ? /** @type {string} */ (options.defaultLocale) : browserLocale;

      const declared = Array.isArray(options.locales) ? options.locales.filter((l) => typeof l === 'string' && l) : [];
      /** @type {readonly string[]} */
      this.locales = Object.freeze([...new Set([this.defaultLocale, ...declared])]);
      /** @type {string|null} */
      this.fallbackLocale =
         this.enabled && typeof options.fallbackLocale === 'string' && options.fallbackLocale !== this.defaultLocale
            ? options.fallbackLocale
            : null;
      if (this.fallbackLocale && !this.locales.includes(this.fallbackLocale)) {
         // The fallback is loaded like any locale; listing it keeps setLocale() consistent.
         this.locales = Object.freeze([...this.locales, this.fallbackLocale]);
      }

      this.path = String(options.path || '/locales').replace(/\/+$/, '');
      this.saveLocally = options.saveLocally === true;
      this.useBrowserLocale = options.useBrowserLocale === true;
      /** @type {false|'prefix'|'prefix-except-default'} the locale in the URL (§7) */
      this.routing = this.enabled ? normalizeRouting(options.routing) : false;

      /** @type {string} */
      this.locale = this.defaultLocale;

      /** @private @type {Map<string, Record<string, any>>} */
      this._app = new Map();
      /** @private @type {Map<string, Record<string, any>>} */
      this._defaults = new Map();
      /** @private @type {Set<string>} files merged, as `locale` or `locale/namespace` */
      this._loaded = new Set();
      /** @private @type {Map<string, Promise<void>>} */
      this._requests = new Map();
      /** @private @type {Set<string>} */
      this._namespaces = new Set();
      /** @private */
      this._version = 0;
      /** @private texts are not written (nor missing keys reported) before the first load */
      this._ready = !this.enabled;

      /** @private */
      this._intl = new IntlCache();
      /** @private @type {Set<string>} */
      this._warned = new Set();

      // DOM
      /** @private @type {WeakMap<Element, string>} */
      this._applied = new WeakMap();
      /** @private @type {WeakMap<Element, Map<string, Element>>} */
      this._slots = new WeakMap();
      /** @private @type {MutationObserver|null} */
      this._observer = null;
      /** @private */
      this._dom = {
         t: (key, params) => this.t(key, params),
         signature: () => `${this.locale}#${this._version}`,
         applied: this._applied,
         slots: this._slots,
         warn: (message) => this._warnOnce(message, message),
      };

      // Props
      /** @private @type {WeakMap<object, Map<string, any>>} component → prop → raw value with markers */
      this._markerProps = new WeakMap();
      /** @private @type {WeakMap<Function, Set<string>>} class → props whose setter resolves markers */
      this._wrappedProps = new WeakMap();
      /** @private */
      this._refreshing = false;

      // watch()
      /** @private @type {Map<object, Set<(locale: string, previous: string) => void>>} */
      this._watchers = new Map();
      /** @private @type {Set<(locale: string, previous: string) => void>} */
      this._globalWatchers = new Set();

      /** @private */
      this._refreshScheduled = false;
      /** @private */
      this._switchId = 0;

      this.format = this._createFormat();
   }

   /**
    * The browser's preferred languages, most preferred first.
    * @returns {string[]}
    */
   static browserLocales() {
      if (typeof navigator === 'undefined') return [];
      const list = Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language];
      return list.filter((l) => typeof l === 'string' && l);
   }

   // ───────────────────────────── Start ─────────────────────────────

   /**
    * Pick the starting locale, load its dictionaries (and the fallback's), translate the
    * document and start watching it. A failed load is logged, not thrown: the app boots
    * showing keys rather than not booting.
    * @returns {Promise<void>}
    */
   async init() {
      if (!this.enabled) return;
      this.locale = this.initialLocale();
      try {
         await this._loadLocale(this.locale);
      } catch (error) {
         this._log('error', `Could not load the dictionary for "${this.locale}"`, error);
      }
      this._ready = true;
      this._applyDocumentLocale();
      // With "prefix", `/pricing` becomes `/es/pricing`; with "prefix-except-default",
      // `/es/pricing` (the default locale) becomes `/pricing`. Before the router starts.
      this.syncUrl();
      this.apply();
      this._observe();
   }

   /**
    * The locale to start with. With `routing`, the URL decides: its prefix, or — with
    * "prefix-except-default" — the default locale when there is none. Otherwise (and for
    * "prefix" at an unprefixed URL): the saved choice (`saveLocally`) → the browser's
    * language (`useBrowserLocale`) → `defaultLocale`.
    * @returns {string}
    */
   initialLocale() {
      if (!this.enabled) return this.defaultLocale;
      if (this.routing && typeof location !== 'undefined') {
         const fromUrl = this.localeOfUrl(location.pathname);
         if (fromUrl) return fromUrl;
      }
      if (this.saveLocally) {
         const saved = matchLocale(this._readSaved(), /** @type {string[]} */ ([...this.locales]));
         if (saved) return saved;
      }
      if (this.useBrowserLocale) {
         for (const candidate of Translator.browserLocales()) {
            const match = matchLocale(candidate, /** @type {string[]} */ ([...this.locales]));
            if (match) return match;
         }
      }
      return this.defaultLocale;
   }

   /**
    * Stop observing the document. Used by tests and by an app tearing Slice down.
    * @returns {void}
    */
   destroy() {
      this._observer?.disconnect();
      this._observer = null;
      this._watchers.clear();
      this._globalWatchers.clear();
   }

   // ───────────────────────────── Messages ─────────────────────────────

   /**
    * Translate a key. Lookup: the app's dictionaries → the library defaults, for the active
    * locale and then for `fallbackLocale`; when nothing matches, the key itself.
    * @param {string} key
    * @param {Record<string, any>} [params]
    * @returns {string}
    */
   t(key, params) {
      if (typeof key !== 'string' || key === '') return String(key ?? '');
      if (!this.enabled) return key;

      for (const locale of this._chain()) {
         const entry = this._entry(key, locale);
         if (entry === undefined) continue;
         const text = formatMessage(entry, params, locale, this._intl, {
            onMissingParam: (name) => this._warnOnce(`param:${locale}:${key}:${name}`, `"${key}" (${locale}) uses {${name}} but no "${name}" param was given`),
            onMissingCount: () => this._warnOnce(`count:${locale}:${key}`, `"${key}" (${locale}) is a plural message: pass { count }`),
         });
         if (text === null) {
            this._warnOnce(`group:${key}`, `"${key}" is a group of messages, not a message`);
            return key;
         }
         return text;
      }

      if (this._ready) {
         this._warnOnce(`missing:${this.locale}:${key}`, `Missing translation "${key}" for "${this.locale}"${this.fallbackLocale ? ` (and "${this.fallbackLocale}")` : ''}`);
      }
      return key;
   }

   /**
    * Whether `key` is a message in `locale` (default: the active one), app or defaults layer.
    * The fallback is not consulted.
    * @param {string} key
    * @param {string} [locale]
    * @returns {boolean}
    */
   has(key, locale = this.locale) {
      const entry = this._entry(key, locale);
      return typeof entry === 'string' || isPluralMessage(entry);
   }

   /**
    * Merge messages at runtime. With `{ defaults: true }` they go to a lower layer that never
    * overrides the app's dictionaries — how a component library ships its own texts.
    * @param {string} locale
    * @param {Record<string, any>} messages
    * @param {{ defaults?: boolean }} [options]
    * @returns {void}
    */
   add(locale, messages, options = {}) {
      if (typeof locale !== 'string' || !isPlainObject(messages)) return;
      const layer = options.defaults ? this._defaults : this._app;
      if (!layer.has(locale)) layer.set(locale, {});
      mergeMessages(/** @type {Record<string, any>} */ (layer.get(locale)), messages);
      this._version++;
      this._scheduleRefresh();
   }

   /**
    * Load a namespace (`/locales/<locale>/<namespace>.json`) for the active locale and the
    * fallback. It stays loaded: later locale changes load it too. Elements and props that
    * use its keys update when it arrives.
    * @param {string} namespace
    * @returns {Promise<void>}
    */
   async load(namespace) {
      if (typeof namespace !== 'string' || !namespace) return;
      this._namespaces.add(namespace);
      if (!this.enabled) return;
      const [active, fallback] = await Promise.allSettled([
         this._fetch(this.locale, namespace),
         this.fallbackLocale ? this._fetch(this.fallbackLocale, namespace) : Promise.resolve(),
      ]);
      if (fallback.status === 'rejected') {
         this._log('warn', `Could not load "${namespace}" for the fallback "${this.fallbackLocale}"`, fallback.reason);
      }
      this._refresh();
      if (active.status === 'rejected') throw active.reason;
   }

   /**
    * Change the active locale. Loads what it needs first: on failure the locale does not
    * change and the promise rejects. Then updates `<html lang|dir>`, saves the choice,
    * re-translates the document, re-assigns marker props, re-applies the route's metadata,
    * calls `watch()` callbacks and emits `translator:change`.
    * @param {string} locale
    * @returns {Promise<string>} the active locale
    */
   async setLocale(locale) {
      if (!this.enabled) {
         this._log('warn', 'setLocale() needs "translator": { "enabled": true } in sliceConfig.json');
         return this.locale;
      }
      const next = matchLocale(locale, /** @type {string[]} */ ([...this.locales]));
      if (!next) {
         throw new Error(`[slice.translator] "${locale}" is not one of the configured locales (${this.locales.join(', ')})`);
      }
      const switchId = ++this._switchId;
      if (next === this.locale) return this.locale;

      await this._loadLocale(next);
      // A later setLocale() started while this one was loading: that one wins.
      if (switchId !== this._switchId) return this.locale;

      const previous = this.locale;
      this.locale = next;
      this._version++;
      this._applyDocumentLocale();
      if (this.saveLocally) this._save(next);
      this.syncUrl();

      this._refresh();
      this._notify(previous);
      return this.locale;
   }

   /**
    * Load what `locale` needs without switching to it, so a navigation can push the new URL
    * only once the dictionaries are in (setLocale() then switches without waiting).
    * Rejects for a locale that is not configured, or when its main file fails.
    * @param {string} locale
    * @returns {Promise<string>} the configured locale matched
    */
   async preload(locale) {
      const match = matchLocale(locale, /** @type {string[]} */ ([...this.locales]));
      if (!match) {
         throw new Error(`[slice.translator] "${locale}" is not one of the configured locales (${this.locales.join(', ')})`);
      }
      if (this.enabled) await this._loadLocale(match);
      return match;
   }

   // ───────────────────────────── Props ─────────────────────────────

   /**
    * A reference to a key, for a component prop. The component receives the translated
    * string, and receives it again when the locale changes.
    * @param {string} key
    * @param {Record<string, any>} [params]
    * @returns {TranslationKey}
    */
   key(key, params) {
      return new TranslationKey(key, params, () =>
         this._warnOnce(`marker:${key}`, `slice.translator.key("${key}") was used as a string; pass it as a prop value, or use slice.t() for text`)
      );
   }

   /**
    * Whether a value is (or contains) a `key()` marker.
    * @param {unknown} value
    * @returns {boolean}
    */
   isKey(value) {
      return containsMarker(value);
   }

   /**
    * Resolve every marker in a value (deep, through arrays and plain objects).
    * @param {any} value
    * @returns {any}
    */
   resolve(value) {
      return resolveMarkers(value, (key, params) => this.t(key, params));
   }

   /**
    * Wrap the setters of a component class's `static props` so that a later assignment of a
    * marker (`this.$count.label = slice.translator.key(…)`) resolves and refreshes too.
    * Once per class; invisible for any value that is not a marker. Called by the Controller.
    * @param {Function} ComponentClass
    * @returns {void}
    */
   prepareClass(ComponentClass) {
      if (!this.enabled || typeof ComponentClass !== 'function' || this._wrappedProps.has(ComponentClass)) return;
      /** @type {Set<string>} */
      const wrapped = new Set();
      this._wrappedProps.set(ComponentClass, wrapped);

      const staticProps = /** @type {any} */ (ComponentClass).props;
      if (!isPlainObject(staticProps)) return;

      const translator = this;
      for (const prop of Object.keys(staticProps)) {
         const found = findAccessor(ComponentClass.prototype, prop);
         if (!found || typeof found.descriptor.set !== 'function') continue;
         const { descriptor } = found;
         if (/** @type {any} */ (descriptor.set)[WRAPPED]) {
            wrapped.add(prop);
            continue;
         }
         const originalSet = descriptor.set;
         const set = function (/** @type {any} */ value) {
            // The runtime has one translator; prefer the live one if it was replaced.
            const active = globalThis.slice?.translator instanceof Translator ? globalThis.slice.translator : translator;
            return originalSet.call(this, active._track(this, prop, value));
         };
         Object.defineProperty(set, WRAPPED, { value: true });
         Object.defineProperty(ComponentClass.prototype, prop, {
            get: descriptor.get,
            set,
            enumerable: descriptor.enumerable,
            configurable: true,
         });
         wrapped.add(prop);
      }
   }

   /**
    * The value the Controller assigns for `prop`. A prop whose setter is wrapped gets the raw
    * value (the setter resolves it); any other prop gets the value resolved here, and its
    * markers are remembered for the next locale change.
    * @param {object} component
    * @param {string} prop
    * @param {any} value
    * @returns {any}
    */
   propValue(component, prop, value) {
      if (this._isWrapped(component, prop)) return value;
      return this._track(component, prop, value);
   }

   /**
    * Validation sees what the component will receive: strings, not markers.
    * @param {Record<string, any>} props
    * @returns {Record<string, any>}
    */
   resolveProps(props) {
      return containsMarker(props) ? this.resolve(props) : props;
   }

   // ───────────────────────────── URLs (§7) ─────────────────────────────

   /**
    * Split a known locale prefix off a URL: `/en/pricing` → `{ locale: 'en', path: '/pricing' }`.
    * Without `routing`, the URL is returned whole with `locale: null`.
    * @param {string} url
    * @returns {{ locale: string|null, path: string }}
    */
   splitPath(url) {
      if (!this.routing) return { locale: null, path: typeof url === 'string' && url ? url : '/' };
      return splitLocalePath(url, this.locales);
   }

   /**
    * The URL of an app path in a locale (default: the active one). Leaves alone what is not
    * an app path (`https://…`, `mailto:`, `#top`, relative paths) and paths that already
    * carry a locale.
    * @param {string} path
    * @param {string} [locale]
    * @returns {string}
    */
   localizePath(path, locale = this.locale) {
      if (!this.routing || isExternalHref(path)) return path;
      if (splitLocalePath(path, this.locales).locale) return path;
      return localizePath(path, locale, { routing: this.routing, defaultLocale: this.defaultLocale });
   }

   /**
    * The locale a URL stands for (see `initialLocale()`); null without `routing`.
    * @param {string} url
    * @returns {string|null}
    */
   localeOfUrl(url) {
      return localeOfUrl(url, { routing: this.routing, defaultLocale: this.defaultLocale, locales: this.locales });
   }

   // ───────────────────────────── DOM ─────────────────────────────

   /**
    * Translate every `data-t` element under `root` (default: the document) now, instead of
    * when the observer runs — for code that reads a text right after creating it.
    * @param {ParentNode} [root]
    * @returns {number} elements written
    */
   apply(root) {
      if (!this.enabled || !this._ready) return 0;
      const target = root || (typeof document !== 'undefined' ? document.documentElement : null);
      if (!target) return 0;
      return translateTree(target, this._dom);
   }

   // ───────────────────────────── Outside the DOM ─────────────────────────────

   /**
    * Run `callback(locale, previous)` after every locale change, for texts that live outside
    * the DOM (a chart drawn on a canvas, a library that copied a string). With a component,
    * the subscription ends when the component is destroyed. Returns an unsubscribe function.
    * @param {object|((locale: string, previous: string) => void)} componentOrCallback
    * @param {(locale: string, previous: string) => void} [callback]
    * @returns {() => void}
    */
   watch(componentOrCallback, callback) {
      if (typeof componentOrCallback === 'function') {
         const fn = componentOrCallback;
         this._globalWatchers.add(fn);
         return () => this._globalWatchers.delete(fn);
      }
      const component = componentOrCallback;
      if (!component || typeof callback !== 'function') return () => {};
      let set = this._watchers.get(component);
      if (!set) {
         set = new Set();
         this._watchers.set(component, set);
      }
      set.add(callback);
      return () => {
         const current = this._watchers.get(component);
         current?.delete(callback);
         if (current && current.size === 0) this._watchers.delete(component);
      };
   }

   /**
    * Drop everything held for a component. Called by the Controller when it is destroyed.
    * @param {object} component
    * @returns {void}
    */
   forget(component) {
      this._watchers.delete(component);
      this._markerProps.delete(component);
   }

   // ───────────────────────────── Formatting ─────────────────────────────

   /**
    * @private
    */
   _createFormat() {
      const intl = this._intl;
      const locale = () => this.locale;
      const toDate = (/** @type {any} */ value) => (value instanceof Date ? value : new Date(value));
      return Object.freeze({
         /** @param {number} value @param {Intl.NumberFormatOptions} [options] */
         number: (value, options = {}) => intl.get(Intl.NumberFormat, locale(), options).format(value),
         /** @param {number} value @param {string} currency @param {Intl.NumberFormatOptions} [options] */
         currency: (value, currency, options = {}) =>
            intl.get(Intl.NumberFormat, locale(), { style: 'currency', currency, ...options }).format(value),
         /** @param {number} value 0.25 → 25 % @param {Intl.NumberFormatOptions} [options] */
         percent: (value, options = {}) => intl.get(Intl.NumberFormat, locale(), { style: 'percent', ...options }).format(value),
         /** @param {Date|number|string} value @param {Intl.DateTimeFormatOptions} [options] */
         date: (value, options = { dateStyle: 'medium' }) => intl.get(Intl.DateTimeFormat, locale(), options).format(toDate(value)),
         /** @param {Date|number|string} value @param {Intl.DateTimeFormatOptions} [options] */
         time: (value, options = { timeStyle: 'short' }) => intl.get(Intl.DateTimeFormat, locale(), options).format(toDate(value)),
         /** @param {number} value @param {Intl.RelativeTimeFormatUnit} unit @param {Intl.RelativeTimeFormatOptions} [options] */
         relative: (value, unit, options = { numeric: 'auto' }) => intl.get(Intl.RelativeTimeFormat, locale(), options).format(value, unit),
         /** @param {string[]} items @param {Intl.ListFormatOptions} [options] */
         list: (items, options = { type: 'conjunction' }) => intl.get(Intl.ListFormat, locale(), options).format(items),
      });
   }

   // ───────────────────────────── Internals ─────────────────────────────

   /** @private @returns {string[]} */
   _chain() {
      return this.fallbackLocale && this.fallbackLocale !== this.locale ? [this.locale, this.fallbackLocale] : [this.locale];
   }

   /** @private */
   _entry(key, locale) {
      const app = lookup(this._app.get(locale), key);
      if (app !== undefined) return app;
      return lookup(this._defaults.get(locale), key);
   }

   /**
    * Load the main file of `locale` and every namespace in use, plus the fallback's.
    * Rejects when the locale's main file fails; a failing fallback only warns.
    * @private
    * @param {string} locale
    */
   async _loadLocale(locale) {
      const files = (/** @type {string} */ loc) => [this._fetch(loc), ...[...this._namespaces].map((ns) => this._fetch(loc, ns))];
      const active = Promise.all(files(locale));
      const fallback =
         this.fallbackLocale && this.fallbackLocale !== locale ? Promise.allSettled(files(this.fallbackLocale)) : Promise.resolve([]);
      const [, fallbackResults] = await Promise.all([active, fallback]);
      for (const result of /** @type {PromiseSettledResult<void>[]} */ (fallbackResults)) {
         if (result.status === 'rejected') this._log('warn', `Fallback dictionary failed (${this.fallbackLocale})`, result.reason);
      }
   }

   /**
    * Fetch one dictionary file once and merge it into the app layer.
    * @private
    * @param {string} locale
    * @param {string} [namespace]
    * @returns {Promise<void>}
    */
   _fetch(locale, namespace) {
      const id = namespace ? `${locale}/${namespace}` : locale;
      if (this._loaded.has(id)) return Promise.resolve();
      const pending = this._requests.get(id);
      if (pending) return pending;

      const url = `${this.path}/${id}.json`;
      const request = (async () => {
         const response = await fetch(url);
         if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
         const json = await response.json();
         if (!isPlainObject(json)) throw new Error(`${url} is not a JSON object`);
         if (!this._app.has(locale)) this._app.set(locale, {});
         mergeMessages(/** @type {Record<string, any>} */ (this._app.get(locale)), namespace ? { [namespace]: json } : json);
         this._loaded.add(id);
         this._version++;
      })().finally(() => this._requests.delete(id));

      this._requests.set(id, request);
      return request;
   }

   /** @private */
   _isWrapped(component, prop) {
      const Class = component?.constructor;
      return !!Class && !!this._wrappedProps.get(Class)?.has(prop);
   }

   /**
    * Remember (or forget) a prop's markers, and return what the component receives.
    * @private
    */
   _track(component, prop, value) {
      if (containsMarker(value)) {
         let record = this._markerProps.get(component);
         if (!record) {
            record = new Map();
            this._markerProps.set(component, record);
         }
         record.set(prop, value);
         return this.resolve(value);
      }
      // A plain value replaces a marker: stop refreshing that prop.
      if (!this._refreshing) this._markerProps.get(component)?.delete(prop);
      return value;
   }

   /**
    * Re-translate the document, re-assign marker props and re-apply the route metadata.
    * @private
    */
   _refresh() {
      if (!this.enabled || !this._ready) return;
      this.apply();
      this._refreshProps();
      this._refreshRouteMetadata();
   }

   /** @private Coalesce several add() calls in the same tick into one refresh. */
   _scheduleRefresh() {
      if (!this._ready || this._refreshScheduled) return;
      this._refreshScheduled = true;
      queueMicrotask(() => {
         this._refreshScheduled = false;
         this._refresh();
      });
   }

   /** @private Parents before children, so a parent that rebuilds its children goes first. */
   _refreshProps() {
      const active = /** @type {Map<string, any>|undefined} */ (globalThis.slice?.controller?.activeComponents);
      if (!active) return;
      const components = [...active.values()]
         .filter((component) => this._markerProps.has(component))
         .sort((a, b) => (a._depth || 0) - (b._depth || 0));

      for (const component of components) {
         const record = this._markerProps.get(component);
         if (!record) continue;
         for (const [prop, raw] of [...record]) {
            this._refreshing = true;
            try {
               component[prop] = this._isWrapped(component, prop) ? raw : this.resolve(raw);
            } catch (error) {
               this._log('error', `Could not refresh "${prop}" of ${component.sliceId || component.constructor?.name}`, error);
            } finally {
               this._refreshing = false;
            }
         }
      }
   }

   /** @private */
   _refreshRouteMetadata() {
      const s = globalThis.slice;
      if (!s?.router || s.routerConfig?.updateTitles === false) return;
      const metadata = s.router.activeMetadata;
      if (metadata && typeof s.router.applyMetadata === 'function') s.router.applyMetadata(metadata);
   }

   /**
    * @private
    * @param {string} previous
    */
   _notify(previous) {
      const s = globalThis.slice;
      const alive = (/** @type {any} */ component) =>
         typeof s?.isComponentAlive === 'function' ? s.isComponentAlive(component) : true;

      const components = [...this._watchers.keys()].sort((a, b) => (a._depth || 0) - (b._depth || 0));
      for (const component of components) {
         if (!alive(component)) {
            this._watchers.delete(component);
            continue;
         }
         for (const callback of [...(this._watchers.get(component) || [])]) {
            this._safeCall(callback, previous);
         }
      }
      for (const callback of [...this._globalWatchers]) this._safeCall(callback, previous);

      const payload = { locale: this.locale, previous };
      if (s?.eventsConfig?.enabled && typeof s.events?.emit === 'function') {
         s.events.emit('translator:change', payload);
      } else if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
         window.dispatchEvent(new CustomEvent('translator:change', { detail: payload }));
      }
   }

   /**
    * @private
    * @param {(locale: string, previous: string) => void} callback
    * @param {string} previous
    */
   _safeCall(callback, previous) {
      try {
         callback(this.locale, previous);
      } catch (error) {
         this._log('error', 'A translator.watch() callback failed', error);
      }
   }

   /** @private */
   _observe() {
      if (this._observer || typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
      this._observer = new MutationObserver((records) => {
         try {
            for (const record of records) {
               if (record.type === 'childList') {
                  for (const node of record.addedNodes) {
                     if (node.nodeType === 1) translateTree(/** @type {Element} */ (node), this._dom);
                  }
               } else if (record.attributeName && record.attributeName.startsWith('data-t') && record.target.isConnected) {
                  translateTree(/** @type {Element} */ (record.target), this._dom);
               }
            }
         } catch (error) {
            this._log('error', 'Error translating new or changed elements', error);
         }
      });
      // No attributeFilter: params are open-ended (`data-t-count`, `data-t-name`…). The
      // callback ignores every other attribute with one string check.
      this._observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
   }

   /**
    * Make the address bar show the active locale (replaceState: no navigation, no history
    * entry). A no-op when it already does, so the router can call setLocale() after pushing
    * the target URL. Called by the router after every route change.
    * @returns {void}
    */
   syncUrl() {
      if (!this.routing || typeof location === 'undefined' || typeof history === 'undefined') return;
      const current = `${location.pathname}${location.search}${location.hash}`;
      const { path } = splitLocalePath(current, this.locales);
      const target = localizePath(path, this.locale, { routing: this.routing, defaultLocale: this.defaultLocale });
      if (target !== current) history.replaceState(history.state, '', target);
   }

   /** @private */
   _applyDocumentLocale() {
      if (typeof document === 'undefined') return;
      const html = document.documentElement;
      if (html.lang !== this.locale) html.lang = this.locale;
      const dir = directionOf(this.locale);
      if (html.dir !== dir) html.dir = dir;
   }

   /** @private @returns {string|null} */
   _readSaved() {
      try {
         return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
      } catch {
         return null;
      }
   }

   /** @private */
   _save(locale) {
      try {
         globalThis.localStorage?.setItem(STORAGE_KEY, locale);
      } catch {
         // storage refused (private mode, quota): the choice lasts for this page only
      }
   }

   /**
    * Development warning, once per id.
    * @private
    */
   _warnOnce(id, message) {
      const s = globalThis.slice;
      if (typeof s?.isProduction === 'function' && s.isProduction()) return;
      if (this._warned.has(id)) return;
      this._warned.add(id);
      this._log('warn', message);
   }

   /** @private */
   _log(level, message, error) {
      const logger = globalThis.slice?.logger;
      if (level === 'error') {
         if (logger?.logError) logger.logError('Translator', message, error);
         else console.error(`[slice.translator] ${message}`, error ?? '');
      } else if (logger?.logWarning) {
         logger.logWarning('Translator', message, error);
      } else {
         console.warn(`[slice.translator] ${message}`, error ?? '');
      }
   }
}

/**
 * Find an accessor along the prototype chain (stops before HTMLElement and friends).
 * @param {object} proto
 * @param {string} prop
 * @returns {{ owner: object, descriptor: PropertyDescriptor }|null}
 */
function findAccessor(proto, prop) {
   let current = proto;
   while (current && current !== Object.prototype) {
      if (typeof HTMLElement !== 'undefined' && current === HTMLElement.prototype) return null;
      const descriptor = Object.getOwnPropertyDescriptor(current, prop);
      if (descriptor) return descriptor.get || descriptor.set ? { owner: current, descriptor } : null;
      current = Object.getPrototypeOf(current);
   }
   return null;
}
