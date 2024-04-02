export default class Button extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$value = this.querySelector(".slice_button_value");
    this.$button = this.querySelector(".slice_button");
    if (props.onClickCallback) {
      this.onClickCallback = props.onClickCallback;
      this.$button.addEventListener("click", async () => await this.onClickCallback());
      //revisar esta verga por si habria q deletear o no
    }

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["value", "onClickCallback", "customColor"];
  }

  get value() {
    return this._value;
  }

  set value(value) {
    this._value = value;
    this.$value.textContent = value;
  }

  get customColor() {
    return this._customColor;
  }

  set customColor(value) {
    this._customColor = value;
    this.$button.style = `--primary-color: ${value};`;
  }

  handleButtonClick() {
    this.onClickCallback();
  }
}
window.customElements.define("slice-button", Button);
