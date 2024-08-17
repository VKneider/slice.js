export default class DocumentationPage extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];

      this.components = ['Button', 'Card', 'Checkbox', 'Input', 'Switch'];
   }

   async init() {

      await import("https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js")
      await import("https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js")
      const css = await fetch("https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css")
      const cssText = await css.text()
      const style = document.createElement('style')
      style.innerHTML = cssText
      document.head.appendChild(style)


      const div = document.createElement('div');
      const componentContainer = document.createElement('div');
      componentContainer.classList.add('docs_container');
      componentContainer.id = 'componentContainer';

      const divView = document.createElement('div');
      divView.classList.add('docs_container');

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
               text: 'About Us',
               path: '',
               type: 'dropdown',
               options: [
                  {
                     text: 'Julio',
                     path: 'https://github.com/juliograterol',
                  },
                  {
                     text: 'Victor',
                     path: 'https://github.com/VKneider',
                  },
               ],
            },
            {
               text: 'Documentation',
               path: '/Documentation',
            },
            {
               text: 'Playground',
               path: '/Playground',
            }
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
               }
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

      let compVisual = {
         value: 'Visual',
         items: [],
      };

      for (const name in components) {
         const component = {
            value: name,
            path: `/Documentation/${name}`,
            component:`${name}Documentation`,
         };
         if (components[name] === 'Visual') {
            compVisual.items.push(component);
         }
      }

      const treeview = await slice.build('TreeView', {
         items: [
            {value:'Introduction',
               items: [
                  {
                     value: 'What is Slice.js?',
                     path: '/Documentation/What-is-Slice.js',
                     component: 'WhatIsSlice'
                  },
                  {
                     value: 'Installation',
                     path: '/Documentation/Installation',
                     component: 'Installation'
                  },
               ],
            }, {
               value: 'Getting Started',
               items: [
                  {
                     value: 'Components',
                     items:[
                        {
                           value: 'The build method',
                           path: '/Documentation/The-build-method',
                           component: 'TheBuildMethod'
                        },
                        {
                           value: 'Visual',
                           path: '/Documentation/Visual',
                           component: 'VisualDocumentation'
                        },
                        {
                           value: 'Structural',
                           path: '/Documentation/Structural',
                           component: 'StructuralDocumentation'
                        },
                        {
                           value: 'Services',
                           path: '/Documentation/Services',
                           component: 'ServicesDocumentation'
                        },
                        {
                           value: `Lifecycle methods`,
                           path: '/Documentation/Lifecycle-methods',
                           component: 'LifecycleMethods'
                        }
                     ]
                  },
                  {
                     value: 'Routing',
                     path: '/Documentation/Routing',
                     component: 'RoutingDocumentation'
                  },
                  {
                     value: 'Themes',
                     path: '/Documentation/Themes',
                     component: 'ThemesDocumentation'
                  },
                  {
                     value: 'Slice Styles',
                     path: '/Documentation/Slice-Styles',
                     component: 'SliceStylesDocumentation'
                  },
               ],
            },
            {
               value: 'Components Library',
               items: [{
                  value:'Services',
                  items:[
                     {
                        value: 'FetchManager',
                        path: '/Documentation/SliceComponents/FetchManager',
                     }
                  ]
               },
               compVisual,
            ],
            },

         ],
         onClickCallback: async (item) => {
            if(item.path){
               myRouteContainer.path = item.path;
               myRouteContainer.component = item.component;
               await slice.router.navigate(item.path)
            }
         },
      });


      const mainMenu = await slice.build('MainMenu', {});
      mainMenu.add(treeview);
      div.appendChild(mainMenu);

      div.appendChild(navBar);

      const myNavigation = await slice.build('MyNavigation', {});

      div.appendChild(myNavigation);

      const myRouteContainer = await slice.build('Route', {
         path: '/Documentation',
         component: 'Documentation',
      });
      

      

      const layOut = await slice.build('Layout', {
         layout: div,
         view: myRouteContainer,
      });

      let theme = slice.stylesManager.themeManager.currentTheme;

      this.appendChild(layOut);

   }
}

customElements.define('slice-documentation-page', DocumentationPage);
