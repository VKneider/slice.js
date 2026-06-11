// Real-runtime integration tests for build({ singleton: true }).
//
// These load the REAL Slice + REAL Controller (no FakeController): the only
// fixture is the components map, injected via a resolve hook because Controller
// imports a browser-absolute '/Components/components.js'. Singletons are
// Service-only (no DOM), so the full build → getOrCreate → _build →
// registerComponent path runs end-to-end under node, exercising the actual
// shipped code.
import { register } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.alert = () => {};
register(new URL('./fixtures/real-runtime-loader.mjs', import.meta.url));

const { default: Slice } = await import('../Slice.js');
const { default: Controller } = await import('../Components/Structural/Controller/Controller.js');

// A real Service-shaped class. The components fixture registers 'Probe' as a
// Service and 'ModalProbe' as a Visual.
let constructCount = 0;
let failNext = false;

class Probe {
  constructor(props) {
    constructCount += 1;
    if (failNext) {
      failNext = false;
      throw new Error('boom'); // simulate a failed build on first attempt
    }
    this.props = props;
  }
  async init() {}
}

class FakeStylesManager {
  registerComponentStyles() {}
}

function createSlice() {
  const instance = new Slice(
    {
      paths: {
        components: {
          Service: { path: '/Components/Service', type: 'Service' },
          Visual: { path: '/Components/Visual', type: 'Visual' },
          // Custom category whose type is Service (e.g. an app's own services).
          AppServices: { path: '/Components/AppServices', type: 'Service' }
        }
      },
      themeManager: {},
      stylesManager: {},
      logger: {},
      debugger: { enabled: false },
      loading: {},
      events: {}
    },
    { Controller, StylesManager: FakeStylesManager }
  );

  instance.logger = { logError() {}, logWarning() {}, logInfo() {} };
  // Pre-seed the class so _build skips the network fetch (the real path for a
  // class already cached by the controller). Everything else is real.
  instance.controller.classes.set('Probe', Probe);
  // AppProbe is a Service-shaped class registered under the custom 'AppServices'
  // category; reuse the Probe class (same shape).
  instance.controller.classes.set('AppProbe', Probe);
  return instance;
}

function withSlice(fn) {
  return async () => {
    const original = globalThis.slice;
    constructCount = 0;
    failNext = false;
    const slice = createSlice();
    globalThis.slice = slice;
    try {
      await fn(slice);
    } finally {
      globalThis.slice = original;
    }
  };
}

test(
  'singleton returns the same instance across awaited calls and builds once',
  withSlice(async (slice) => {
    const a = await slice.build('Probe', { singleton: true });
    const b = await slice.build('Probe', { singleton: true });

    assert.ok(a, 'first call returns an instance');
    assert.equal(a, b, 'same instance reference');
    assert.equal(constructCount, 1, 'constructed exactly once');
    assert.equal(a.sliceId, 'Probe', 'sliceId defaults to component name');
    assert.equal(slice.controller.activeComponents.get('Probe'), a, 'registered in activeComponents');
  })
);

test(
  'concurrent singleton builds share one in-flight build (race-safe)',
  withSlice(async (slice) => {
    const [a, b] = await Promise.all([
      slice.build('Probe', { singleton: true }),
      slice.build('Probe', { singleton: true })
    ]);

    assert.equal(a, b, 'both callers get the same instance');
    assert.equal(constructCount, 1, 'deduped to a single construction');
  })
);

test(
  'named singletons via distinct sliceId are separate instances',
  withSlice(async (slice) => {
    const a = await slice.build('Probe', { singleton: true, sliceId: 'probeA' });
    const b = await slice.build('Probe', { singleton: true, sliceId: 'probeB' });

    assert.notEqual(a, b);
    assert.equal(a.sliceId, 'probeA');
    assert.equal(b.sliceId, 'probeB');
    assert.equal(constructCount, 2);
  })
);

test(
  'a failed singleton build is not cached and the next call retries',
  withSlice(async (slice) => {
    failNext = true;
    const first = await slice.build('Probe', { singleton: true });
    assert.equal(first, null, 'failed build resolves to null');
    assert.equal(
      slice.controller._pendingBuilds.has('Probe'),
      false,
      'pending entry cleared after settle'
    );
    assert.equal(
      slice.controller.activeComponents.has('Probe'),
      false,
      'failed build never registered'
    );

    const second = await slice.build('Probe', { singleton: true });
    assert.ok(second, 'retry succeeds');
    assert.equal(constructCount, 2, 'retried construction');
  })
);

test(
  'singleton:true is rejected for non-Service components',
  withSlice(async (slice) => {
    let errored = false;
    slice.logger.logError = () => {
      errored = true;
    };

    const result = await slice.build('ModalProbe', { singleton: true });

    assert.equal(result, null, 'returns null for a Visual');
    assert.equal(errored, true, 'logs an error');
    assert.equal(constructCount, 0, 'never constructed');
  })
);

test(
  'singleton:true is allowed for a custom Service-type category (AppServices)',
  withSlice(async (slice) => {
    let errored = false;
    slice.logger.logError = () => {
      errored = true;
    };

    const a = await slice.build('AppProbe', { singleton: true });
    const b = await slice.build('AppProbe', { singleton: true });

    assert.ok(a, 'builds the instance');
    assert.equal(a, b, 'returns the same singleton instance');
    assert.equal(errored, false, 'does not log an error for a Service-type category');
    assert.equal(constructCount, 1, 'constructed exactly once');
  })
);

test(
  'default (non-singleton) build path is unchanged',
  withSlice(async (slice) => {
    const a = await slice.build('Probe');
    const b = await slice.build('Probe');

    assert.ok(a);
    assert.ok(b);
    assert.notEqual(a, b, 'each non-singleton build is a fresh instance');
    assert.equal(constructCount, 2);
  })
);

test(
  'props only apply on the first (creating) call',
  withSlice(async (slice) => {
    const a = await slice.build('Probe', { singleton: true, tag: 'first' });
    const b = await slice.build('Probe', { singleton: true, tag: 'second' });

    assert.equal(a, b, 'same instance');
    assert.equal(constructCount, 1, 'not rebuilt');
    assert.equal(a.props.tag, 'first', 'later props are ignored');
  })
);

test(
  'the singleton/sliceId directives are not forwarded to the component props',
  withSlice(async (slice) => {
    const a = await slice.build('Probe', { singleton: true, sliceId: 'probeX', tag: 'keep' });

    assert.equal(a.props.tag, 'keep', 'real props pass through');
    assert.equal('singleton' in a.props, false, 'singleton flag stripped');
    assert.equal('sliceId' in a.props, false, 'sliceId directive stripped');
  })
);

test(
  'singleton is stripped from props even on a non-singleton build',
  withSlice(async (slice) => {
    const a = await slice.build('Probe', { singleton: false, tag: 'keep' });

    assert.ok(a);
    assert.equal(a.props.tag, 'keep', 'real props pass through');
    assert.equal('singleton' in a.props, false, 'singleton key never reaches the component');
  })
);

test(
  'singleton:true on an unregistered component is rejected (unknown category)',
  withSlice(async (slice) => {
    let errored = false;
    slice.logger.logError = () => {
      errored = true;
    };

    const result = await slice.build('NotRegistered', { singleton: true });

    assert.equal(result, null, 'returns null');
    assert.equal(errored, true, 'logs an error');
    assert.equal(constructCount, 0, 'never constructed');
  })
);
