# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.2.0] - 2026-10-29

### Added

- `slice.t.list(key, params?)` reads a dictionary array for the active locale (string items are
  formatted, records are returned as-is); `slice.t.ref.list()` is the prop marker and refreshes the
  whole array on a locale change. Missing or non-array values return `[]` with one warning.
- `slice.t.content(name)` loads `<translator.path>/content/<name>.json` once and resolves every
  `copy: { en, es }` branch for the active locale, flattening nested nodes. `slice.t.localized(value)`
  is the primitive for a one-off localized value.
- Content documents are served from `src/locales/content/` in development and `dist/locales/content/`
  in production, and `api/framework/content.js` exposes `readContent()` / `resolveContentFor()` for
  server-side SEO.
- `slice translator check` validates `t.list` keys, `t.content` document names and each content
  `copy` (every locale present, same shape, no empty strings); the doctor Translator row uses the
  same scan.
- SEO: a `${param}` route can declare `sitemap.paths` (strings or parameter objects); `buildSitemap`
  expands every value into one URL per locale with alternates, and the validator rejects a value
  missing one of the pattern's parameters.

## [4.1.1] - 2026-10-28

### Added

- `api/framework/seo.js`, exported as `slicejs-web-framework/api/framework/seo.js`: per-route
  metadata, `<head>` tags, canonical URLs, JSON-LD and sitemap generation, with a separate image
  manifest that the server merges.
- The fallback serves prerendered per-route HTML: each indexable route gets its own `<head>`, and an
  unknown path answers 404 with `noindex, nofollow` instead of a 200 shell.
- The router keeps `document.title` in sync with the matched route metadata.
- `createSliceServer()` exposes the app before the terminal fallback, so middleware mounted between
  the factory and `start()` runs for every page route.
- `slice build --compress` support: `.br`/`.gz` siblings are served with `Content-Encoding` and
  `Vary: Accept-Encoding`, without re-compressing the response.

### Fixed

- Bundles served from a precompressed build had no `Cache-Control`. The precompressed handler runs
  before `/bundles/`, so unstale bundles fell back to heuristic caching; bundle URLs (including
  `bundle.config.json` and the `/dist/bundles/` mirror) are now always `no-store`.
- The dev-deps optimizer tests pass on Windows.

### Packaging

- The tarball no longer ships `api/framework/*.test.js`; `scripts/check-pack.mjs` now flags them.
