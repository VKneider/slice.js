export default class Button extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.value = this.querySelector(".slice_button_value");
    this.button = this.querySelector(".slice_button");
    this.onClickCallback = props.onClickCallback;

    console.log(this.onClickCallback)

    this.button.addEventListener("click", () => this.onClickCallback());

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
    this.onClickCallback();
  }
}
window.customElements.define("slice-button", Button);
