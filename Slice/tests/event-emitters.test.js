// Tests for emitter tracing: who emits each event (bind attribution + dev
// stack-trace fallback), recorded only while a debugger is "open" (recording).
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.slice = {
   isProduction: () => false,
   controller: { activeComponents: new Map() },
   logger: { logError() {}, logInfo() {}, logWarning() {}, info() {}, error() {} },
};

const { default: EventManager } = await import('../Components/Structural/EventManager/EventManager.js');

test('bound emit is attributed to its component', () => {
   const em = new EventManager();
   em.startRecording();
   const comp = { sliceId: 'card-1', constructor: { name: 'Card' } };
   em.bind(comp).emit('user:login', { id: 1 });

   const bucket = em.emitters.get('user:login');
   assert.ok(bucket, 'event has emitters bucket');
   const entry = bucket.get('card-1');
   assert.equal(entry.name, 'Card');
   assert.equal(entry.sliceId, 'card-1');
   assert.equal(entry.count, 1);

   const hist = em.emitHistory.find((e) => e.eventName === 'user:login');
   assert.equal(hist.emitter.sliceId, 'card-1', 'history entry carries the emitter');
});

test('global emit falls back to a dev stack-trace source', () => {
   const em = new EventManager();
   em.startRecording();
   em.emit('router:change');

   const hist = em.emitHistory.find((e) => e.eventName === 'router:change');
   assert.ok(hist.emitter, 'emitter captured for global emit');
   assert.ok(hist.emitter.source && hist.emitter.source.includes('.js'), 'source is file:line');
   assert.ok(!hist.emitter.source.includes('EventManager.js'), 'attributes the caller, not the manager');
});

test('emitter counts accumulate per distinct source', () => {
   const em = new EventManager();
   em.startRecording();
   em.bind({ sliceId: 'a-1', constructor: { name: 'A' } }).emit('x:y');
   em.bind({ sliceId: 'a-1', constructor: { name: 'A' } }).emit('x:y');
   em.bind({ sliceId: 'b-2', constructor: { name: 'B' } }).emit('x:y');

   const bucket = em.emitters.get('x:y');
   assert.equal(bucket.get('a-1').count, 2);
   assert.equal(bucket.get('b-2').count, 1);
});

test('no recording (debugger closed) => no emitter tracking, zero overhead', () => {
   const em = new EventManager();
   em.emit('a:b');
   em.bind({ sliceId: 'z-1', constructor: { name: 'Z' } }).emit('a:b');
   assert.equal(em.emitters.size, 0);
   assert.equal(em.emitHistory.length, 0);
});

test('production: no stack-trace source captured', () => {
   globalThis.slice.isProduction = () => true;
   const em = new EventManager();
   em.startRecording();
   em.emit('p:q');
   const hist = em.emitHistory.find((e) => e.eventName === 'p:q');
   assert.equal(hist.emitter, null, 'no source attribution in production');
   globalThis.slice.isProduction = () => false;
});

test('startRecording resets the emitters map', () => {
   const em = new EventManager();
   em.startRecording();
   em.bind({ sliceId: 'a-1', constructor: { name: 'A' } }).emit('x:y');
   assert.equal(em.emitters.size, 1);
   em.startRecording();
   assert.equal(em.emitters.size, 0, 'fresh session clears prior emitters');
});
