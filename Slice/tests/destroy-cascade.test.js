// Real-Controller tests for destroyComponent cascading to children.
//
// Loads the REAL Controller (via the resolve hook that stubs its
// '/Components/components.js' import) and drives it with a minimal fake DOM, so
// the actual registerComponentsRecursively + destroyComponent code runs. This
// reproduces the childrenIndex bug and verifies the fix: destroyComponent(parent)
// must cascade to nested Visual children, running their beforeDestroy.
import { register } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.alert = () => {};
register(new URL('./fixtures/real-runtime-loader.mjs', import.meta.url));

// The controller references the `slice` global for logging / events.
globalThis.slice = {
  logger: { logError() {}, logWarning() {}, logInfo() {} },
  events: null
};

const { default: Controller } = await import('../Components/Structural/Controller/Controller.js');

// --- minimal fake DOM ----------------------------------------------------
// Each node is a SLICE-* element with querySelectorAll('*') returning all of
// its descendants in document (pre) order — enough for registerComponentsRecursively.
let destroyLog = [];

function mkEl(sliceId, children = []) {
  const node = {
    sliceId,
    tagName: 'SLICE-X',
    isConnected: true,
    parentComponent: null,
    _children: children,
    querySelectorAll() {
      const out = [];
      const walk = (n) => {
        for (const c of n._children) {
          out.push(c);
          walk(c);
        }
      };
      walk(node);
      return out;
    },
    remove() {
      this.isConnected = false;
    },
    beforeDestroy() {
      destroyLog.push(this.sliceId);
    }
  };
  return node;
}

// Collect every node in a tree (pre-order).
function flatten(root) {
  const out = [root];
  for (const c of root._children) out.push(...flatten(c));
  return out;
}

// Simulate slice.build's registration: registerComponent WITHOUT a parent for
// every node, then registerComponentsRecursively on the root (what _build does
// for a Visual once its subtree is in the DOM).
function buildTree(controller, root) {
  for (const node of flatten(root)) controller.registerComponent(node);
  controller.registerComponentsRecursively(root);
}

function setup() {
  destroyLog = [];
  return new Controller();
}

test('destroyComponent(parent) cascades to a nested child', () => {
  const c = setup();
  const child = mkEl('child');
  const parent = mkEl('parent', [child]);
  buildTree(c, parent);

  assert.equal(c.activeComponents.has('child'), true, 'child registered');

  const count = c.destroyComponent(parent);

  assert.equal(c.activeComponents.has('parent'), false, 'parent removed');
  assert.equal(c.activeComponents.has('child'), false, 'child removed (cascaded)');
  assert.ok(destroyLog.includes('child'), 'child beforeDestroy ran');
  assert.equal(count, 2, 'reported 2 destroyed');
});

test('cascade reaches deep descendants, deepest beforeDestroy first', () => {
  const c = setup();
  const grandchild = mkEl('grandchild');
  const child = mkEl('child', [grandchild]);
  const parent = mkEl('parent', [child]);
  buildTree(c, parent);

  c.destroyComponent(parent);

  assert.equal(c.activeComponents.size, 0, 'all three destroyed');
  // deepest-first ordering (children before their parents)
  assert.ok(
    destroyLog.indexOf('grandchild') < destroyLog.indexOf('child'),
    'grandchild before child'
  );
  assert.ok(destroyLog.indexOf('child') < destroyLog.indexOf('parent'), 'child before parent');
});

test('childrenIndex records DIRECT parents, not ancestors', () => {
  const c = setup();
  const grandchild = mkEl('grandchild');
  const child = mkEl('child', [grandchild]);
  const parent = mkEl('parent', [child]);
  buildTree(c, parent);

  assert.deepEqual([...(c.childrenIndex.get('parent') || [])], ['child'], 'parent -> child');
  assert.deepEqual([...(c.childrenIndex.get('child') || [])], ['grandchild'], 'child -> grandchild');
  assert.equal(child.parentComponent.sliceId, 'parent');
  assert.equal(grandchild.parentComponent.sliceId, 'child', 'direct parent, not the root');
});

test('destroying a subtree leaves no stale childrenIndex entries', () => {
  const c = setup();
  const child = mkEl('child');
  const parent = mkEl('parent', [child]);
  buildTree(c, parent);

  c.destroyComponent(parent);

  assert.equal(c.childrenIndex.has('parent'), false, 'parent index entry cleared');
  assert.equal(c.childrenIndex.has('child'), false, 'child index entry cleared');
});

test('a Service (no DOM element) is NOT cascaded — still needs explicit destroy', () => {
  const c = setup();
  const child = mkEl('child');
  const parent = mkEl('parent', [child]);
  buildTree(c, parent);
  // A Service built by the parent: registered, but not part of any DOM subtree.
  const service = { sliceId: 'svc', isConnected: false, beforeDestroy() { destroyLog.push('svc'); } };
  c.registerComponent(service);

  c.destroyComponent(parent);

  assert.equal(c.activeComponents.has('svc'), true, 'service survives parent destroy');
  assert.equal(destroyLog.includes('svc'), false, 'service beforeDestroy did NOT run');
});

test('all siblings under one parent cascade', () => {
  const c = setup();
  const a = mkEl('a');
  const b = mkEl('b');
  const parent = mkEl('parent', [a, b]);
  buildTree(c, parent);

  assert.deepEqual([...c.childrenIndex.get('parent')].sort(), ['a', 'b']);

  c.destroyComponent(parent);
  assert.equal(c.activeComponents.size, 0, 'parent and both siblings destroyed');
});

test('destroying a mid-level child destroys only its subtree', () => {
  const c = setup();
  const grandchild = mkEl('grandchild');
  const child = mkEl('child', [grandchild]);
  const parent = mkEl('parent', [child]);
  buildTree(c, parent);

  const count = c.destroyComponent(child);

  assert.equal(count, 2, 'child + grandchild');
  assert.equal(c.activeComponents.has('parent'), true, 'parent survives');
  assert.equal(c.activeComponents.has('child'), false);
  assert.equal(c.activeComponents.has('grandchild'), false);
  assert.equal(
    c.childrenIndex.has('parent') && c.childrenIndex.get('parent').has('child'),
    false,
    "parent's index no longer points to the destroyed child"
  );
});

test('re-running registerComponentsRecursively is idempotent', () => {
  const c = setup();
  const child = mkEl('child');
  const parent = mkEl('parent', [child]);
  buildTree(c, parent);
  c.registerComponentsRecursively(parent); // walk again

  assert.deepEqual([...c.childrenIndex.get('parent')], ['child'], 'no duplicate edges');

  c.destroyComponent(parent);
  assert.equal(c.activeComponents.size, 0, 'still cascades cleanly');
});

test('destroyByContainer also collects the whole DOM subtree', () => {
  const c = setup();
  const grandchild = mkEl('grandchild');
  const child = mkEl('child', [grandchild]);
  const parent = mkEl('parent', [child]);
  buildTree(c, parent);

  // destroyByContainer queries [slice-id] on the container; emulate that query.
  const container = {
    querySelectorAll() {
      return flatten(parent).map((n) => ({
        getAttribute: () => n.sliceId,
        sliceId: n.sliceId
      }));
    }
  };

  const count = c.destroyByContainer(container);
  assert.equal(count, 3, 'all three destroyed via DOM discovery');
});
