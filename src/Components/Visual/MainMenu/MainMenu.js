export default class MainMenu extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  init() {}

  
}

customElements.define("slice-mainmenu", MainMenu);
