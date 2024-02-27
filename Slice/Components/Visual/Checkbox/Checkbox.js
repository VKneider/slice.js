export default class Checkbox extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["checked", "disabled"];
  }

  init() { }


  get checked() {
    return this._checked;
  }

  set checked(value) {
    this._checked = value;
    this.querySelector("input").checked = value;
  }


  get disabled() {
    return this._disabled;
  }

  set disabled(value) {
    this._disabled = value;
    this.querySelector("input").disabled = value;
    this.classList.toggle("non-clickable", value);
  }

}

customElements.define("slice-checkbox", Checkbox);
