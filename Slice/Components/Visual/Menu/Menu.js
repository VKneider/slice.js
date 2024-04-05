export default class Menu extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    this.$menuButton = this.querySelector(".slice_menu_button");
    this.$closeButton = this.querySelector(".slice_close_menu");
    this.$container = this.querySelector(".slice_menu_container");
    this.$menu = this.querySelector(".slice_menu");

    this.$menuButton.addEventListener("click", () => {
      this.$container.style.width = "100%";
      this.$menu.style = "transform: translateX(0%); width: 100%;";
    });
    this.$closeButton.addEventListener("click", () => {
      this.$container.style.width = "0%";
      this.$menu.style = "transform: translateX(-100%);";
      // this.$menu.classList.toggle("slice_menu");
    });

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  init() {}
}

customElements.define("slice-menu", Menu);
