export default class TreeItem extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    this.$item = this.querySelector(".slice_tree_item");

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["value", "href"];
  }

  async init() {
    if (this._items) {
      for (let i = 0; i < this._items.length; i++) {
        await this.setItem(this._items[i], this.$container); // Cambiado items por _items
      }
    }
  }

  set value(value) {
    this.$item.textContent = value;
    this._value = value;
  }

  get value() {
    return this._value;
  }

  set href(value) {
    this.$item.href = value;
    this._href = value;
  }

  get href() {
    return this._href;
  }

  set items(values) {
    this._items = values;
    const caret = document.createElement("div");
    caret.classList.add("caret");
    //create a container for items
    const container = document.createElement("div");
    container.classList.add("container");
    this.appendChild(container);
    //add
    this.$container = container;
    caret.addEventListener("click", () => {
      caret.classList.toggle("caret_open");
      this.$container.classList.toggle("container_open");
    });
    if (!this.href) {
      this.$item.addEventListener("click", () => {
        caret.classList.toggle("caret_open");
        this.$container.classList.toggle("container_open");
      });
    }
    this.$item.appendChild(caret);
  }

  async setItem(value, addTo) {
    const item = await slice.build("TreeItem", value);
    addTo.appendChild(item);
  }
}

customElements.define("slice-treeitem", TreeItem);
