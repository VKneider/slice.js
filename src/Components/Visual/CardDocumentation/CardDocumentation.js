export default class CardDocumentation extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {
    const myCard = await slice.build("Card", {});
    this.querySelector(".myCard_container").appendChild(myCard);
  }
}

customElements.define("slice-carddocumentation", CardDocumentation);
