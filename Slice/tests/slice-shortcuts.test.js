import test from 'node:test';
import assert from 'node:assert/strict';
import Slice from '../Slice.js';

/** A Slice instance without running init(): only the shortcuts are under test. */
const withRouter = (router) => {
   const instance = Object.create(Slice.prototype);
   instance.router = router;
   return instance;
};

test('slice.path is the router path, with the browser path before it exists', () => {
   assert.equal(withRouter({ path: '/pricing' }).path, '/pricing');
   // node: no window. In the browser this is window.location.pathname.
   assert.equal(withRouter({}).path, '/');
});

test('slice.href delegates to the router and returns the path without one', () => {
   assert.equal(withRouter({ href: (path) => `/en${path}` }).href('/pricing'), '/en/pricing');
   assert.equal(withRouter({}).href('/pricing'), '/pricing');
   assert.equal(withRouter({}).href(null), '');
   assert.equal(withRouter({}).href(42), '42');
});
