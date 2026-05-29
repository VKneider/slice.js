import Slice from '/Slice/Slice.js';

// `slice` is now a global. Routes are declared in /routes.js and the router
// auto-starts shortly after load, so this file can stay almost empty.
//
// If you need navigation guards (auth, page titles, analytics), define them
// here and then start the router EXPLICITLY (this cancels the auto-start):
//
// slice.router.beforeEach(async (to, from, next) => {
//   if (to.metadata?.private && !slice.context.getState('auth')?.isLoggedIn) {
//     return next({ path: '/login', replace: true });
//   }
//   next();
// });
//
// slice.router.afterEach((to) => {
//   document.title = to.metadata?.title ?? 'Slice App';
// });
//
// await slice.router.start();
