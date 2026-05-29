export default class AboutSection extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      slice.controller.setComponentProps(this, props);
   }

   // A static section needs no init(). Add async init() if it fetches data,
   // and update() if it should refresh when revisited (MultiRoute caches it).
}

customElements.define('slice-about-section', AboutSection);
