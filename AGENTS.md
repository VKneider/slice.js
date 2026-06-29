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
- The real `Controller` imports a browser-absolute `'/Components/components.js'`, so to load it under
  node use the resolve hook in **`Slice/tests/fixtures/real-runtime-loader.mjs`** (see
  `build-singleton.test.js`, `destroy-cascade.test.js`). DOM-less paths (Services, registry, build
  orchestration) run the **real** code this way — no mocks of the logic under test. Reserve a browser
  harness for genuine DOM behavior.
- **E2e destroy lifecycle tests** live in `slice_visual_library/src/Components/Visual/Destroy.spec.js` (Playwright, 20 tests). They cover `destroyComponent`, `destroyByContainer`, and `destroyByPattern` against the real `activeComponents` in a browser. These are the browser e2e counterpart of the unit tests in `slice.js/Slice/tests/destroy-cascade.test.js`.
- The framework repo (`slice.js`) only has node:unit tests. Any test that needs a real DOM (events, visual rendering, destroy with `querySelectorAll`) must be written in `slice_visual_library`.

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

## Conventions
- `id`, `sliceId`, `singleton` are **reserved build directives** — stripped from props before setters
  run; never expose them as component props.
- `build({ singleton: true })` is get-or-create (race-safe via a memoized in-flight promise); the public
  `build` is a thin wrapper over `_build` for it. Singletons are Service-only.
- Bare imports are unsupported in component files; relative imports are fine.
- The runtime has no build step in dev — keep it plain ESM that runs in the browser.
