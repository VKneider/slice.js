export default class MainMenu extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    this.$menuButton = this.querySelector(".slice_menu_button");
    this.$closeButton = this.querySelector(".slice_close_menu");
    this.$container = this.querySelector(".slice_menu_container");
    this.$menu = this.querySelector(".slice_menu");

    this.$menuButton.addEventListener("click", () => {
      this.$container.classList.add("slice_menu_open");
    });
    this.$closeButton.addEventListener("click", () => {
      this.$container.classList.remove("slice_menu_open");
    });

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  init() {}

  add(value) {
    this.$menu.appendChild(value);
  }
}

customElements.define("slice-mainmenu", MainMenu);
