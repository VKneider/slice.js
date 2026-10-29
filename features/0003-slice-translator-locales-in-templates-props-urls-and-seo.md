---
id: "0003"
title: "slice.translator: locales in templates, props, URLs and SEO"
repo: "slice.js"
status: done
area: framework
priority: medium
created: 2026-10-28
updated: 2026-10-28
target: "TBD"
owners: []
related:
  - "0002-native-seo-per-route-head-sitemap-and-real-404s.md (left i18n / hreflang out of scope; this is that follow-up)"
  - "slicejs-cli/features/0003-translator-and-multilingual-seo-commands.md"
  - "slicejs-components/features/0002-library-texts-through-slice-translator.md"
---

# slice.translator: locales in templates, props, URLs and SEO

## Summary

Translations and locale formatting as a **structural** part of Slice, next to `slice.router`,
`slice.context` and the theme manager: `slice.translator`, with `slice.t()` as the shortcut. Texts
live in per-locale dictionaries; templates carry only keys (`data-t`); component props carry key
references the framework resolves and refreshes; and the locale can live in the URL (`/en/pricing`)
so the native SEO module (feature 0002) prerenders, links (`hreflang`) and lists (sitemap) every
language.

## Problem / motivation

| # | Today | Consequence |
|---|---|---|
| 1 | No translation support in the framework | Every app writes its own `t()`, dictionary loader and "re-render on language change" |
| 2 | Text lives in templates and in JS, with no shared mechanism | Static views (text in `.html`) and dynamic components (text from props) are translated two different ways, or not at all |
| 3 | Components receive strings (`value`, `label`, `title`) | A string passed at build time stays in the old language when the user switches |
| 4 | Library components hardcode English (`"Close"`, `"Clear date"`, Table/DataList labels) | Each app overrides them prop by prop |
| 5 | The SEO module prerenders **one** `<head>` per path | A translated site exposes one language to crawlers; there is no URL to point `hreflang` at, and the sitemap cannot list the other languages |
| 6 | Ten library/app components read `window.location.pathname` directly | Any change to what a URL looks like (a locale prefix, a base path) breaks their active-route logic |

Number 5 is why this cannot be a library Service: the server, the router, the template loader and
the prop pipeline all have to know the locale.

## Proposed direction

### 1. Configuration (`sliceConfig.json`)

```json
"translator": {
  "enabled": true,
  "defaultLocale": "es",
  "fallbackLocale": "en",
  "locales": ["es", "en"],
  "path": "/locales",
  "saveLocally": true,
  "useBrowserLocale": true,
  "localePrefix": "except-default"
}
```

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `false` | Off: `slice.t(key)` returns the key, `data-t` is left alone, nothing is loaded. |
| `defaultLocale` | — | Required when enabled. |
| `fallbackLocale` | `null` | Asked when the active locale lacks a key. |
| `locales` | `[defaultLocale]` | The locales the app has; `setLocale()` refuses others. |
| `path` | `/locales` | Where dictionaries are served from. |
| `saveLocally` | `false` | Remember the choice (like `themeManager.saveThemeLocally`). |
| `useBrowserLocale` | `false` | First visit: the browser's language if supported (`es-VE` → `es`). |
| `localePrefix` | `false` | `false`: the locale is not in the URL. `"prefix"`: every URL has it (`/es/pricing`, `/en/pricing`). `"except-default"`: the default locale has none (`/pricing`, `/en/pricing`). |

**Which locale starts**: with a locale prefix, the URL decides — its prefix, or with
`"except-default"` the default locale when there is none (an unprefixed URL *is* the default
language, so a saved choice never contradicts the address bar). Otherwise, and for `"prefix"` at an
unprefixed URL: the saved one → the browser's → `defaultLocale`. `sliceConfig.schema.json` gains the block, so `slice doctor` validates it.

### 2. Dictionaries

```
src/locales/es.json          ← loaded at start, with the fallback's
src/locales/en.json
src/locales/es/orders.json   ← a namespace, loaded with slice.translator.load('orders')
```

Hierarchical keys, plain-text values (never HTML). A namespace file is merged under its name.
`slice.translator.add(locale, messages)` merges at runtime; with `{ defaults: true }` the messages go
to a lower layer that never overrides the app's dictionaries (how the visual library ships its own
texts, slicejs-components 0002).

**Lookup order**: app dictionaries (active locale) → defaults layer (active locale) → the same two
for `fallbackLocale` → the key.

### 3. Messages

| Feature | Dictionary | Call | Result |
| --- | --- | --- | --- |
| Interpolation | `"greeting": "Hola, {name}"` | `slice.t('orders.greeting', { name: 'Ana' })` | `Hola, Ana` |
| Plural | `"count": { "one": "{count} pedido", "other": "{count} pedidos" }` | `slice.t('orders.count', { count: 3 })` | `3 pedidos` |
| Exact zero | `"zero": "Sin pedidos"` | `{ count: 0 }` | `Sin pedidos` |
| Numbers | `"{count} pedidos"` | `{ count: 1234 }` | `1.234 pedidos` |
| Literal brace | `"{{"` `"}}"` | — | `{` `}` |

Plural categories come from `Intl.PluralRules`; `other` is required; an explicit `zero` wins. No ICU
MessageFormat in v1.

**Lookup**: active locale → `fallbackLocale` → **the key itself** (`orders.title` on screen), plus a
development warning once per key and locale.

### 4. JavaScript API

```js
slice.t(key, params?)                        // translate (shortcut of slice.translator.t)
slice.translator.locale                      // 'es'
slice.translator.locales                     // ['es', 'en']
await slice.translator.setLocale('en')       // §8
await slice.translator.load('orders')        // a namespace, active + fallback locale
slice.translator.has(key, locale?)
slice.translator.add(locale, messages, { defaults }?)
slice.translator.ref(key, params?)           // a reference for a component prop (§6)
slice.translator.watch(component, callback)  // callback(locale, previous), until the component is destroyed
slice.translator.apply(root?)                // translate data-t under root now (default: the document)
slice.translator.format.number / currency / percent / date / time / relative / list
```

`Intl` formatters are cached per locale and options. With `enabled: false`, `slice.t()` returns the
key and `format.*` uses the browser's locale, so translated code keeps running.

### 5. Templates: only the key

```html
<h1 data-t="home.title"></h1>
<input data-t="home.search" placeholder aria-label>
<p data-t="signup.terms">
  <a href="/terms" data-t-slot="link" data-t="signup.termsLink"></a>
</p>
```

For `data-t="key"`:
- the element's **text** is `key` — except when it has translatable attributes, then only those are
  filled unless `data-t-text` is present;
- every **translatable attribute present** (even empty) is `key.<attribute>` in camelCase
  (`placeholder`, `title`, `alt`, `aria-label` → `ariaLabel`, `aria-description`, `aria-placeholder`,
  `aria-roledescription`, `aria-valuetext`, `label` on `<option>`/`<track>`, `value` on
  `input[type=button|submit|reset]`);
- **slots**: a message `"Acepto los {link}."` is rebuilt around the child marked
  `data-t-slot="link"`, which keeps its attributes and listeners. Dictionaries never contain HTML.

**Marked, not written.** Any element with `data-t` — in a template, in `App/index.html`, or created
later from JS — is translated when it enters the document and again on every locale change. A
document-level `MutationObserver` does it, so JS never writes translated text and never needs a
hook to repaint it:

```js
this.$count.dataset.tCount = items.length;        // re-translates "cart.items" with { count }
this.$status.dataset.t = `orders.status.${state}`; // a different key: re-translated too
el.innerHTML = `<p data-t="about.description"></p>`; // HTML built in JS works the same
```

- **Params** come from `data-t-*` attributes (`data-t-user-name` → `{userName}`); numeric strings
  become numbers. `data-t-text` and `data-t-slot` are directives, not params.
- Templates are translated inside `attachTemplate()`, while the component is still detached, so
  `init()` reads translated text and the first paint has no keys. The observer skips elements that
  are already up to date (same locale, dictionaries, key and params).
- A component kept out of the document (a cached route) is brought up to date when it is attached
  again.
- Text computed at the moment it is used (`slice.t()` in a toast, a confirm) needs nothing.

### 6. Component props: `t.ref()` references

```js
await slice.build('Button', { value: slice.t.ref('orders.save') });
this.$count.label = slice.t.ref('cart.items', { count });
await slice.build('DropDown', { items: [{ label: slice.t.ref('menu.home'), path: '/' }] });
```

- `t.ref()` returns a frozen reference; **the component only ever receives the translated string**,
  through its normal setter. Components need no change.
- On a locale change the framework assigns the prop again. A marker nested in an array or a plain
  object is resolved, and the whole prop is assigned again.
- Covered props: every prop given through `setComponentProps` (build or refresh) is refreshed. The
  setters of `static props` are also wrapped (once per class) so a later direct assignment of a
  marker (`this.$badge.label = slice.translator.ref(…)`) resolves and refreshes too; assigning a
  plain string afterwards stops the refresh for that prop.
- Prop validation (`allowedValues`, unknown props) sees the translated strings, not the markers.
- `String(marker)` returns the key and warns in development (a marker used as text by mistake).

### 7. Router and URLs

**For every app, whatever `localePrefix` says** — the router becomes the only reader of the URL:

```js
slice.router.path            // the app path, without locale or query: '/pricing'
slice.router.href('/pricing')// the URL to put in an <a>: '/en/pricing' (or '/pricing')
```

`Route`, `MultiRoute`, `Navbar`, `BottomNav`, `SideMenu`, `Breadcrumbs`, `TreeView`, `App`,
`ComponentsPage` and `UnsavedChangesGuard` move from `window.location.pathname` to these
(slicejs-components feature 0002).

**With a locale prefix:**
- Routes are declared **once**, without a locale (`/pricing`, `/producto/${id}`). `matchRoute` strips
  a known locale prefix first; the prefix sets the active locale.
- `navigate('/pricing')` and `Link` add the active locale. `navigate('/pricing', { locale: 'en' })`
  goes to another language.
- `setLocale('en')` rewrites the current URL with `replaceState` (no rebuild of the route) and
  translates (§8).
- `navigate(path, { locale })` loads the new locale's dictionaries **before** pushing the URL, so the
  page renders translated and a failed load leaves the user where they were. A path given with a
  prefix (`navigate('/en/pricing')`) means that locale. A guard redirect stays in the target locale.
- Back/forward across languages: the router follows the URL's locale before rendering.
- The default locale with a prefix under `"except-default"` (`/es/pricing`) is canonicalized
  to `/pricing` (client: `replaceState`; server: phase 5).
- `matchRoute()` drops a known prefix and the query/hash before matching, so a component that still
  passes `window.location.pathname` keeps working.
- `/` with `"prefix"` redirects to the detected locale; an unknown prefix (`/fr/…`) is not a locale,
  so it is a normal path (a 404 if no route matches).
- Guards and `router:change` receive the app path and the locale: `to.path === '/pricing'`,
  `to.locale === 'en'`, `to.url === '/en/pricing'`. `RouteInfo` gains `locale` and `url`.
- Translated slugs (`/es/precios`) are out of scope.

### 8. Changing the locale

`await slice.translator.setLocale('en')`, in order:

1. Load what the locale needs (main file, namespaces already loaded, the fallback's). On failure the
   locale does not change and the promise rejects.
2. Set `slice.translator.locale`, `<html lang>`, `<html dir>` (`rtl` for ar, he, fa, ur); save it if
   `saveLocally`; with a locale prefix, rewrite the URL.
3. Re-translate every `data-t` in the document.
4. Re-assign every prop that came from a marker, parents before children.
5. Re-apply the active route's `metadata` (`applyRouteMetadata`, now locale-aware, §9).
6. Call `watch()` callbacks (components first, parents before children); emit `translator:change`
   (`{ locale, previous }`).

There is no lifecycle hook: what lives in the DOM is marked (§5), props are markers (§6), and only
what lives outside the DOM (a canvas chart, a third-party widget that copied a string) uses
`watch()`. If two `setLocale()` calls overlap, the last one wins.

**First load**: the translator starts in `Slice` init right after the config, before `Loading` and
the styles, and loads its dictionaries in parallel with `stylesManager.init()` and the routes module.
The first paint is translated. A namespace loaded later shows keys until it arrives.

### 9. SEO (extends feature 0002)

**Texts by key.** Any string field of a route entry in `seo.json`, of `defaults`, or of a route's
`metadata` in `routes.js`, accepts `{ "t": "key" }` (optionally `{ "t": "key", "params": {…} }`):

```json
"defaults": { "titleTemplate": { "t": "seo.titleTemplate" }, "description": { "t": "seo.description" } },
"routes": {
  "/pricing": { "title": { "t": "pricing.seo.title" }, "description": { "t": "pricing.seo.description" } }
}
```

The server resolves them at startup with the same `/locales/*.json` the client uses; the client's
`applyRouteMetadata` resolves them with `slice.t()`. A plain string stays a plain string (the same
in every locale), so existing manifests do not change.

**With a locale prefix, `prepareSeo()`:**
- prerenders every route **once per locale** (`/pricing`, `/en/pricing`), each with `<html lang>`,
  `<html dir>`, `og:locale` (from the locale, `en` → `en_US` unless `seo.json` maps it), the
  translated `<head>`, and its own canonical;
- adds `<link rel="alternate" hreflang="…">` for every locale of the route, plus `x-default` (the
  `defaultLocale` URL);
- answers `404` for an unknown locale prefix, exactly like an unknown path;
- `${param}` routes render per request as today, per locale.

**Without `localePrefix`**, the server prerenders the `defaultLocale`; there is one URL per page and no
`hreflang` (switching language is a client preference).

**Sitemap.** `buildSitemap()` emits one `<url>` per route and locale, each with its
`xhtml:link rel="alternate" hreflang` set (and `x-default`), under the `xmlns:xhtml` namespace.
`robots: false` and `sitemap: false` apply to every locale of the route.

**Validation** (`validateSeoManifest`, shared with the CLI): a `{ t }` key missing in a locale is an
error (the page would advertise the key as its title); `hreflang` sets are reciprocal by
construction.

**Memory.** Prerendered pages are routes × locales (74 × 2 ≈ 770 KB with the measurement in 0002).
`maxPrerenderedRoutes` counts pages, not routes.

### 10. Development tools

- Warnings (outside production, once each): missing key per locale, missing parameter, a key that is
  a group, a marker used as a string, `data-t` with nothing to fill.
- A debugger panel like context/events (shortcut in `sliceConfig.translator.ui.shortcut`): active
  locale, a switcher, keys missing on this page, and "show keys instead of texts".

### Where it plugs in

| Point | Change |
| --- | --- |
| `Slice` init | Create `slice.translator`, pick the locale, load dictionaries in parallel with styles and routes, translate `App/index.html`. |
| `Controller.loadTemplateToComponent` | After `innerHTML`, translate the component's own `data-t` nodes; remember them per component. |
| `Controller.setComponentProps` + registration | Resolve markers before setters; wrap `static props` setters; remember marker props. |
| `Controller.destroyComponent` | Forget nodes, marker props, `watch()` subscriptions. |
| `Router` | `path`, `href()`, prefix stripping in `matchRoute`, locale in `navigate`/`loadInitialRoute`/`popstate`, `RouteInfo.locale`/`url`. |
| `applyRouteMetadata` | Resolve `{ t }` fields; called again on locale change. |
| `api/framework/seo.js`, `server.js` | `{ t }` resolution, per-locale prerender, `hreflang`, sitemap alternates, locale-aware 404. |
| `EventManager` | `translator:change` declared like the `context:` family. |
| `sliceConfig.schema.json` | The `translator` block. |

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| A library Service (`TranslatorService`) | Cannot reach templates (`attachTemplate`), the prop pipeline, the router or the server. Apps without the library would not have it. |
| Text as key (gettext: `slice.t('Pedidos')`) | Editing the source text loses every translation; homonyms need context; long keys in code. |
| Default-language text in the template, key as attribute | Two sources of truth for the default language; the app chose keys only, with the key shown when missing. |
| Translated strings passed as props (`value: slice.t(…)`) | Frozen in the old language after a switch, unless every component re-assigns by hand. |
| Magic strings (`value: '@orders.save'`) | A real text starting with `@` breaks; nothing in the code says it is a key. |
| ICU MessageFormat | Heavier, harder to write; `{name}` + plural objects cover the common cases. Possible later behind the same `t()`. |
| Locale in a query (`?lang=en`) or a cookie only | Not indexable as separate pages; no `hreflang` target. |

## Scope

### In scope (v1, in phases)

1. `slice.translator` core: config, dictionaries, `t()`, `format.*`, `setLocale()`, `watch()`. **Done.**
2. Templates (`data-t`, attributes, slots, `data-t-*` params, observer) and prop markers. **Done.**
3. `slice.router.path` / `href()` (useful without any locale) and their adoption in the library.
   **Framework done**; the library adoption is slicejs-components 0002.
4. `localePrefix: "always" | "except-default"`. **Done on the client.** Until phase 5, a server
   with native SEO (`seo.json`) answers `/en/…` as an unknown path (404 page); apps without SEO get
   the shell and work.
5. SEO: `{ t }` fields, per-locale prerender, `hreflang`, sitemap alternates, validation. **Done.**
6. Debugger panel. **Done.**

### Out of scope

- Translated slugs (`/es/precios`).
- ICU MessageFormat.
- Domain or subdomain per locale (`es.example.com`), and multi-tenant origins (0002 already excludes them).
- Translating server data.
- Dictionaries from an API (use `add()`).

## Compatibility and risk

- **Additive.** `translator.enabled` defaults to `false`; `localePrefix` to `false`. Apps that do nothing
  see no change except `slice.router.path`/`href()` existing.
- **Setter wrapping** touches every component with `static props`. It must be invisible: same `this`,
  same return, no change for non-marker values. Measure registration cost on the docs site (≈ 70
  components).
- **The document observer** watches every attribute (params are open-ended, so no
  `attributeFilter`); the callback discards anything that is not `data-t*` with one string check.
  Animations that rewrite `style` every frame create records that are discarded. Measured on the
  phase 1–2 harness: 200 style writes caused no re-translation.
- **SEO memory** grows with locales (§9).
- **Breaking for apps with a locale prefix on**: every hard-coded `href="/x"` in their templates bypasses
  `href()`. `Link` and `navigate` are fine; raw anchors need `slice.router.href()` or a delegated
  click handler. Document it, and let `slice translator check` (CLI 0003) report raw `href="/…"`.

## Validation plan

- Unit: message formatting (interpolation, plurals per locale, zero, braces, missing params),
  lookup chain, marker resolution in nested values, `matchRoute` with/without prefixes,
  `buildSitemap` alternates, `{ t }` resolution in `resolveMetadata`.
- Browser: first paint translated (no keys visible); `setLocale` order (§8) with a spy per step;
  `data-t` text/attributes/slots; props re-assigned on change; no leaks after destroying
  components (LeakInspector); `localePrefix` navigation, back/forward, guards receiving `locale`.
- Server: per-locale prerender, `hreflang` + `x-default`, canonical per locale, 404 for `/fr/…`,
  sitemap with `xhtml:link`.
- Dogfood: the components docs site in English and Spanish with `except-default`.

## Documentation impact

- New guide "Translating an app" (config, dictionaries, templates, props, locale change, URLs).
- `routes.md` / router docs: `path`, `href()`, `RouteInfo.locale`.
- SEO docs: `{ t }` fields, multilingual output.
- `sliceConfig` reference: the `translator` block.
- Skills/AGENTS: "text never hard-coded in templates when the app is translated; props use `t.ref()`".

## Open questions

1. `data-t` as the attribute name, or `data-translate`? (Implemented as `data-t`.)
2. ~~`localeChanged()` hook~~ — dropped: texts are marked, not written (§5).
3. ~~Wrap setters?~~ — implemented: wrapped once per class, invisible for non-marker values.
4. Which `og:locale` mapping by default (`es` → `es_ES` or `es_419`)? Probably `seo.json` maps it,
   with a neutral default per language.
5. Library `slice.*` keys in English and Spanish only for v1?
6. The defaults layer (`add(…, { defaults: true })`): is a flag on `add()` right, or a separate
   `slice.translator.defaults(locale, messages)`? (Implemented as the flag.)
7. **Localized data** (found in the portfolio): long content kept in `data.js` arrays (experience,
   projects) does not fit dictionary keys. Document a convention (`data.<locale>.js` chosen by
   `slice.translator.locale`), or add a helper such as `slice.translator.pick({ en, es })`?
8. **Rendered-from-data sections and cached routes**: a section built from per-locale data has to
   rebuild on a locale change; `data-t` and markers cover the rest. `watch()` works today; should
   `setLocale()` also offer `{ reload: true }` for content sites?

## Decision log

- 2026-10-28 — Structural, not a Service (templates, props, router and server need it).
- 2026-10-28 — Name `slice.translator`, shortcut `slice.t()`; no `i18n` anywhere.
- 2026-10-28 — Hierarchical keys; templates carry only the key; a missing translation shows the key.
- 2026-10-28 — Props through `slice.translator.ref()` markers, resolved and refreshed by the framework.
- 2026-10-28 — Locale in the URL and multilingual SEO are part of v1 (phases 4–5), designed with 0002.
- 2026-10-28 — Texts are *marked*, not written: a document observer translates `data-t` (with
  `data-t-*` params) wherever it appears; no `localeChanged()` hook and no `bind()`. `watch()` only
  for texts outside the DOM.
- 2026-10-28 — Phases 1–2 implemented: `Slice/Components/Structural/Translator/` (`Translator.js`,
  `messages.js`, `markers.js`, `dom.js`), Controller/Router/Slice integration, schema, types, tests.
  The translator is always created (disabled: `t()` returns the key), so the CLI bundles it with
  the core.
- 2026-10-28 — Phases 3–4 (framework): `slice.router.path` / `href()`, `RouteInfo.locale` / `url`,
  `navigate(path, { locale })`, locale-prefix handling in `translator/localePath.js` (pure, shared with the
  server for phase 5). With a locale prefix, the URL decides the locale.
- 2026-10-28 — Integration proof in `slicejs-lab` (Spanish default, English fallback, no locale prefix):
  marked shell texts, `t.ref()` props for SideMenu/Breadcrumbs/Button/ToolTip, ES/EN switch, saved
  choice and `translator:change`. `tests/translator.e2e.mjs` boots the dev server and drives
  Chromium (`pnpm test:lab:e2e`).
- 2026-10-28 — Found in that proof and fixed: production did not serve the dictionaries.
  `api/framework/server.js` now mounts `translator.path` from `dist` (the build already copies
  `src/locales`), so the runtime stops showing keys in `slice start`; two tests cover the mount and
  the opt-out. The dev server and the standalone harness hid this.
- 2026-10-28 — Library adoption stays in slicejs-components 0007, and phase 5 (multilingual SEO) and
  the CLI commands remain pending; docs state both limits.
- 2026-10-28 — Phase 5 shipped: `seo.js` resolves `{ t }` (`title`, `titleTemplate`, `description`,
  `imageAlt`, `openGraph`/`twitter` titles) with the app dictionaries, prerenders every literal route
  per locale (`<html lang|dir>`, canonical, `og:locale`), adds `hreflang` + `x-default`, validates a
  missing key per locale as an error and builds the sitemap with `xhtml:link` alternates.
  `/` under `"always"` answers 302, a default-locale prefix under `except-default` answers 301,
  an unknown prefix stays a 404. `og:locale` defaults to the locale with `-` → `_`, overridable per
  locale in `seo.json` (`locales.<locale>.ogLocale`).
- 2026-10-28 — Phase 6 shipped: `TranslatorDebugger` (`translator.ui`) with a locale switcher, the
  missing keys on the page, and `setShowKeys()` (keys instead of texts). Registering it in the bundle
  is config-driven in `DependencyAnalyzer`. Found and fixed while wiring the panel: the shortcut
  parser built `shift+alt+t` while configs say `alt+shift+t`, so every panel shortcut was dead;
  modifier order is now canonical.
- 2026-10-28 — CLI: `slice translator init/check`, a Translators row in `doctor`, locale-aware
  `seo sitemap/check/images`, all reusing the framework's `{ t }`/sitemap code and `dom.js` rules.
  Unused-key reporting is opt-in (`--unused`): keys reached through app helpers (`tr(key)`) are
  invisible to the scan.
- 2026-10-29 — API closed after review: **one entry point**, `slice.t()`, for text; `slice.t.ref()`
  for a prop that must follow the locale without rebuilding the component. `slice.translator.key()`
  is gone (renamed to `ref()`); nothing is published, so there is no deprecated alias. The marker
  class is `TranslationRef`.
- 2026-10-29 — No fourth lifecycle hook and no global `refreshComponents`: `data-t` (including
  `element.dataset.t` for DOM created from JS) is the automatic text binding; props use `t.ref()`;
  canvas/third-party widgets use the existing `watch()`. A section that computes labels from data can
  call its own render from `watch` in `init` when needed; that stays local and explicit.
- 2026-10-29 — The lab was fully translated with `data-t`/`dataset.t`, `t.ref()` for component
  props and `t()` for computed text, proving the rule end to end in both locales.
- 2026-10-29 — App Shell titles: `onRouteChange()` skipped `handleRoute()` when a
  `<slice-route>`/`<slice-multiRoute>` owns the view, so a section's `metadata.title` was never
  applied and `activeMetadata` kept the shell's. It now applies the matched leaf's metadata before
  delegating to MultiRoute (respecting `router.updateTitles: false`) and stores `activeMetadata`, so
  the translator re-applies the title after a locale change. `metadata.titleKey` is the key; the
  router resolves it through `slice.t()`.
- 2026-10-29 — Title/description design closed: `titleKey` / `descriptionKey` are the shorthand for
  `{ t }` and win over the literal; with the translator off the key is shown and the router logs one
  warning per key. The product name is app-wide, not per route: `router.titlePrefix` / `titleSuffix`
  in `sliceConfig.json`, separator inside the string, per-route override with `false` to disable.
  Composition is `prefix + title + suffix` (only one, both or neither). The server reads the same
  `router` block so the prerendered `<title>` and the hydrated one match. `%s`/`titleTemplate` stays
  as a legacy escape hatch, never the documented path.
