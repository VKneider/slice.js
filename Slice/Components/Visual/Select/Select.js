export default class Select extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$selectContainer = this.querySelector(".slice_select_container");
    this.$select = this.querySelector(".slice_select");
    this.$menu = this.querySelector(".slice_menu");
    this.$caret = this.querySelector(".caret");

    this.$selectContainer.addEventListener("click", () => {
      this.$menu.classList.toggle("menu_open");
      this.$caret.classList.toggle("caret_open");
    });

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["options", "disabled", "label"];
  }

  init() {}

  get options() {
    return this._options;
  }

  set options(values) {
    this._options = values;
    values.forEach((option) => {
      const opt = document.createElement("div");
      opt.textContent = option;
      opt.addEventListener("click", () => {
        this.label = option;
        this.$menu.classList.remove("menu_open");
        if (this.$menu.querySelector(".active")) {
          this.$menu.querySelector(".active").classList.remove("active");
        }
        opt.classList.toggle("active");
      });
      this.$menu.appendChild(opt);
    });
  }

  get value() {
    return this._value;
  }

  set value(value) {
    this._value = value;
  }

  get label() {
    return this._label;
  }

  set label(value) {
    this._label = value;
    this.$select.textContent = value;
  }

  get disabled() {
    return this._disabled;
  }

  set disabled(value) {
    this._disabled = value;
  }
}

customElements.define("slice-select", Select);
