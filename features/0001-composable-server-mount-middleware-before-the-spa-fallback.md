---
id: "0001"
title: "Composable server: mount middleware before the SPA fallback"
repo: "slice.js"
status: proposed
area: framework
priority: high
created: 2026-10-27
updated: 2026-10-27
target: "TBD"
owners: []
related:
  - "api/framework/server.js"
  - "api/index.js"
  - "slicejs-cli: commands/init (api/index.js template)"
  - "slicejs-components/api/index.js (the fork this is meant to delete)"
---

# Composable server: mount middleware before the SPA fallback

## Summary

Make the generated server entrypoint genuinely composable: the factory returns an app
with **nothing terminal registered**, the SPA/404 fallback becomes a middleware the app mounts
last, and `start()` only listens. Today a user can add `app.use(...)` in `api/index.js`, but it can
never run for a real page — the catch-all is already inside the factory.

## Problem / motivation

**Correction to the original premise:** `createSliceServer()` already returns `{ app, start }` and
does **not** call `app.listen()` — only `start()` does. The listening is not the blocker; the
*ordering* is.

`api/framework/server.js` registers the terminal `app.get('*')` SPA fallback (and the error handler
after it) **inside the factory**, before it returns:

```js
export function createSliceServer(options = {}) {
  const app = express();
  // …security, static, bundles, PWA…
  app.get('*', …);          // ← terminal, registered here
  app.use((err, req, res, next) => …);
  return { app, start: startServer };
}
```

So this does nothing for `/` — the fallback already answered:

```js
const { app } = createSliceServer();
app.use('/api/hooks', hooks);   // dead code for every page route
```

Consequences, in order of how much they cost:

1. **Apps that need their own middleware fork the server.** `slicejs-components/api/index.js` is a
   ~700-line copy of the framework server: security, compression, static mounts, bundles, PWA, the
   SPA fallback, the 404 logic. Every framework-side fix since then (the development `.html`
   carve-out, the `.css` carve-out that JS-only components need, the per-route metadata) had to be
   re-applied by hand in the fork, and the fork then drifted from the framework. That copy *is* the
   argument for this feature.
2. **No place for a normal API.** Auth, rate limits, webhooks, i18n negotiation, request logging,
   preview/branch headers, an `/api/*` router — all of it has to sit before the catch-all.
3. **`PORT` and signals are locked inside `start()`**: it reads `PORT` at factory time and installs
   `SIGINT`/`SIGTERM` handlers that call `process.exit(0)`. A user who wants their own graceful
   shutdown (drain the server, close a DB pool) has to bypass `start()` and lose the logs.

## Proposed direction

Split "build the app" from "finish the app":

```js
import { createSliceServer } from 'slicejs-web-framework/api/framework/server.js';

const { app, start } = createSliceServer({ seo: { manifest, origin } });

app.use('/api/hooks', hooks);      // ordinary Express middleware, ordinary position
app.get('/health', (req, res) => res.json({ ok: true }));

await start({ port: 3001 });       // mounts the fallback last, then listens
export default app;
```

1. **`createSliceServer(options)` → `{ app, start }`.** Registers only pre-routing middleware:
   security, compression, body parsers, `/slice-env.json`, PWA endpoints, static mounts,
   `/bundles/*`, the dev bare-import rewriter. No catch-all, no error handler.
2. **`start({ port, host, signals })` mounts the terminal middleware itself**, before listening —
   that is the primary path, not a compatibility shim. The app never names the fallback, and the
   ordering contract collapses to one rule: *everything you add goes before `start()`, and `start()`
   is the last line.*
3. **`sliceFallback(options)` is exported for the case where there is no `start()`**: exporting a
   ready app for a serverless adapter, or driving it from a test harness (supertest). Only then does
   the app close the chain by hand; mounting it when `start()` will also mount it is a development
   warning, not a crash.
4. **Options that shape the terminal live on the factory** (`seo`, `fallback`), because they describe
   the app, not the lifecycle. `start()` reads them; it does not take a second copy.
5. **Port and signals move to `start()`**: `PORT` is read at call time, `signals: false` disables the
   handlers, and `start()` rejects if called twice.
6. **The generated `api/index.js` becomes the snippet above** (CLI `init` template), and the docs get
   the ordering contract: *everything you add goes between the factory and `start()`; `start()` is
   last.*

## What `sliceFallback(options)` owns

It is reached only when nothing else matched (static, bundles, `/api`, PWA, `/slice-env.json` —
all registered by the factory before it), so it is the single place where "nobody answered" is
decided:

| Responsibility | Today | With the fallback |
|---|---|---|
| Known page | `app.get('*')` → `200` + `App/index.html` | `200` + that route's prerendered HTML (or the plain shell when SEO is off) |
| Unknown path | **`200` + shell** (soft 404) | **`404`** + the same shell; the client router renders its own NotFound |
| Non-GET to an unknown path | Express default 404 (HTML) | `404`, JSON when the client does not ask for HTML |
| Internal route (`/__test`, `/playground`) | `200`, indexable | `200` + `noindex` |
| Encoding | `res.sendFile` + on-the-fly compression | precomputed br/gzip + ETag + `Vary` |
| Dev component assets (`.html`/`.css` that do not exist) | `404` → `slice.build` returns `null` | `200` (shell / empty stylesheet), so JS-only components work |
| Headers | none | `no-cache` + ETag on `200`, `no-store` on `404` |

It does **not** do: security, compression, static mounts, bundles, `/slice-env.json`, PWA endpoints
(factory), nor build the manifest/sitemap (SEO module at startup), nor render the 404 UI (the client
route does).

Two consequences worth naming:

- It is the **only** piece that must be last — exposing it is what gives the app freedom to mount
  middleware before it.
- The **development carve-outs live here**: the framework fetches `<Component>.html`/`.css` over HTTP
  and a JS-only component has no file; answering `404` there is what made `slice.build` return `null`
  and broke the MiniInspector and Breadcrumbs demos in `slicejs-components`. Putting that logic in
  the fallback makes every app inherit it instead of rediscovering it.

Contract: `start()` mounts it as the last middleware, so a normal app never names it; the app calls it
by hand only when there is no `start()` (serverless export, test harness). Mounting it when `start()`
will also mount it is a development warning; mounting it twice is what the warning exists for.

## Alternatives considered

- **Phase arrays** (`createSliceServer({ middleware: [{ phase: 'beforeStatic', handler }] })`):
  rejected. It invents an ordering vocabulary the framework then has to document and maintain,
  for something Express already expresses with `.use()`.
- **Factory only, user mounts everything**: rejected. It loses the "three lines" property that makes
  `slice init` usable, and 90 % of apps have nothing to mount before the fallback.
- **Accept an existing `express()` instance** (`createSliceServer({ app })`): a good escape hatch for
  the 10 % who need middleware *before* the security layer, but it does not solve ordering by
  itself. Keep as a follow-up option, not as the primary API.
- **Leave it as is and document "fork the server"**: rejected — that is what already happens, and it
  produces exactly the drift described above.

## Scope

### In scope

- `api/framework/server.js`: remove the early catch-all/error handler from the factory, export
  `sliceFallback`, make `start()` accept `{ port, host, signals }` and auto-mount the fallback when
  absent.
- Backward compatibility for the current `api/index.js` shape (`createSliceServer(); start();`).
- `slicejs-cli`: update the `api/` template that `init` copies.
- Tests: `api/framework/server.test.js` (node:test) — a middleware registered between the factory
  and `sliceFallback` runs for `/` and for an API path; `start()` without an explicit fallback still
  serves the SPA; `start()` twice throws; port override works.
- Docs: `markdown/project-architecture/server-entrypoint.md` (+ links from `installation.md`
  and `cli-commands.md`).

### Out of scope

- The dev watcher / HMR pipeline and how the CLI spawns `api/index.js` (both keep working as-is).
- A plugin system or a middleware registry inside the framework.
- Static hosting (there is no server to compose then).
- Migrating `slicejs-components` off its fork — that is the *acceptance test*, tracked separately.

## Compatibility and risk

- Public API: additive (`sliceFallback` export, `start` options) + a behavioural guarantee that
  `start()` mounts the fallback if the user did not. Minor release.
- Risk: **double mount** (user mounts `sliceFallback()` *and* `start()` auto-mounts). Mitigate with a
  flag on the app + a test; produce a dev-mode warning instead of two catch-alls.
- Risk: users put middleware *after* the terminal and wonder why it never runs. Mitigate with the
  documented contract and, in development, a warning when `app.use` is called after the fallback.
- Risk: `start()` currently owns signals; moving `PORT` to call time changes nothing for existing
  apps, but a process that relied on the factory reading `PORT` early (nothing does today) would
  notice.
- Perf: nothing new in the request path.

## Validation plan

- Unit tests: the four contract cases above, against a real `express` app (no HTTP server needed for
  ordering; use `supertest`-style raw `http` against `app.listen(0)` for the fallback).
- Browser/e2e tests: the existing `@server` suites in `slicejs-components` must still pass against an
  app that migrated its `api/index.js` to the new shape.
- Product check (Conclave): its `api/index.js` has app middleware; moving it to the new shape is the
  real-world proof.
- Artifact/release check: `pnpm doctor` + the demo app boots with the unchanged template.

## Documentation impact

- Framework docs pages: new `markdown/project-architecture/server-entrypoint.md`; touch
  `installation.md` (what the generated server looks like) and `cli-commands.md` (`dev`/`start`).
- Component docs: none.
- Skill / agent guidance: yes — the canonical `api/index.js` snippet belongs in the
  `slice-js-developer` skill, with the "before the fallback" rule stated as a trap.
- Workspace docs: none (orchestration unchanged).

## Open questions

- [ ] Does `sliceFallback()` take the SEO options (feature 0002), or is SEO a separate middleware
      the user mounts before it?
- [ ] Should `createSliceServer` accept an existing `express()` app in this iteration or later?
- [ ] Keep the `PORT` fallback chain (`process.env.PORT` → `sliceConfig.server.port` → 3001) inside
      `start()` defaults? (Suggested: yes, but overridable per call.)
- [ ] Do we warn (dev) or throw when `app.use()` is called after the fallback?

## Decision log

- 2026-10-27 - Created as `proposed` after reviewing `api/framework/server.js`. The premise "the
  framework listens internally" is only partly true: `start()` already owns the listen. The actual
  blocker is that the terminal fallback is registered inside the factory, so user middleware can
  never run. Direction: export `sliceFallback`, keep `start()`/the template backward compatible.
