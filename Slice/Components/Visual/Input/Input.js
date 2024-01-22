export default class Input extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this._placeholder = this.querySelector(".slice_input_placeholder");
    this._inputContainer = this.querySelector(".slice_input");
    this._input = this.querySelector(".input_area");
    this.hasConditions = false;
    this.conditions;

    if (props.conditions) {
      this.hasConditions = true;
      this.setConditions(props.conditions);
    }

    slice.controller.setComponentAttributes(this, props);
  }

  static observedAttributes = [
    "placeholder",
    "value",
    "type",
    "required",
    "secret",
  ];

  attributeChangedCallback(attributeName, oldValue, newValue) {
    if (Input.observedAttributes.includes(attributeName)) {
      switch (attributeName) {
        case "placeholder":
          this._placeholder.textContent = newValue;

          this._input.addEventListener("input", () => {
            if (this._input.value !== "") {
              this._placeholder.classList.add("slice_input_value");
            } else {
              this._placeholder.classList.remove("slice_input_value");
            }
          });

          break;

        case "value":
          this._input.value = newValue;
          if (this._input.value !== "") {
            this._placeholder.classList.add("slice_input_value");
          } else {
            this._placeholder.classList.add("slice_input_placeholder");
          }
          break;

        case "required":
          if (newValue === "true") {
            this._input.addEventListener("input", () => {
              if (this._input.value === "") {
                this.triggerError();
              } else {
                this.triggerSuccess();
              }
            });
          }
          break;

        case "type":
          this._input.type = newValue;
          break;

        case "secret":
          if (newValue === "true" && this._input.type === "password") {
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
          break;
      }
    }
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

  getValue() {
    if (this.hasConditions && !this.conditions.test(this._input.value)) {
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
}

customElements.define("slice-input", Input);
