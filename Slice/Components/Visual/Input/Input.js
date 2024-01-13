export default class Input extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.placeholder = this.querySelector(".slice_input_placeholder");
    this.slice_input = this.querySelector(".slice_input");
    this.input = this.querySelector(".input_area");

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
                this.placeholder.classList.add("placeholder_required");
                this.input.classList.add("input_required");
              } else {
                this.placeholder.classList.remove("placeholder_required");
                this.input.classList.remove("input_required");
              }
            });
          }
          break;

        case "type":
          if (newValue === "password") {
            this.input.type = "password";
          }
          break;

        case "secret":
          if (newValue === "true") {
            const revealButton = document.createElement("div");
            revealButton.classList.add("eye");
            const reveal = document.createElement("label");
            reveal.textContent = "Mostrar";
            reveal.classList.add("label");
            revealButton.appendChild(reveal);
            revealButton.addEventListener("mousedown", () => {
              if (this.input.type === "password") {
                reveal.textContent = "Ocultar";
                this.input.type = "text";
              } else {
                reveal.textContent = "Mostrar";
                this.input.type = "password";
              }
            });
            this.slice_input.appendChild(revealButton);
          }
          break;
      }
    }
  }

  getValue() {
    return this.input.value;
  }

  clear() {
    if (this.input.value !== "") {
      this.input.value = "";
      this.placeholder.className = "slice_input_placeholder";
    }
  }
}

customElements.define("slice-input", Input);
