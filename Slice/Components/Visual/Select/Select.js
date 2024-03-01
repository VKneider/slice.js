export default class Select extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$selectContainer = this.querySelector(".slice_select_container");
    this.$select = this.querySelector(".slice_select");

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["options", "disabled"];
  }

  init() {}

  get options() {
    return this._options;
  }

  set options(options) {
    this._options = options;
    options.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option;
      this.$select.appendChild(opt);
    });
  }

  get disabled() {
    return this._disabled;
  }

  set disabled(value) {
    this._disabled = value;
  }
}

customElements.define("slice-select", Select);
