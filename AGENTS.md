# AGENTS.md — slice.js (`slicejs-web-framework`)

This repo is the **framework source** (package `slicejs-web-framework`, runtime under `Slice/`) **and**
a demo/docs app (`src/`, `api/`). Read this before editing the runtime.

## ⚠️ The running app serves the PUBLISHED runtime, not this source
`api/index.js` serves `/Slice/` from **`node_modules/slicejs-web-framework/Slice`** — the *published*
package, NOT this repo's `Slice/`. So **editing `Slice/` does not change runtime behavior in any app
(including this one's `npm run dev`) until the package is published / synced.** Plan releases
accordingly. Never edit `node_modules` (global rule).

## Testing
- Run: `node --test Slice/tests/*.test.js` (the package `test` script is intentionally unset).
- The real `Controller` imports a browser-absolute `'/Components/components.js'`, so to load it under
  node use the resolve hook in **`Slice/tests/fixtures/real-runtime-loader.mjs`** (see
  `build-singleton.test.js`, `destroy-cascade.test.js`). DOM-less paths (Services, registry, build
  orchestration) run the **real** code this way — no mocks of the logic under test. Reserve a browser
  harness for genuine DOM behavior.

## Cleanup / destroy model (non-obvious)
- `destroyComponent(parent)` cascades to nested **Visual** children via `childrenIndex`. `childrenIndex`
  is fed by `registerComponentsRecursively` (the DOM walk at build time) — so only children present in
  the parent's DOM by the end of its `init()` are linked.
- **Services have no DOM → never auto-cascaded by anything.** A component that builds a Service must
  destroy it explicitly in `beforeDestroy()`.
- `destroyByContainer(domNode)` discovers components by DOM (`querySelectorAll('[slice-id]')`) and is
  the reliable "destroy-before-clear" path.
- Full rationale: the docs `project-architecture/service-patterns.md`.

## Conventions
- `id`, `sliceId`, `singleton` are **reserved build directives** — stripped from props before setters
  run; never expose them as component props.
- `build({ singleton: true })` is get-or-create (race-safe via a memoized in-flight promise); the public
  `build` is a thin wrapper over `_build` for it. Singletons are Service-only.
- Bare imports are unsupported in component files; relative imports are fine.
- The runtime has no build step in dev — keep it plain ESM that runs in the browser.
