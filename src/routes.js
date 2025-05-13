const routes = [
   // Rutas principales
   { path: '/', component: 'LandingPage' },
   {
      path: '/Documentation',
      component: 'DocumentationPage',
      children: [
         {
            path: '/Slice',
            component: 'WhatIsSlice',
         },
         {
            path:'/Visual',
            component: 'VisualDocumentation',
         },
         {
            path:'/Service',
            component: 'ServiceDocumentation',
         },
         {
            path:'/Structural',
            component: 'StructuralDocumentation',
         },

         {
            path:'/Themes',
            component: 'ThemesDocumentation',
         },
         {
            path:'/Routing',
            component: 'RoutingDocumentation',
         },
         {
            path: '/Installation',
            component: 'Installation',
         },
         {
            path: '/The-build-method',
            component: 'TheBuildMethod',
         },
         {
            path:'/Components',
            component: 'DocumentationPage',
            children:[
               {
                  path: '/Visual',
                  component: 'VisualDocumentation',
                  children: [
                     {
                        path: '/Card',
                        component: 'CardDocumentation',
                     },
                     {
                        path:'/Button',
                        component: 'ButtonDocumentation',
                     },
                     {
                        path:'/Switch',
                        component: 'SwitchDocumentation',
                     },
                     {
                        path:'/Checkbox',
                        component: 'CheckboxDocumentation',
                     },
                     {
                        path:'/Input',
                        component: 'InputDocumentation',
                     }
                  ]
               },
               {
                  path: '/Service',
                  component: 'ServiceDocumentation',
                  children:[
                     {
                        path: '/FetchManager',
                        component: 'FetchManagerDocumentation',
                     }
                  ]
               }
            ]
         } 
      ]
   },
   // Otras rutas
   { path: '/Playground', component: 'Playground' },
   { path: '/404', component: 'NotFound' },
   {
      path: '/Docum/${category}/${id}',
      component: 'LandingPage',
   },
   {
      path: '/Team',
      component: 'TheSliceTeam',
   }
];

export default routes;