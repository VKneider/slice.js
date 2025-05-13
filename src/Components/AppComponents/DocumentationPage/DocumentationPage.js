export default class DocumentationPage extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async init() {
      // Centralizar las rutas de documentación
      const routesConfig = {
         introduction: {
            title: 'Introduction',
            items: [
               {
                  title: 'What is Slice.js?',
                  path: '/Documentation/What-is-Slice.js',
                  component: 'WhatIsSlice'
               },
               {
                  title: 'Installation',
                  path: '/Documentation/Installation',
                  component: 'Installation'
               }
            ]
         },
         gettingStarted: {
            title: 'Getting Started',
            items: [
               {
                  title: 'Components',
                  items: [
                     {
                        title: 'The build method',
                        path: '/Documentation/The-build-method',
                        component: 'TheBuildMethod'
                     },
                     {
                        title: 'Visual',
                        path: '/Documentation/Visual',
                        component: 'VisualDocumentation'
                     },
                     {
                        title: 'Structural',
                        path: '/Documentation/Structural',
                        component: 'StructuralDocumentation'
                     },
                     {
                        title: 'Services',
                        path: '/Documentation/Service',
                        component: 'ServiceDocumentation'
                     },
                     {
                        title: 'Lifecycle methods',
                        path: '/Documentation/Lifecycle-methods',
                        component: 'LifecycleMethods'
                     }
                  ]
               },
               {
                  title: 'Routing',
                  path: '/Documentation/Routing',
                  component: 'RoutingDocumentation'
               },
               {
                  title: 'Themes',
                  path: '/Documentation/Themes',
                  component: 'ThemesDocumentation'
               },
               {
                  title: 'Slice Styles',
                  path: '/Documentation/Slice-Styles',
                  component: 'SliceStylesDocumentation'
               }
            ]
         },
         componentsLibrary: {
            title: 'Components Library',
            items: [
             /*  {
                  title: 'Services',
                  items: [
                     {
                        title: 'FetchManager',
                        path: '/Documentation/SliceComponents/FetchManager'
                     }
                  ]
               },*/
               {
                  title: 'Visual',
                  path: '/Documentation/Visual',
                  items: [
                     { title: 'Button', path: '/Documentation/Components/Visual/Button', component: 'ButtonDocumentation' },
                     { title: 'Card', path: '/Documentation/Components/Visual/Card', component: 'CardDocumentation' },
                     { title: 'Checkbox', path: '/Documentation/Components/Visual/Checkbox', component: 'CheckboxDocumentation' },
                     { title: 'Input', path: '/Documentation/Components/Visual/Input', component: 'InputDocumentation' },
                     { title: 'Switch', path: '/Documentation/Components/Visual/Switch', component: 'SwitchDocumentation' }
                  ]
               }
            ]
         },
         defaultRoute: {
            path: '/Documentation',
            component: 'Documentation'
         }
      };

      const navBar = await slice.build('Navbar', {
         position: 'fixed',
         logo: {
            src: '/images/Slice.js-logo.png',
            path: '/',
         },
         items: [
            { text: 'Home', path: '/' },
            { text: 'Documentation', path: '/Documentation' },
            { text: 'Playground', path: '/Playground' },
            { text: 'Our Team', path: '/Team' }
         ],
         buttons: [
            {
               value: 'Change Theme',
               onClickCallback: async () => {
                  let theme = slice.stylesManager.themeManager.currentTheme;
                  if (theme === 'Slice') {
                     await slice.setTheme('Light');
                     theme = 'Light';
                  } else if (theme === 'Light') {
                     await slice.setTheme('Dark');
                     theme = 'Dark';
                  } else if (theme === 'Dark') {
                     await slice.setTheme('Slice');
                     theme = 'Slice';
                  }
               },
            },
         ],
      });

      // Función para extraer todas las rutas para MultiRoute
      const getAllRoutes = (routesObj) => {
         const allRoutes = [];
         
         const processItems = (items) => {
            if (!items) return;
            
            items.forEach(item => {
               if (item.path && item.component) {
                  allRoutes.push({
                     path: item.path,
                     component: item.component
                  });
               }
               
               if (item.items) {
                  processItems(item.items);
               }
            });
         };
         
         // Procesar cada sección principal
         Object.values(routesObj).forEach(section => {
            if (section.path && section.component) {
               allRoutes.push({
                  path: section.path,
                  component: section.component
               });
            }
            
            if (section.items) {
               processItems(section.items);
            }
         });
         
         return allRoutes;
      };

      // Función para convertir el config de rutas al formato del TreeView
      const createTreeViewItems = (routesConfig) => {
         return [
            {
               value: routesConfig.introduction.title,
               items: routesConfig.introduction.items.map(item => ({
                  value: item.title,
                  path: item.path,
                  component: item.component
               }))
            },
            {
               value: routesConfig.gettingStarted.title,
               items: routesConfig.gettingStarted.items.map(item => {
                  if (item.items) {
                     return {
                        value: item.title,
                        items: item.items.map(subItem => ({
                           value: subItem.title,
                           path: subItem.path,
                           component: subItem.component
                        }))
                     };
                  }
                  return {
                     value: item.title,
                     path: item.path,
                     component: item.component
                  };
               })
            },
            {
               value: routesConfig.componentsLibrary.title,
               items: routesConfig.componentsLibrary.items.map(item => {
                  if (item.items) {
                     return {
                        value: item.title,
                        items: item.items.map(subItem => ({
                           value: subItem.title,
                           path: subItem.path,
                           component: subItem.component
                        }))
                     };
                  }
                  return {
                     value: item.title,
                     path: item.path,
                     component: item.component
                  };
               })
            }
         ];
      };

      // Obtener todas las rutas planas para el MultiRoute
      const multiRouteItems = getAllRoutes(routesConfig);
      
      // Asegurarse que la ruta por defecto esté incluida
      if (!multiRouteItems.some(route => route.path === routesConfig.defaultRoute.path)) {
         multiRouteItems.push(routesConfig.defaultRoute);
      }

      console.log('MultiRoute items:', multiRouteItems);

      // Crear el MultiRoute con todas las rutas
      const VisualComponentsMultiRoute = await slice.build('MultiRoute', {
         routes: multiRouteItems
      });

      // Crear el TreeView con la estructura jerárquica
      const treeviewItems = createTreeViewItems(routesConfig);
      const treeview = await slice.build('TreeView', {
         items: treeviewItems,
         onClickCallback: async (item) => {
            if (item.path) {
               await slice.router.navigate(item.path);
               myNavigation.page = VisualComponentsMultiRoute;
            }
         },
      });

      const mainMenu = await slice.build('MainMenu', {});
      mainMenu.add(treeview);

      const myNavigation = await slice.build('MyNavigation', {
         page: VisualComponentsMultiRoute,
      });

      const layOut = await slice.build('Layout', {
         view: VisualComponentsMultiRoute,
      });

      layOut.onLayOut(mainMenu);
      layOut.onLayOut(navBar);
      layOut.onLayOut(myNavigation);

      if (window.location.pathname === '/Documentation') {
         await VisualComponentsMultiRoute.renderIfCurrentRoute();
      }
      
      this.appendChild(layOut);
   }
}

customElements.define('slice-documentation-page', DocumentationPage);