export default class NavBar extends HTMLElement {
  constructor() {
    super();
    slice.controller
      .loadTemplate("./Slice/templates/Navbar.html")
      .then((template) => {
        this.template = template;
        slice.controller.registerComponent(this);
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        if (this.props != undefined) {
          if (this.props.style != undefined) {
            this.setCss();
          }
          let logo = this.shadowRoot.querySelector("#logo");
          logo.innerHTML = this.props.logo;

          let titleContainer =
            this.shadowRoot.getElementById("title-container");
          for (let i = 0; i < this.props.sections.length; i++) {
            let prop = this.props.sections;
            titleContainer.innerHTML += `<li class="nav-menu-item "> <a href="${prop[i].id}" id="script" class="averus nav-menu-link"> ${prop[i].text} </a></li>`;
          }
        }

        const t = this.shadowRoot.querySelector(".toggle");
        t.addEventListener("click", () => {
          t.classList.toggle("is-active");
        });

        const navMenu = this.shadowRoot.querySelector(".nav-menu");

        t.addEventListener("click", () => {
          navMenu.classList.toggle("nav-menu_visible");

          if (navMenu.classList.contains("nav-menu_visible")) {
            t.setAttribute("aria-label", "Cerrar menú");
          } else {
            t.setAttribute("aria-label", "Abrir menú");
          }
        });
      });
  }

  connectedCallback() {}

  setCss() {
    let style = document.createElement("style");
    let keys = Object.keys(this.props.style);
    style.innerHTML += `.header{`;
    for (let i = 0; i < keys.length; i++) {
      style.innerHTML += `${keys[i]}:${this.props.style[keys[i]]};\n`;
    }
    style.innerHTML += `}`;
    this.shadowRoot.appendChild(style);
  }
}
window.customElements.define("nav-bar", NavBar);
