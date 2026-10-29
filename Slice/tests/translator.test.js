// slice.translator — the Translator class under node (dictionaries, locale changes,
// props, watch) and its integration with the REAL Controller. DOM behaviour (data-t,
// the observer, slots) is covered in a browser; see translator-messages for the rules.
import { register } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.alert = () => {};
register(new URL('./fixtures/real-runtime-loader.mjs', import.meta.url));

const warnings = [];
const emitted = [];
const activeComponents = new Map();

globalThis.slice = {
   logger: {
      logError() {},
      logWarning: (_source, message) => warnings.push(message),
      logInfo() {},
      error() {},
   },
   events: { emit: (name, payload) => emitted.push({ name, payload }), cleanupComponent() {} },
   eventsConfig: { enabled: true },
   isProduction: () => false,
   isComponentAlive: (c) => activeComponents.get(c.sliceId) === c,
   controller: { activeComponents },
};

const { default: Translator } = await import('../Components/Structural/Translator/Translator.js');
const { default: Controller } = await import('../Components/Structural/Controller/Controller.js');

const DICTIONARIES = {
   '/locales/es.json': { orders: { title: 'Pedidos', save: 'Guardar', count: { one: '{count} pedido', other: '{count} pedidos' } } },
   '/locales/en.json': { orders: { title: 'Orders', save: 'Save', count: { one: '{count} order', other: '{count} orders' } }, onlyEn: 'Only in English' },
   '/locales/es/billing.json': { invoice: 'Factura' },
   '/locales/en/billing.json': { invoice: 'Invoice' },
};

/** fetch stub: serves DICTIONARIES, records requests, can fail or delay a URL. */
function stubFetch({ fail = [], delay = {} } = {}) {
   const requests = [];
   globalThis.fetch = async (url) => {
      requests.push(url);
      if (delay[url]) await new Promise((r) => setTimeout(r, delay[url]));
      if (fail.includes(url) || !DICTIONARIES[url]) return { ok: false, status: 404, statusText: 'Not Found' };
      return { ok: true, json: async () => structuredClone(DICTIONARIES[url]) };
   };
   return requests;
}

const config = (extra = {}) => ({ enabled: true, defaultLocale: 'es', fallbackLocale: 'en', locales: ['es', 'en'], ...extra });

test('disabled: t() returns the key, nothing is fetched, markers resolve to their key', async () => {
   const requests = stubFetch();
   const translator = new Translator({ enabled: false });
   await translator.init();
   assert.equal(translator.t('orders.title'), 'orders.title');
   assert.equal(translator.resolve({ label: translator.ref('orders.save') }).label, 'orders.save');
   assert.equal(requests.length, 0);
   assert.equal(typeof translator.format.number(1), 'string');
});

test('init loads the locale and the fallback; lookup chain ends in the key', async () => {
   const requests = stubFetch();
   const translator = new Translator(config());
   await translator.init();
   assert.deepEqual(requests.sort(), ['/locales/en.json', '/locales/es.json']);
   assert.equal(translator.t('orders.title'), 'Pedidos');
   assert.equal(translator.t('orders.count', { count: 3 }), '3 pedidos');
   assert.equal(translator.t('onlyEn'), 'Only in English', 'falls back to fallbackLocale');
   assert.equal(translator.t('nope.key'), 'nope.key');
   assert.ok(warnings.some((w) => w.includes('Missing translation "nope.key"')));
   assert.equal(translator.has('onlyEn'), false, 'has() does not consult the fallback');
   assert.equal(translator.has('onlyEn', 'en'), true);
});

test('the defaults layer never overrides the app dictionaries', async () => {
   stubFetch();
   const translator = new Translator(config());
   await translator.init();
   translator.add('es', { orders: { title: 'Default title', extra: 'Default extra' } }, { defaults: true });
   assert.equal(translator.t('orders.title'), 'Pedidos');
   assert.equal(translator.t('orders.extra'), 'Default extra');
   translator.add('es', { orders: { extra: 'App extra' } });
   assert.equal(translator.t('orders.extra'), 'App extra');
});

test('setLocale: loads first, rejects on failure without changing, emits and calls watchers', async () => {
   const requests = stubFetch({ fail: ['/locales/en.json'] });
   const translator = new Translator(config({ fallbackLocale: null }));
   await translator.init();

   await assert.rejects(() => translator.setLocale('en'), /404/);
   assert.equal(translator.locale, 'es');

   await assert.rejects(() => translator.setLocale('fr'), /not one of the configured locales/);

   stubFetch();
   const component = { sliceId: 'chart-1', _depth: 0 };
   activeComponents.set('chart-1', component);
   const calls = [];
   translator.watch(component, (locale, previous) => calls.push(`component:${previous}->${locale}`));
   const off = translator.watch((locale) => calls.push(`global:${locale}`));

   emitted.length = 0;
   assert.equal(await translator.setLocale('en-US'), 'en');
   assert.equal(translator.t('orders.title'), 'Orders');
   assert.deepEqual(calls, ['component:es->en', 'global:en']);
   assert.deepEqual(emitted, [{ name: 'translator:change', payload: { locale: 'en', previous: 'es' } }]);

   off();
   translator.forget(component);
   activeComponents.delete('chart-1');
   await translator.setLocale('es');
   assert.equal(calls.length, 2, 'no callbacks after unsubscribe / forget');
   assert.ok(requests.length > 0);
});

test('the last of two overlapping setLocale() calls wins', async () => {
   stubFetch({ delay: { '/locales/en.json': 30 } });
   const translator = new Translator(config({ fallbackLocale: null }));
   await translator.init();
   const slow = translator.setLocale('en');
   const fast = translator.setLocale('es');
   await Promise.all([slow, fast]);
   assert.equal(translator.locale, 'es');
});

test('namespaces load for the active locale and the fallback, and again on a locale change', async () => {
   const requests = stubFetch();
   const translator = new Translator(config());
   await translator.init();
   await translator.load('billing');
   assert.equal(translator.t('billing.invoice'), 'Factura');
   assert.ok(requests.includes('/locales/en/billing.json'));
   await translator.setLocale('en');
   assert.equal(translator.t('billing.invoice'), 'Invoice');
   assert.equal(requests.filter((u) => u === '/locales/en/billing.json').length, 1, 'each file is fetched once');
});

test('starting locale: saved choice, then browser language, then default', async () => {
   stubFetch();
   const store = new Map();
   globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
   Object.defineProperty(globalThis, 'navigator', { value: { languages: ['en-GB', 'es'] }, configurable: true });
   try {
      assert.equal(new Translator(config()).initialLocale(), 'es');
      assert.equal(new Translator(config({ useBrowserLocale: true })).initialLocale(), 'en');

      const saving = new Translator(config({ saveLocally: true }));
      await saving.init();
      await saving.setLocale('en');
      assert.equal(store.get('slice:locale'), 'en');
      store.set('slice:locale', 'es');
      assert.equal(new Translator(config({ saveLocally: true, useBrowserLocale: true })).initialLocale(), 'es');
   } finally {
      delete globalThis.localStorage;
      delete globalThis.navigator;
   }
});

test('format.* follows the active locale', async () => {
   stubFetch();
   const translator = new Translator(config());
   await translator.init();
   assert.equal(translator.format.number(12345.5), '12.345,5');
   await translator.setLocale('en');
   assert.equal(translator.format.number(12345.5), '12,345.5');
   assert.equal(translator.format.list(['a', 'b', 'c']), 'a, b, and c');
   assert.equal(translator.format.percent(0.25), '25%');
});

// ─── Props through the real Controller ───────────────────────────────────

class Label {
   static props = { value: { type: 'string', allowedValues: ['Guardar', 'Save', 'Pedidos', 'Orders', 'x'] }, items: { type: 'array' }, plain: {} };
   constructor(props) {
      this.renders = [];
      slice.controller.setComponentProps(this, props);
   }
   get value() { return this._value; }
   set value(v) {
      if (v === this._value) return;
      this._value = v;
      this.renders.push(v);
   }
   get items() { return this._items; }
   set items(v) { this._items = v; }
}

async function withRealController(run) {
   stubFetch();
   const translator = new Translator(config());
   await translator.init();
   const controller = new Controller();
   const previous = { controller: slice.controller, translator: slice.translator };
   slice.controller = controller;
   slice.translator = translator;
   try {
      await run({ translator, controller });
   } finally {
      slice.controller = previous.controller;
      slice.translator = previous.translator;
   }
}

test('key() props: the component receives text, and receives it again after setLocale()', async () => {
   await withRealController(async ({ translator, controller }) => {
      warnings.length = 0;
      const label = new Label({
         value: translator.ref('orders.save'),
         items: [{ label: translator.ref('orders.title'), path: '/orders' }],
         plain: translator.ref('orders.title'),
      });
      label.sliceId = 'label-1';
      controller.registerComponent(label);

      assert.equal(label.value, 'Guardar');
      assert.deepEqual(label.items, [{ label: 'Pedidos', path: '/orders' }]);
      assert.equal(label.plain, 'Pedidos', 'a prop without a setter is resolved by the Controller');
      assert.equal(warnings.filter((w) => w.includes('Invalid value')).length, 0, 'validation saw the text, not the marker');

      await translator.setLocale('en');
      assert.equal(label.value, 'Save');
      assert.deepEqual(label.items, [{ label: 'Orders', path: '/orders' }]);
      assert.equal(label.plain, 'Orders');
      assert.deepEqual(label.renders, ['Guardar', 'Save']);

      // A later assignment of a marker goes through the wrapped setter…
      label.value = translator.ref('orders.title');
      assert.equal(label.value, 'Orders');
      await translator.setLocale('es');
      assert.equal(label.value, 'Pedidos');

      // …and a plain string replaces it: no longer refreshed.
      label.value = 'x';
      await translator.setLocale('en');
      assert.equal(label.value, 'x');

      // Destroyed components are forgotten.
      label.value = translator.ref('orders.save');
      controller.destroyComponent(label);
      await translator.setLocale('es');
      assert.equal(label.value, 'Save', 'a destroyed component is not refreshed');
   });
});

test('setter wrapping is invisible for plain values and happens once per class', async () => {
   await withRealController(async ({ translator }) => {
      const descriptorBefore = Object.getOwnPropertyDescriptor(Label.prototype, 'value');
      const label = new Label({ value: 'x' });
      const descriptorAfter = Object.getOwnPropertyDescriptor(Label.prototype, 'value');
      translator.prepareClass(Label);
      assert.equal(Object.getOwnPropertyDescriptor(Label.prototype, 'value').set, descriptorAfter.set, 'not wrapped twice');
      assert.equal(label.value, 'x');
      assert.equal(descriptorAfter.get, descriptorBefore.get, 'getter untouched');
   });
});

test('setShowKeys: keys instead of texts and back, without changing the locale', async () => {
   stubFetch();
   const translator = new Translator(config());
   await translator.init();

   assert.equal(translator.t('orders.title'), 'Pedidos');
   assert.equal(translator.showKeys, false);

   assert.equal(translator.setShowKeys(true), true);
   assert.equal(translator.showKeys, true);
   assert.equal(translator.t('orders.title'), 'orders.title');
   assert.equal(translator.t('orders.count', { count: 3 }), 'orders.count');

   assert.equal(translator.setShowKeys(false), false);
   assert.equal(translator.t('orders.title'), 'Pedidos');
   assert.equal(translator.locale, 'es');
});
