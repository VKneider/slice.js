# AGENTS.md — slice.js (`slicejs-web-framework`)

This repo is the **framework source** (package `slicejs-web-framework`, runtime under `Slice/`) **and**
a demo/docs app (`src/`, `api/`). Read this before editing the runtime.

## ⚠️ The running app serves the PUBLISHED runtime, not this source
The server (`api/framework/server.js`) serves `/Slice/` from **`node_modules/slicejs-web-framework/Slice`**
— the *published* package, NOT this repo's `Slice/`. So **editing `Slice/` does not change runtime
behavior in any app (including this one's `npm run dev`) until the package is published / synced.**
Plan releases accordingly. Never edit `node_modules` (global rule).

## Arquitectura del servidor
La lógica del servidor Express (`api/index.js`) se movió a `api/framework/server.js` como factory
`createSliceServer()`. El `api/index.js` del proyecto ahora es solo un wrapper que importa y ejecuta
la factory. Los módulos `securityMiddleware.js` y `publicEnvResolver.js` viven en `api/framework/`.
Desde el init del CLI se copia `api/` completo al proyecto del usuario, por lo que nuevos proyectos
reciben el wrapper delgado automáticamente. Proyectos existentes no se ven afectados (tienen su copia
local de `api/`).

## Testing
- Run: `node --test Slice/tests/*.test.js` (the package `test` script is intentionally unset).
- **CI lives in `.github/workflows/ci.yml`**: runtime/server/SEO tests, `scripts/check-pack.mjs`, and a
  Conclave job. Locally, the two scripts are the fast equivalents:
  - `node scripts/check-pack.mjs` — what `npm pack` would ship (no tests, proposals or local tooling).
  - `node scripts/verify-app.mjs --app ../conclave --replace` — points an app at this checkout,
    builds with the app's own CLI, boots it, and asserts `/Slice/Slice.js` is this source. Use
    `--replace` only on a disposable checkout; in the workspace the link already exists.
- The real `Controller` imports a browser-absolute `'/Components/components.js'`, so to load it under
  node use the resolve hook in **`Slice/tests/fixtures/real-runtime-loader.mjs`** (see
  `build-singleton.test.js`, `destroy-cascade.test.js`). DOM-less paths (Services, registry, build
  orchestration) run the **real** code this way — no mocks of the logic under test. Reserve a browser
  harness for genuine DOM behavior.
- **E2e destroy lifecycle tests** live in `slicejs-components/src/Components/Visual/Destroy.spec.js` (Playwright, 20 tests). They cover `destroyComponent`, `destroyByContainer`, and `destroyByPattern` against the real `activeComponents` in a browser. These are the browser e2e counterpart of the unit tests in `slice.js/Slice/tests/destroy-cascade.test.js`.
- The framework repo (`slice.js`) only has node:unit tests. Any test that needs a real DOM (events, visual rendering, destroy with `querySelectorAll`) must be written in `slicejs-components`.

## Cleanup / destroy model (non-obvious)
- `destroyComponent(parent)` cascades to nested **Visual** children via `childrenIndex`. `childrenIndex`
  is fed by `registerComponentsRecursively` (the DOM walk at build time) — so only children present in
  the parent's DOM by the end of its `init()` are linked.
- **Services have no DOM → never auto-cascaded by anything.** A component that builds a Service must
  destroy it explicitly in `beforeDestroy()`.
- `destroyByContainer(domNode)` discovers components by DOM (`querySelectorAll('[slice-id]')`) and is
  the reliable "destroy-before-clear" path.
- **`destroyByContainer` was broken until `registerComponent()` was patched** to set `component.setAttribute('slice-id', component.sliceId)`.
  Without the HTML attribute, `querySelectorAll('[slice-id]')` returned nothing and `destroyByContainer` always returned 0.
  The JS property alone (`component.sliceId = ...`) is invisible to CSS attribute selectors.
- Full rationale: the docs `project-architecture/service-patterns.md`.

## slice.translator (feature 0003, phases 1–6)
- `Slice/Components/Structural/Translator/`: `Translator.js` (the class), `TranslatorDebugger.js`
  (panel), and pure helpers `messages.js` (lookup, plurals, interpolation), `markers.js` (`t.ref()`
  markers), `dom.js` (`data-t` rules, reused by the CLI), `localePath.js` (URL rules, shared with the
  server). Helpers must not import each other: the CLI bundler inlines only the helpers a Structural
  component imports directly.
- Always created in `init()` (disabled → `t()` returns the key), so it is part of the core bundle.
- Texts are *marked*: `data-t` / `data-t-*` anywhere in the document are translated by one
  `MutationObserver`; templates are translated in `loadTemplateToComponent` (before `init()`).
  Props: `setComponentProps` resolves `t.ref()` references and `static props` setters are wrapped once per
  class; `destroyComponent` calls `translator.forget()`. No `localeChanged()` hook. One entry point:
  `slice.t()` for text, `slice.t.ref()` for a prop; `data-t` covers the DOM (templates and JS-created).
- Lists and content values: `slice.t.list()` returns a dictionary array (`t.ref.list()` is the prop
  marker); `localized.js` resolves `{ en, es }` and `content.js` resolves `copy` documents loaded from
  `<path>/content/<name>.json` (`t.content()`). The CLI validates list keys and every `copy`; the
  server reads the same documents with `api/framework/content.js`.
- URLs (phases 3–4): `localePath.js` (pure prefix rules). The Router never reads
  `window.location.pathname` for matching without `_appPath()`; components use the shortcuts
  `slice.path` / `slice.href()` (aliases of `slice.router.path` / `href()`), so they import no helper.
  With `routing` on, the URL decides the locale.
- SEO (phase 5): `api/framework/seo.js` resolves `{ t }` fields and prerenders per locale with
  `hreflang`, canonical and `og:locale`; `buildSitemap` emits alternates; validation fails on a key
  missing in a locale. `api/framework/server.js` mounts the dictionaries folder from `dist`.
- Debugger (phase 6): `translator.ui.enabled` + `shortcut` creates `slice.translatorDebugger`;
  `setShowKeys()` renders keys instead of texts. The shortcut parser normalizes modifier order
  (`ctrl+alt+shift+meta`) — configs use `alt+shift+t`.
- Unit tests: `Slice/tests/translator*.test.js`, `api/framework/seo.test.js`,
  `api/framework/server.test.js`. DOM behaviour and the panel: `slicejs-lab` `tests/translator.e2e.mjs`.
- The CLI (`slice translator init/check`, doctor row) reuses `dom.js` for the same template rules.

## Conventions
- `id`, `sliceId`, `singleton` are **reserved build directives** — stripped from props before setters
  run; never expose them as component props.
- `build({ singleton: true })` is get-or-create (race-safe via a memoized in-flight promise); the public
  `build` is a thin wrapper over `_build` for it. Singletons are Service-only.
- Bare imports are unsupported in component files; relative imports are fine.
- The runtime has no build step in dev — keep it plain ESM that runs in the browser.
