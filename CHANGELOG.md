# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.1.0] - 2026-10-28

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
