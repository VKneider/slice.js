// Regression test: handleRoute() must not append a failed build to the DOM.
//
// slice.build() returns null on any unrecoverable path (component not
// registered, a resource fetch failed or was aborted mid-flight, init() threw).
// Passing that null straight to appendChild() raised
//   TypeError: Failed to execute 'appendChild' on 'Node': parameter 1 is not of type 'Node'
// which surfaced far from the real cause and made the failure look like a DOM
// bug. handleRoute() now reports the build failure and leaves the current view
// in place.
//
// Router has no imports and no module-level DOM access, so its prototype can be
// exercised directly against stubs (same approach as router-emit-ordering).
//
// Run: node --test tests/router-build-failure.test.js

import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('Router.handleRoute — failed component build', () => {
  let Router;
  let appended;
  let loggedErrors;
  let appElement;

  before(async () => {
    globalThis.window = globalThis.window || { location: { pathname: '/' } };
    globalThis.slice = globalThis.slice || {};
    ({ default: Router } = await import('../Slice/Components/Structural/Router/Router.js'));
  });

  beforeEach(() => {
    appended = [];
    loggedErrors = [];
    appElement = {
      innerHTML: 'previous view',
      appendChild(node) {
        // Mirror the real DOM contract: appending a non-Node is a TypeError.
        if (!node || typeof node !== 'object') {
          throw new TypeError(
            "Failed to execute 'appendChild' on 'Node': parameter 1 is not of type 'Node'."
          );
        }
        appended.push(node);
      },
    };

    globalThis.document = { querySelector: (sel) => (sel === '#app' ? appElement : null) };
    globalThis.slice = {
      logger: { logError: (...args) => loggedErrors.push(args) },
      controller: { getComponent: () => null },
      router: {},
      loading: null,
      build: async () => null, // the failure under test
    };
  });

  const makeRouter = () => {
    const r = Object.create(Router.prototype);
    r.renderRoutesInComponent = async () => {};
    r.invalidateCache = () => {};
    return r;
  };

  test('does not throw when slice.build() returns null', async () => {
    const r = makeRouter();
    await r.handleRoute({ path: '/broken', component: 'Broken' }, {});
    assert.equal(appended.length, 0, 'nothing should be appended');
  });

  test('logs the build failure naming the route and component', async () => {
    const r = makeRouter();
    await r.handleRoute({ path: '/broken', component: 'Broken' }, {});

    assert.equal(loggedErrors.length, 1, 'exactly one error should be reported');
    const [scope, message] = loggedErrors[0];
    assert.equal(scope, 'Router');
    assert.match(message, /\/broken/);
    assert.match(message, /Broken/);
  });

  test('leaves the current view untouched instead of blanking it', async () => {
    const r = makeRouter();
    await r.handleRoute({ path: '/broken', component: 'Broken' }, {});
    assert.equal(appElement.innerHTML, 'previous view');
  });

  test('does not mark the failed route as active', async () => {
    const r = makeRouter();
    await r.handleRoute({ path: '/broken', component: 'Broken' }, {});
    assert.equal(slice.router.activeRoute, undefined);
  });

  test('still stops the loading indicator', async () => {
    const stops = [];
    slice.loading = { start() {}, stop() { stops.push(1); } };

    const r = makeRouter();
    await r.handleRoute({ path: '/broken', component: 'Broken' }, {});
    assert.equal(stops.length, 1, 'loading.stop() must run even on the failure path');
  });

  test('a successful build still renders and activates the route', async () => {
    const component = { tagName: 'DIV' };
    slice.build = async () => component;

    const r = makeRouter();
    const route = { path: '/ok', component: 'Ok' };
    await r.handleRoute(route, {});

    assert.deepEqual(appended, [component]);
    assert.equal(appElement.innerHTML, '');
    assert.equal(slice.router.activeRoute, route);
    assert.equal(loggedErrors.length, 0);
  });

  test('reports instead of throwing when #app is missing', async () => {
    globalThis.document = { querySelector: () => null };

    const r = makeRouter();
    await r.handleRoute({ path: '/ok', component: 'Ok' }, {});

    assert.equal(loggedErrors.length, 1);
    assert.match(loggedErrors[0][1], /#app/);
  });
});
