export default class Card extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    this.$title = this.querySelector(".title")
    this.$text = this.querySelector(".text")
    this.$iconContainer = this.querySelector(".icon-container")
    slice.controller.setComponentProps(this, props);

    this.debuggerProps = ["title", "text", "icon", "customColor"];
  }

  async init() {
    this.$icon = await slice.build("Icon", {
      name: "twitter",
      size: "150px",
      color: "var(--card-color)",
      iconStyle: "filled"
    })



    this.$icon.classList.add("icon")
    this.$iconContainer.appendChild(this.$icon)

    if (this._customColor) {
      this.customColor = this._customColor
    }
  }

  get title() {
    return this._title;
  }

  set title(value) {
    this._title = value;
    this.$title.textContent = value;
  }

  get text() {
    return this._text;
  }

  set text(value) {
    this._text = value;
    this.$text.textContent = value;
  }

  get icon() {
    return this._icon;
  }

  set icon(value) {
    this._icon = value;
    if (!this.$icon) return;
    this.$icon.name = value;
  }

  get customColor() {
    return this._customColor;
  }

  set customColor(value) {
    this._customColor = value;
    this.querySelector(".card").style["--card-color"] = value;
    if (!this.$icon) return;
    this.$icon.color = value.iconColor;
  }


}

customElements.define("slice-card", Card);

