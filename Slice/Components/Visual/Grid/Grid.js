export default class Grid extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    this.$grid = this.querySelector(".grid-container");

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["columns", "rows"];
  }

  async init() {
    if (!this.rows || !this.columns) {
      throw new Error(
        "Grid cannot be build if rows or columns are not created."
      );
    }
  }

  set columns(value) {
    this._columns = value;
    this.$grid.style.gridTemplateColumns = `repeat(${value}, 1fr)`;
  }

  get columns() {
    return this._columns;
  }

  set rows(value) {
    this.$grid.style.gridTemplateRows = `repeat(${value}, 1fr)`;
    this._rows = value;
  }

  get rows() {
    return this._rows;
  }

  set items(values) {
    this.setItems(values);
    this._items = values;
  }

  get items() {
    return this._items;
  }

  async setItem(item) {
    item.classList.add("grid-item");
    this.$grid.appendChild(item);
  }

  async setItems(items) {
    for (let i = 0; i < items.length; i++) {
      this.setItem(items[i]);
    }
  }
}

customElements.define("slice-grid", Grid);
