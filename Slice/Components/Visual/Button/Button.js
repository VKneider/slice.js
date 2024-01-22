export default class Button extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.value = this.querySelector(".slice_button_value");
    this.button = this.querySelector(".slice_button");
    this.function = props.function;
    console.log(this.function);

    // this.button.addEventListener("click", () => {
    //   console.log("Button clicked!");
    //   this.handleButtonClick();
    // });

    this.button.addEventListener("click", () => this.handleButtonClick());

    for (const prop in props) {
      this.setAttribute(prop, props[prop]);
    }
  }

  static observedAttributes = ["value"];

  attributeChangedCallback(attributeName, oldValue, newValue) {
    if (Button.observedAttributes.includes(attributeName)) {
      switch (attributeName) {
        case "value":
          this.value.textContent = newValue;
          break;
      }
    }
  }

  handleButtonClick() {
    console.log("Function:", this.function);
    if (this.function && typeof window[this.function] === "function") {
      window[this.function]();
    } else {
      console.error("Function not provided or not a valid function");
    }
  }
}
window.customElements.define("slice-button", Button);
