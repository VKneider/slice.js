// slice.translator §7 — the locale in the URL. Pure helpers, then the REAL Router driven
// by the REAL Translator over a fake location/history (no DOM needed: rendering is stubbed).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
   isExternalHref,
   localeOfUrl,
   localizePath,
   normalizeRouting,
   splitLocalePath,
} from '../Components/Structural/Translator/localePath.js';

const LOCALES = ['es', 'en', 'pt-BR'];

test('splitLocalePath: known prefixes only, query and hash kept', () => {
   assert.deepEqual(splitLocalePath('/en/pricing?x=1#top', LOCALES), { locale: 'en', path: '/pricing?x=1#top' });
   assert.deepEqual(splitLocalePath('/EN', LOCALES), { locale: 'en', path: '/' });
   assert.deepEqual(splitLocalePath('/pt-br/a/b', LOCALES), { locale: 'pt-BR', path: '/a/b' });
   assert.deepEqual(splitLocalePath('/fr/pricing', LOCALES), { locale: null, path: '/fr/pricing' });
   assert.deepEqual(splitLocalePath('/english', LOCALES), { locale: null, path: '/english' });
   assert.deepEqual(splitLocalePath('/', LOCALES), { locale: null, path: '/' });
});

test('localizePath per routing mode', () => {
   const prefix = { routing: /** @type {const} */ ('prefix'), defaultLocale: 'es' };
   const except = { routing: /** @type {const} */ ('prefix-except-default'), defaultLocale: 'es' };
   assert.equal(localizePath('/pricing', 'es', prefix), '/es/pricing');
   assert.equal(localizePath('/', 'en', prefix), '/en');
   assert.equal(localizePath('/pricing', 'es', except), '/pricing');
   assert.equal(localizePath('/pricing?a=1', 'en', except), '/en/pricing?a=1');
   assert.equal(localizePath('/pricing', 'en', { routing: false, defaultLocale: 'es' }), '/pricing');
   assert.equal(normalizeRouting('yes'), false);
});

test('localeOfUrl and isExternalHref', () => {
   const except = { routing: /** @type {const} */ ('prefix-except-default'), defaultLocale: 'es', locales: LOCALES };
   assert.equal(localeOfUrl('/en/x', except), 'en');
   assert.equal(localeOfUrl('/x', except), 'es');
   assert.equal(localeOfUrl('/x', { ...except, routing: 'prefix' }), null);
   for (const href of ['https://a.com/x', '//cdn/x', 'mailto:a@b.c', '#top', '?page=2', 'relative/path']) {
      assert.equal(isExternalHref(href), true, href);
   }
   assert.equal(isExternalHref('/pricing'), false);
});

// ─── Router + Translator ──────────────────────────────────────────────────

function fakeBrowser(url) {
   const location = { pathname: '/', search: '', hash: '', origin: 'http://test' };
   const set = (value) => {
      const parsed = new URL(value, 'http://test');
      location.pathname = parsed.pathname;
      location.search = parsed.search;
      location.hash = parsed.hash;
   };
   set(url);
   const entries = [];
   const history = {
      state: null,
      pushState(state, _title, value) { entries.push(['push', new URL(value, 'http://test').pathname]); set(value); },
      replaceState(state, _title, value) { entries.push(['replace', new URL(value, 'http://test').pathname]); set(value); },
   };
   globalThis.location = location;
   globalThis.history = history;
   globalThis.window = { location, history, dispatchEvent() {}, addEventListener() {} };
   return { location, entries, set };
}

const DICTIONARIES = { '/locales/es.json': { t: 'hola' }, '/locales/en.json': { t: 'hello' } };
globalThis.fetch = async (url) =>
   DICTIONARIES[url] ? { ok: true, json: async () => structuredClone(DICTIONARIES[url]) } : { ok: false, status: 404, statusText: 'Not Found' };

const { default: Translator } = await import('../Components/Structural/Translator/Translator.js');
const { default: Router } = await import('../Components/Structural/Router/Router.js');

const ROUTES = [
   { path: '/', component: 'Home' },
   { path: '/pricing', component: 'Pricing' },
   { path: '/login', component: 'Login' },
   { path: '/p/${id}', component: 'Product' },
   { path: '/404', component: 'NotFound' },
];

/**
 * Boot like Slice.js does: translator first (it reads the URL), then the router.
 * @param {string} url
 * @param {Object} translatorConfig
 */
async function boot(url, translatorConfig) {
   const browser = fakeBrowser(url);
   const events = [];
   globalThis.slice = {
      logger: { error() {}, logError() {}, logWarning() {}, logInfo() {}, info() {} },
      isProduction: () => true,
      routerConfig: { updateTitles: false },
      eventsConfig: { enabled: true },
      events: { emit: (name, payload) => events.push({ name, payload }) },
      controller: { activeComponents: new Map() },
   };
   const translator = new Translator({ enabled: true, defaultLocale: 'es', locales: ['es', 'en'], ...translatorConfig });
   slice.translator = translator;
   await translator.init();

   const router = new Router(ROUTES);
   slice.router = router;
   const rendered = [];
   router.renderRoutesComponentsInPage = async () => false;
   router.handleRoute = async (route, params) => {
      rendered.push(`${route.component}:${translator.locale}${params.id ? `:${params.id}` : ''}`);
   };
   const guards = [];
   router.beforeEach((to, from, next) => {
      guards.push({ to: `${to.path}|${to.locale}|${to.url}`, from: `${from.path}|${from.locale}` });
      if (to.path === '/private') return next('/login');
      next();
   });
   router._started = true;
   return { browser, translator, router, rendered, guards, events };
}

test('prefix-except-default: unprefixed URL is the default locale; prefix picks the locale', async () => {
   const { translator, router, rendered } = await boot('/en/pricing', { routing: 'prefix-except-default' });
   assert.equal(translator.locale, 'en');
   assert.equal(router.path, '/pricing');
   assert.equal(router.href('/p/7'), '/en/p/7');
   assert.equal(router.href('/p/7', { locale: 'es' }), '/p/7');
   assert.equal(router.href('https://x.dev'), 'https://x.dev');
   assert.equal(router.matchRoute('/en/p/42?ref=1').params.id, '42');
   await router.loadInitialRoute();
   assert.deepEqual(rendered, ['Pricing:en']);
});

test('prefix-except-default: the default locale with a prefix is canonicalized', async () => {
   const { browser, translator } = await boot('/es/pricing?x=1', { routing: 'prefix-except-default' });
   assert.equal(translator.locale, 'es');
   assert.equal(`${browser.location.pathname}${browser.location.search}`, '/pricing?x=1');
});

test('prefix: an unprefixed URL gets the detected locale (saved choice here)', async () => {
   const store = new Map([['slice:locale', 'en']]);
   globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
   try {
      const { browser, translator, router } = await boot('/pricing', { routing: 'prefix', saveLocally: true });
      assert.equal(translator.locale, 'en');
      assert.equal(browser.location.pathname, '/en/pricing');
      assert.equal(router.path, '/pricing');
   } finally {
      delete globalThis.localStorage;
   }
});

test('navigate keeps the locale; { locale } switches language before rendering', async () => {
   const { browser, translator, router, rendered, guards, events } = await boot('/', { routing: 'prefix-except-default' });

   await router.navigate('/pricing');
   assert.equal(browser.location.pathname, '/pricing');

   await router.navigate('/p/9', { locale: 'en' });
   assert.equal(browser.location.pathname, '/en/p/9');
   assert.equal(translator.locale, 'en');
   assert.equal(translator.t('t'), 'hello');
   assert.deepEqual(rendered.slice(-1), ['Product:en:9'], 'rendered after the locale switched');
   assert.ok(guards.some((g) => g.to === '/p/9|en|/en/p/9' && g.from === '/pricing|es'));
   assert.ok(events.some((e) => e.name === 'translator:change' && e.payload.locale === 'en'));

   // A guard redirect stays in the target language.
   await router.navigate('/private');
   assert.equal(browser.location.pathname, '/en/login');

   // A path given with a prefix is taken as that locale.
   await router.navigate('/es/pricing');
   assert.equal(browser.location.pathname, '/pricing');
   assert.equal(translator.locale, 'es');

   // An unknown locale aborts the navigation.
   await router.navigate('/pricing', { locale: 'fr' });
   assert.equal(browser.location.pathname, '/pricing');
});

test('back/forward to another locale follows the URL', async () => {
   const { browser, translator, router, rendered } = await boot('/en/pricing', { routing: 'prefix-except-default' });
   browser.set('/p/3'); // popstate to the default locale
   await router.onRouteChange();
   assert.equal(translator.locale, 'es');
   assert.deepEqual(rendered.slice(-1), ['Product:es:3']);
});

test('setLocale() rewrites the current URL without a new history entry', async () => {
   const { browser, translator } = await boot('/pricing?tab=2', { routing: 'prefix-except-default' });
   browser.entries.length = 0;
   await translator.setLocale('en');
   assert.equal(`${browser.location.pathname}${browser.location.search}`, '/en/pricing?tab=2');
   assert.deepEqual(browser.entries, [['replace', '/en/pricing']]);
});

test('without routing: the path is the URL, and { locale } still switches', async () => {
   const { browser, translator, router } = await boot('/en/pricing', {});
   assert.equal(router.path, '/en/pricing', 'en is not a prefix when routing is off');
   assert.equal(router.href('/pricing'), '/pricing');
   browser.set('/');
   await router.navigate('/pricing', { locale: 'en' });
   assert.equal(browser.location.pathname, '/pricing');
   assert.equal(translator.locale, 'en');
});
