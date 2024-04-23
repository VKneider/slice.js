export default class Select extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$dropdown = this.querySelector(".slice_select_dropdown");
    this.$selectContainer = this.querySelector(".slice_select_container");
    this.$label = this.querySelector(".slice_select_label");
    this.$select = this.querySelector(".slice_select");
    this.$menu = this.querySelector(".slice_select_menu");
    this.$caret = this.querySelector(".caret");

    this.$selectContainer.addEventListener("click", () => {
      this.$menu.classList.toggle("menu_open");
      this.$caret.classList.toggle("caret_open");
    });
    this.$dropdown.addEventListener("mouseleave", () => {
      this.$menu.classList.remove("menu_open");
      this.$caret.classList.remove("caret_open");
    });

    if (props.visibleProp) {
      this.visibleProp = props.visibleProp;
    }
    this._value = [];

    if (props.onOptionSelect) {
      this.onOptionSelect = props.onOptionSelect;
    }
    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [
      "options",
      "disabled",
      "label",
      "multiple",
      "visibleProp",
    ];
  }

  init() {
    if (!this.disabled) {
      this._disabled = false;
    }

    if (!this._multiple) {
      this._multiple = false;
    }
  }

  get options() {
    return this._options;
  }

  removeOptionFromValue(option) {
    const optionIndex = this.isObjectInArray(option, this._value).index;
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
    this.$select.value = "";

    // Volver a agregar los valores seleccionados
    if (this._value.length > 0) {
      this.$select.value = this._value
        .map((option) => option[this.visibleProp])
        .join(", ");
      this.$label.classList.add("slice_select_value");
    } else {
      this.$label.classList.remove("slice_select_value");
    }
  }

  addSelectedOption(option) {
    this._value.push(option);
    this.updateSelectLabel();
    this.$label.classList.add("slice_select_value");
    if (!this.multiple) {
      this.$menu.classList.remove("menu_open");
    }
  }

  set options(values) {
    this._options = values;
    values.forEach((option) => {
      const opt = document.createElement("div");
      opt.textContent = option[this.visibleProp];
      opt.addEventListener("click", async () => {
        if (this.$menu.querySelector(".active") && !this.multiple) {
          this.$menu.querySelector(".active").classList.remove("active");
        }

        if (this._value.length === 1 && !this.multiple) {
          this.removeOptionFromValue(this._value[0]);
          this.addSelectedOption(option);
          if (this.onOptionSelect) await this.onOptionSelect();
          return;
        }

        if (this.isObjectInArray(option, this._value).found) {
          this.removeOptionFromValue(option);
          opt.classList.remove("active");
        } else {
          this.addSelectedOption(option);
          opt.classList.add("active");
        }
        if (this.onOptionSelect) await this.onOptionSelect();
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

  set value(valueParam) {
    this._value = [];

    if (valueParam.length > 1 && !this.multiple) {
      return console.error(
        "Select is not multiple, you can only select one option"
      );
    }

    const validOptions = valueParam.every(
      (option) => this.isObjectInArray(option, this._options).found
    );

    if (!validOptions) {
      console.error(
        "Error: Al menos una de las opciones proporcionadas no está en this.options."
      );
      return;
    }

    // Agregar las opciones a _value
    this.$label.classList.add("slice_select_value");
    valueParam.forEach((option) => this.addSelectedOption(option));
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

  isObjectInArray(objeto, arreglo) {
    for (let i = 0; i < arreglo.length; i++) {
      if (this.sameObject(arreglo[i], objeto)) {
        return { found: true, index: i };
      }
    }
    return { found: false, index: -1 };
  }
  sameObject(objetoA, objetoB) {
    const keysA = Object.keys(objetoA);
    const keysB = Object.keys(objetoB);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      const valueA = objetoA[key];
      const valueB = objetoB[key];

      if (typeof valueA === "object" && typeof valueB === "object") {
        if (!this.sameObject(valueA, valueB)) {
          return false;
        }
      } else if (valueA !== valueB) {
        return false;
      }
    }

    return true;
  }
}

customElements.define("slice-select", Select);
