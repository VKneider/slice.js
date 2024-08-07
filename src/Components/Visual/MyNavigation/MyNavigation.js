export default class MyNavigation extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    this.$navigation = this.querySelector(".my_navigation");

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["element"];
  }

  set element(value) {
    this._element = value;
  }

  init() {
    this.updateNavigation();
  }

  getHash() {
    this.$hash = window.location.hash;
  }

  updateNavigation() {
    this.getHash();
    this.$navigation.innerHTML = "";
    const idElements = document.body.querySelectorAll("[id]");
    idElements.forEach((elements, index) => {
      const a = document.createElement("a");
      a.textContent = elements.innerHTML;
      if (elements.id) {
        a.href = `#${elements.id}`;
      } else {
        a.href = `${this.$hash}`;
      }
      this.$navigation.appendChild(a);
    });
    window.addEventListener("hashchange", async () => {
      idElements.forEach((elements) => {
        if (window.location.hash === `#${elements.id}`) {
          window.location.hash = this.$hash;
        }
      });
    });
  }
}

customElements.define("slice-mynavigation", MyNavigation);
