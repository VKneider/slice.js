const routes = [
  { path: '/', component: "LandingPage" },
  { path: '/Playground', component: 'Playground' },
  { path: '/Documentation', component: "DocumentationPage" },
  { path: '/404', component: 'NotFound' },
  { path: '/Documentation/*', component: 'DocumentationPage' }

];



export default routes;