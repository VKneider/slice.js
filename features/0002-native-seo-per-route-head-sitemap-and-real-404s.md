---
id: "0002"
title: "Native SEO: per-route head, sitemap and real 404s"
repo: "slice.js"
status: done
area: framework
priority: medium
created: 2026-10-27
updated: 2026-10-27
target: "TBD"
owners: []
related:
  - "0001-composable-server-mount-middleware-before-the-spa-fallback.md"
  - "slicejs-components/SEO.md (the implementation this would absorb)"
  - "slicejs-components/parser/lib/seo.js (manifest + sitemap generator)"
---

# Native SEO: per-route head, sitemap and real 404s

## Summary

Every Slice app is a SPA: one `<head>` for every route, a soft 404 for unknown paths, no sitemap, and
per-route metadata only if the app re-implements it. Turn the work done in `slicejs-components` into
a framework module the app configures with a manifest and a handful of options — the app keeps
owning the *content*, the framework owns the *mechanics*.

## Problem / motivation

The five failures are identical in every project, and all five are invisible until someone shares a
link or opens Search Console:

| # | Symptom | Cause |
|---|---|---|
| 1 | Every URL previews the same title/canonical/OG | One static `<head>` in `App/index.html`; the client only fixes `document.title` after boot |
| 2 | Google indexes `/nope` | The SPA fallback answers `200` with the shell for any path |
| 3 | Every page declares the home as canonical | Nobody injects `rel=canonical` per route |
| 4 | No sitemap, or a hand-written one that drifts | Nothing derives it from the routes |
| 5 | JSON-LD is one static `WebSite` block | Same reason |

`slicejs-components` solved it by hand: a parser that emits `seo-manifest.json` + `sitemap.xml` from
markdown front matter, a server that prerenders all 74 routes with injected metadata (gzip + brotli +
ETag, `Map` lookup, ~0.8 ms per request), a real 404, and a client title map. That is ~400 lines
duplicated from the framework server, coupled to the docs parser, and unreachable for anyone else.

The mechanics are not app-specific. The *data* is.

## Proposed direction

A new opt-in module — `slicejs-web-framework/api/framework/seo.js` — so apps that do not import it pay
nothing.

### Manifest contract (v1)

**File name: `seo.json`** (or `seo.config.js` with a default export, when the app wants to compute it).
**Not** `manifest.json` — that name is taken by the PWA manifest in `public/`, and colliding with it
would be a support nightmare.

The shape follows the metadata APIs people already know (Next `metadata`, Nuxt/Unhead `useSeoMeta`,
Astro frontmatter): camelCase, `title`, `description`, `canonical`, `robots`, `openGraph`, `twitter`,
`jsonLd`. Where a concept has a de-facto name, that name wins over inventing one.

#### Smallest useful file

```json
{
  "origin": "https://myapp.com",
  "routes": {
    "/": { "title": "Home" },
    "/pricing": { "title": "Pricing", "description": "Plans and limits." }
  }
}
```

That already yields a per-route `<title>`, description, canonical, `og:url`, `og:title`,
`twitter:card`, a real `404` for anything else, and a sitemap with both URLs. Everything else is
derived.

#### Full example

```json
{
  "$schema": "https://slicejs.com/schemas/seo.v1.json",
  "version": 1,
  "origin": "https://components.slicejs.com",

  "defaults": {
    "titleTemplate": "%s | Slice.js Components",
    "title": "Slice.js Components",
    "description": "Official Slice.js Components library…",
    "siteName": "Slice.js Components",
    "locale": "en_US",
    "image": "/images/og-image.png",
    "twitter": { "card": "summary_large_image", "site": "@slicejs" }
  },

  "routes": {
    "/": { "titleTemplate": "%s" },

    "/docs/input/button": {
      "title": "Button",
      "description": "Action trigger with variants, sizes and icons.",
      "image": "/og/docs-input-button-ee62ff75d5.png",
      "imageAlt": "Button component",
      "canonical": "/docs/input/button",
      "robots": { "index": true, "follow": true },
      "sitemap": { "lastmod": "2026-10-22" },
      "openGraph": { "type": "article" },
      "jsonLd": [
        { "@type": "TechArticle", "headline": "Button" },
        { "@type": "BreadcrumbList", "itemListElement": [] }
      ]
    },

    "/__test": { "robots": false }
  },

  "sitemap": true,
  "robotsTxt": { "disallow": ["/__test", "/playground"] }
}
```

#### Fields

`origin` — absolute URL, no trailing slash. The base for `canonical`, `og:url`, `og:image` and the
sitemap. Same concept as Next's `metadataBase`, Astro's `site`. Required in production (a missing
origin is a startup error, not a silent relative URL); in development it falls back to
`http://localhost:<port>`. `SLICE_ORIGIN` overrides it for preview deploys — see the resolution order
and the localhost rules below.

| field | type | default | renders as |
|---|---|---|---|
| `version` | `1` | `1` | validated at startup; unknown version is a hard error |
| `defaults` | route entry | `{}` | inherited by every route |
| `routes` | `{ [path]: Entry }` | `{}` | one entry per real route (paths start with `/`, no trailing slash) |
| `Entry.title` | string | `defaults.title` or the app's static title | `<title>`, `og:title`, `twitter:title` |
| `Entry.titleTemplate` | string with `%s` | `defaults.titleTemplate` | `<title>`; `"%s"` opts out for that route |
| `Entry.description` | string | `defaults.description` | `<meta name="description">`, `og:description`, `twitter:description` |
| `Entry.canonical` | path or same-origin URL | `origin + path` | `<link rel="canonical">`, `og:url` |
| `Entry.image` | path or absolute https URL | `defaults.image` | `og:image`, `twitter:image`; see the local-vs-remote rules |
| `Entry.imageAlt` | string | `Entry.title` | `og:image:alt`, `twitter:image:alt` |
| `Entry.imageWidth` / `imageHeight` | number | read from a local file | `og:image:width/height`; required for remote images if you want them declared |
| `Entry.robots` | `false` or `{ index?, follow?, noarchive?, nosnippet? }` | `{ index: true, follow: true }` | `<meta name="robots">`; `false` ⇒ `noindex, nofollow` and the route leaves the sitemap |
| `Entry.sitemap` | `false` or `{ lastmod?, priority?, changefreq? }` | `true` for indexable routes | that `<url>` entry |
| `Entry.openGraph` | `{ type?, siteName?, locale?, images? }` | derived | overrides the short fields; same shape as Next's `openGraph` |
| `Entry.twitter` | `{ card?, site?, creator?, title?, description?, image? }` | derived from the image | the five `twitter:*` tags |
| `Entry.jsonLd` | object or array | none | one `<script type="application/ld+json">` per object; `@context` added if missing |
| `sitemap` | boolean | `true` | `/sitemap.xml` generated at startup |
| `robotsTxt` | `false` or `{ allow?, disallow?, sitemap? }` | `{ sitemap: true }` | `/robots.txt` |

Precedence, highest first: **`routes.js` inline `metadata`** (the code that defines the route knows its
params) → `routes[path]` → `defaults` → derived. Short fields (`image`, `title`) win over nested
`openGraph`/`twitter` only where the nested object is absent — the nested form is the explicit one.

#### Param routes (v1)

`routes` keys accept the router's `${param}` syntax. Matching: a literal key wins, then the longest
pattern. A pattern provides **static** metadata, and the canonical is always the real requested path.

```json
{
  "routes": {
    "/producto/${id}": {
      "title": "Producto",
      "description": "Ficha de producto.",
      "image": "/og/producto.png"
    }
  }
}
```

- `/producto/42` takes the pattern's title, description and image; its canonical is
  `origin + /producto/42`, never the pattern.
- A pattern cannot be enumerated, so it never enters `sitemap.xml`. A concrete list of URLs can be
  added later without changing the manifest shape.
- Per-instance metadata (a title built from the param) needs `metadata: (params) => …` in
  `routes.js`: **v2**. That is also why inline route metadata outranks the manifest.

#### Images: local path or remote URL

`image` (and `defaults.image`, and `openGraph.images[].url`) accepts either form:

| form | example | how it is resolved |
|---|---|---|
| local path | `/og/login-4f2a91c3d8.png` | `origin + path`; must exist under `public/` (checked offline) |
| absolute URL | `https://cdn.acme.com/og/login.png` | used as-is, https recommended; **not** fetched during checks |

Rules:

- Only absolute `http:`/`https:`. Protocol-relative (`//cdn/…`) and `data:` are rejected — OG consumers
  do not agree on them.
- **No expiring / signed URLs.** A CDN URL with `?X-Amz-Signature=…` or `?token=…` gets fetched once,
  cached by the platform, and is broken when it expires. Use a stable, publicly readable URL
  (content-hashed names are still preferred: previews cache per URL).
- **Dimensions cannot be read from a remote file**, so `og:image:width/height` is emitted only when
  declared (`imageWidth` / `imageHeight`, or `openGraph.images[0].width/height`) or when the image is
  local. Omitting them is valid — the crawler fetches the file — but declaring them avoids a layout
  reflow in some clients.
- The CDN must allow crawler fetches. Cloudflare bot protection or hotlink rules break every preview
  silently, and nothing in the app can detect it.
- Offline checks verify local files only; a remote URL is reported as *not verified*, never as
  passed. `--check-remote` (HEAD requests) stays an opt-in flag so CI has no network dependency.

#### Example: an auth route

The route definition is the right place for one-off metadata — it is where the `robots` decision
belongs, and it wins over `seo.json`:

```js
// src/routes.js
export default [
  {
    path: '/login',
    component: 'LoginPage',
    metadata: {
      title: 'Sign in',
      description: 'Sign in to your workspace.',
      image: '/og/login-4f2a91c3d8.png',
      imageAlt: 'Sign in to Acme',
      robots: false            // never indexed, never in the sitemap
    }
  },
  { path: '/dashboard', component: 'Dashboard', metadata: { title: 'Dashboard', robots: false } }
];
```

`api/index.js` does **not** carry the image — it only wires the module:

```js
const { app, start } = createSliceServer({ seo: { manifest: './seo.json' } });
app.use(authGate);          // before the terminal: session checks, redirects
await start({ port: 3001 });
```

Four things this example pins down:

1. **The server does not authenticate.** `/dashboard` still returns its prerendered shell to anyone
   who asks; `robots: false` keeps it out of indexes, it is not access control. Real gating is your
   middleware *before* the terminal (feature 0001), and it must answer with `no-store` +
   `Vary: Cookie`, because that response is per-user.
2. **Query strings are not part of identity.** `/login?next=/dashboard` and `/login` share the
   canonical `/login`; otherwise every redirect target becomes a duplicate URL. Same for `#hash`.
3. **A login page is a policy decision.** `robots: false` is the safe default for app routes; keep it
   indexable only when the page is a marketing surface.
4. **The image is content, not wiring.** It lives with the route (`metadata.image` or `seo.json`), must
   exist under `public/` (the static mount serves it), and the module only turns it into an absolute
   `og:image` + `twitter:image` with `alt`.

#### `origin` in development, previews and behind a proxy

Canonical and `og:url` are absolute, and the prerender cache is built **once at startup**, so the
origin is a **startup value, never per-request**. Deriving it from `req.headers.host` would (a) need
one cache entry per host, (b) be wrong behind a TLS-terminating proxy where `req.protocol` is `http`
unless `trust proxy` is set, and (c) leak the LAN IP when you test on a phone.

Resolution order, resolved once at startup:

1. `SLICE_ORIGIN` (env) — preview deploys and CI.
2. `createSliceServer({ seo: { origin } })` — runtime override.
3. `seo.json` → `origin`.
4. **Development only:** `http://localhost:<port>` (from `--port` / `sliceConfig.server.port`), logged
   as a fallback.
5. Otherwise: **startup error**, naming the env var in the message.

Consequences worth stating:

- **Dev is honest.** The metadata you inspect at `localhost` is what the route would ship, with
  `localhost` in place of the domain — so you can see a broken canonical before deploying.
- **Localhost never reaches a crawler.** The dev fallback is never written to disk; if the build-time
  sitemap export lands, `build` must refuse a localhost origin.
- **One canonical origin, always.** Apex vs `www` is a redirect decision for the app; two origins
  would produce duplicate canonicals, and the module cannot guess which one is real.
- **Previews.** Set `SLICE_ORIGIN` to the platform URL (`RENDER_EXTERNAL_URL`, `VERCEL_URL`); the
  preview then advertises its own canonical and OG image instead of production's.
- **Multi-tenant (one server, many domains) is out of scope**: it needs per-host prerender variants,
  a different cache shape.

#### Adoption check: `slice doctor`

`slice doctor` gains an `SEO` row that answers "is this configured, and is it safe to deploy?" —
see `slicejs-cli/features/0001`. It consumes the **same** `validateSeoManifest()` exported by this
module, so the rules cannot drift between `slice doctor` (local, friendly) and `slice seo check`
(CI, strict, exit code 1).

#### Mapping to what people already use

| concept | Next.js | Nuxt / Unhead | Astro | Slice |
|---|---|---|---|---|
| site URL | `metadataBase` | `site.url` | `site` | `origin` |
| title | `title` (string or `{ template }`) | `title` / `titleTemplate` | `title` | `title` + `titleTemplate: "%s | Site"` |
| canonical | `alternates.canonical` | `link rel=canonical` | `canonicalURL` | `canonical` |
| robots | `robots` | `robots` | — | `robots` |
| social | `openGraph` / `twitter` | `ogTitle`, `ogImage`… | `openGraph` | `image` shorthand + `openGraph` / `twitter` |
| structured data | `<script type=ld+json>` | `useHead` | inline `<script>` | `jsonLd` |

#### Validation (`slice seo check`, plus a dev-time warning)

- `version` unknown, `origin` missing in production, path keys that are not `/`-prefixed, duplicate
  keys after normalisation ⇒ error.
- A `routes.js` route with no manifest entry ⇒ warning in dev, error in `seo check`.
- A manifest entry with no route ⇒ error in `seo check` (the entry would advertise a 404 URL).
- A local `image` that does not exist on disk ⇒ error in `seo check`.
- A remote `image` ⇒ "not verified" (never a pass). `http:` in production, or a signed/expiring query
  (`?X-Amz-Signature=`, `?token=`, `?expires=`) ⇒ warning; `data:` or protocol-relative ⇒ error.
- `title` > 60 chars or `description` > 160 ⇒ warning (soft limits, configurable).
- `robots.index !== false` but `sitemap: false` ⇒ warning (a page you want indexed but not listed).


### Server

```js
const { app, start } = createSliceServer({
  seo: {
    manifest: './seo.json',                    // or an inline object with the same shape
    origin: process.env.SLICE_ORIGIN,          // optional override, for preview deploys
    maxPrerenderedRoutes: 500                  // guard rail, see risk
  }
});

await start({ port: 3001 });                   // mounts the terminal, then listens
```

`start()` mounts the SEO-aware fallback last (feature 0001). Apps with no `start()` — serverless
exports, supertest — mount it by hand: `app.use(sliceFallback({ seo: { manifest: './seo.json' } }))`.

At startup, once: read **two** sources — `routes.js` (the route set, the only answer to "is this
path a page?") and `seo.json` (the metadata for each one) — then render each route's HTML (shell +
`<title>`, description, canonical, `og:*`, `twitter:*`, robots, JSON-LD) → gzip + brotli + ETag →
`Map`. A request is a lookup, an `If-None-Match` check and one write, exactly like the pages the
framework already serves (the precompute rule in `slicejs-components/AGENTS.md`).

- Known route → `200`, its own head, its own canonical.
- Unknown path → **the same shell with `404`** and no fabricated canonical (this is what removes the
  soft 404; the client router already renders its own NotFound).
- `robots: false` → `200` + `noindex`.
- `/sitemap.xml` and `/robots.txt` are **build artifacts committed to `public/`**: `slice seo
  sitemap` writes them from the manifest (only indexable routes, sorted, escaped, `lastmod` from the
  manifest), the build runs it, and the server serves the files statically. Nothing is generated at
  startup and nothing can drift into a 404: `slice seo check` compares the committed file against the
  manifest and fails on any difference (same pattern as the docs repo's sitemap guard). The command
  never overwrites silently — see the file-writing rule in `slicejs-cli/features/0002`.
- Escaping is part of the contract: `&`, `<`, `>`, `"` in a title must not break the `<head>` (the
  first implementation shipped an `escapeHtml` that replaced every entity with itself).

### Client

Route entries accept `metadata`, and the Router applies it to the head by default:

```js
// src/routes.js
{ path: '/pricing', component: 'Pricing', metadata: { title: 'Pricing', description: 'Plans.' } }
```

```json
// src/sliceConfig.json  (only to opt out)
{ "router": { "updateTitles": false } }
```

Why on by default, and what keeps it safe:

- **A SPA that keeps the first page's title is broken in every app**, and the failure is invisible
  until someone shares a link or reads a tab. Making it opt-in means most apps never get it.
- **Only what the route declares** is touched. No `metadata.title` → the server's title survives.
- **`canonical` and `robots` are never written client-side**: crawlers do not run this code, so
  rewriting them here could only desync the SPA from the HTML that was served.
- **A `router:change` listener still wins**, because `handleRoute` applies the metadata before the
  event: metadata is the default, the listener is the escape hatch.
- **The one real risk is caught, not hidden**: if `routes.js` and `seo.json` disagree on a title, the
  client would replace the richer server title after hydration. `validateSeoManifest()` (used by
  `slice seo check` and `slice doctor`) compares both and warns with the route and both values.
- **Guards are not the place for this.** `beforeEach` is for decisions (auth, redirects); it also runs
  for navigations that get cancelled or redirected, and it forces every app to re-implement the
  description and the template. The Router already sees every match.
- This replaces the `App._titleByRoute` map an app writes today (and the "title degrades to
  `Slice.js` after a client-side navigation" bug that comes with forgetting an entry).

### Drift guard

`slice seo check` (CLI) compares `routes.js` ↔ manifest ↔ sitemap and fails on: a route with no metadata,
a manifest entry with no route, a sitemap URL that answers non-200. Runs in the app's CI, not in
production.

## Alternatives considered

- **Keep it in the app, ship it as a template/copy-paste module**: rejected — that is today's state
  (a fork), and forks drift.
- **Parse markdown in the framework**: rejected. Content pipelines (front matter, git dates, a CMS)
  are app concerns; the framework should consume a manifest.
- **Generate the manifest inside the framework from `routes.js` only**: rejected as the primary path.
  It cannot know descriptions, sections, `lastmod` or JSON-LD, so every app would end up extending it
  anyway. inline `metadata` is a convenience for small apps; the manifest stays the contract.
- **Full SSR / prerender the article HTML**: out of scope here (see below), but this module is the
  natural base for it.

## Scope

### In scope

- `api/framework/seo.js`: manifest loader, **`validateSeoManifest()`** (exported: the single source of
  truth for `slice seo check` and `slice doctor`), head injector (pure, unit-testable), JSON-LD
  rendering, prerender cache (html/gzip/br/ETag), the 200/404/noindex decision, sitemap + robots
  builder, origin resolution (`SLICE_ORIGIN` → option → file → dev localhost → error), and the JSON
  Schema that powers `$schema` autocomplete.
- Wiring into `sliceFallback({ seo })` (depends on feature 0001).
- Router: `metadata` on routes → `document.title`/description on navigation.
- `slice seo check` (strict, CI) and the `slice doctor` row (friendly, local) — both on the same
  validator.
- Docs + skill updates.

### Out of scope

- **Prerendering the article body** (the real SEO ceiling: a crawler without JS still sees an empty
  `#app`). Same reason as `SEO.md` §6 — it needs content HTML at build time plus hydration, and it is
  a separate feature.
- **Generating OG images.** They need a browser; the module only consumes `route.image`. The
  generator stays an app-side build step (see `slicejs-components/features/0001`).
- Markdown, front matter, git dates, CMS integrations.
- i18n / `hreflang` alternates (hook left in the manifest shape, not implemented).
- Static hosting: the module needs a server. Document it.

## Compatibility and risk

- Public API: new module + new `metadata` field on routes. Additive; apps that never mount `seo` behave
  exactly as today.
- **Manifest is public API**: version it (`version: 1`), reject unknown versions loudly at startup.
- **Opinionated JSON-LD**: ship defaults (`WebSite` for `/`, `BreadcrumbList` when the path has
  segments) but always allow a per-route `jsonLd` override, and document that search engines only
  need a handful of types.
- **Memory**: 74 routes ≈ 385 KB of prerendered buffers (measured). Above
  `maxPrerenderedRoutes` (default 500) the module must refuse to prerender and fall back to
  per-request injection with a small LRU — otherwise a 10 000-route app boots with hundreds of MB.
- **Dev freshness**: the manifest changes on `docs:generate`; in development the module must not
  cache it blindly (re-read on change or document a restart).
- **Wrong data, no error**: a manifest that drifts from `routes.js` silently breaks metadata — hence
  `slice seo check` in CI.
- Security: the head injector must escape everything it interpolates (the `&`/`<` bug above). It also
  must not let a manifest entry inject a `<script>` via JSON-LD: serialize with `JSON.stringify` and
  escape `<` as `\u003c`.

## Validation plan

- Unit tests (`api/framework/seo.test.js`, pure): head injection per field, escaping of `& < > "`,
  JSON-LD serialization with a `</script>` payload, `canonical` defaulting to `origin + path`,
  `robots: false` → noindex + excluded from the sitemap, `titleTemplate` with and without `%s`,
  `og:image:width/height` read from a local file, precedence (inline `metadata` > route > defaults),
  sitemap builder (sorted, escaped, `lastmod`), unknown manifest version rejected.
- Browser/e2e tests: `@server` spec asserting the RAW HTML (no JS) of two routes differs, an unknown
  path answers 404 with the shell, `/sitemap.xml` matches the manifest, repeated requests do no work
  (latency < 2 ms after warm-up).
- Product check (Conclave): mount it in its `api/index.js`; its `/p/${id}` style routes with a dynamic
  manifest is the interesting case.
- Artifact/release check: the dependency graph — importing `api/framework/seo.js` must not pull the
  browser runtime into the server bundle (and vice versa).

## Documentation impact

- Framework docs pages: new `markdown/project-architecture/server-entrypoint.md` section (or a
  dedicated `seo.md`); `slice-config.md` if the options move to config; mention `metadata` in
  `getting-started/routing.md`.
- Component docs: none.
- Skill / agent guidance: yes — "a SPA needs a per-route head; use the `seo` module, do not hand-roll
  a fallback" is exactly the kind of trap the skill exists for.
- Workspace docs: `docs/DOCUMENTATION.md` mapping gains the SEO page.

## Open questions

- [x] Manifest path vs inline `metadata` in `routes.js`: both, precedence documented (inline wins).
- [x] `origin` naming: kept, mapped to Next's `metadataBase` / Astro's `site` in the docs.
- [x] Does `seo()` own the terminal fallback? No — it is an option of the terminal
      (`sliceFallback({ seo })`), which `start()` mounts.
- [x] JSON-LD defaults: none in v1 (only what the manifest declares), so nothing is injected that the
      app did not ask for.
- [x] Sitemap: **committed file in `public/`, written at build time** (`slice seo sitemap`), served
      statically, with `seo check` failing on drift. Chosen over in-memory generation so a static
      host works and the file is reviewable in the PR.
- [x] Param routes: **pattern keys in v1**, using the router's `${param}` syntax (a literal wins,
      then the longest pattern). The canonical is the real requested path, never the pattern.
      `metadata: (params) => …` stays for v2.
- [x] Short fields and nested `openGraph` **coexist**; the nested object wins. Needs the test.
- [x] JSON Schema ships **with the module** (editor autocomplete offline, same source `seo check`
      uses).
- [x] Remote images: `--check-remote` is opt-in, and the CLI **prompts** for it when it runs in a
      TTY; non-interactive runs (CI) default to off and never hang.

## Decision log

- 2026-10-27 - Created as `proposed` after the `slicejs-components` implementation shipped (70
  prerendered routes, sitemap, real 404, per-route OG cards). Scope is deliberately the *mechanics*
  only: manifest in, correct HTML/sitemap/status out. Article prerender and OG image generation stay
  out.
- 2026-10-27 - Manifest contract v1 written down (`seo.json`): `origin` + `defaults` + `routes`,
  standard field names (`titleTemplate` with `%s`, `canonical`, `robots`, `openGraph`, `twitter`,
  `jsonLd`), `image` shorthand with `og:image:width/height` read from the file when local, and a
  validation list for `slice seo check`. Named `seo.json` on purpose: `manifest.json` is the PWA
  manifest.
- 2026-10-27 - Origin rules made explicit after the localhost question: it is a **startup value**
  (`SLICE_ORIGIN` → option → `seo.json` → dev fallback `http://localhost:<port>` → error), never
  derived from the request, because the prerender cache is built once and `req.protocol` lies behind
  a TLS proxy. Dev is honest, `slice doctor` warns while the origin is localhost, `build` refuses to
  export a sitemap with one, previews use the env override, multi-tenant stays out.
- 2026-10-27 - Auth-route example added, which pinned down three rules: canonical ignores `?query`
  and `#hash` (one URL per page, not per redirect target); `robots: false` is metadata, **not**
  access control — the prerendered shell is public, gating is middleware before the terminal; and the
  OG image is route content (`metadata.image` / `seo.json`), never server wiring.
- 2026-10-27 - Remote `image` URLs allowed (https absolute), with the consequences spelled out:
  dimensions cannot be read from a remote file so they must be declared, signed/expiring URLs are
  rejected as a design error (the platform caches the preview), and offline checks report a remote URL
  as *not verified* instead of passing it.
- 2026-10-27 - Decisions closed with the product owner and promoted to `planned`: the sitemap is a **committed build artifact in `public/`** with a drift guard in `seo check` (not in-memory); param routes are pattern keys using `${param}` in v1 with the canonical taken from the real path; short and nested social fields coexist; the JSON Schema ships with the module; `--check-remote` is opt-in and only prompts in a TTY.
- 2026-10-27 - Implementation started with the pure core (`api/framework/seo.js` + 12 tests): pattern matching with the router's `${param}` syntax (literal wins, then the longest pattern; canonical from the real path), metadata precedence (defaults -> manifest -> inline), head rendering with escaping, JSON-LD that cannot close its own script tag, shell injection that removes the tags the module owns, the sitemap builder (literal + indexable only), and `validateSeoManifest()` as the single validator for `seo check` and `slice doctor`. 123 framework tests. Still open: wiring into `sliceFallback`, the build-time sitemap command, Router titles, docs.

- 2026-10-27 - Wiring landed. `prepareSeo()` reads the manifest, imports `routes.js` (the route set), resolves the origin (config -> `SLICE_ORIGIN` -> manifest -> `http://localhost:<port>` in development, hard error in production), prerenders every literal route once (html + gzip + br + ETag) and returns a resolver. `sliceFallback({ seo })` serves the prerendered page, renders `${param}` routes per path with a 200-entry cache, and answers `404` + `noindex` with no canonical for anything else. `start()` is async now and awaits the preparation before listening — the template already used `await start()`. 5 HTTP tests (per-route head + 304, real 404, param canonical, `robots: false`, dev localhost origin); 128 framework tests and `verify:conclave` green. A JS manifest is passed as an object by the app (`seo: { ...config }`); the framework does not import arbitrary config files. Still open: the build-time sitemap command + drift guard, Router titles, docs.

- 2026-10-27 - Router titles shipped **on by default** (`sliceConfig.router.updateTitles: false` to opt out) after review: the flag-off version was safer but invisible, and a SPA that keeps the first title is broken in every app. `applyRouteMetadata()` only touches declared fields, never `canonical`/`robots`, and a `router:change` listener still wins. The one real risk — `routes.js` and `seo.json` disagreeing on a title, so hydration replaces the richer server title — became a **warning in `validateSeoManifest()`** (route + both values), which `seo check` and `slice doctor` surface. 137 framework tests.

- 2026-10-27 - `slice seo sitemap` and `slice seo check` implemented in the CLI (`commands/seo/`). `sitemap` reads `seo.json`, validates it with the framework validator, refuses a localhost origin, and writes `src/public/sitemap.xml` (+ `robots.txt` only when the manifest has `robotsTxt`) through `writeFileConfirmed()`: unchanged files are not rewritten, an existing different file asks first (default no), `--yes` skips, and no TTY means fail with a message instead of hanging. `check` validates, cross-checks `routes.js`, and fails (exit 1) when the committed sitemap drifted. 10 tests. The framework now also exports `./api/framework/seo.js` as a package entry so apps and the CLI share one implementation.

- 2026-10-27 - Sitemap handover prepared and proven. `buildSitemap()` in the framework now emits the same multi-line format as the parser (one field per line, so a `<lastmod>` change is a one-line diff), and running the real `slice seo sitemap` against slicejs-components reports `unchanged`: the committed file is byte-identical, so switching generators costs zero churn. `slice seo check` runs green on the app (74 routes cross-checked, only description-length warnings) and both commands are wired into the docs CI, gated on the installed framework shipping `api/framework/seo.js` — until 4.1 is published the parser keeps writing the identical sitemap, so there is no drift window and no red pipeline. Removing the parser writer is a one-line follow-up at release.
- 2026-10-27 - Done. Per-route head, real 404s, `noindex`, `${param}` routes, origin resolution, the committed sitemap (parser now, CLI ready and byte-identical), the router titles from `routes.js` metadata, the mismatch warning, the docs page and the skill are all in place. `slicejs-components` runs entirely on it: `api/seo.js` (the adapter) is deleted, `_titleByRoute` and its `beforeEach` guard are deleted, `seo.json` is the generated manifest, and the served `<head>` is identical to the old server tag for tag. Remaining follow-up at release: delete the parser sitemap writer once slicejs-web-framework 4.1 is the installed version (the CI step flips on by itself).
