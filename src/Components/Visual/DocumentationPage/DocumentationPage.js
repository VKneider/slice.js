export default class DocumentationPage extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];

      this.components = ['Button', 'Card', 'Checkbox', 'Input', 'Switch'];
   }

   async init() {
      await import('https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js');
      await import('https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js');
      const css = await fetch('https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css');
      const cssText = await css.text();
      const style = document.createElement('style');
      style.innerHTML = cssText;
      document.head.appendChild(style);

      const navBar = await slice.build('Navbar', {
         position: 'fixed',
         logo: {
            src: '../../images/Slice.js-logo.png',
            path: '/',
         },
         items: [
            {
               text: 'Home',
               path: '/',
            },
            {
               text: 'Documentation',
               path: '/Documentation',
            },
            {
               text: 'Playground',
               path: '/Playground',
            },
         ],
         buttons: [
            {
               value: 'Change Theme',
               // color:
               onClickCallback: async () => {
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

      const components = {
         Button: 'Visual',
         Card: 'Visual',
         Checkbox: 'Visual',
         Input: 'Visual',
         Switch: 'Visual',
      };

      let documentationRoutes = {
         value: 'Visual',
         items: [],
      };

      for (const name in components) {
         const component = {
            value: name,
            path: `/Documentation/${name}`,
            component: `${name}Documentation`,
         };
         if (components[name] === 'Visual') {
            documentationRoutes.items.push(component);
         }
      }

      const treeview = await slice.build('TreeView', {
         items: [
            {
               value: 'Introduction',
               items: [
                  {
                     value: 'What is Slice.js?',
                     path: '/Documentation/What-is-Slice.js',
                     component: 'WhatIsSlice',
                  },
                  {
                     value: 'Installation',
                     path: '/Documentation/Installation',
                     component: 'Installation',
                  },
               ],
            },
            {
               value: 'Getting Started',
               items: [
                  {
                     value: 'Components',
                     items: [
                        {
                           value: 'The build method',
                           path: '/Documentation/The-build-method',
                           component: 'TheBuildMethod',
                        },
                        {
                           value: 'Visual',
                           path: '/Documentation/Visual',
                           component: 'VisualDocumentation',
                        },
                        {
                           value: 'Structural',
                           path: '/Documentation/Structural',
                           component: 'StructuralDocumentation',
                        },
                        {
                           value: 'Services',
                           path: '/Documentation/Services',
                           component: 'ServicesDocumentation',
                        },
                        {
                           value: `Lifecycle methods`,
                           path: '/Documentation/Lifecycle-methods',
                           component: 'LifecycleMethods',
                        },
                     ],
                  },
                  {
                     value: 'Routing',
                     path: '/Documentation/Routing',
                     component: 'RoutingDocumentation',
                  },
                  {
                     value: 'Themes',
                     path: '/Documentation/Themes',
                     component: 'ThemesDocumentation',
                  },
                  {
                     value: 'Slice Styles',
                     path: '/Documentation/Slice-Styles',
                     component: 'SliceStylesDocumentation',
                  },
               ],
            },
            {
               value: 'Components Library',
               items: [
                  {
                     value: 'Services',
                     items: [
                        {
                           value: 'FetchManager',
                           path: '/Documentation/SliceComponents/FetchManager',
                        },
                     ],
                  },
                  documentationRoutes,
               ],
            },
         ],
         onClickCallback: async (item) => {
            if (item.path) {
               //myRouteContainer.path = item.path;
               //myRouteContainer.component = item.component;
               await slice.router.navigate(item.path);
               myNavigation.page = VisualComponentsMultiRoute;
            }
         },
      });

      const extraRoute = {
         path: '/Documentation',
         component: 'Documentation',
      };

      //add extra route to the routes
      documentationRoutes.items.push(extraRoute);

      function getRoutes(array) {
         for (let i = 0; i < array.length; i++) {
            if (array[i].items) {
               getRoutes(array[i].items);
            } else {
               const exists = documentationRoutes.items.some(route => route.path === array[i].path);
               if (!exists) {
                  documentationRoutes.items.push(array[i]);
               }
            }
         }
      }      

      const VisualComponentsMultiRoute = await slice.build('MultiRoute', {
         routes: documentationRoutes.items,
      });

      const mainMenu = await slice.build('MainMenu', {});
      mainMenu.add(treeview);

      const myNavigation = await slice.build('MyNavigation', {
         page: VisualComponentsMultiRoute,
      });

      const layOut = await slice.build('Layout', {
         // layout: div,
         view: VisualComponentsMultiRoute,
      });

      layOut.onLayOut(mainMenu);
      layOut.onLayOut(navBar);
      layOut.onLayOut(myNavigation);

      let theme = slice.stylesManager.themeManager.currentTheme;

      this.appendChild(layOut);

      //if route is domain/Documentation 
      if (window.location.pathname === '/Documentation') {
         VisualComponentsMultiRoute.renderIfCurrentRoute();
      }

   }

}

customElements.define('slice-documentation-page', DocumentationPage);
