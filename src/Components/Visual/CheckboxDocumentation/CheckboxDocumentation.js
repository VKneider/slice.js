export default class CheckboxDocumentation extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  init() {}

  
}

customElements.define("slice-checkboxdocumentation", CheckboxDocumentation);
