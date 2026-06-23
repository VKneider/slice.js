// Real-Controller tests for the dev-mode leak detector (findOrphans + criteria).
// Loads the REAL Controller via the resolve hook (same pattern as
// destroy-cascade.test.js) and drives it with a minimal fake DOM. Fake nodes are
// made `instanceof HTMLElement` because findOrphans filters on that.
import { register } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.alert = () => {};
register(new URL('./fixtures/real-runtime-loader.mjs', import.meta.url));

globalThis.HTMLElement = class HTMLElement {};
globalThis.slice = {
   logger: { logError() {}, logWarning() {}, logInfo() {} },
   events: null,
};

const { default: Controller } = await import('../Components/Structural/Controller/Controller.js');

function mkEl(sliceId, children = []) {
   return Object.assign(Object.create(HTMLElement.prototype), {
      sliceId,
      tagName: 'SLICE-X',
      isConnected: true,
      parentComponent: null,
      _children: children,
      querySelectorAll() {
         const out = [];
         const walk = (n) => { for (const c of n._children) { out.push(c); walk(c); } };
         walk(this);
         return out;
      },
      setAttribute() {},
      remove() { this.isConnected = false; },
   });
}

function flatten(root) {
   const out = [root];
   for (const c of root._children) out.push(...flatten(c));
   return out;
}

function buildTree(controller, root) {
   for (const node of flatten(root)) controller.registerComponent(node);
   controller.registerComponentsRecursively(root);
}

test('a built-then-detached component (no destroy) IS flagged', () => {
   const c = new Controller();
   const comp = mkEl('leaky');
   buildTree(c, comp);
   comp.isConnected = false; // simulate innerHTML='' / remove() without destroyComponent

   const orphans = c.findOrphans();
   assert.equal(orphans.length, 1, 'one orphan');
   assert.equal(orphans[0].sliceId, 'leaky');
   assert.ok(orphans[0].retainPath.includes('Object(leaky)') || orphans[0].retainPath.length >= 1);
});

test('a connected component is NOT flagged', () => {
   const c = new Controller();
   const comp = mkEl('alive');
   buildTree(c, comp);
   assert.equal(c.findOrphans().length, 0);
});

test('__sliceCached components are excluded (Route/MultiRoute cache)', () => {
   const c = new Controller();
   const comp = mkEl('cachedView');
   buildTree(c, comp);
   comp.isConnected = false;
   comp.__sliceCached = true;
   assert.equal(c.findOrphans().length, 0);
});

test('router-managed route-* sliceIds are excluded', () => {
   const c = new Controller();
   const comp = mkEl('route-Home');
   buildTree(c, comp);
   comp.isConnected = false;
   assert.equal(c.findOrphans().length, 0);
});

test('ancestor de-dup: only the detached root is reported', () => {
   const c = new Controller();
   const child = mkEl('child');
   const parent = mkEl('parent', [child]);
   buildTree(c, parent);
   parent.isConnected = false;
   child.isConnected = false;

   const orphans = c.findOrphans();
   assert.equal(orphans.length, 1, 'only the root, not the descendant');
   assert.equal(orphans[0].sliceId, 'parent');
});

test('descendants of a cached subtree are NOT flagged', () => {
   const c = new Controller();
   const child = mkEl('child');
   const parent = mkEl('parent', [child]);
   buildTree(c, parent);
   parent.__sliceCached = true; // cached route root
   parent.isConnected = false;
   child.isConnected = false;
   assert.equal(c.findOrphans().length, 0);
});

test('app-registered exclusion predicate is honored', () => {
   const c = new Controller();
   const comp = mkEl('special');
   buildTree(c, comp);
   comp.isConnected = false;
   c.registerLeakExclusion((node) => node.sliceId === 'special');
   assert.equal(c.findOrphans().length, 0);
});

test('growth heuristic trips on monotonic increase and resets on shrink', () => {
   const c = new Controller();
   assert.equal(c.isGrowthMonotonic(), false, 'needs >= 5 samples');

   for (let i = 0; i < 5; i++) {
      c.registerComponent(mkEl(`g${i}`));
      c.sampleComponentGrowth();
   }
   assert.equal(c.isGrowthMonotonic(), true, 'sizes 1..5 are monotonic growth');

   c.destroyComponent('g4');
   c.sampleComponentGrowth(); // size dips
   assert.equal(c.isGrowthMonotonic(), false, 'a shrink breaks the monotonic signal');
});
