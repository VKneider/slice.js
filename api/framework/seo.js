// api/framework/seo.js — the mechanics of per-route metadata.
//
// Consumes two sources and never guesses:
//   - `routes.js` (the app's route list): the only answer to "is this path a page?"
//   - `seo.json` (the metadata manifest): titles, descriptions, images, JSON-LD.
//
// Everything here is pure or filesystem-only (no express, no DOM) so the server,
// the build command and the CLI validator share exactly one implementation.

import fs from 'node:fs';
import path from 'node:path';
import {
  IntlCache,
  directionOf,
  formatMessage,
  isPluralMessage,
  lookup as lookupMessage
} from '../../Slice/Components/Structural/Translator/messages.js';
import {
  localeOfUrl,
  localizePath,
  normalizeLocalePrefix,
  splitLocalePath
} from '../../Slice/Components/Structural/Translator/localePath.js';

export const SEO_VERSION = 1;

const DEFAULT_TITLE_LIMIT = 60;
const DEFAULT_DESCRIPTION_LIMIT = 160;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/** `https://a.com/` -> `https://a.com`; anything not absolute is rejected. */
export function normalizeOrigin(value) {
  const raw = String(value ?? '').trim();
  if (!/^https?:\/\/[^/]+/i.test(raw)) return null;
  return raw.replace(/\/+$/, '');
}

/** `/producto/${id}` matched against `/producto/42` -> `{ id: '42' }`. */
export function matchPathPattern(pattern, pathname) {
  const escaped = String(pattern)
    .replace(/[.*+?^()|[\]\\]/g, '\\$&')
    .replace(/\$\{([^}]+)\}/g, (_, name) => `(?<${name}>[^/]+)`);
  const match = new RegExp(`^${escaped}$`).exec(pathname);
  return match ? { ...match.groups } : null;
}

const isPattern = (value) => /\$\{[^}]+\}/.test(String(value));

/**
 * The translator as the server needs it: which locales exist, how a URL carries one, and
 * `t()` for `{ t: 'key' }` fields. Same lookup order as the browser (locale → fallback →
 * the key itself), using the dictionaries the client already downloads.
 *
 * @param {object|null} config the `translator` block from sliceConfig.json
 * @param {Record<string, object>} [dictionaries] locale → messages
 */
export function buildTranslatorContext(config, dictionaries = {}) {
  const clean = (value) => (typeof value === 'string' && value.trim() ? value.trim() : '');
  const enabled = config?.enabled === true && clean(config.defaultLocale) !== '';
  const defaultLocale = enabled ? clean(config.defaultLocale) : null;
  const declared = Array.isArray(config?.locales) ? config.locales.map(clean).filter(Boolean) : [];
  const seen = new Map();
  for (const locale of enabled ? [defaultLocale, ...declared] : []) {
    const key = locale.toLowerCase();
    if (!seen.has(key)) seen.set(key, locale);
  }
  const fallbackLocale = enabled && clean(config.fallbackLocale)
    && clean(config.fallbackLocale).toLowerCase() !== defaultLocale.toLowerCase()
    ? clean(config.fallbackLocale)
    : null;
  // The fallback is a real locale: the client lists it (setLocale accepts it), so the
  // server must too or it would emit URLs it then treats as unknown prefixes.
  if (fallbackLocale && !seen.has(fallbackLocale.toLowerCase())) seen.set(fallbackLocale.toLowerCase(), fallbackLocale);
  const locales = enabled ? [...seen.values()] : [];
  const localePrefix = enabled ? normalizeLocalePrefix(config.localePrefix) : false;
  const intl = new IntlCache();

  const entry = (locale, key) => {
    const value = lookupMessage(dictionaries[locale], key);
    if (value === undefined && fallbackLocale && locale !== fallbackLocale) {
      return lookupMessage(dictionaries[fallbackLocale], key);
    }
    return value;
  };

  const t = (locale, key, params) => {
    if (!enabled || typeof key !== 'string') return key;
    const value = entry(locale, key);
    if (value === undefined) return key;
    return formatMessage(value, params, locale, intl) ?? key;
  };

  const localize = (pathname, locale) => (enabled
    ? localizePath(pathname, locale || defaultLocale, { localePrefix, defaultLocale })
    : pathname);

  return {
    enabled,
    localePrefix,
    defaultLocale,
    fallbackLocale,
    locales,
    t,
    has: (locale, key) => {
      if (!enabled) return false;
      const value = entry(locale, key);
      return typeof value === 'string' || isPluralMessage(value);
    },
    localize,
    split: (pathname) => (enabled && localePrefix
      ? splitLocalePath(pathname, locales)
      : { locale: null, path: pathname }),
    localeOf: (pathname) => (enabled
      ? localeOfUrl(pathname, { localePrefix, defaultLocale, locales })
      : null),
    direction: (locale) => directionOf(locale || defaultLocale || 'en'),
    ogLocale: (locale) => String(locale || '').replace('-', '_')
  };
}

/**
 * Read `{ locale: messages }` from `<folderDeployed>/<translator.path>/<locale>.json`.
 * Missing files are tolerated (the key shows, as in the browser); a malformed one is an
 * error the server cannot silently ignore.
 */
export function loadTranslatorDictionaries(projectRoot, folderDeployed, config) {
  if (config?.enabled !== true) return {};
  const folder = String(config.path || '/locales').replace(/^\/+|\/+$/g, '') || 'locales';
  const declared = [
    config.defaultLocale,
    ...(Array.isArray(config.locales) ? config.locales : []),
    config.fallbackLocale
  ].filter((value) => typeof value === 'string' && value);

  const dictionaries = {};
  for (const locale of [...new Set(declared)]) {
    const base = path.join(projectRoot, folderDeployed, folder);
    const file = path.join(base, `${locale}.json`);
    let messages = null;
    if (fs.existsSync(file)) {
      try {
        messages = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (error) {
        throw new Error(`seo: invalid translator dictionary ${locale}.json: ${error.message}`);
      }
    }
    // Namespaced dictionaries (`<path>/<locale>/<ns>.json`, loaded by translator.load())
    // are part of the same locale; the browser merges them under the file name.
    const namespaceDir = path.join(base, locale);
    if (fs.existsSync(namespaceDir) && fs.statSync(namespaceDir).isDirectory()) {
      messages = messages && typeof messages === 'object' ? messages : {};
      for (const name of fs.readdirSync(namespaceDir)) {
        if (!name.endsWith('.json')) continue;
        const namespace = name.slice(0, -5);
        try {
          messages[namespace] = JSON.parse(fs.readFileSync(path.join(namespaceDir, name), 'utf8'));
        } catch (error) {
          throw new Error(`seo: invalid translator dictionary ${locale}/${name}: ${error.message}`);
        }
      }
    }
    if (messages) dictionaries[locale] = messages;
  }
  return dictionaries;
}

/**
 * `{ t: 'key', params? }` → text. Anything else is returned untouched, so plain strings
 * keep working in every locale. Exported for the server, the CLI and the tests.
 */
export function resolveSeoText(value, translate) {
  if (value && typeof value === 'object' && typeof value.t === 'string') {
    return translate ? translate(value.t, value.params) : value.t;
  }
  return value;
}


/**
 * The most specific manifest entry for a path: an exact key first, then the
 * longest matching pattern, then nothing.
 */
export function pickRouteEntry(pathname, manifest) {
  const routes = manifest?.routes || {};
  if (Object.prototype.hasOwnProperty.call(routes, pathname)) {
    return { key: pathname, entry: routes[pathname], params: {} };
  }

  let best = null;
  for (const [key, entry] of Object.entries(routes)) {
    if (!isPattern(key)) continue;
    const params = matchPathPattern(key, pathname);
    if (!params) continue;
    if (!best || key.length > best.key.length) best = { key, entry, params };
  }
  return best;
}

const mergeDeep = (base, override) => {
  if (!override) return base;
  if (!base) return override;
  return {
    ...base,
    ...override,
    openGraph: { ...(base.openGraph || {}), ...(override.openGraph || {}) },
    twitter: { ...(base.twitter || {}), ...(override.twitter || {}) }
  };
};

const absolute = (value, origin) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

const IMAGE_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif'
};

/** `og:image:type` from the file extension, when it is a known one. */
const imageTypeFromUrl = (url) => {
  if (!url) return null;
  const extension = String(url).split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  return IMAGE_TYPES[extension] || null;
};

const robotsDirectives = (robots) => {
  if (robots === false) return 'noindex, nofollow';
  if (!robots || typeof robots !== 'object') return 'index, follow';
  const parts = [robots.index === false ? 'noindex' : 'index', robots.follow === false ? 'nofollow' : 'follow'];
  if (robots.noarchive) parts.push('noarchive');
  if (robots.nosnippet) parts.push('nosnippet');
  return parts.join(', ');
};

/**
 * Resolve one route's metadata: defaults -> manifest entry (literal or pattern)
 * -> inline `metadata` from routes.js (most specific, wins). With `translate`, every
 * documented text field may be `{ t: 'key', params? }` (translator feature 0003).
 */
export function resolveMetadata({ pathname, routeMetadata, manifest = {}, origin, translate = null, url = pathname, routerConfig = {} }) {
  const inline = routeMetadata && typeof routeMetadata === 'object' ? { ...routeMetadata } : null;
  // `titleKey` / `descriptionKey` are the shorthand for `{ t: 'key' }`; they win
  // over the literal `title` / `description`.
  if (inline) {
    if (typeof inline.titleKey === 'string' && inline.titleKey.trim()) {
      inline.title = { t: inline.titleKey.trim() };
    }
    if (typeof inline.descriptionKey === 'string' && inline.descriptionKey.trim()) {
      inline.description = { t: inline.descriptionKey.trim() };
    }
  }
  const text = (value) => resolveSeoText(value, translate);
  const defaultTitle = text(manifest.defaults?.title);
  const merged = mergeDeep(
    mergeDeep(manifest.defaults || {}, pickRouteEntry(pathname, manifest)?.entry),
    inline
  );

  // `titleKey` / `descriptionKey` may come from routes.js OR from a seo.json entry;
  // normalise the merged object so both work (the manifest path was previously ignored).
  if (typeof merged.titleKey === 'string' && merged.titleKey.trim()) merged.title = { t: merged.titleKey.trim() };
  if (typeof merged.descriptionKey === 'string' && merged.descriptionKey.trim()) {
    merged.description = { t: merged.descriptionKey.trim() };
  }

  // Always map `{ t }`: with no translate (translator off) the key is the honest output,
  // never "[object Object]".
  merged.title = text(merged.title);
  merged.titleTemplate = text(merged.titleTemplate);
  merged.description = text(merged.description);
  merged.imageAlt = text(merged.imageAlt);
  if (merged.openGraph) {
    merged.openGraph = {
      ...merged.openGraph,
      title: text(merged.openGraph.title),
      description: text(merged.openGraph.description),
      siteName: text(merged.openGraph.siteName)
    };
  }
  if (merged.twitter) {
    merged.twitter = {
      ...merged.twitter,
      title: text(merged.twitter.title),
      description: text(merged.twitter.description)
    };
  }

  const title = merged.title || defaultTitle || null;
  const template = merged.titleTemplate;
  const affix = (own, fallback) => (own === false ? '' : typeof own === 'string' ? own : typeof fallback === 'string' ? fallback : '');
  const prefix = affix(text(merged.titlePrefix), routerConfig?.titlePrefix);
  const suffix = affix(text(merged.titleSuffix), routerConfig?.titleSuffix);
  const finalTitle = title
    ? (template && template !== '%s' ? template.replace('%s', title) : `${prefix}${title}${suffix}`)
    : null;

  const canonical = merged.canonical
    ? absolute(merged.canonical, origin)
    : `${origin}${url === '/' ? '/' : url}`;

  const image = absolute(merged.image ?? merged.openGraph?.image ?? merged.openGraph?.images?.[0]?.url, origin);

  return {
    title: finalTitle,
    description: merged.description ?? null,
    canonical,
    robots: robotsDirectives(merged.robots),
    indexable: !(merged.robots === false || merged.robots?.index === false),
    image,
    imageAlt: merged.imageAlt ?? merged.openGraph?.images?.[0]?.alt ?? finalTitle,
    imageWidth: merged.imageWidth ?? merged.openGraph?.images?.[0]?.width ?? null,
    imageHeight: merged.imageHeight ?? merged.openGraph?.images?.[0]?.height ?? null,
    imageType: merged.imageType ?? imageTypeFromUrl(image),
    openGraph: merged.openGraph || {},
    twitter: merged.twitter || {},
    jsonLd: merged.jsonLd ?? null,
    sitemap: merged.sitemap !== false
  };
}

/** JSON-LD must never close its own script tag. */
export function serializeJsonLd(list) {
  const entries = Array.isArray(list) ? list : list ? [list] : [];
  return entries
    .map((entry) => JSON.stringify({ '@context': 'https://schema.org', ...entry }).replace(/</g, '\\u003c'))
    .map((json) => `<script type="application/ld+json">${json}</script>`)
    .join('\n');
}

/** The `<head>` block for one route. Pure: no shell, no injection. */
export function renderHead(meta, { siteName = null, locale = null, alternates = null } = {}) {
  const tags = [];
  if (meta.title) tags.push(`<title>${escapeHtml(meta.title)}</title>`);
  if (meta.description) tags.push(`<meta name="description" content="${escapeHtml(meta.description)}" />`);
  if (meta.canonical) tags.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`);
  if (Array.isArray(alternates)) {
    for (const alternate of alternates) {
      if (!alternate?.href || !alternate?.hreflang) continue;
      tags.push(`<link rel="alternate" hreflang="${escapeHtml(alternate.hreflang)}" href="${escapeHtml(alternate.href)}" />`);
    }
  }
  tags.push(`<meta name="robots" content="${escapeHtml(meta.robots)}" />`);

  const openGraph = meta.openGraph || {};
  const twitter = meta.twitter || {};
  const ogType = openGraph.type || 'website';
  const ogTitle = openGraph.title || meta.title;
  const ogDescription = openGraph.description || meta.description;

  tags.push(`<meta property="og:type" content="${escapeHtml(ogType)}" />`);
  if (ogTitle) tags.push(`<meta property="og:title" content="${escapeHtml(ogTitle)}" />`);
  if (ogDescription) tags.push(`<meta property="og:description" content="${escapeHtml(ogDescription)}" />`);
  if (meta.canonical) tags.push(`<meta property="og:url" content="${escapeHtml(meta.canonical)}" />`);
  const ogSiteName = openGraph.siteName || siteName;
  if (ogSiteName) tags.push(`<meta property="og:site_name" content="${escapeHtml(ogSiteName)}" />`);
  const ogLocale = openGraph.locale || locale;
  if (ogLocale) tags.push(`<meta property="og:locale" content="${escapeHtml(ogLocale)}" />`);
  if (meta.image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(meta.image)}" />`);
    if (meta.imageWidth) tags.push(`<meta property="og:image:width" content="${escapeHtml(meta.imageWidth)}" />`);
    if (meta.imageHeight) tags.push(`<meta property="og:image:height" content="${escapeHtml(meta.imageHeight)}" />`);
    if (meta.imageType) tags.push(`<meta property="og:image:type" content="${escapeHtml(meta.imageType)}" />`);
    if (meta.imageAlt) tags.push(`<meta property="og:image:alt" content="${escapeHtml(meta.imageAlt)}" />`);
  }

  const card = twitter.card
    || (meta.image ? 'summary_large_image' : 'summary');
  tags.push(`<meta name="twitter:card" content="${escapeHtml(card)}" />`);
  if (twitter.site) tags.push(`<meta name="twitter:site" content="${escapeHtml(twitter.site)}" />`);
  if (twitter.creator) tags.push(`<meta name="twitter:creator" content="${escapeHtml(twitter.creator)}" />`);
  if (ogTitle) tags.push(`<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`);
  if (ogDescription) tags.push(`<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`);
  if (meta.image) tags.push(`<meta name="twitter:image" content="${escapeHtml(meta.image)}" />`);

  const jsonLd = meta.jsonLd ? serializeJsonLd(meta.jsonLd) : '';
  return [...tags, jsonLd].filter(Boolean).join('\n    ');
}

// Everything this module owns in the `<head>`. Removed before inserting, so the
// shell's generic tags can never survive next to a route's own.
const OWNED_HEAD = [
  /<title>[^<]*<\/title>/i,
  /<meta\s+name="description"[^>]*?\/?>/gi,
  /<link\s+rel="canonical"[^>]*?\/?>/gi,
  /<meta\s+property="og:[^"]*"[^>]*?\/?>/gi,
  /<meta\s+name="twitter:[^"]*"[^>]*?\/?>/gi,
  /<meta\s+name="robots"[^>]*?\/?>/gi,
  /<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi
];

/** Replace `<html lang|dir>` (or add them) in a shell. No-op when both are null. */
export function setDocumentLanguage(html, { lang = null, dir = null } = {}) {
  if (!lang && !dir) return String(html);
  return String(html).replace(/<html\b([^>]*)>/i, (match, attributes) => {
    let next = attributes;
    if (lang) {
      next = /\slang="/i.test(next)
        ? next.replace(/\slang="[^"]*"/i, ` lang="${lang}"`)
        : `${next} lang="${lang}"`;
    }
    if (dir) {
      next = /\sdir="/i.test(next)
        ? next.replace(/\sdir="[^"]*"/i, ` dir="${dir}"`)
        : `${next} dir="${dir}"`;
    }
    return `<html${next}>`;
  });
}

/** Replace this module's tags in a shell with the route's own block. */
export function injectHead(html, headTags, options = {}) {
  let output = setDocumentLanguage(html, options);
  for (const pattern of OWNED_HEAD) output = output.replace(pattern, '');
  const block = `    ${headTags}\n  `;
  if (/<\/head>/i.test(output)) return output.replace(/<\/head>/i, `${block}</head>`);
  return `${output}\n${block}`;
}

const xmlEscape = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

/**
 * `sitemap.xml` from the manifest. Only literal routes that are indexable and
 * not explicitly excluded: a `${param}` pattern cannot be enumerated.
 *
 * With a translator context and `localePrefix`, every route appears once per locale and
 * each `<url>` carries the `xhtml:link` alternates (plus `x-default`), so the
 * sitemap and the `hreflang` in the head cannot disagree.
 */
export function buildSitemap({ manifest, origin, translator = null }) {
  const base = normalizeOrigin(origin);
  if (!base) throw new Error('seo: buildSitemap needs an absolute origin');

  const active = translator?.enabled ? translator : null;
  // Without a locale prefix the URL does not identify a locale, so the sitemap has one
  // URL per route (the default locale) and no alternates.
  const locales = active
    ? (active.localePrefix ? active.locales : [active.defaultLocale])
    : [null];
  const urls = [];

  for (const [key, entry] of Object.entries(manifest?.routes || {})) {
    if (isPattern(key)) continue;
    if (entry?.sitemap === false) continue;
    if (entry?.robots === false || entry?.robots?.index === false) continue;
    if (entry?.noindex) continue;

    const paths = locales.map((locale) => (active ? active.localize(key, locale) : key));
    const alternates = active?.localePrefix && locales.length > 1
      ? locales
        .map((locale, index) => ({
          hreflang: locale,
          href: `${base}${paths[index] === '/' ? '/' : paths[index]}`
        }))
        .concat([{
          hreflang: 'x-default',
          href: `${base}${active.localize(key, active.defaultLocale)}`
        }])
      : [];

    const sitemap = entry?.sitemap && typeof entry.sitemap === 'object' ? entry.sitemap : {};
    const lastmod = sitemap.lastmod || entry?.lastmod;
    const changefreq = sitemap.changefreq || entry?.changefreq;
    const priority = sitemap.priority || entry?.priority;

    for (const pathname of paths) {
      const loc = `${base}${pathname === '/' ? '/' : pathname}`;
      // One field per line: a <lastmod> update is a one-line diff in review.
      const block = [
        '  <url>',
        `    <loc>${xmlEscape(loc)}</loc>`,
        ...alternates.map((alternate) =>
          `    <xhtml:link rel="alternate" hreflang="${xmlEscape(alternate.hreflang)}" href="${xmlEscape(alternate.href)}" />`),
        lastmod ? `    <lastmod>${xmlEscape(lastmod)}</lastmod>` : '',
        changefreq ? `    <changefreq>${xmlEscape(changefreq)}</changefreq>` : '',
        priority ? `    <priority>${xmlEscape(priority)}</priority>` : '',
        '  </url>'
      ].filter(Boolean);
      urls.push({ loc, body: block.join('\n') });
    }
  }

  urls.sort((a, b) => a.loc.localeCompare(b.loc));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${active ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : ''}>`,
    ...urls.map((url) => url.body),
    '</urlset>',
    ''
  ].join('\n');
}

/** Route paths from `routes.js`, normalised (leading slash, no trailing slash). */
export function routePaths(routes) {
  const list = Array.isArray(routes) ? routes : [];
  const normalize = (base, value) => {
    const merged = `${base || ''}${value || ''}`.replace(/\/+/g, '/');
    return merged.length > 1 ? merged.replace(/\/+$/, '') || '/' : '/';
  };
  const paths = [];
  const walk = (entries, base = '') => {
    for (const route of Array.isArray(entries) ? entries : []) {
      if (typeof route === 'string') {
        paths.push(normalize(base, route));
        continue;
      }
      const full = normalize(base, route?.path);
      if (route?.path) paths.push(full);
      if (Array.isArray(route?.children)) walk(route.children, full);
    }
  };
  walk(list);
  return paths;
}

/**
 * The one validator: `slice seo check` and `slice doctor` both call this, so
 * they cannot disagree. `fileExists` is injectable to keep it unit-testable.
 */
export function validateSeoManifest(manifest, options = {}) {
  const {
    routes = null,
    fileExists = (file) => fs.existsSync(file),
    publicDir = null,
    titleLimit = DEFAULT_TITLE_LIMIT,
    descriptionLimit = DEFAULT_DESCRIPTION_LIMIT,
    translator = null
  } = options;

  const errors = [];
  const warnings = [];
  const add = (list, message) => list.push(message);

  /** `{ t: 'key' }` references in the fields a translator may fill. */
  const keyRefsOf = (entry, where) => {
    const refs = [];
    const scan = (value, field) => {
      if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.t === 'string') {
        refs.push({ key: value.t, where: `${where}.${field}` });
      }
    };
    for (const field of ['title', 'titleTemplate', 'description', 'imageAlt']) scan(entry?.[field], field);
    for (const field of ['titleKey', 'descriptionKey']) {
      if (typeof entry?.[field] === 'string' && entry[field].trim()) {
        refs.push({ key: entry[field].trim(), where: `${where}.${field}` });
      }
    }
    for (const group of ['openGraph', 'twitter']) {
      for (const field of ['title', 'description', 'siteName']) scan(entry?.[group]?.[field], `${group}.${field}`);
    }
    return refs;
  };

  /**
   * A `{ t }` key missing in one locale would ship the key as a title, so it blocks.
   * The browser resolves the same way (locale → fallback → key).
   */
  const checkTranslations = (entry, where) => {
    if (!translator?.enabled) return;
    const refs = keyRefsOf(entry, where);
    if (!refs.length) return;
    for (const locale of translator.locales) {
      for (const ref of refs) {
        if (!translator.has(locale, ref.key)) {
          add(errors, `missing translation "${ref.key}" for "${locale}" (${ref.where})`);
        }
      }
    }
  };

  if (!manifest || typeof manifest !== 'object') {
    return { errors: ['manifest is not an object'], warnings };
  }
  if (manifest.version !== SEO_VERSION) {
    add(errors, `unsupported version ${JSON.stringify(manifest.version)} (expected ${SEO_VERSION})`);
  }
  if (!manifest.origin) {
    add(errors, 'origin is required');
  } else if (!normalizeOrigin(manifest.origin)) {
    add(errors, `origin must be an absolute http(s) URL without a path: ${JSON.stringify(manifest.origin)}`);
  } else if (manifest.origin !== normalizeOrigin(manifest.origin)) {
    add(errors, 'origin must not end with a slash');
  }
  if (manifest.origin && /localhost|127\.0\.0\.1|0\.0\.0\.0|\.local\b/i.test(manifest.origin)) {
    add(warnings, 'origin points at localhost; canonical and og:url will leak it after deploy');
  }

  const seen = new Map();
  checkTranslations(manifest.defaults, 'defaults');
  for (const [key, entry] of Object.entries(manifest.routes || {})) {
    if (!key.startsWith('/')) add(errors, `route key must start with "/": ${key}`);
    if (key.length > 1 && key.endsWith('/')) add(errors, `route key must not end with "/": ${key}`);
    if (seen.has(key)) add(errors, `duplicate route key: ${key}`);
    seen.set(key, true);
    if (!entry || typeof entry !== 'object') {
      add(errors, `route entry must be an object: ${key}`);
      continue;
    }

    checkTranslations(entry, key);

    if (typeof entry.title === 'string' && entry.title.length > titleLimit) {
      add(warnings, `title longer than ${titleLimit} chars: ${key}`);
    }
    if (typeof entry.description === 'string' && entry.description.length > descriptionLimit) {
      add(warnings, `description longer than ${descriptionLimit} chars: ${key}`);
    }

    const image = entry.image;
    if (typeof image === 'string' && !/^https?:\/\//i.test(image)) {
      if (publicDir && !fileExists(path.join(publicDir, image.replace(/^\//, '')))) {
        add(errors, `image not found in public/: ${image} (${key})`);
      }
    }

    const robots = entry.robots;
    const indexable = !(robots === false || robots?.index === false);
    if (indexable && entry.sitemap === false) {
      add(warnings, `indexable page excluded from the sitemap: ${key}`);
    }
  }

  if (routes) {
    for (const route of routePaths(routes)) {
      const covered = Object.keys(manifest.routes || {}).some((key) =>
        key === route || (isPattern(key) && matchPathPattern(key, route.replace(/\$\{[^}]+\}/g, 'x')))
      );
      if (!covered) add(warnings, `route has no metadata: ${route}`);
    }

    for (const key of Object.keys(manifest.routes || {})) {
      const matches = routePaths(routes).some((route) =>
        route === key || (isPattern(key) && matchPathPattern(key, route.replace(/\$\{[^}]+\}/g, 'x')))
      );
      if (!matches) add(warnings, `metadata entry has no route: ${key}`);
    }

    // The client applies `routes.js` metadata on every navigation (the Router's
    // `updateTitles`, on by default). If that title differs from what the server
    // sends for the same path, the tab title changes after hydration — and a
    // crawler that runs JS sees the shorter one. Catch it here, not in production.
    const origin = normalizeOrigin(manifest.origin) || '';
    const translate = translator?.enabled
      ? (key, params) => translator.t(translator.defaultLocale, key, params)
      : null;
    for (const route of (Array.isArray(routes) ? routes : [])) {
      const pathname = typeof route === 'string' ? route : route?.path;
      const metadata = typeof route === 'object' ? route?.metadata : null;
      if (!pathname || !metadata) continue;
      checkTranslations(metadata, `routes.js ${pathname}`);
      if (!metadata.title && !metadata.titleKey) continue;
      if (metadata.title && typeof metadata.title !== 'string') continue;
      // A missing titleKey is already an error; comparing it to seo.json would only add noise.
      if (metadata.titleKey && translator?.enabled && !translator.has(translator.defaultLocale, metadata.titleKey)) continue;
      const served = resolveMetadata({ pathname, manifest, origin, translate });
      const client = resolveMetadata({ pathname, manifest: {}, origin, routeMetadata: metadata, translate });
      if (served.title && client.title && served.title !== client.title) {
        add(
          warnings,
          `route title differs from seo.json: ${pathname} ("${client.title}" vs "${served.title}")`
        );
      }
    }
  }

  return { errors, warnings };
}

/** Read `seo.json` (or a JS module exporting the same object). */
export function loadSeoManifest(file) {
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) return null;
  if (/\.(c|m)?js$/i.test(resolved)) {
    // Caller must import it: this module stays synchronous for the build path.
    throw new Error(`seo: use import() for JS manifests: ${resolved}`);
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}
