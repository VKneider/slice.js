export default class complexNavbar extends HTMLElement {
  constructor(props) {
    super();
    slice.controller.loadTemplate(this);
    let menu = this.shadowRoot.querySelector("#menu-icon");
    let navbar = this.shadowRoot.querySelector(".navbar");

    menu.addEventListener("click", () => {
      navbar.classList.toggle("open");
      menu.classList.toggle("fa-navicon");
      menu.classList.toggle("fa-close");
    });

    if (props != undefined) {
      if (props.id != undefined) {
        this.id = props.id;
      }

      let logoLink = this.shadowRoot.getElementById("logoLink");
      if (props.logoLink != undefined) {
        logoLink.href = props.logoLink;
      }

      let sign = this.shadowRoot.querySelector("#sign-in");
      if (props.sign != undefined) {
        sign.href = props.sign;
      } else {
        sign.style.display = "none";
      }

      let logo = this.shadowRoot.querySelector("#logo");
      logo.innerHTML = props.logo;

      let titleContainer = this.shadowRoot.querySelector(".navbar");
      for (let i = 0; i < props.sections.length; i++) {
        let prop = props.sections[i];
        titleContainer.innerHTML += `<li><a id=${prop.id}  href="${prop.link}">${prop.text}</a></li>`;
      }
    }
    slice.controller.registerComponent(this);
  }

  getElement(id) {
    return this.shadowRoot.getElementById(id);
  }
}

window.customElements.define("complex-navbar", complexNavbar);
