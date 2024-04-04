export default class Navbar extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$navBar = this.querySelector(".slice_nav_bar");
    this.$menu = this.querySelector(".nav_bar_menu");

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["items"];
  }

  async init() {}

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
  async addItem(value) {
    const item = document.createElement("li");
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
    this.$menu.appendChild(item);
  }
}
window.customElements.define("slice-nav-bar", Navbar);
