export default class Input extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$placeholder = this.querySelector(".slice_input_placeholder");
    this.$inputContainer = this.querySelector(".slice_input");
    this.$input = this.querySelector(".input_area");

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [
      "value",
      "placeholder",
      "type",
      "required",
      "conditions",
      "disabled",
    ];
  }

  get placeholder() {
    return this._placeholder;
  }

  set placeholder(value) {
    this._placeholder = value;
    this.$placeholder.textContent = value;
  }

  get value() {
    return this.$input.value;
  }

  set value(value) {
    if (value) {
      this._value = value;
      this.$input.value = value;
      this.$placeholder.classList.add("slice_input_value");
    } else {
      this.$placeholder.classList.remove("slice_input_value");
      this.$input.value = "";
    }
  }

  get type() {
    return this._type;
  }

  set type(value) {
    const allowedTypes = ["text", "password", "email", "number", "date"];

    if (!allowedTypes.includes(value)) {
      throw new Error(`This type is not allowed: ${value}`);
    }

    this._type = value;
    this.$input.type = value;
    if (value === "date") {
      this.$placeholder.classList.add("slice_input_value");
    }
  }

  get required() {
    return this._required;
  }

  set required(boolean) {
    this._required = boolean;
    this.$input.required = boolean;
  }

  get disabled() {
    return this._disabled;
  }

  set disabled(boolean) {
    this._disabled = boolean;
    this.$input.disabled = boolean;
    this.$inputContainer.classList.add("disabled");
    this.$placeholder.classList.add("disabled");
    this.querySelector(".eye").classList.add("disabled");
  }

  get secret() {
    return this._secret;
  }

  set secret(boolean) {
    this._secret = boolean;
    this.$input.type = "password";
    const reveal = document.createElement("div");
    reveal.classList.add("eye");
    reveal.textContent = "Mostrar";
    reveal.addEventListener("click", () => {
      if (this.$input.type === "password") {
        this.$input.type = "text";
        reveal.textContent = "Ocultar";
      } else {
        this.$input.type = "password";
        reveal.textContent = "Mostrar";
      }
    });
    this.$inputContainer.appendChild(reveal);
  }

  get conditions() {
    return this._conditions;
  }

  set conditions(value) {
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
    } = value;

    let regexPattern = "";

    if (regex !== "") {
      regexPattern = regex;
    } else {
      regexPattern =
        `^(?=.*[a-z]{${minMinusc},${maxMinusc}})` +
        `(?=.*[A-Z]{${minMayusc},${maxMayusc}})` +
        `(?=.*\\d{${minNumber},${maxNumber}})` +
        `(?=.*[\\W$]{${minSymbol},${maxSymbol}})` +
        `.{${minLength},${maxLength}}$`;
    }

    this._conditions = new RegExp(regexPattern);
  }

  init() {
    if (!this.type) {
      this.type = "text";
    }

    if (!this.disabled) {
      this._disabled = false;
    }

    if (!this.required) {
      this._required = false;
    }

    this.$input.addEventListener("input", () => {
      this.update();
    });
  }

  update() {
    if (this.$input.value !== "" || !undefined) {
      if (this.$input.value !== "") {
        this.$placeholder.classList.add("slice_input_value");
        this.triggerSuccess();
      } else {
        this.$placeholder.classList.remove("slice_input_value");
        if (this.required) {
          this.triggerError();
        }
      }
    }
  }

  validateValue() {
    if (this._conditions && !this._conditions.test(this.$input.value)) {
      this.triggerError();
      return false;
    }
    this.triggerSuccess();
    return true;
  }

  clear() {
    if (this.$input.value !== "") {
      this.$input.value = "";
      this.$placeholder.className = "slice_input_placeholder";
    }
  }

  triggerSuccess() {
    this.$placeholder.classList.remove("placeholder_required");
    this.$inputContainer.classList.remove("input_required");
  }

  triggerError() {
    this.$inputContainer.classList.add("error");
    this.$inputContainer.classList.add("input_required");
    this.$placeholder.classList.add("placeholder_required");
    setTimeout(() => {
      this.$inputContainer.classList.remove("error");
    }, 500);
  }
}

customElements.define("slice-input", Input);
