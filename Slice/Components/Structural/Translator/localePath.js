/**
 * The locale in the URL (`routing`, feature 0003 §7). Pure: no DOM, no `slice` global, no
 * imports — the server-side SEO code uses the same rules.
 *
 *   routing: "prefix"                 /es/pricing   /en/pricing   (`/` redirects to a locale)
 *   routing: "prefix-except-default"  /pricing      /en/pricing   (default locale has no prefix)
 *
 * Routes are declared once, without a locale; the prefix is added and removed here.
 */

/** @typedef {false|'prefix'|'prefix-except-default'} LocaleRouting */

/**
 * Normalize the `routing` option: anything else means "not in the URL".
 * @param {unknown} value
 * @returns {LocaleRouting}
 */
export function normalizeRouting(value) {
   return value === 'prefix' || value === 'prefix-except-default' ? value : false;
}

/**
 * Split `?query#hash` off a path.
 * @param {string} path
 * @returns {[string, string]} [pathname, suffix]
 */
export function splitSuffix(path) {
   const index = path.search(/[?#]/);
   return index === -1 ? [path, ''] : [path.slice(0, index), path.slice(index)];
}

/**
 * Remove a known locale prefix: `/en/pricing?x=1` → `{ locale: 'en', path: '/pricing?x=1' }`.
 * The match is case-insensitive and returns the locale as configured. A first segment that
 * is not a configured locale (`/fr/…`, `/docs/…`) is part of the path.
 * @param {string} url
 * @param {readonly string[]} locales
 * @returns {{ locale: string|null, path: string }}
 */
export function splitLocalePath(url, locales) {
   const value = typeof url === 'string' && url ? url : '/';
   const [pathname, suffix] = splitSuffix(value);
   const match = /^\/([^/]+)(\/.*)?$/.exec(pathname);
   if (!match || !Array.isArray(locales)) return { locale: null, path: value };
   const segment = match[1].toLowerCase();
   const locale = locales.find((candidate) => candidate.toLowerCase() === segment);
   if (!locale) return { locale: null, path: value };
   return { locale, path: `${match[2] || '/'}${suffix}` };
}

/**
 * The URL of an app path in a locale.
 * @param {string} path app path, without locale (may carry `?query#hash`)
 * @param {string|null} locale
 * @param {{ routing: LocaleRouting, defaultLocale: string }} options
 * @returns {string}
 */
export function localizePath(path, locale, { routing, defaultLocale }) {
   const value = typeof path === 'string' && path ? path : '/';
   if (!routing || !locale) return value;
   if (routing === 'prefix-except-default' && locale === defaultLocale) return value;
   const [pathname, suffix] = splitSuffix(value);
   return `/${locale}${pathname === '/' ? '' : pathname}${suffix}`;
}

/**
 * The locale a URL stands for: its prefix, or — with "prefix-except-default" — the default
 * locale when there is none. `null` with "prefix" and no prefix (the locale must be chosen
 * and the URL redirected), and always `null` without routing.
 * @param {string} url
 * @param {{ routing: LocaleRouting, defaultLocale: string, locales: readonly string[] }} options
 * @returns {string|null}
 */
export function localeOfUrl(url, { routing, defaultLocale, locales }) {
   if (!routing) return null;
   const { locale } = splitLocalePath(url, locales);
   if (locale) return locale;
   return routing === 'prefix-except-default' ? defaultLocale : null;
}

/**
 * Whether `href` is something `localizePath` must leave alone: another origin, a scheme
 * (`mailto:`), a protocol-relative URL, a fragment, a query, or a relative path.
 * @param {string} href
 * @returns {boolean}
 */
export function isExternalHref(href) {
   return typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//');
}
