export default class Menu extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  init() {}

  
}

customElements.define("slice-menu", Menu);
