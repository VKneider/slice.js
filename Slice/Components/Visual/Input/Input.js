export default class Input extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$inputContainer = this.querySelector(".slice_input");
    this.$input = this.querySelector(".input_area");
    this.$placeholder = this.querySelector(".slice_input_placeholder");

    this.$inputContainer.addEventListener("click", () => {
      this.$input.focus(); // Hacer que el input obtenga el foco al hacer clic en el contenedor
    });

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [
      "value",
      "placeholder",
      "type",
      "required",
      "conditions",
      "disabled",
      "secret",
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
    if (boolean) {
      this.$inputContainer.classList.add("disabled");
    } else {
      this.$inputContainer.classList.remove("disabled");
    }
  }

  get secret() {
    return this._secret;
  }

  set secret(boolean) {
    this._secret = boolean;
    if (boolean) {
      this.$input.type = "password";
      if (!this.querySelector(".eye")) {
        const reveal = document.createElement("label");

        const eyeSlash = `<svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path stroke="var(--primary-color)" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.933 13.909A4.357 4.357 0 0 1 3 12c0-1 4-6 9-6m7.6 3.8A5.068 5.068 0 0 1 21 12c0 1-3 6-9 6-.314 0-.62-.014-.918-.04M5 19 19 5m-4 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
          </svg>`;
        const eye = `<svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path stroke="var(--primary-color)" stroke-width="1.5" d="M21 12c0 1.2-4.03 6-9 6s-9-4.8-9-6c0-1.2 4.03-6 9-6s9 4.8 9 6Z"/>
            <path stroke="var(--primary-color)" stroke-width="1.5" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
          </svg>`;

        reveal.classList.add("eye");
        reveal.innerHTML = eye;
        reveal.addEventListener("click", () => {
          if (this.$input.type === "password") {
            this.$input.type = "text";
            reveal.innerHTML = eyeSlash;
          } else {
            this.$input.type = "password";
            reveal.innerHTML = eye;
          }
        });
        this.$inputContainer.appendChild(reveal);
      } else {
        this.querySelector(".eye").remove();
      }
    }
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
    this.$inputContainer.classList.remove("required");
  }

  triggerError() {
    this.$inputContainer.classList.add("error");
    this.$inputContainer.classList.add("required");
    setTimeout(() => {
      this.$inputContainer.classList.remove("error");
    }, 500);
  }
}

customElements.define("slice-input", Input);
