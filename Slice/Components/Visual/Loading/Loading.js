export default class Loading extends HTMLElement {
  constructor() {
    super();
    slice.controller
      .loadTemplate("./Slice/templates/Loading.html")
      .then((template) => {
        this.shadow = this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        if (this.props != undefined) {
          if (this.props.id != undefined) {
            this.id = this.props.id;
          }
        }

        slice.controller.registerComponent(this);
        slice.appendStyles(`.blocked{
                pointer-events: none;
                background-color: #1d2630;
                opacity: 0.5;
                z-index: 5;
              }`);
      });
  }

  connectedCallback() {}

  start() {
    document.body.appendChild(this);
    document.body.classList.add("blocked");
  }

  stop() {
    document.body.classList.remove("blocked");
    this.remove();
  }
}

window.customElements.define("load-popup", Loading);
