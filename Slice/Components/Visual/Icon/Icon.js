export default class Icon extends HTMLElement {
  constructor(props) {
    super();

    slice.attachTemplate(this);
    this.$icon = this.querySelector("i");

    if (!this.iconStyle) {
      this._iconStyle = "filled";
    }

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["name", "size", "color", "iconStyle"];
  }

  get random() {
    return this.$icon.classList;
  }

  set random(value) {
  }

  init() {

    if (!this._name) {
      this.name = "youtube";
    }

    if (!this._size) {
      this.size = "small";
    }

    if (!this._color) {
      this.color = "black";
    }


  }

  get name() {
    return this._name;
  }

  set name(value) {
    this._name = value;
    this.$icon.className = "";
    this.$icon.classList.add(`slc-${styleTypes[this._iconStyle]}${value}`);
  }

  get iconStyle() {
    return this._iconStyle;
  }


  set iconStyle(value) {
    if (value !== "filled" && value !== "outlined") value = "filled";
    this._iconStyle = value;
    this.name = this._name;
  }

  get size() {
    return this._size;
  }

  set size(value) {
    switch (value) {
      case "small":
        this._size = "16px";
        break;
      case "medium":
        this._size = "20px";
        break;
      case "large":
        this._size = "24px";
        break;
      default:
        this._size = value;
    }

    this.$icon.style.fontSize = value;
  }

  get color() {
    return this._color;
  }

  set color(value) {
    this._color = value;
    this.$icon.style.color = value;
  }

}

const styleTypes = { outlined: "out", filled: "fil" };
customElements.define("slice-icon", Icon);
