export default class Button extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$value = this.querySelector(".slice_button_value");
    this.$button = this.querySelector(".slice_button");
    if (props.onClickCallback) {
      this.onClickCallback = props.onClickCallback;
      this.querySelector(".slice_button_container").addEventListener(
        "click",
        async () => await this.onClickCallback()
      );
      //revisar esta verga por si habria q deletear o no
    }

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["value", "onClickCallback", "customColor"];
  }

  async init() {
    if (this.icon) {
      this.$icon = await slice.build("Icon", {
        name: this.icon,
        size: "25px",
        color: "var(--primary-color-contrast)",
        // iconStyle: this._icon.iconStyle,
      });
      this.$button.appendChild(this.$icon);
    }
  }

  get icon() {
    return this._icon;
  }

  set icon(value) {
    this._icon = value;
    if (!this.$icon) return;
    this.$icon.name = value.name;
    this.$icon.iconStyle = value.iconStyle;
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
    if (value.button) {
      this.style = `--primary-color: ${value.button};`;
    }
    if (value.label) {
      this.$button.style = `--primary-color-contrast: ${value.label};`;
    }
  }

  handleButtonClick() {
    this.onClickCallback();
  }
}
window.customElements.define("slice-button", Button);
