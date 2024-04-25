export default class Checkbox extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$checkbox = this.querySelector(".slice_checkbox");
    this.$checkmark = this.querySelector(".checkmark");

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["checked", "disabled", "customColor", "labelPlacement"];
  }

  init() {
    if (this._checked === undefined) {
      this.checked = false;
    }
    
    if(!this.disabled){
      this._disabled=false;
    }

  }

  get checked() {
    return this._checked;
  }

  set checked(value) {
    this._checked = value;
    this.querySelector("input").checked = value;
  }

  get label() {
    return this._label;
  }

  set label(value) {
    this._label = value;
    if (this.querySelector(".checkbox_label")) {
      this.querySelector(".checkbox_label").textContent = value;
    } else {
      const label = document.createElement("label");
      label.classList.add("checkbox_label");
      label.textContent = value;
      this.$checkbox.appendChild(label);
    }
  }

  get customColor() {
    return this._customColor;
  }

  set customColor(value) {
    this._customColor = value;
    this.style = `--success-color: ${value};`;
  }

  get labelPlacement() {
    return this._labelPlacement;
  }

  set labelPlacement(value) {
    if (value === "left") {
      this.$checkbox.style = ` flex-direction: row-reverse;`;
    }
    if (value === "right") {
      this.$checkbox.style = `flex-direction: row;`;
    }
    if (value === "top") {
      this.$checkbox.style = `flex-direction: column-reverse;`;
    }
    if (value === "bottom") {
      this.$checkbox.style = `flex-direction: column;`;
    }
  }

  get disabled() {
    return this._disabled;
  }

  set disabled(value) {
    this._disabled = value;
    this.querySelector("input").disabled = value;
    this.$checkmark.classList.add("disabled");
  }
}

customElements.define("slice-checkbox", Checkbox);
