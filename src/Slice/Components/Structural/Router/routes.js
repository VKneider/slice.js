const routes = [
   { path: '/', component: 'LandingPage' },
   {
      path: '/products',
      component: 'Test1',
      children: [
         {
            path: '/info',
            component: 'Button',
         },
         {
            path: '/list',
            component: 'ProductList',
         },
         {
            path: '/search',
            component: 'ProductSearch',
         },
      ],
   },
   { path: '/Playground', component: 'Playground' },
   { path: '/Documentation', component: 'DocumentationPage' },
   { path: '/Documentation/*/', component: 'DocumentationPage' },
   { path: '/404', component: 'NotFound' },
];

export default routes;
