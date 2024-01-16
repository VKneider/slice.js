export default class Input extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.placeholder = this.querySelector(".slice_input_placeholder");
    this.slice_input = this.querySelector(".slice_input");
    this.input = this.querySelector(".input_area");
    this.hasRegex = false;
    this.regex;

    if (props.regex) {
      this.hasRegex = true;
      this.regexConditions(props.regex);
    }

    for (const prop in props) {
      this.setAttribute(prop, props[prop]);
    }
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
          this.placeholder.textContent = newValue;

          this.input.addEventListener("input", () => {
            if (this.input.value !== "") {
              this.placeholder.classList.add("slice_input_value");
            } else {
              this.placeholder.classList.remove("slice_input_value");
            }
          });

          break;

        case "value":
          this.input.value = newValue;
          if (this.input.value !== "") {
            this.placeholder.classList.add("slice_input_value");
          } else {
            this.placeholder.classList.add("slice_input_placeholder");
          }
          break;

        case "required":
          if (newValue === "true") {
            this.input.addEventListener("input", () => {
              if (this.input.value === "") {
                this.triggerError();
              } else {
                this.triggerSuccess();
              }
            });
          }
          break;

        case "type":
          this.input.type = newValue;
          break;

        case "secret":
          if (newValue === "true" && this.input.type === "password") {
            const revealButton = document.createElement("div");
            revealButton.classList.add("eye");

            const reveal = document.createElement("label");
            reveal.textContent = "Mostrar";
            reveal.classList.add("label");

            revealButton.appendChild(reveal);

            revealButton.addEventListener("click", () => {
              if (this.input.type === "password") {
                this.input.type = "text";
                reveal.textContent = "Ocultar";
              } else {
                this.input.type = "password";
                reveal.textContent = "Mostrar";
              }
            });

            this.slice_input.appendChild(revealButton);
          }
          break;
      }
    }
  }

  regexConditions(conditions) {
    const {
      explicit = "",
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

    if (explicit !== "") {
      regexPattern = explicit;
    } else {
      regexPattern =
        `^(?=.*[a-z]{${minMinusc},${maxMinusc}})` +
        `(?=.*[A-Z]{${minMayusc},${maxMayusc}})` +
        `(?=.*\\d{${minNumber},${maxNumber}})` +
        `(?=.*[\\W_]{${minSymbol},${maxSymbol}})` +
        `.{${minLength},${maxLength}}$`;
    }

    this.regex = new RegExp(regexPattern);
  }

  triggerSuccess() {
    this.placeholder.classList.remove("placeholder_required");
    this.input.classList.remove("input_required");
  }

  triggerError() {
    this.slice_input.classList.add("error");
    this.placeholder.classList.add("placeholder_required");
    this.input.classList.add("input_required");
    setTimeout(() => {
      this.slice_input.classList.remove("error");
    }, 500);
  }

  getValue() {
    if (this.hasRegex && !this.regex.test(this.input.value)) {
      this.triggerError();
      return `This is not a valid ${this.input.type}`;
    }

    return this.input.value;
  }
  setValue(string) {
    this.input.value = string;
  }
  getPlacegolder() {
    return this.input.placeholder;
  }
  setPlaceholder(string) {
    this.input.placeholder = string;
  }
  clear() {
    if (this.input.value !== "") {
      this.input.value = "";
      this.placeholder.className = "slice_input_placeholder";
    }
  }
}

customElements.define("slice-input", Input);
