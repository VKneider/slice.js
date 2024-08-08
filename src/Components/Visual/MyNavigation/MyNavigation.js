export default class MyNavigation extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    this.$navigation = this.querySelector(".my_navigation");

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["page"];
  }

  set page(value) {
    this._page = value;
    this.updateNavigation();
  }

  get page() {
    return this._page;
  }

  init() {
    if (this.page) {
      this.updateNavigation();
    }
  }

  updateNavigation() {
    this.$navigation.innerHTML = "";
    const idElements = this.page.querySelectorAll("[id]");

    idElements.forEach((element) => {
      const a = document.createElement("a");
      a.textContent = element.innerHTML;
      if (element.id) {
        a.href = `#${element.id}`;
        a.addEventListener("click", (event) => {
          event.preventDefault();
          document
            .getElementById(element.id)
            .scrollIntoView({ behavior: "smooth", block: "center" });
        });
      } else {
        a.href = ``;
      }
      this.$navigation.appendChild(a);
    });
  }
}

customElements.define("slice-mynavigation", MyNavigation);
