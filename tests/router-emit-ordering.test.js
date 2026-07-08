// Regression test for GOTCHAS §3: router:change must not be observable before
// slice.router.activeRoute is updated.
//
// Router is a plain class with no module-level DOM/global access and no imports,
// so onRouteChange() can be exercised directly on a stubbed instance. The fix
// makes onRouteChange() resolve only AFTER the debounced handleRoute() runs
// (which is where activeRoute is set), so a caller that awaits it — like
// _performNavigation — emits router:change with activeRoute already current.
//
// Run: node --test tests/router-emit-ordering.test.js

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

describe('Router.onRouteChange (§3 emit-after-activeRoute)', () => {
  let Router;

  before(async () => {
    globalThis.window = globalThis.window || { location: { pathname: '/' } };
    globalThis.slice = globalThis.slice || { logger: { error() {} }, router: {} };
    ({ default: Router } = await import('../Slice/Components/Structural/Router/Router.js'));
  });

  const makeRouter = (handleRoute) => {
    const r = Object.create(Router.prototype);
    r.renderRoutesComponentsInPage = async () => false; // not the MultiRoute container path
    r.matchRoute = () => ({ route: { component: 'X' }, params: {} });
    r.handleRoute = handleRoute;
    return r;
  };

  test('awaiting onRouteChange() waits until handleRoute() has finished', async () => {
    const order = [];
    const r = makeRouter(async () => {
      await new Promise((res) => setTimeout(res, 5)); // simulate async render
      order.push('handleRoute-done'); // activeRoute is assigned here in the real code
    });

    await r.onRouteChange();
    order.push('after-await');

    // With the fix, handleRoute completes BEFORE the await returns. (Before the
    // fix the awaited promise resolved the instant the timer was scheduled, so
    // 'after-await' would land first — i.e. emit-before-activeRoute.)
    assert.deepEqual(order, ['handleRoute-done', 'after-await']);
  });

  test('a superseded (debounced) call still resolves — no hang', async () => {
    let handled = 0;
    const r = makeRouter(async () => { handled++; });

    const p1 = r.onRouteChange(); // schedules timer T1
    const p2 = r.onRouteChange(); // clears T1, resolves p1, schedules T2

    await Promise.race([
      Promise.all([p1, p2]),
      new Promise((_, rej) => setTimeout(() => rej(new Error('onRouteChange hung')), 1000)),
    ]);

    // Only the surviving timer runs its work.
    assert.equal(handled, 1);
  });
});
