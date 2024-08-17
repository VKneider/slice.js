export default class DocumentationPage extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];

      this.components = ['Button', 'Card', 'Checkbox', 'Input', 'Switch'];
   }

   async init() {


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
            href: '/',
         },
         items: [
            {
               text: 'Home',
               href: '/',
            },
            {
               text: 'About Us',
               href: '',
               type: 'dropdown',
               options: [
                  {
                     text: 'Julio',
                     href: 'https://github.com/juliograterol',
                  },
                  {
                     text: 'Victor',
                     href: 'https://github.com/VKneider',
                  },
               ],
            },
            {
               text: 'Documentation',
               href: '/Documentation',
            },
            {
               text: 'Playground',
               href: '/Playground',
            },
            {
               text: 'Card ',
               href: '/Documentation/Card',
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
            href: `/Documentation/SliceComponents/${name}`,
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
                     href: '/Documentation/What-is-Slice.js',
                     component: 'WhatIsSlice'
                  },
                  {
                     value: 'Installation',
                     href: '/Documentation/Installation',
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
                           href: '/Documentation/The-build-method',
                           component: 'TheBuildMethod'
                        },
                        {
                           value: 'Visual',
                           href: '/Documentation/Visual',
                           component: 'VisualDocumentation'
                        },
                        {
                           value: 'Structural',
                           href: '/Documentation/Structural',
                           component: 'StructuralDocumentation'
                        },
                        {
                           value: 'Services',
                           href: '/Documentation/Services',
                           component: 'ServicesDocumentation'
                        },
                        {
                           value: `Lifecycle methods`,
                           href: '/Documentation/Lifecycle-methods',
                           component: 'LifecycleMethods'
                        }
                     ]
                  },
                  {
                     value: 'Routing',
                     href: '/Documentation/Routing',
                     component: 'RoutingDocumentation'
                  },
                  {
                     value: 'Themes',
                     href: '/Documentation/Themes',
                     component: 'ThemesDocumentation'
                  },
                  {
                     value: 'Slice Styles',
                     href: '/Documentation/Slice-Styles',
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
                        href: '/Documentation/SliceComponents/FetchManager',
                     }
                  ]
               },
               compVisual,
            ],
            },

         ],
         onClickCallback: async (item) => {
            console.log('item', item);
            myRouteContainer.href = item.href;
            myRouteContainer.component = item.component;
            slice.router.navigate(item.href);
         }
      });


      const mainMenu = await slice.build('MainMenu', {});
      mainMenu.add(treeview);
      div.appendChild(mainMenu);

      div.appendChild(navBar);

      const myNavigation = await slice.build('MyNavigation', {});

      div.appendChild(myNavigation);

      const myRouteContainer = await slice.build('Route', {
         href: '/Documentation/',
         component: 'Documentation',
      });

      await myRouteContainer.render();

      const layOut = await slice.build('Layout', {
         layout: div,
         view: myRouteContainer,
      });

      let theme = slice.stylesManager.themeManager.currentTheme;

      this.appendChild(layOut);

   }
}

customElements.define('slice-documentation-page', DocumentationPage);
