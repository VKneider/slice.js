export default class Navbar extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> a5f3d58 (navbar direction reverse added)
=======
>>>>>>> a5f3d58 (navbar direction reverse added)
    this.$header = this.querySelector(".slice_nav_header");
    this.$navBar = this.querySelector(".slice_nav_bar");
    this.$menu = this.querySelector(".nav_bar_menu");
<<<<<<< HEAD
<<<<<<< HEAD
=======
    this.$navBar = this.querySelector(".slice_nav_bar");
    this.$menu = this.querySelector(".nav_bar_menu");
>>>>>>> 7396563 (Navbar adds Buttons)
=======
    this.$navBar = this.querySelector(".slice_nav_bar");
    this.$menu = this.querySelector(".nav_bar_menu");
>>>>>>> 7396563 (Navbar adds Buttons)
    this.$buttonsContainer = this.querySelector(".nav_bar_buttons");
    this.$logoContainer = this.querySelector(".logo_container");
    this.$mobileMenu = this.querySelector(".slice_mobile_menu");
    this.$mobileButton = this.querySelector(".mobile_menu_button");
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    this.$closeMenu = this.querySelector(".mobile_close_menu");

    this.$mobileButton.addEventListener("click", () => {
      this.$mobileMenu.style.transform = "translateX(0%)";
    });

    this.$closeMenu.addEventListener("click", () => {
      this.$mobileMenu.style.transform = "translateX(-100%)";
    });
=======
    this.$logoContainer = this.querySelector(".logo_container");
>>>>>>> bdab084 (NavBar logo can be added, and anim-item on hover. Mobile menu next to be added)
=======
=======
>>>>>>> b740578 (mobile menu on process)

    // this.$mobileButton.addEventListener("click", () => {
    //   this.$mobileMenu.classList.toggle("menu_open");
    // });
<<<<<<< HEAD
>>>>>>> b740578 (mobile menu on process)
=======
    this.$closeMenu = this.querySelector(".mobile_close_menu");

    this.$mobileButton.addEventListener("click", () => {
=======
    this.$closeMenu = this.querySelector(".mobile_close_menu");

    this.$mobileButton.addEventListener("click", () => {
      this.$mobileMenu.style.visibility = "visible";
>>>>>>> 9a11b47 (functional mobile menu in navbar mobile view)
      this.$mobileMenu.style.transform = "translateX(0%)";
    });

    this.$closeMenu.addEventListener("click", () => {
<<<<<<< HEAD
      this.$mobileMenu.style.transform = "translateX(-100%)";
    });
>>>>>>> 9a11b47 (functional mobile menu in navbar mobile view)
=======
    this.$logoContainer = this.querySelector(".logo_container");
>>>>>>> bdab084 (NavBar logo can be added, and anim-item on hover. Mobile menu next to be added)
=======
>>>>>>> b740578 (mobile menu on process)
=======
      // this.$mobileMenu.style.visibility = "hidden";
      this.$mobileMenu.style.transform = "translateX(-100%)";
    });
>>>>>>> 9a11b47 (functional mobile menu in navbar mobile view)

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["logo", "items"];
  }

  async init() {
    const mobileItems = this.items;
    mobileItems.forEach((item) => {
      const it = document.createElement("a");
      it.href = item.href;
      it.innerText = item.text;
      this.$mobileMenu.appendChild(it);
    });
  }
<<<<<<< HEAD
<<<<<<< HEAD

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
=======
>>>>>>> 9a11b47 (functional mobile menu in navbar mobile view)

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
=======
>>>>>>> 9a11b47 (functional mobile menu in navbar mobile view)

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
    values.forEach((value) => {
      if (!value.type) {
        value.type = "text";
      }
      this.addItem(value);
    });
  }

  get buttons() {
    return this._buttons;
  }

  set buttons(values) {
    this._buttons = values;
    values.forEach((value) => {
      this.addButton(value);
    });
  }

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> a5f3d58 (navbar direction reverse added)
=======
>>>>>>> a5f3d58 (navbar direction reverse added)
  get direction() {
    return this._direction;
  }

  set direction(value) {
    this._direction = value;
    if (value === "reverse") {
      this.$header.classList.add("direction-row-reverse");
    }
  }

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 7396563 (Navbar adds Buttons)
=======
>>>>>>> a5f3d58 (navbar direction reverse added)
=======
>>>>>>> 7396563 (Navbar adds Buttons)
=======
>>>>>>> a5f3d58 (navbar direction reverse added)
  async addItem(value) {
    const item = document.createElement("li");
    const hover = document.createElement("div");
    hover.classList.add("anim-item");
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
    this.$menu.appendChild(item);
  }

  async addButton(value) {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 38695ad (button change color fixed)
=======
>>>>>>> 38695ad (button change color fixed)
    if (!value.color) {
      value.color = {
        label: "var(--primary-color-rgb)",
        button: "var(--primary-background-color)",
      };
    }
<<<<<<< HEAD
<<<<<<< HEAD
    const button = await slice.build("Button", {
      value: value.value,
      customColor: value.color,
      onClickCallback: value.onClickCallback,
=======
=======
>>>>>>> 7396563 (Navbar adds Buttons)
    const button = await slice.build("Button", {
      value: value.value,
      customColor: "black",
      onClickCallback: () => value.onClickCallback,
<<<<<<< HEAD
>>>>>>> 7396563 (Navbar adds Buttons)
=======
    const button = await slice.build("Button", {
      value: value.value,
      customColor: value.color,
      onClickCallback: value.onClickCallback,
>>>>>>> 38695ad (button change color fixed)
=======
>>>>>>> 7396563 (Navbar adds Buttons)
=======
    const button = await slice.build("Button", {
      value: value.value,
      customColor: value.color,
      onClickCallback: value.onClickCallback,
>>>>>>> 38695ad (button change color fixed)
    });
    this.$buttonsContainer.appendChild(button);
  }
}
window.customElements.define("slice-nav-bar", Navbar);
