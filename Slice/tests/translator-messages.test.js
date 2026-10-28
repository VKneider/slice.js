// slice.translator — pure message logic (no DOM, no slice global).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
   IntlCache,
   directionOf,
   formatMessage,
   interpolate,
   isPluralMessage,
   lookup,
   matchLocale,
   mergeMessages,
} from '../Components/Structural/Translator/messages.js';
import { TranslationKey, containsMarker, resolveMarkers } from '../Components/Structural/Translator/markers.js';
import { camelCase, templateKeys, paramsOf } from '../Components/Structural/Translator/dom.js';
import { applyRouteMetadata, resolveText } from '../Components/Structural/Router/applyRouteMetadata.js';

const intl = new IntlCache();

test('interpolate: params, locale numbers, literal braces', () => {
   assert.equal(interpolate('Hola, {name}', { name: 'Ana' }, 'es', intl), 'Hola, Ana');
   assert.equal(interpolate('{count} pedidos', { count: 12345 }, 'es', intl), '12.345 pedidos');
   assert.equal(interpolate('{count} orders', { count: 12345 }, 'en', intl), '12,345 orders');
   assert.equal(interpolate('{{literal}} and }}', {}, 'en', intl), '{literal} and }');
   assert.equal(interpolate('{ name }', { name: 'x' }, 'en', intl), 'x', 'spaces inside braces are allowed');
});

test('interpolate: a missing param stays visible and is reported', () => {
   const missing = [];
   assert.equal(interpolate('Hi {name}', {}, 'en', intl, (n) => missing.push(n)), 'Hi {name}');
   assert.deepEqual(missing, ['name']);
});

test('plurals follow the locale; an explicit zero wins; other is the fallback', () => {
   const message = { zero: 'Sin pedidos', one: '{count} pedido', other: '{count} pedidos' };
   assert.equal(formatMessage(message, { count: 0 }, 'es', intl), 'Sin pedidos');
   assert.equal(formatMessage(message, { count: 1 }, 'es', intl), '1 pedido');
   assert.equal(formatMessage(message, { count: 5 }, 'es', intl), '5 pedidos');

   const noZero = { one: '{count} order', other: '{count} orders' };
   assert.equal(formatMessage(noZero, { count: 0 }, 'en', intl), '0 orders');

   // Russian has "few": falls back to other when the dictionary lacks it.
   assert.equal(formatMessage({ one: 'one', other: 'other' }, { count: 3 }, 'ru', intl), 'other');
   assert.equal(formatMessage({ one: 'one', few: 'few', other: 'other' }, { count: 3 }, 'ru', intl), 'few');

   let missingCount = 0;
   assert.equal(formatMessage(noZero, {}, 'en', intl, { onMissingCount: () => missingCount++ }), '{count} orders');
   assert.equal(missingCount, 1);
});

test('formatMessage returns null for a group', () => {
   assert.equal(formatMessage({ title: 'x' }, {}, 'en', intl), null);
   assert.equal(isPluralMessage({ title: 'x', other: 'y' }), false);
   assert.equal(isPluralMessage({ one: 'x', other: 'y' }), true);
});

test('lookup and merge: dotted keys, deep merge, plurals replaced whole', () => {
   const dict = mergeMessages({}, { orders: { title: 'Pedidos', count: { one: 'a', other: 'b' } } });
   // JSON can carry an own "__proto__" key: it must not reach Object.prototype.
   mergeMessages(dict, JSON.parse('{ "orders": { "save": "Guardar", "count": { "other": "c" } }, "__proto__": { "polluted": true } }'));
   assert.equal(lookup(dict, 'orders.title'), 'Pedidos');
   assert.equal(lookup(dict, 'orders.save'), 'Guardar');
   assert.deepEqual(lookup(dict, 'orders.count'), { other: 'c' });
   assert.equal(lookup(dict, 'orders.nope'), undefined);
   assert.equal(lookup(dict, 'orders.title.deeper'), undefined);
   assert.equal(/** @type {any} */ ({}).polluted, undefined);
});

test('matchLocale: exact, base language, regional variant', () => {
   const supported = ['es', 'en', 'pt-BR'];
   assert.equal(matchLocale('es-VE', supported), 'es');
   assert.equal(matchLocale('EN', supported), 'en');
   assert.equal(matchLocale('pt', supported), 'pt-BR');
   assert.equal(matchLocale('pt_PT', supported), 'pt-BR');
   assert.equal(matchLocale('fr', supported), null);
   assert.equal(matchLocale('', supported), null);
});

test('directionOf', () => {
   assert.equal(directionOf('ar-EG'), 'rtl');
   assert.equal(directionOf('he'), 'rtl');
   assert.equal(directionOf('es'), 'ltr');
});

test('markers: resolved deep, identity kept where there is nothing to resolve', () => {
   const translate = (key, params) => `<${key}${params ? JSON.stringify(params) : ''}>`;
   const icon = { name: 'home' };
   const items = [
      { label: new TranslationKey('menu.home'), path: '/', icon },
      { label: 'Plain', path: '/plain' },
   ];
   const resolved = resolveMarkers(items, translate);
   assert.equal(resolved[0].label, '<menu.home>');
   assert.equal(resolved[0].icon, icon, 'objects without markers keep their identity');
   assert.equal(resolved[1], items[1]);
   assert.equal(containsMarker(items), true);
   assert.equal(containsMarker(resolved), false);

   const nested = new TranslationKey('cart.items', { count: 2, who: new TranslationKey('you') });
   assert.equal(resolveMarkers(nested, translate), '<cart.items{"count":2,"who":"<you>"}>');
});

test('a marker used as a string shows its key and reports it', () => {
   let reported = 0;
   const marker = new TranslationKey('orders.save', undefined, () => reported++);
   assert.equal(`${marker}`, 'orders.save');
   assert.equal(String(marker), 'orders.save');
   assert.equal(reported, 2);
   assert.ok(Object.isFrozen(marker));
});

test('templateKeys: text, attributes, data-t-text, void elements', () => {
   const el = (tagName, attrs) => ({
      tagName,
      hasAttribute: (n) => Object.prototype.hasOwnProperty.call(attrs, n),
      getAttribute: (n) => (n in attrs ? attrs[n] : null),
   });
   assert.deepEqual(templateKeys(el('H1', { 'data-t': 'home.title' })), { key: 'home.title', text: 'home.title', attributes: {} });
   assert.deepEqual(templateKeys(el('INPUT', { 'data-t': 's', placeholder: '', 'aria-label': '' })), {
      key: 's',
      text: null,
      attributes: { placeholder: 's.placeholder', 'aria-label': 's.ariaLabel' },
   });
   assert.deepEqual(templateKeys(el('BUTTON', { 'data-t': 'b', title: '', 'data-t-text': '' })), {
      key: 'b',
      text: 'b',
      attributes: { title: 'b.title' },
   });
   // label only counts on option/track/optgroup; value only on button-like inputs
   assert.deepEqual(templateKeys(el('DIV', { 'data-t': 'd', label: '' })).attributes, {});
   assert.deepEqual(templateKeys(el('INPUT', { 'data-t': 'i', type: 'submit', value: '' })).attributes, { value: 'i.value' });
   assert.deepEqual(templateKeys(el('INPUT', { 'data-t': 'i', type: 'text', value: '' })).text, null);
   assert.equal(templateKeys(el('P', {})), null);
});

test('paramsOf: data-t-* become params, numbers parsed, directives skipped', () => {
   const attributes = [
      { name: 'data-t', value: 'cart.count' },
      { name: 'data-t-count', value: '3' },
      { name: 'data-t-user-name', value: 'Ana' },
      { name: 'data-t-text', value: '' },
      { name: 'data-t-slot', value: 'link' },
      { name: 'class', value: 'x' },
   ];
   assert.deepEqual(paramsOf(/** @type {any} */ ({ attributes })), { count: 3, userName: 'Ana' });
   assert.equal(camelCase('aria-roledescription'), 'ariaRoledescription');
});

test('route metadata accepts { t } fields', () => {
   const head = { children: [], appendChild(node) { this.children.push(node); } };
   const doc = /** @type {any} */ ({
      title: '',
      head,
      querySelector: () => head.children[0] || null,
      createElement: () => {
         const attrs = {};
         return { setAttribute: (k, v) => (attrs[k] = v), getAttribute: (k) => attrs[k] ?? null };
      },
   });
   const translate = (key, params) => (key === 'seo.template' ? '%s · Shop' : `${key}${params ? `:${params.n}` : ''}`);
   applyRouteMetadata(
      { title: { t: 'pricing.title', params: { n: 2 } }, titleTemplate: { t: 'seo.template' }, description: { t: 'pricing.description' } },
      doc,
      translate
   );
   assert.equal(doc.title, 'pricing.title:2 · Shop');
   assert.equal(head.children[0].getAttribute('content'), 'pricing.description');
   assert.equal(resolveText('plain', translate), 'plain');
});
