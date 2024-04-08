export default class DropDown extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    this.$dropdown = this.querySelector(".slice_dropdown");
    this.$box = this.querySelector(".slice_dropbox");
    this.$label = this.querySelector(".slice_dropdown_label");
    this.$caret = this.querySelector(".caret");

    this.addEventListener("click", () => {
      this.toggleDrop();
    });

    this.$box.addEventListener("mouseleave", () => {
      this.closeDrop();
    });

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["label", "dropbox"];
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
      const div = document.createElement("div");
      const e = document.createElement("a");
      e.addEventListener("click", () => {
        this.closeDrop();
      });
      e.textContent = element.text;
      e.href = element.href;
      div.appendChild(e);
      this.$box.appendChild(div);
    });
  }

  toggleDrop() {
    this.$box.classList.toggle("slice_dropbox_open");
    this.$caret.classList.toggle("caret_open");
  }
  closeDrop() {
    this.$box.classList.remove("slice_dropbox_open");
    this.$caret.classList.remove("caret_open");
  }
}

customElements.define("slice-dropdown", DropDown);
