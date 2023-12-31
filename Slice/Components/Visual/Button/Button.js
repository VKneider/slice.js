export default class Button extends HTMLElement {
  constructor() {
    super();
    slice.controller
      .loadTemplate("./Slice/templates/Button.html")
      .then((template) => {
        this.shadow = this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
        let btn = this.shadowRoot.getElementById("btn");

        if (this.props != undefined) {
          if (this.props.id != undefined) {
            this.id = this.props.id;
          }

          if (this.props.style != undefined) {
            this.setCss();
          }
          if (this.props.value != undefined) {
            btn.innerHTML = this.props.value;
          }
        }

        slice.controller.registerComponent(this);
      });
  }

  connectedCallback() {}

  setCss() {
    let style = document.createElement("style");
    let keys = Object.keys(this.props.style);
    style.innerHTML += `.button{`;
    for (let i = 0; i < keys.length; i++) {
      style.innerHTML += `${keys[i]}:${this.props.style[keys[i]]};\n`;
    }
    style.innerHTML += `}`;
    let css = this.shadowRoot.getElementById("css");
    css.appendChild(style);
  }
}
window.customElements.define("my-button", Button);
