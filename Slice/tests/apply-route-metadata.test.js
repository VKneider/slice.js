import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRouteMetadata } from '../Components/Structural/Router/applyRouteMetadata.js';

// The Router is DOM-bound, but this helper is the whole behaviour: no title
// means "the server already set it", and canonical/robots are never touched.

const fakeDocument = ({ title = 'Server title', description = null } = {}) => {
   const metas = [];
   if (description !== null) {
      const meta = {
         attrs: { name: 'description', content: description },
         getAttribute(name) { return this.attrs[name] ?? null; },
         setAttribute(name, value) { this.attrs[name] = value; }
      };
      metas.push(meta);
   }

   return {
      title,
      metas,
      head: {
         appended: [],
         appendChild(node) { this.appended.push(node); }
      },
      querySelector(selector) {
         if (selector !== 'meta[name="description"]') return null;
         return metas[0] || null;
      },
      createElement(tag) {
         return {
            tag,
            attrs: {},
            getAttribute(name) { return this.attrs[name] ?? null; },
            setAttribute(name, value) { this.attrs[name] = value; }
         };
      }
   };
};

test('applies the route title and its template', () => {
   const doc = fakeDocument();
   applyRouteMetadata({ title: 'Pricing', titleTemplate: '%s | Acme' }, doc);
   assert.equal(doc.title, 'Pricing | Acme');
});

test('a template of "%s" leaves the title as written', () => {
   const doc = fakeDocument();
   applyRouteMetadata({ title: 'Home', titleTemplate: '%s' }, doc);
   assert.equal(doc.title, 'Home');
});

test('a route without a title keeps the one the server sent', () => {
   const doc = fakeDocument({ title: 'Pricing | Acme (from seo.json)' });
   applyRouteMetadata({ description: 'Plans and limits.' }, doc);
   assert.equal(doc.title, 'Pricing | Acme (from seo.json)');
});

test('creates the description meta when the shell has none', () => {
   const doc = fakeDocument();
   applyRouteMetadata({ title: 'X', description: 'Plans.' }, doc);

   assert.equal(doc.head.appended.length, 1);
   const meta = doc.head.appended[0];
   assert.equal(meta.tag, 'meta');
   assert.equal(meta.getAttribute('name'), 'description');
   assert.equal(meta.getAttribute('content'), 'Plans.');
});

test('updates an existing description instead of appending a second one', () => {
   const doc = fakeDocument({ description: 'Old.' });
   applyRouteMetadata({ description: 'New.' }, doc);

   assert.equal(doc.head.appended.length, 0);
   assert.equal(doc.metas.length, 1);
   assert.equal(doc.metas[0].getAttribute('content'), 'New.');
});

test('never writes canonical or robots from the client', () => {
   const doc = fakeDocument();
   applyRouteMetadata({ title: 'X', canonical: 'https://evil/', robots: 'noindex' }, doc);
   assert.equal(doc.title, 'X');
   assert.equal(doc.head.appended.length, 0, 'nothing but the description is ever appended');
});

test('a missing document (SSR / node) is a no-op', () => {
   assert.doesNotThrow(() => applyRouteMetadata({ title: 'X' }, null));
   assert.doesNotThrow(() => applyRouteMetadata(null, null));
});

test('titleKey is the shorthand for a translated title', () => {
   const doc = fakeDocument();
   const calls = [];
   applyRouteMetadata(
      { titleKey: 'home.title', titleTemplate: '%s | Acme' },
      doc,
      (key) => {
         calls.push(key);
         return key === 'home.title' ? 'Inicio' : key;
      },
      { translatorEnabled: true }
   );
   assert.equal(doc.title, 'Inicio | Acme');
   assert.deepEqual(calls, ['home.title']);
});

test('titleKey wins over title when the translator is on', () => {
   const doc = fakeDocument();
   applyRouteMetadata(
      { titleKey: 'home.title', title: 'Home' },
      doc,
      (key) => (key === 'home.title' ? 'Inicio' : key),
      { translatorEnabled: true }
   );
   assert.equal(doc.title, 'Inicio');
});

test('titleKey with the translator off shows the key and warns once', () => {
   const doc = fakeDocument();
   const warnings = [];
   const warn = (field, key) => warnings.push([field, key]);
   applyRouteMetadata({ titleKey: 'home.title', title: 'Home' }, doc, (key) => key, {
      translatorEnabled: false,
      warn
   });
   assert.equal(doc.title, 'home.title');
   assert.deepEqual(warnings, [['titleKey', 'home.title']]);
});

test('titlePrefix and titleSuffix compose around the title', () => {
   const cases = [
      [{}, 'Resumen'],
      [{ titleSuffix: ' · Lab' }, 'Resumen · Lab'],
      [{ titlePrefix: 'Lab · ' }, 'Lab · Resumen'],
      [{ titlePrefix: 'Lab · ', titleSuffix: ' · Lab' }, 'Lab · Resumen · Lab']
   ];
   for (const [config, expected] of cases) {
      const doc = fakeDocument();
      applyRouteMetadata({ title: 'Resumen' }, doc, (key) => key, { routerConfig: config });
      assert.equal(doc.title, expected, JSON.stringify(config));
   }
});

test('a per-route affix overrides the router config, and false disables it', () => {
   const doc = fakeDocument();
   applyRouteMetadata(
      { title: 'Resumen', titleSuffix: ' · Otra', titlePrefix: false },
      doc,
      (key) => key,
      { routerConfig: { titlePrefix: 'Lab · ', titleSuffix: ' · Lab' } }
   );
   assert.equal(doc.title, 'Resumen · Otra');
});

test('descriptionKey follows the same rules as titleKey', () => {
   const doc = fakeDocument();
   const calls = [];
   applyRouteMetadata(
      { descriptionKey: 'home.description' },
      doc,
      (key) => {
         calls.push(key);
         return key === 'home.description' ? 'Todo sobre el producto.' : key;
      },
      { translatorEnabled: true }
   );
   const meta = doc.metas[0] || doc.head.appended[0];
   assert.equal(meta.getAttribute('content'), 'Todo sobre el producto.');
   assert.deepEqual(calls, ['home.description']);
});

test('descriptionKey with the translator off shows the key and warns', () => {
   const doc = fakeDocument();
   const warnings = [];
   applyRouteMetadata({ descriptionKey: 'home.description' }, doc, (key) => key, {
      translatorEnabled: false,
      warn: (field, key) => warnings.push([field, key])
   });
   const meta = doc.metas[0] || doc.head.appended[0];
   assert.equal(meta.getAttribute('content'), 'home.description');
   assert.deepEqual(warnings, [['descriptionKey', 'home.description']]);
});
