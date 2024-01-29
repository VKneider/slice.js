export default class Input extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$placeholder = this.querySelector(".slice_input_placeholder");
    this.$inputContainer = this.querySelector(".slice_input");
    this.$input = this.querySelector(".input_area");

    slice.controller.setComponentProps(this, props);
    this.props = ['value', 'placeholder', 'type', 'secret', 'required', 'conditions']
  }

  get placeholder() {
    return this._placeholder;
  }

  set placeholder(value) {
    this._placeholder = value;
    this.$placeholder.textContent = value;
      if (this.value !== undefined) {
        this.$input.value = this.value;
        this.$placeholder.classList.add("slice_input_value");
      }
  }

  get value() {
    return this.$input.value;
  }

  set value(value) {
    this._value = value;
    this.$input.value = value;
  }

  get type() {
    return this._type;
  }

  set type(value) {
    this._type = value;
    this.$input.type = value;
  }


  init() {
    if (this.conditions) {
      this.setConditions(this.conditions);
    }
    

    this.$input.addEventListener("input", () => {
      this.update();
    });


    if (this.secret && this.$input.type === "password") {
      const revealButton = document.createElement("div");
      revealButton.classList.add("eye");
      const reveal = document.createElement("label");
      reveal.textContent = "Mostrar";
      reveal.classList.add("label");
      revealButton.appendChild(reveal);
      revealButton.addEventListener("click", () => {
        if (this.$input.type === "password") {
          this.$input.type = "text";
          reveal.textContent = "Ocultar";
        } else {
          this.$input.type = "password";
          reveal.textContent = "Mostrar";
        }
      });
      this.$inputContainer.appendChild(revealButton);
    }
  }


  update() {
    if (this.value !== "" || !undefined) {
      if (this.$input.value !== "") {
        this.$placeholder.classList.add("slice$input$value");
        this.triggerSuccess();
      } else {
        this.$placeholder.classList.remove("slice$input$value");
        if (this.required) {
          this.triggerError();
        }
      }
    }
  }

  getValue() {
    if (this.conditions && !this.conditions.test(this.$input.value)) {
      this.triggerError();
      return `This is not a valid ${this.$input.type}`;
    }

    return this.$input.value;
  }



  clear() {
    if (this.$input.value !== "") {
      this.$input.value = "";
      this.$placeholder.className = "slice_input_placeholder";
    }
  }



  triggerSuccess() {
    this.$placeholder.classList.remove("placeholder_required");
    this.$input.classList.remove("input_required");
  }

  triggerError() {
    this.$inputContainer.classList.add("error");
    this.$placeholder.classList.add("placeholder_required");
    this.$input.classList.add("input_required");
    setTimeout(() => {
      this.$inputContainer.classList.remove("error");
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
        `(?=.*[\\W$]{${minSymbol},${maxSymbol}})` +
        `.{${minLength},${maxLength}}$`;
    }

    this.conditions = new RegExp(regexPattern);
  }
}

customElements.define("slice-input", Input);
