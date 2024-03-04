export default class Checkbox extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$checkbox = this.querySelector(".slice_checkbox");
    this.$checkmark = this.querySelector(".checkmark");

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["checked", "disabled"];
  }

  init() {
    if (this._checked === undefined) {
      this.checked = false;
    }
  }

  get checked() {
    return this._checked;
  }

  set checked(value) {
    this._checked = value;
    this.querySelector("input").checked = value;
  }

  get label() {
    return this._label;
  }

  set label(value) {
    this._label = value;
    const label = document.createElement("label");
    label.classList.add("checkbox_label");
    label.textContent = value;
    this.$checkbox.appendChild(label);
  }

  get disabled() {
    return this._disabled;
  }

  set disabled(value) {
    this._disabled = value;
    this.querySelector("input").disabled = value;
    this.$checkmark.classList.add("disabled");
  }
}

customElements.define("slice-checkbox", Checkbox);
