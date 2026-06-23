// Unit tests for the EventManager typed-event registry (register/validate/warn).
// EventManager only depends on the `slice` global for logging + isProduction +
// controller.activeComponents, so we stub a minimal one and drive the real class.
import test from 'node:test';
import assert from 'node:assert/strict';

const warnings = [];
globalThis.slice = {
   isProduction: () => false,
   controller: { activeComponents: new Map() },
   logger: {
      logError() {},
      logInfo() {},
      logWarning(_c, message) { warnings.push(message); },
      info() {}, error() {}, warn() {},
   },
};

const { default: EventManager } = await import('../Components/Structural/EventManager/EventManager.js');

const undeclaredWarns = (name) => warnings.filter((w) => w.includes('Undeclared') && (!name || w.includes(name)));

test('loose mode: with no registry, nothing warns', () => {
   warnings.length = 0;
   const em = new EventManager();
   em.emit('anything:happens');
   em.subscribe('whatever:event', () => {});
   assert.equal(undeclaredWarns().length, 0);
});

test('declared event emits and subscribes without warning', () => {
   warnings.length = 0;
   const em = new EventManager();
   em.register({ 'user:login': { payload: { id: 'number' } } });
   em.subscribe('user:login', () => {});
   em.emit('user:login', { id: 1 });
   assert.equal(undeclaredWarns().length, 0);
});

test('undeclared event warns exactly once but still delivers', () => {
   warnings.length = 0;
   const em = new EventManager();
   em.register({ 'user:login': { payload: null } });

   let calls = 0;
   em.subscribe('ghost:event', () => { calls += 1; });   // subscribe (undeclared) -> warns
   em.emit('ghost:event');                                 // emit (undeclared, already warned)
   em.emit('ghost:event');

   assert.equal(undeclaredWarns('ghost:event').length, 1, 'warned exactly once');
   assert.equal(calls, 2, 'delivery still happened both emits');
});

test('framework events (router:*/context:*) never warn', () => {
   warnings.length = 0;
   const em = new EventManager();
   em.register({ 'user:login': { payload: null } });
   em.emit('router:change');
   em.emit('context:user', {});
   em.subscribe('context:cart', () => {});
   assert.equal(undeclaredWarns().length, 0);
});

test('production: undeclared events do not warn', () => {
   warnings.length = 0;
   globalThis.slice.isProduction = () => true;
   const em = new EventManager();
   em.register({ 'a:b': { payload: null } });
   em.emit('zzz:undeclared');
   assert.equal(undeclaredWarns().length, 0);
   globalThis.slice.isProduction = () => false;
});

test('register() merges catalogs and is chainable', () => {
   const em = new EventManager();
   const ret = em.register({ 'a:1': { payload: null } }).register({ 'b:2': { payload: { x: 'string' } } });
   assert.equal(ret, em, 'returns the manager for chaining');
   assert.ok(em.registry.has('a:1') && em.registry.has('b:2'), 'both catalogs merged');
   assert.equal(em.isDeclared('a:1'), true);
   assert.equal(em.isDeclared('nope:nope'), false);
});

test('register(namespace, catalog) prefixes keys', () => {
   const em = new EventManager();
   em.register('user', { login: { payload: { id: 'number' } }, logout: { payload: null } });
   assert.ok(em.registry.has('user:login'), 'user:login declared');
   assert.ok(em.registry.has('user:logout'), 'user:logout declared');
   assert.equal(em.namespaceOf('user:login'), 'user');
   assert.equal(em.namespaceOf('ready'), null);
});

test('event without namespace warns once in dev', () => {
   warnings.length = 0;
   const em = new EventManager();
   em.register({ 'ready': { payload: null } });       // declared but no namespace -> warns
   em.emit('ready');
   em.emit('ready');
   const nsWarns = warnings.filter((w) => w.includes('no namespace'));
   assert.equal(nsWarns.length, 1, 'namespace warning fired exactly once');
});

test('no-namespace warning is silent in loose mode (no registry)', () => {
   warnings.length = 0;
   const em = new EventManager();
   em.emit('ready'); // nobody registered -> loose mode, no warnings at all
   assert.equal(warnings.length, 0);
});

test('loadGraph stores the static graph and exposes emitters/listeners', () => {
   const em = new EventManager();
   assert.deepEqual(em.staticEmittersOf('user:login'), [], 'empty before loadGraph');
   em.loadGraph({
      events: {
         'user:login': {
            payload: { id: 'number' },
            emitters: [{ file: 'src/Login.js', line: 12, component: 'Login' }],
            listeners: [{ file: 'src/Header.js', line: 5, component: 'Header' }],
         },
      },
      dynamic: { emitters: [], listeners: [] },
   });
   assert.equal(em.staticEmittersOf('user:login')[0].component, 'Login');
   assert.equal(em.staticListenersOf('user:login')[0].component, 'Header');
   assert.deepEqual(em.staticEmittersOf('unknown:event'), []);
});

test('loadGraph ignores malformed input', () => {
   const em = new EventManager();
   em.loadGraph(null);
   em.loadGraph({ nope: true });
   assert.equal(em.graph, null);
});

test('undeclared usage is tracked for the debugger drift view', () => {
   warnings.length = 0;
   const em = new EventManager();
   em.register({ 'declared:ok': { payload: null } });
   em.emit('drifted:event');
   assert.ok(em.undeclared.has('drifted:event'), 'drift set records undeclared usage');
   assert.ok(!em.undeclared.has('declared:ok'), 'declared events are not drift');
});
