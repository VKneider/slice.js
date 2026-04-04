export default class HomePage extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async init() {
      await Promise.all([
         this._buildNavbar(),
         this._buildHeroCta(),
         this._buildFeatures(),
         this._buildShowcase(),
      ]);
   }

   async _buildNavbar() {
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
                  const current = slice.stylesManager.themeManager.currentTheme;
                  const next = current === 'Slice' ? 'Light'
                             : current === 'Light' ? 'Dark'
                             : 'Slice';
                  await slice.setTheme(next);
               },
            },
         ],
      });
      this.insertBefore(navbar, this.firstChild);
   }

   async _buildHeroCta() {
      const docsBtn = await slice.build('Button', {
         value: 'Documentation',
         onClickCallback: () =>
            window.open('https://slice-js-docs.vercel.app/Documentation', '_blank'),
         customColor: {
            button: 'var(--primary-color)',
            label: 'var(--primary-color-contrast)',
         },
      });

      const componentsBtn = await slice.build('Button', {
         value: 'Components Library',
         onClickCallback: () =>
            window.open('https://slice-js-docs.vercel.app/Documentation/Visual', '_blank'),
         customColor: {
            button: 'var(--secondary-background-color)',
            label: 'var(--primary-color)',
         },
      });

      const cta = this.querySelector('.hero-cta');
      cta.appendChild(docsBtn);
      cta.appendChild(componentsBtn);
   }

   async _buildFeatures() {
      const features = [
         {
            title: 'Component-Based',
            description: 'Build your app using modular, reusable components following web standards.',
         },
         {
            title: 'Themeable',
            description: 'Swap themes at runtime. Ships with Slice, Light, Dark and more.',
         },
         {
            title: 'Lightweight',
            description: 'No heavy runtime. Just vanilla JavaScript and web standards.',
         },
         {
            title: 'Built-in Router',
            description: 'Client-side routing with MultiRoute — no extra libraries needed.',
         },
         {
            title: 'CLI Tools',
            description: 'Scaffold projects, create components and build bundles from the command line.',
         },
         {
            title: 'Services',
            description: 'Built-in FetchManager, LocalStorage and IndexedDB integrations.',
         },
      ];

      const grid = this.querySelector('.feature-grid');
      for (const { title, description } of features) {
         const item = document.createElement('div');
         item.classList.add('feature-item');

         const h3 = document.createElement('h3');
         h3.classList.add('feature-title');
         h3.textContent = title;

         const p = document.createElement('p');
         p.classList.add('feature-description');
         p.textContent = description;

         item.appendChild(h3);
         item.appendChild(p);
         grid.appendChild(item);
      }
   }

   async _buildShowcase() {
      const grid = this.querySelector('.showcase-grid');

      // Helper: wrap built components in a labeled card and append to grid
      const addCard = (label, ...components) => {
         const card = document.createElement('div');
         card.classList.add('comp-card');

         const labelEl = document.createElement('p');
         labelEl.classList.add('comp-label');
         labelEl.textContent = label;

         const demo = document.createElement('div');
         demo.classList.add('comp-demo');
         components.forEach(c => demo.appendChild(c));

         card.appendChild(labelEl);
         card.appendChild(demo);
         grid.appendChild(card);
      };

      // Button — primary + secondary variants
      const [btnPrimary, btnSecondary] = await Promise.all([
         slice.build('Button', {
            value: 'Primary',
            onClickCallback: () => {},
            customColor: {
               button: 'var(--primary-color)',
               label: 'var(--primary-color-contrast)',
            },
         }),
         slice.build('Button', {
            value: 'Secondary',
            onClickCallback: () => {},
            customColor: {
               button: 'var(--secondary-background-color)',
               label: 'var(--primary-color)',
            },
         }),
      ]);
      addCard('Button', btnPrimary, btnSecondary);

      // Input
      const input = await slice.build('Input', {
         placeholder: 'Type something...',
         type: 'text',
      });
      addCard('Input', input);

      // Switch
      const sw = await slice.build('Switch', {
         label: 'Toggle me',
         checked: true,
      });
      addCard('Switch', sw);

      // Select — theme chooser
      const themeOptions = [
         { name: 'Slice Theme' },
         { name: 'Light Theme' },
         { name: 'Dark Theme' },
         { name: 'Purple Theme' },
      ];
      const select = await slice.build('Select', {
         label: 'Pick a theme',
         options: themeOptions,
         visibleProp: 'name',
         onOptionSelect: async (option) => {
            if (!option) return;
            const themeName = option.name.replace(' Theme', '');
            await slice.setTheme(themeName);
         },
      });
      addCard('Select', select);

      // Loading — triggered by a demo button (Loading appends to document.body)
      const loading = await slice.build('Loading', {});
      const demoBtn = await slice.build('Button', {
         value: 'Demo Loading',
         onClickCallback: () => {
            loading.start();
            setTimeout(() => loading.stop(), 1500);
         },
         customColor: {
            button: 'var(--primary-color)',
            label: 'var(--primary-color-contrast)',
         },
      });
      addCard('Loading', demoBtn);
   }
}

customElements.define('slice-home-page', HomePage);
