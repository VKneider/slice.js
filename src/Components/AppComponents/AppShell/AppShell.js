export default class AppShell extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$header = this.querySelector('.app-shell__header');
      this.$content = this.querySelector('.app-shell__content');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      // Persistent navbar — built once, stays across navigations.
      const navbar = await slice.build('Navbar', {
         sliceId: 'app-navbar',
         position: 'fixed',
         items: [
            { text: 'Home', path: '/' },
            { text: 'About', path: '/about' }
         ]
      });
      this.$header.appendChild(navbar);

      // Content area — a MultiRoute swaps the matching section by URL.
      // MultiRoute caches each section instance, so give sections an update()
      // method if they show dynamic data.
      const content = await slice.build('MultiRoute', {
         sliceId: 'app-content',
         routes: [
            { path: '/', component: 'HomeSection' },
            { path: '/about', component: 'AboutSection' }
         ]
      });
      this.$content.appendChild(content);
   }
}

customElements.define('slice-app-shell', AppShell);
