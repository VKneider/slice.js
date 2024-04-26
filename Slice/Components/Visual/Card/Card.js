export default class Card extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$card = this.querySelector(".slice-card");
    this.$title = this.querySelector(".title");
    this.$text = this.querySelector(".text");
    this.$cover = this.querySelector(".card_cover");
    slice.controller.setComponentProps(this, props);

    this.$cover.addEventListener("click", () => {
      this.isOpen = !this.isOpen;
    });

    this.$card.addEventListener("mouseover", () => {
      this.$cover.style.backgroundColor = this.$color.icon;
      this.$icon.color = this.$color.card;
    });
    this.$card.addEventListener("mouseout", () => {
      this.$cover.style.backgroundColor = this.$color.card;
      this.$icon.color = this.$color.icon;
    });

    this.debuggerProps = ["title", "text", "icon", "customColor", "isOpen"];
  }

  async init() {
    if (this.isOpen === undefined) {
      this.isOpen = false;
    }

    if (!this.customColor) {
      this.$color = {
        icon: "var(--primary-color-contrast)",
        card: "var(--primary-color)",
      };
    }

    if (!this._icon) {
      this.icon = { name: "sliceJs", iconStyle: "filled" };
    }

    this.$icon = await slice.build("Icon", {
      name: this.icon.name,
      size: "150px",
      color: this.$color.icon,
      iconStyle: this._icon.iconStyle,
    });
    this.$cover.appendChild(this.$icon);
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
    this.$icon.name = value.name;
    this.$icon.iconStyle = value.iconStyle;
  }

  get isOpen() {
    return this._isOpen;
  }

  set isOpen(boolean) {
    this._isOpen = boolean;
    if (boolean) {
      this.$cover.style.zIndex = 0;
    } else {
      this.$cover.style.zIndex = 1;
    }
  }

  get customColor() {
    return this._customColor;
  }

  set customColor(value) {
    this._customColor = value;
    this.$color = value;
    if (value.card) {
      this.$cover.style.backgroundColor = value.card;
    }
  }
}

customElements.define("slice-card", Card);
