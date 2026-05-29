// App Shell + MultiRoute starter.
// Every section URL renders AppShell, which swaps the content area via a MultiRoute.
// Dynamic params use ${name} (NOT :name). Keep the 404 route last.
const routes = [
   { path: '/',      component: 'AppShell', metadata: { title: 'Home' } },
   { path: '/about', component: 'AppShell', metadata: { title: 'About' } },
   { path: '/404',   component: 'NotFound', metadata: { title: 'Not Found' } }
];

export default routes;