const routes = [
   { path: '/', component: 'LandingPage' },
   {
      path: '/Documentation',
      component: 'DocumentationPage',
      children: [
         {
            path:"/Button",
            component:"ButtonDocumentation",
         }
      ],
   },
   { path: '/Documentation/CustomMenu', component: 'DocumentationPage',
      children: [
         {
            path:"/Button",
            component:"CardDocumentation",
         }
      ] },
      {path:"/Documentation/CustomMenu/pepito",component:"Button"},
   { path: '/Playground', component: 'Playground' },
   { path: '/404', component: 'NotFound' },
];

export default routes;
