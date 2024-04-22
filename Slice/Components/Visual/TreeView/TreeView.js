export default class TreeView extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    this.$treeView = this.querySelector(".simple_treeview");

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {
    if (this.items) {
      await this.setTreeItems(this.items);
    }
  }

  set items(values) {
    this._items = values;
  }

  get items() {
    return this._items;
  }

  async setTreeItem(item) {
    const treeItem = await slice.build("TreeItem", item);
    treeItem.classList.add("tree_item");
    this.$treeView.appendChild(treeItem);
  }

  async setTreeItems(items) {
    for (let i = 0; i < items.length; i++) {
      await this.setTreeItem(items[i]);
    }
  }
}

customElements.define("slice-treeview", TreeView);
