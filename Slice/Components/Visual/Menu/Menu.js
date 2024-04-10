export default class Menu extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    this.$menuButton = this.querySelector(".slice_menu_button");
    this.$closeButton = this.querySelector(".slice_close_menu");
    this.$container = this.querySelector(".slice_menu_container");
    this.$menu = this.querySelector(".slice_menu");

    this.$menuButton.addEventListener("click", () => {
      this.showMenu();
    });
    this.$closeButton.addEventListener("click", () => {
      this.hideMenu();
    });

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  init() {}

  add(value) {
    this.$menu.appendChild(value);
  }

  hideMenu() {
    this.$container.style.width = "0%";
    this.$menu.classList.remove("slice_menu_open");
  }

  showMenu() {
    this.$container.style.width = "100%";
    this.$menu.classList.add("slice_menu_open");
  }
}

customElements.define("slice-menu", Menu);
