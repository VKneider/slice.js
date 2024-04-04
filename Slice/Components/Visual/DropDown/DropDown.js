export default class DropDown extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    this.$dropdown = this.querySelector(".slice_dropdown");
    this.$menu = this.querySelector(".slice_dropdown_menu");
    this.$label = this.querySelector(".slice_dropdown_label");
    this.$caret = this.querySelector(".caret");

    this.$caret.addEventListener("click", () => {
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
=======
>>>>>>> 17d8ac2d5ca54844263fbba02e282e0ac27e3cfd
>>>>>>> d54834e44799f8989dd05756edf839d61f86cd96
    this.$menu.classList.toggle("dropdown_menu_open");
    this.$caret.classList.toggle("caret_open");
  }
  closeDrop() {
    this.$menu.classList.remove("dropdown_menu_open");
<<<<<<< HEAD
=======
=======
>>>>>>> 730dff9 (dropdown additions)
    this.$menu.classList.toggle("menu_open");
    this.$caret.classList.toggle("caret_open");
  }
  closeDrop() {
    this.$menu.classList.remove("menu_open");
<<<<<<< HEAD
>>>>>>> 730dff9 (dropdown additions)
=======
    this.$menu.classList.toggle("dropdown_menu_open");
    this.$caret.classList.toggle("caret_open");
  }
  closeDrop() {
    this.$menu.classList.remove("dropdown_menu_open");
>>>>>>> 17d8ac2 (dropdown changed)
=======
>>>>>>> 730dff9 (dropdown additions)
=======
    this.$menu.classList.toggle("dropdown_menu_open");
    this.$caret.classList.toggle("caret_open");
  }
  closeDrop() {
    this.$menu.classList.remove("dropdown_menu_open");
>>>>>>> 17d8ac2 (dropdown changed)
=======
>>>>>>> 17d8ac2d5ca54844263fbba02e282e0ac27e3cfd
    this.$caret.classList.remove("caret_open");
  }
}

customElements.define("slice-dropdown", DropDown);
