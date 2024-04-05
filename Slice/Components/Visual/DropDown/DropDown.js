export default class DropDown extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    this.$dropdown = this.querySelector(".slice_dropdown");
    this.$menu = this.querySelector(".slice_dropdown_menu");
    this.$label = this.querySelector(".slice_dropdown_label");
    this.$caret = this.querySelector(".caret");

    this.$dropdown.addEventListener("click", () => {
      this.toggleDrop();
    });

    this.$menu.addEventListener("mouseleave", () => {
      this.closeDrop();
    });

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["label", "options"];
  }

  init() {}

  get label() {
    return this._label;
  }

  set label(value) {
    this._label;
    this.$label.textContent = value;
  }

  get options() {
    return this._options;
  }

  set options(values) {
    this._options = values;
    values.forEach((element) => {
      const e = document.createElement("div");
      e.addEventListener("click", () => {
        this.closeDrop();
      });
      e.textContent = element.text;
      this.$menu.appendChild(e);
    });
  }

  toggleDrop() {
    this.$menu.classList.toggle("dropdown_menu_open");
    this.$caret.classList.toggle("caret_open");
  }
  closeDrop() {
    this.$menu.classList.remove("dropdown_menu_open");
    this.$caret.classList.remove("caret_open");
  }
}

customElements.define("slice-dropdown", DropDown);
