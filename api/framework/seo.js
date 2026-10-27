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
 * -> inline `metadata` from routes.js (most specific, wins).
 */
export function resolveMetadata({ pathname, routeMetadata, manifest = {}, origin }) {
  const merged = mergeDeep(
    mergeDeep(manifest.defaults || {}, pickRouteEntry(pathname, manifest)?.entry),
    routeMetadata
  );

  const title = merged.title ?? null;
  const template = merged.titleTemplate;
  const finalTitle = title && template && template !== '%s' ? template.replace('%s', title) : title;

  const canonical = merged.canonical
    ? absolute(merged.canonical, origin)
    : `${origin}${pathname === '/' ? '/' : pathname}`;

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
export function renderHead(meta, { siteName = null, locale = null } = {}) {
  const tags = [];
  if (meta.title) tags.push(`<title>${escapeHtml(meta.title)}</title>`);
  if (meta.description) tags.push(`<meta name="description" content="${escapeHtml(meta.description)}" />`);
  if (meta.canonical) tags.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`);
  tags.push(`<meta name="robots" content="${escapeHtml(meta.robots)}" />`);

  const ogType = meta.openGraph.type || 'website';
  const ogTitle = meta.openGraph.title || meta.title;
  const ogDescription = meta.openGraph.description || meta.description;

  tags.push(`<meta property="og:type" content="${escapeHtml(ogType)}" />`);
  if (ogTitle) tags.push(`<meta property="og:title" content="${escapeHtml(ogTitle)}" />`);
  if (ogDescription) tags.push(`<meta property="og:description" content="${escapeHtml(ogDescription)}" />`);
  if (meta.canonical) tags.push(`<meta property="og:url" content="${escapeHtml(meta.canonical)}" />`);
  const ogSiteName = meta.openGraph.siteName || siteName;
  if (ogSiteName) tags.push(`<meta property="og:site_name" content="${escapeHtml(ogSiteName)}" />`);
  const ogLocale = meta.openGraph.locale || locale;
  if (ogLocale) tags.push(`<meta property="og:locale" content="${escapeHtml(ogLocale)}" />`);
  if (meta.image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(meta.image)}" />`);
    if (meta.imageWidth) tags.push(`<meta property="og:image:width" content="${escapeHtml(meta.imageWidth)}" />`);
    if (meta.imageHeight) tags.push(`<meta property="og:image:height" content="${escapeHtml(meta.imageHeight)}" />`);
    if (meta.imageType) tags.push(`<meta property="og:image:type" content="${escapeHtml(meta.imageType)}" />`);
    if (meta.imageAlt) tags.push(`<meta property="og:image:alt" content="${escapeHtml(meta.imageAlt)}" />`);
  }

  const card = meta.twitter.card
    || (meta.image ? 'summary_large_image' : 'summary');
  tags.push(`<meta name="twitter:card" content="${escapeHtml(card)}" />`);
  if (meta.twitter.site) tags.push(`<meta name="twitter:site" content="${escapeHtml(meta.twitter.site)}" />`);
  if (meta.twitter.creator) tags.push(`<meta name="twitter:creator" content="${escapeHtml(meta.twitter.creator)}" />`);
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

/** Replace this module's tags in a shell with the route's own block. */
export function injectHead(html, headTags) {
  let output = String(html);
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
 */
export function buildSitemap({ manifest, origin }) {
  const base = normalizeOrigin(origin);
  if (!base) throw new Error('seo: buildSitemap needs an absolute origin');

  const urls = [];
  for (const [key, entry] of Object.entries(manifest?.routes || {})) {
    if (isPattern(key)) continue;
    if (entry?.sitemap === false) continue;
    if (entry?.robots === false || entry?.robots?.index === false) continue;
    if (entry?.noindex) continue;

    const loc = `${base}${key === '/' ? '/' : key}`;
    const parts = [`<loc>${xmlEscape(loc)}</loc>`];
    if (entry?.sitemap?.lastmod || entry?.lastmod) {
      parts.push(`<lastmod>${xmlEscape(entry.sitemap?.lastmod || entry.lastmod)}</lastmod>`);
    }
    if (entry?.sitemap?.changefreq || entry?.changefreq) {
      parts.push(`<changefreq>${xmlEscape(entry.sitemap?.changefreq || entry.changefreq)}</changefreq>`);
    }
    if (entry?.sitemap?.priority || entry?.priority) {
      parts.push(`<priority>${xmlEscape(entry.sitemap?.priority || entry.priority)}</priority>`);
    }
    urls.push({ loc, body: `  <url>${parts.join('')}</url>` });
  }

  urls.sort((a, b) => a.loc.localeCompare(b.loc));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => url.body),
    '</urlset>',
    ''
  ].join('\n');
}

/** Route paths from `routes.js`, normalised (leading slash, no trailing slash). */
export function routePaths(routes) {
  const list = Array.isArray(routes) ? routes : [];
  return list
    .map((route) => (typeof route === 'string' ? route : route?.path))
    .filter(Boolean)
    .map((value) => String(value).replace(/\/+$/, '') || '/');
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
    descriptionLimit = DEFAULT_DESCRIPTION_LIMIT
  } = options;

  const errors = [];
  const warnings = [];
  const add = (list, message) => list.push(message);

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
  for (const [key, entry] of Object.entries(manifest.routes || {})) {
    if (!key.startsWith('/')) add(errors, `route key must start with "/": ${key}`);
    if (key.length > 1 && key.endsWith('/')) add(errors, `route key must not end with "/": ${key}`);
    if (seen.has(key)) add(errors, `duplicate route key: ${key}`);
    seen.set(key, true);
    if (!entry || typeof entry !== 'object') {
      add(errors, `route entry must be an object: ${key}`);
      continue;
    }

    if (entry.title && String(entry.title).length > titleLimit) {
      add(warnings, `title longer than ${titleLimit} chars: ${key}`);
    }
    if (entry.description && String(entry.description).length > descriptionLimit) {
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
    for (const route of (Array.isArray(routes) ? routes : [])) {
      const pathname = typeof route === 'string' ? route : route?.path;
      const metadata = typeof route === 'object' ? route?.metadata : null;
      if (!pathname || !metadata?.title) continue;
      const served = resolveMetadata({ pathname, manifest, origin });
      const client = resolveMetadata({ pathname, manifest: {}, origin, routeMetadata: metadata });
      if (served.title && client.title && served.title !== client.title) {
        add(
          warnings,
          `route title differs from seo.json: ${pathname} ("${metadata.title}" vs "${served.title}")`
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
