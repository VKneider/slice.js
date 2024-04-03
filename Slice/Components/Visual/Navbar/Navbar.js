export default class Navbar extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$navBar = this.querySelector(".slice_nav_bar");
    this.$items = this.querySelector(".nav_bar_items");

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
  addItem(value) {
    if (value.type === "text") {
      console.log(value.type);
      const item = document.createElement("a");
      item.textContent = value.text;
      item.href = value.href;
      item.classList.add("item");
      this.$items.appendChild(item);
    }
    if (value.type === "dropdown") {
    }
  }
}
window.customElements.define("slice-nav-bar", Navbar);
