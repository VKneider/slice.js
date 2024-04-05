export default class Details extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    this.$detailsTitle = this.querySelector(".details_title");
    this.$detailsText = this.querySelector(".details_text");
    this.$details = this.querySelector(".full_details");
    this.$summary = this.querySelector(".details_summary");

    this.$summary.addEventListener("click", () => {
      this.classList.toggle("details_open");
    });

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["title", "text"];
  }

  async init() {}

  get title() {
    return this._title;
  }

  set title(value) {
    this._title = value;
    this.$detailsTitle.textContent = value;
  }

  get text() {
    return this._text;
  }

  set text(value) {
    this._text = value;
    this.$detailsText.textContent = value;
  }

  addDetail(value) {
    this.$details.appendChild(value);
  }
}

customElements.define("slice-details", Details);
