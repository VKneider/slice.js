const routes = [
  { path: '/', component: "Test1", reuse: true },
  { path: '/2', component: "Test2", reuse: true },
  { path: '/3', component: "Test3", reuse: true},
  { path: '/Playground', component: 'Playground', reuse: true },
  { path: '/Documentation', component: "DocumentationPage" },
  { path: '/Documentation/*/', component: 'DocumentationPage' },
  { path: '/404', component: 'NotFound' },
  { path: '/rutica/que/obviamente/existe/xd/xd/', component: 'DocumentationPage' },

];



export default routes;