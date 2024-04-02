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
      if (
        value &&
        typeof value === "object" &&
        "text" in value &&
        "href" in value
      ) {
        const item = document.createElement("a");
        item.textContent = value.text;
        item.href = value.href;
        item.classList.add("item");
        this.$items.appendChild(item);
      } else {
        // value.classList.add("item");
        // this.$items.appendChild(value);
      }
    });
  }
}
window.customElements.define("slice-nav-bar", Navbar);
