export default class MyLayout extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   init() {}
}

customElements.define('slice-mylayout', MyLayout);
