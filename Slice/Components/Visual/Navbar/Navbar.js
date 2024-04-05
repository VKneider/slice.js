export default class Navbar extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    this.$header = this.querySelector(".slice_nav_header");
    this.$navBar = this.querySelector(".slice_nav_bar");
    this.$menu = this.querySelector(".nav_bar_menu");
    this.$buttonsContainer = this.querySelector(".nav_bar_buttons");
    this.$logoContainer = this.querySelector(".logo_container");
    this.$mobileMenu = this.querySelector(".slice_mobile_menu");
    this.$mobileButton = this.querySelector(".mobile_menu_button");
    this.$closeMenu = this.querySelector(".mobile_close_menu");

    this.$mobileButton.addEventListener("click", () => {
      this.$mobileMenu.style.transform = "translateX(0%)";
    });

    this.$closeMenu.addEventListener("click", () => {
      this.$mobileMenu.style.transform = "translateX(-100%)";
    });

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["logo", "items"];
  }

  async init() {
    this.items.forEach(async (item) => {
      await this.addItem(item, this.$mobileMenu);
    });
    this.buttons.forEach(async (item) => {
      await this.addButton(item, this.$mobileMenu);
    });
  }

  get position() {
    return this._position;
  }

  set position(value) {
    this._position = value;
    if (value === "fixed") {
      this.classList.add("nav_bar_fixed");
    }
  }

  get logo() {
    return this._logo;
  }

  set logo(value) {
    this._logo = value;
    const img = document.createElement("img");
    img.src = value.src;
    this.$logoContainer.appendChild(img);
    this.$logoContainer.href = value.href;
  }

  get items() {
    return this._items;
  }

  set items(values) {
    this._items = values;
    values.forEach(async (value) => {
      await this.addItem(value, this.$menu);
    });
  }

  get buttons() {
    return this._buttons;
  }

  set buttons(values) {
    this._buttons = values;
    values.forEach(async (value) => {
      await this.addButton(value, this.$buttonsContainer);
    });
  }

  get direction() {
    return this._direction;
  }

  set direction(value) {
    this._direction = value;
    if (value === "reverse") {
      this.$header.classList.add("direction-row-reverse");
    }
  }

  async addItem(value, addTo) {
    if (!value.type) {
      value.type = "text";
    }
    const item = document.createElement("li");
    const hover = document.createElement("div");
    hover.classList.add("anim-item");
    //type
    if (value.type === "text") {
      const a = document.createElement("a");
      a.textContent = value.text;
      a.href = value.href;
      a.classList.add("item");
      item.appendChild(a);
    }
    if (value.type === "dropdown") {
      console.log(value);
      const d = await slice.build("DropDown", {
        label: value.text,
        options: value.options,
      });
      d.classList.add("item");
      item.appendChild(d);
    }
    item.appendChild(hover);
    addTo.appendChild(item);
    console.log("Final item");
  }

  async addButton(value, addTo) {
    if (!value.color) {
      value.color = {
        label: "var(--primary-color-rgb)",
        button: "var(--primary-background-color)",
      };
    }
    const button = await slice.build("Button", {
      value: value.value,
      customColor: value.color,
      onClickCallback: value.onClickCallback,
    });
    addTo.appendChild(button);
    console.log("Final button");
  }
}
window.customElements.define("slice-nav-bar", Navbar);
