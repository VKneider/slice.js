import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.alert = () => {};

// Minimal global `slice` so ContextManager's slice.logger / slice.events work in
// isolation (a tiny in-memory event bus drives the watch notifications).
const subscribers = new Map(); // eventName -> Set<fn>
let subId = 0;
globalThis.slice = {
   logger: { logError() {}, logInfo() {}, logWarning() {} },
   events: {
      subscribe(name, cb) {
         if (!subscribers.has(name)) subscribers.set(name, new Set());
         subscribers.get(name).add(cb);
         return `sub-${++subId}`;
      },
      emit(name, ...args) {
         for (const cb of subscribers.get(name) ?? []) cb(...args);
      },
   },
};

const { default: ContextManager } = await import(
   '../Components/Structural/ContextManager/ContextManager.js'
);

function freshContext(name, initial) {
   const ctx = new ContextManager();
   ctx.create(name, initial);
   return ctx;
}

test('patch merges into existing state (does not replace)', () => {
   const ctx = freshContext('cart', { items: 2, total: 47, discount: 0 });
   ctx.patch('cart', { discount: 0.1 });
   assert.deepEqual(ctx.getState('cart'), { items: 2, total: 47, discount: 0.1 });
});

test('setState replaces, patch keeps the rest', () => {
   const ctx = freshContext('s', { a: 1, b: 2 });
   ctx.setState('s', { a: 9 }); // replace → drops b
   assert.deepEqual(ctx.getState('s'), { a: 9 });
   ctx.patch('s', { b: 5 }); // merge onto { a: 9 }
   assert.deepEqual(ctx.getState('s'), { a: 9, b: 5 });
});

test('patch rejects non-object partials and missing contexts (no throw)', () => {
   const ctx = freshContext('s', { a: 1 });
   ctx.patch('s', null);
   ctx.patch('s', [1, 2]);
   ctx.patch('nope', { x: 1 });
   assert.deepEqual(ctx.getState('s'), { a: 1 });
   assert.equal(ctx.has('nope'), false);
});

test('use(name) returns a handle bound to that context', () => {
   const ctx = freshContext('settings', { model: 'a' });
   const settings = ctx.use('settings');

   assert.equal(settings.get().model, 'a');
   settings.set({ model: 'b' });
   assert.equal(ctx.getState('settings').model, 'b');
   settings.patch({ theme: 'dark' });
   assert.deepEqual(ctx.getState('settings'), { model: 'b', theme: 'dark' });
   assert.equal(settings.has(), true);
   settings.destroy();
   assert.equal(ctx.has('settings'), false);
});

test('use(name).bind calls back immediately and on every change', () => {
   const ctx = freshContext('cart', { items: [], n: 0 });
   const calls = [];
   ctx.use('cart').bind({ sliceId: 'c1' }, (state) => calls.push(state.n));

   assert.deepEqual(calls, [0]); // immediate initial call
   ctx.patch('cart', { n: 1 });
   assert.deepEqual(calls, [0, 1]); // fired on change
});

test('use(name).bind with a selector only fires when the selected value changes', () => {
   const ctx = freshContext('cart', { items: ['x'], note: 'a' });
   const counts = [];
   ctx.use('cart').bind(
      { sliceId: 'c2' },
      (count) => counts.push(count),
      (s) => s.items.length
   );

   assert.deepEqual(counts, [1]); // immediate, selected value = length
   ctx.patch('cart', { note: 'b' }); // length unchanged → no fire
   assert.deepEqual(counts, [1]);
   ctx.patch('cart', { items: ['x', 'y'] }); // length changed → fire
   assert.deepEqual(counts, [1, 2]);
});
