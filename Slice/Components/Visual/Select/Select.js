export default class Select extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$selectContainer = this.querySelector(".slice_select_container");
    this.$select = this.querySelector(".slice_select");
    this.$menu = this.querySelector(".slice_menu");
    this.$openButton = this.querySelector(".open");

    this.$openButton.addEventListener("click", () => {
      this.$menu.classList.toggle("menu_open");
    });

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["options", "disabled", "label"];
  }

  init() {}

  get options() {
    return this._options;
  }

  set options(options) {
    this._options = options;
    options.forEach((option) => {
      const opt = document.createElement("div");
      opt.textContent = option;
      opt.addEventListener("click", () => {
        this.label = option;
        this.$menu.classList.remove("menu_open");
      });
      this.$menu.appendChild(opt);
    });
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
