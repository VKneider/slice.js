export default class HomePage extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      
      this.$featureContainer = this.querySelector('.feature-grid');
      this.$examplesContainer = this.querySelector('.examples-container');
      
      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async init() {
      // Crear la barra de navegación
      const navbar = await slice.build('Navbar', {
         position: 'fixed',
         logo: {
            src: '/images/Slice.js-logo.png',
            path: '/',
         },
         items: [
            { text: 'Home', path: '/' },
            { text: 'Playground', path: '/Playground' },
         ],
         buttons: [
            {
               value: 'Change Theme',
               onClickCallback: async () => {
                  const currentTheme = slice.stylesManager.themeManager.currentTheme;
                  if (currentTheme === 'Slice') {
                     await slice.setTheme('Light');
                  } else if (currentTheme === 'Light') {
                     await slice.setTheme('Dark');
                  } else {
                     await slice.setTheme('Slice');
                  }
               },
            },
         ],
      });
      
      // Crear botones para la sección de llamada a la acción
      const docsButton = await slice.build('Button', {
         value: 'Documentation',
         onClickCallback: () => slice.router.navigate('/Documentation'),
         customColor: {
            button: 'var(--primary-color)',
            label: 'var(--primary-color-contrast)'
         }
      });
      
      const componentsButton = await slice.build('Button', {
         value: 'Components Library',
         onClickCallback: () => slice.router.navigate('/Documentation/Visual'),
         customColor: {
            button: 'var(--secondary-color)',
            label: 'var(--secondary-color-contrast)'
         }
      });
      
      // Añadir botones a la sección CTA
      this.querySelector('.cta-buttons').appendChild(docsButton);
      this.querySelector('.cta-buttons').appendChild(componentsButton);
      
      // Crear tarjetas de características
      await this.createFeatureCards();
      
      // Crear ejemplos de componentes
      await this.createComponentExamples();
      
      // Añadir la barra de navegación al inicio del componente
      this.insertBefore(navbar, this.firstChild);
   }
   
   async createFeatureCards() {
      // Definir características
      const features = [
         {
            title: 'Component-Based',
            text: 'Build your app using modular, reusable components following web standards.',
            icon: { name: 'layout', iconStyle: 'filled' }
         },
         {
            title: 'Zero Dependencies',
            text: 'Built with vanilla JavaScript. No external libraries required.',
            icon: { name: 'package', iconStyle: 'filled' }
         },
         {
            title: 'Easy Routing',
            text: 'Simple and powerful routing system for single page applications.',
            icon: { name: 'navigation', iconStyle: 'filled' }
         },
         {
            title: 'Theme System',
            text: 'Built-in theme support with easy customization through CSS variables.',
            icon: { name: 'palette', iconStyle: 'filled' }
         },
         {
            title: 'Developer Tools',
            text: 'Integrated debugging and logging for faster development.',
            icon: { name: 'code', iconStyle: 'filled' }
         },
         {
            title: 'Performance Focused',
            text: 'Lightweight and optimized for fast loading and execution.',
            icon: { name: 'zap', iconStyle: 'filled' }
         }
      ];
      
      // Crear grid para las tarjetas
      const grid = await slice.build('Grid', {
         columns: 3,
         rows: 2
      });
      
      // Crear y añadir cada tarjeta al grid
      for (const feature of features) {
         const card = await slice.build('Card', {
            title: feature.title,
            text: feature.text,
            icon: feature.icon,
            isOpen: true
         });
         
         await grid.setItem(card);
      }
      
      // Ajustar columnas para mobile
      if (window.innerWidth <= 770) {
         grid.columns = 1;
      }
      
      // Añadir grid al contenedor
      this.$featureContainer.appendChild(grid);
      
      // Añadir evento para ajustar el grid en resize
      window.addEventListener('resize', () => {
         if (window.innerWidth <= 770) {
            grid.columns = 1;
         } else {
            grid.columns = 3;
         }
      });
   }
   
   async createComponentExamples() {
      // Crear ejemplos para demostrar componentes
      const inputExample = await slice.build('Input', {
         placeholder: 'Try typing here...',
         type: 'text'
      });
      
      const switchExample = await slice.build('Switch', {
         label: 'Toggle me',
         checked: true
      });
      
      const checkboxExample = await slice.build('Checkbox', {
         label: 'Check me',
         labelPlacement: 'right'
      });
      
      const detailsExample = await slice.build('Details', {
         title: 'Click to expand',
         text: 'This is a collapsible details component that can contain any content.'
      });
      
      // Crear sección para cada ejemplo
      const exampleSections = [
         { title: 'Input Component', component: inputExample },
         { title: 'Switch Component', component: switchExample },
         { title: 'Checkbox Component', component: checkboxExample },
         { title: 'Details Component', component: detailsExample }
      ];
      
      // Añadir cada ejemplo a la sección de ejemplos
      for (const section of exampleSections) {
         const container = document.createElement('div');
         container.classList.add('example-item');
         
         const title = document.createElement('h3');
         title.textContent = section.title;
         
         container.appendChild(title);
         container.appendChild(section.component);
         
         this.$examplesContainer.appendChild(container);
      }
   }
}

customElements.define('slice-home-page', HomePage);