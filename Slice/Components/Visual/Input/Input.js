export default class Input extends HTMLElement {
  constructor(props) {
    super();
    slice.controller.setComponentProps(this, props);
    slice.attachTemplate(this);
    this._placeholder = this.querySelector(".slice_input_placeholder");
    this._inputContainer = this.querySelector(".slice_input");
    this._input = this.querySelector(".input_area");

    //slice.controller.removeVisualPropsFromComponent(this, ['placeholder'])
    this.init();
  }

  async init() {
    if (this.conditions) {
      this.setConditions(this.conditions);
    }
    this._placeholder.textContent = this.placeholder;
    if (this.value !== undefined) {
      this._input.value = this.value;
      this._placeholder.classList.add("slice_input_value");
    }
    this._input.type = this.type;
    this._input.addEventListener("input", () => {
      this.update();
    });
    if (this.secret && this._input.type === "password") {
      const revealButton = document.createElement("div");
      revealButton.classList.add("eye");
      const reveal = document.createElement("label");
      reveal.textContent = "Mostrar";
      reveal.classList.add("label");
      revealButton.appendChild(reveal);
      revealButton.addEventListener("click", () => {
        if (this._input.type === "password") {
          this._input.type = "text";
          reveal.textContent = "Ocultar";
        } else {
          this._input.type = "password";
          reveal.textContent = "Mostrar";
        }
      });
      this._inputContainer.appendChild(revealButton);
    }
  }

  update() {
    if (this.value !== "" || !undefined) {
      if (this._input.value !== "") {
        this._placeholder.classList.add("slice_input_value");
        this.triggerSuccess();
      } else {
        this._placeholder.classList.remove("slice_input_value");
        if (this.required) {
          this.triggerError();
        }
      }
    }
  }
  getValue() {
    if (this.conditions && !this.conditions.test(this._input.value)) {
      this.triggerError();
      return `This is not a valid ${this._input.type}`;
    }

    return this._input.value;
  }
  setValue(string) {
    this._input.value = string;
  }
  getPlacegolder() {
    return this._input.placeholder;
  }
  setPlaceholder(string) {
    this._input.placeholder = string;
  }
  clear() {
    if (this._input.value !== "") {
      this._input.value = "";
      this._placeholder.className = "slice_input_placeholder";
    }
  }

  triggerSuccess() {
    this._placeholder.classList.remove("placeholder_required");
    this._input.classList.remove("input_required");
  }

  triggerError() {
    this._inputContainer.classList.add("error");
    this._placeholder.classList.add("placeholder_required");
    this._input.classList.add("input_required");
    setTimeout(() => {
      this._inputContainer.classList.remove("error");
    }, 500);
  }

  setConditions(conditions) {
    const {
      regex = "",
      minLength = 0,
      maxLength = "",
      minMinusc = 0,
      maxMinusc = "",
      minMayusc = 0,
      maxMayusc = "",
      minNumber = 0,
      maxNumber = "",
      minSymbol = 0,
      maxSymbol = "",
    } = conditions;

    let regexPattern = "";

    if (regex !== "") {
      regexPattern = regex;
    } else {
      regexPattern =
        `^(?=.*[a-z]{${minMinusc},${maxMinusc}})` +
        `(?=.*[A-Z]{${minMayusc},${maxMayusc}})` +
        `(?=.*\\d{${minNumber},${maxNumber}})` +
        `(?=.*[\\W_]{${minSymbol},${maxSymbol}})` +
        `.{${minLength},${maxLength}}$`;
    }

    this.conditions = new RegExp(regexPattern);
  }
}

customElements.define("slice-input", Input);
