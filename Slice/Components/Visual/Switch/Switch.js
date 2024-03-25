export default class Switch extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$switch = this.querySelector(".slice_switch");
    this.$checkbox = this.querySelector("input");
    this.toggle = props.toggle;
    if (this.toggle) {
      this.$checkbox.addEventListener("click", () => this.toggle());
    }

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [
      "checked",
      "disabled",
      "label",
      "customColor",
      "position",
    ];
  }

  init() {
    if (this._checked === undefined) {
      this.checked = false;
    }
    if (this.position === undefined) {
      this.position = "right";
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
    if (this.querySelector(".switch_label")) {
      this.querySelector(".switch_label").textContent = value;
    } else {
      const label = document.createElement("label");
      label.classList.add("switch_label");
      label.textContent = value;
      this.$switch.appendChild(label);
    }
  }

  get customColor() {
    return this._customColor;
  }

  set customColor(value) {
    this._customColor = value;
    this.style = `--success-color: ${value};`;
  }

  get position() {
    return this._position;
  }

  set position(value) {
    if (value === "left") {
      this.$switch.style = ` flex-direction: row-reverse;`;
    }
    if (value === "right") {
      this.$switch.style = `flex-direction: row;`;
    }
    if (value === "top") {
      this.$switch.style = `flex-direction: column-reverse;`;
    }
    if (value === "bottom") {
      this.$switch.style = `flex-direction: column;`;
    }
    this._position = value;
  }

  get disabled() {
    return this._disabled;
  }

  set disabled(value) {
    this._disabled = value;
    this.$checkbox.disabled = value;
    if(value===true){
      this.querySelector(".slider").classList.add("disabled");
    }else{
      this.querySelector(".slider").classList.remove("disabled");
    }

  }
}

customElements.define("slice-switch", Switch);
