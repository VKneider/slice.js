export default class HomePage extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      
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
         onClickCallback: () => //redirect to https://slice-js-docs.vercel.app/Documentation
         window.open('https://slice-js-docs.vercel.app/Documentation', '_blank'),
         customColor: {
            button: 'var(--primary-color)',
            label: 'var(--primary-color-contrast)'
         }
      });
      
      const componentsButton = await slice.build('Button', {
         value: 'Components Library',
         onClickCallback: () => window.open('https://slice-js-docs.vercel.app/Documentation/Visual', '_blank'),
         customColor: {
            button: 'var(--secondary-color)',
            label: 'var(--secondary-color-contrast)'
         }
      });
      
      // Añadir botones a la sección CTA
      this.querySelector('.cta-buttons').appendChild(docsButton);
      this.querySelector('.cta-buttons').appendChild(componentsButton);
      
      // Crear features section con un enfoque diferente (sin usar Cards)
      await this.createFeatures();
      
      // Crear ejemplos de componentes
      await this.createComponentExamples();
      
      // Configurar la sección de código de inicio
      await this.setupGettingStartedSection();
      
      // Añadir la barra de navegación al inicio del componente
      this.insertBefore(navbar, this.firstChild);
   }
   
   async createFeatures() {
      // Definir características
      const features = [
         {
            title: 'Component-Based',
            description: 'Build your app using modular, reusable components following web standards.'
         },
         {
            title: 'Zero Dependencies',
            description: 'Built with vanilla JavaScript. No external libraries required.'
         },
         {
            title: 'Easy Routing',
            description: 'Simple and powerful routing system for single page applications.'
         },
         {
            title: 'Theme System',
            description: 'Built-in theme support with easy customization through CSS variables.'
         },
         {
            title: 'Developer Tools',
            description: 'Integrated debugging and logging for faster development.'
         },
         {
            title: 'Performance Focused',
            description: 'Lightweight and optimized for fast loading and execution.'
         }
      ];
      
      const featureGrid = this.querySelector('.feature-grid');
      
      // Crear y añadir cada feature como un elemento HTML simple
      for (const feature of features) {
         const featureElement = document.createElement('div');
         featureElement.classList.add('feature-item');
         
         const featureTitle = document.createElement('h3');
         featureTitle.textContent = feature.title;
         featureTitle.classList.add('feature-title');
         
         const featureDescription = document.createElement('p');
         featureDescription.textContent = feature.description;
         featureDescription.classList.add('feature-description');
         
         featureElement.appendChild(featureTitle);
         featureElement.appendChild(featureDescription);
         
         featureGrid.appendChild(featureElement);
      }
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
   
   async setupGettingStartedSection() {
      // Opcionalmente podríamos mejorar esta sección usando el CodeVisualizer component
      // en lugar del código HTML estático en el template
      const codeVisualizer = await slice.build('CodeVisualizer', {
         value: `// Initialize a new Slice.js project
npm run slice:init

// Create a new component
npm run slice:create

// Start your application
npm run slice:start`,
         language: 'bash'
      });
      
      const codeSample = this.querySelector('.code-sample');
      codeSample.innerHTML = ''; // Clear the static code sample
      codeSample.appendChild(codeVisualizer);
   }
}

customElements.define('slice-home-page', HomePage);