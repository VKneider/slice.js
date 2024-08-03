const routes = [
  { path: '/', component: "LandingPage", reuse: true },
  {
    path: '/3', component: "Test3", reuse: true, children: [
      {
        path: "/info",
        component: "ProductInfo"
      },
      {
        path: "/list",
        component: "ProductList"
      },
      {
        path: "/search",
        component: "ProductSearch"
      }
    ]
  },
  { path: '/Playground', component: 'Playground', reuse: true },
  { path: '/Documentation', component: "DocumentationPage", reuse: true },
  { path: '/Documentation/*/', component: 'DocumentationPage' },
  { path: '/404', component: 'NotFound' },

];



export default routes;