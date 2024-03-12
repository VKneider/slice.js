export default class Select extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$selectContainer = this.querySelector(".slice_select_container");
    this.$label = this.querySelector(".slice_select_label");
    this.$select = this.querySelector(".slice_select");
    this.$menu = this.querySelector(".slice_menu");
    this.$caret = this.querySelector(".caret");

    this.$selectContainer.addEventListener("click", () => {
      this.$menu.classList.toggle("menu_open");
      this.$caret.classList.toggle("caret_open");
    });

    if (props.visibleProp) {
      this.visibleProp = props.visibleProp;
    }
    this._value = [];
    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [
      "options",
      "disabled",
      "label",
      "multiple",
      "visibleProp",
    ];
  }

  init() {}

  get options() {
    return this._options;
  }

  removeOptionFromValue(option) {
    const optionIndex = this._value.indexOf(option);

    if (optionIndex !== -1) {
      this._value.splice(optionIndex, 1);
      // Actualizar la representación visual en el elemento select
      this.updateSelectLabel();
    }

    if (this._value.length === 0) {
      this.$label.classList.remove("slice_select_value");
    }
  }

  updateSelectLabel() {
    // Limpiar el contenido actual del elemento select
    this.$select.textContent = "";

    // Volver a agregar los valores seleccionados
    if (this._value.length > 0) {
      this.$select.textContent = this._value
        .map((option) => option[this.visibleProp])
        .join(", ");
      this.$label.classList.add("slice_select_value");
    } else {
      this.$label.classList.remove("slice_select_value");
    }
  }

  addSelectedOption(option) {
    if (this._value.length === 0) {
      this.$select.textContent += `${option[this.visibleProp]}`;
    } else {
      this.$select.textContent += `, ${option[this.visibleProp]}`;
    }
    this._value.push(option);
    this.$label.classList.add("slice_select_value");
  }

  set options(values) {
    this._options = values;
    values.forEach((option) => {
      const opt = document.createElement("div");
      opt.textContent = option[this.visibleProp];
      opt.addEventListener("click", () => {
        if (this.$menu.querySelector(".active") && !this.multiple) {
          this.$menu.querySelector(".active").classList.remove("active");
        }
        if (this._value.includes(option)) {
          this.removeOptionFromValue(option);
          opt.classList.remove("active");
        } else {
          this.addSelectedOption(option);
          opt.classList.add("active");
        }
        this.$menu.classList.remove("menu_open");
      });
      this.$menu.appendChild(opt);
    });
  }

  get value() {
    if (this._value.length === 1) {
      return this._value[0];
    }
    return this._value;
  }

  set value(value) {
    this.$select.textContent = value[this.visibleProp];
    this.$label.classList.add("slice_select_value");
  }

  get label() {
    return this._label;
  }

  set label(value) {
    this._label = value;
    this.$label.textContent = value;
  }

  get multiple() {
    return this._multiple;
  }
  set multiple(value) {
    this._multiple = value;
  }

  get disabled() {
    return this._disabled;
  }

  set disabled(value) {
    this._disabled = value;
  }
}

customElements.define("slice-select", Select);
