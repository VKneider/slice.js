export default class Switch extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$switch = this.querySelector(".slice_switch");
    this.$checkbox = this.querySelector("input");

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["checked", "disabled", "label"];
  }

  init() {
    if (this._checked === undefined) {
      this.checked = false;
    }
    this.querySelector("input").addEventListener("change", (e) => {
      this.checked = e.target.checked;
    });
  }

  get checked() {
    return this._checked;
  }

  set checked(value) {
    this._checked = value;
    this.$checkbox.checked = value;
  }

  get label() {
    return this._label;
  }

  set label(value) {
    this._label = value;
    const label = document.createElement("label");
    label.classList.add("switch_label");
    label.textContent = value;
    this.$switch.appendChild(label);
  }

  get customColor() {
    return this._customColor;
  }

  set customColor(value) {
    this._customColor = value;
    this.$switch.style = `--success-color: ${value};`;
  }

  get disabled() {
    return this._disabled;
  }

  set disabled(value) {
    this._disabled = value;
    this.$checkbox.disabled = value;
    this.querySelector(".slider").classList.add("disabled");
  }
}

customElements.define("slice-switch", Switch);
