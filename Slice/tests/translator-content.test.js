// slice.translator — lists, localized content values and content documents.
// Pure rules live in localized.js / content.js; the Translator integration covers the
// fetch cache, the locale switch and prop refresh through the REAL Controller.
import { register } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.alert = () => {};
register(new URL('./fixtures/real-runtime-loader.mjs', import.meta.url));

const warnings = [];
const activeComponents = new Map();

globalThis.slice = {
   logger: {
      logError() {},
      logWarning: (_source, message) => warnings.push(message),
      logInfo() {},
      error() {},
   },
   events: { emit() {}, cleanupComponent() {} },
   eventsConfig: { enabled: true },
   isProduction: () => false,
   isComponentAlive: (component) => activeComponents.get(component.sliceId) === component,
   controller: { activeComponents },
};

const { default: Translator } = await import('../Components/Structural/Translator/Translator.js');
const { default: Controller } = await import('../Components/Structural/Controller/Controller.js');
const { localize, isLocalizedObject } = await import('../Components/Structural/Translator/localized.js');
const { resolveContent, validateContentDocument } = await import('../Components/Structural/Translator/content.js');

const DICTIONARIES = {
   '/locales/es.json': {
      roles: ['Profesor', 'Ingeniero'],
      greetings: ['Hola, {name}', 'Bienvenido, {name}'],
      records: [{ id: 1, title: 'Uno' }],
      single: 'No es una lista',
   },
   '/locales/en.json': {
      roles: ['Professor', 'Engineer'],
      greetings: ['Hello, {name}', 'Welcome, {name}'],
      records: [{ id: 1, title: 'One' }],
      single: 'Not a list',
   },
   '/locales/content/experience.json': {
      records: [
         {
            id: 1,
            logo: '/images/x.png',
            technologies: ['JavaScript'],
            copy: {
               en: { position: 'Engineer', responsibilities: ['Build', 'Teach'] },
               es: { position: 'Ingeniero', responsibilities: ['Construir', 'Enseñar'] },
            },
         },
      ],
   },
   '/locales/content/teaching.json': {
      courses: [
         {
            slug: 'pr2',
            copy: { en: { name: 'Programming 2' }, es: { name: 'Programación 2' } },
            units: [
               {
                  key: 'u1',
                  copy: { en: { title: 'Unit 1' }, es: { title: 'Unidad 1' } },
                  topics: [{ key: 't1', copy: { en: { title: 'Topic 1' }, es: { title: 'Tema 1' } } }],
               },
            ],
         },
      ],
   },
};

function stubFetch() {
   const requests = [];
   globalThis.fetch = async (url) => {
      requests.push(url);
      if (!(url in DICTIONARIES)) return { ok: false, status: 404, statusText: 'Not Found' };
      return { ok: true, json: async () => structuredClone(DICTIONARIES[url]) };
   };
   return requests;
}

const config = (extra = {}) => ({ enabled: true, defaultLocale: 'es', fallbackLocale: 'en', locales: ['es', 'en'], ...extra });

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

// ─── localized.js ────────────────────────────────────────────────────────

test('localize picks the branch, walks arrays/objects and falls back', () => {
   const options = { locale: 'es', fallbackLocale: 'en', defaultLocale: 'en', locales: ['es', 'en'] };
   assert.equal(localize({ en: 'Hello', es: 'Hola' }, options), 'Hola');
   assert.deepEqual(
      localize({ title: { en: 'Title', es: 'Título' }, items: [{ en: 'One', es: 'Uno' }] }, options),
      { title: 'Título', items: ['Uno'] }
   );
   assert.equal(localize({ en: 'Only English' }, options), 'Only English');
   assert.equal(localize({ en: 'Only English' }, { locale: 'es', locales: ['en', 'es'] }), undefined);
   assert.deepEqual(localize({ fr: 'Bonjour' }, options), { fr: 'Bonjour' }, 'not a localized object');
   assert.equal(localize('plain', options), 'plain');
});

test('isLocalizedObject only accepts objects whose keys are locales', () => {
   assert.equal(isLocalizedObject({ en: 'a', es: 'b' }, ['en', 'es']), true);
   assert.equal(isLocalizedObject({ en: 'a', title: 'b' }, ['en', 'es']), false);
   assert.equal(isLocalizedObject({ en: 'a', es: 'b' }, []), true);
   assert.equal(isLocalizedObject({ en: 'a' }, []), true);
   assert.equal(isLocalizedObject(['en'], ['en']), false);
});

// ─── content.js ──────────────────────────────────────────────────────────

test('resolveContent flattens copy branches and nested nodes', () => {
   const localizeFor = (value) => localize(value, { locale: 'es', fallbackLocale: 'en', defaultLocale: 'en', locales: ['es', 'en'] });
   const resolved = resolveContent(structuredClone(DICTIONARIES['/locales/content/teaching.json']), localizeFor);

   assert.equal(resolved.courses[0].name, 'Programación 2');
   assert.equal(resolved.courses[0].units[0].title, 'Unidad 1');
   assert.deepEqual(resolved.courses[0].units[0].topics[0], { key: 't1', title: 'Tema 1' });
   assert.equal(resolved.courses[0].copy, undefined);
});

test('validateContentDocument reports missing locales, shape drift and empty text', () => {
   const valid = structuredClone(DICTIONARIES['/locales/content/experience.json']);
   assert.deepEqual(validateContentDocument(valid, ['es', 'en']), []);

   const missing = structuredClone(valid);
   delete missing.records[0].copy.es;
   assert.ok(validateContentDocument(missing, ['es', 'en']).some((issue) => /missing "es"/.test(issue.message)));

   const drift = structuredClone(valid);
   drift.records[0].copy.es.responsibilities = ['Una sola'];
   assert.ok(validateContentDocument(drift, ['es', 'en']).some((issue) => /expected 2 item/.test(issue.message)));

   const empty = structuredClone(valid);
   empty.records[0].copy.en.position = '   ';
   assert.ok(validateContentDocument(empty, ['es', 'en']).some((issue) => /empty text/.test(issue.message)));

   const unknown = structuredClone(valid);
   unknown.records[0].copy.fr = { position: 'Ingénieur', responsibilities: ['A', 'B'] };
   assert.ok(validateContentDocument(unknown, ['es', 'en']).some((issue) => /not a configured locale/.test(issue.message)));
});

// ─── Translator: lists ───────────────────────────────────────────────────

test('list translates string items, returns records as-is and warns on a missing list', async () => {
   stubFetch();
   const translator = new Translator(config());
   await translator.init();

   assert.deepEqual(translator.list('roles'), ['Profesor', 'Ingeniero']);
   assert.deepEqual(translator.list('greetings', { name: 'Ana' }), ['Hola, Ana', 'Bienvenido, Ana']);
   assert.deepEqual(translator.list('records'), [{ id: 1, title: 'Uno' }]);
   assert.deepEqual(translator.list('nope'), []);
   assert.ok(warnings.some((warning) => /Missing list "nope"/.test(warning)));
   assert.deepEqual(translator.list('single'), []);
   assert.ok(warnings.some((warning) => /is not a list/.test(warning)));
});

test('list follows the locale and showKeys switches string items to keys', async () => {
   stubFetch();
   const translator = new Translator(config());
   await translator.init();

   assert.deepEqual(translator.list('roles'), ['Profesor', 'Ingeniero']);
   await translator.setLocale('en');
   assert.deepEqual(translator.list('roles'), ['Professor', 'Engineer']);

   translator.setShowKeys(true);
   assert.deepEqual(translator.list('roles'), ['roles.0', 'roles.1']);
   assert.deepEqual(translator.list('records'), [{ id: 1, title: 'One' }], 'records are not messages');
});

test('t.ref.list resolves to an array and refreshes the whole prop on a locale change', async () => {
   await withRealController(async ({ translator }) => {
      class Menu {
         static props = { items: { type: 'array' } };
         constructor(props) {
            this.renders = [];
            slice.controller.setComponentProps(this, props);
         }
         get items() { return this._items; }
         set items(value) {
            this._items = value;
            this.renders.push(value);
         }
      }

      const menu = new Menu({ items: translator.refList('roles') });
      menu.sliceId = 'menu-1';
      slice.controller.registerComponent(menu);
      assert.deepEqual(menu.items, ['Profesor', 'Ingeniero']);

      await translator.setLocale('en');
      assert.deepEqual(menu.items, ['Professor', 'Engineer']);
      assert.deepEqual(menu.renders, [['Profesor', 'Ingeniero'], ['Professor', 'Engineer']]);
   });
});

// ─── Translator: content documents ───────────────────────────────────────

test('content loads once, resolves copy for the locale and reuses the cache', async () => {
   const requests = stubFetch();
   const translator = new Translator(config());
   await translator.init();

   const experience = await translator.content('experience');
   assert.equal(experience.records[0].position, 'Ingeniero');
   assert.deepEqual(experience.records[0].responsibilities, ['Construir', 'Enseñar']);
   assert.equal(experience.records[0].logo, '/images/x.png');
   assert.equal(experience.records[0].copy, undefined);

   const again = await translator.content('experience');
   assert.equal(again, experience, 'resolved document is cached per locale');
   assert.equal(requests.filter((url) => url === '/locales/content/experience.json').length, 1);

   await translator.setLocale('en');
   const english = await translator.content('experience');
   assert.equal(english.records[0].position, 'Engineer');
   assert.equal(requests.filter((url) => url === '/locales/content/experience.json').length, 1, 'no second fetch');
});

test('content flattens nested nodes (teaching) and reports a missing document', async () => {
   stubFetch();
   const translator = new Translator(config());
   await translator.init();

   const teaching = await translator.content('teaching');
   assert.equal(teaching.courses[0].name, 'Programación 2');
   assert.equal(teaching.courses[0].units[0].title, 'Unidad 1');
   assert.deepEqual(teaching.courses[0].units[0].topics[0], { key: 't1', title: 'Tema 1' });

   assert.equal(await translator.content('missing'), null);
   assert.ok(warnings.some((warning) => /Could not load content "missing"/.test(warning)));
   assert.equal(await translator.content('../escape'), null);
});

test('content warns when a copy branch is missing and keeps the structure', async () => {
   stubFetch();
   const translator = new Translator(config({ fallbackLocale: null }));
   await translator.init();

   const broken = structuredClone(DICTIONARIES['/locales/content/experience.json']);
   delete broken.records[0].copy.es;
   globalThis.fetch = async (url) => ({
      ok: true,
      json: async () => (url === '/locales/content/broken.json' ? broken : {}),
   });

   const resolved = await translator.content('broken');
   assert.equal(resolved.records[0].logo, '/images/x.png');
   assert.equal(resolved.records[0].position, undefined);
   assert.ok(warnings.some((warning) => /without "es"/.test(warning)));
});

test('with the translator off, list/content are empty and localized is the identity', async () => {
   stubFetch();
   Object.defineProperty(globalThis, 'navigator', { value: { languages: ['en-US'] }, configurable: true });
   try {
      const translator = new Translator({ enabled: false });
      assert.deepEqual(translator.list('roles'), []);
      assert.equal(await translator.content('experience'), null);
      assert.equal(translator.localized({ en: 'Hello', es: 'Hola' }), 'Hello', 'falls back to the browser/default locale');
   } finally {
      delete globalThis.navigator;
   }
});
