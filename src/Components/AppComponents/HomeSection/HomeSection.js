export default class HomeSection extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$cta = this.querySelector('.home__cta');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      // Build child components with slice.build (always await).
      const button = await slice.build('Button', {
         value: 'Go to About',
         onClickCallback: () => slice.router.navigate('/about')
      });
      this.$cta.appendChild(button);
   }
}

customElements.define('slice-home-section', HomeSection);
