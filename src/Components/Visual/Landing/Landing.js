export default class Landing extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {
    let logoSize = "500px";
    if (window.screen.width <= 770) {
      logoSize = "300px";
    }
    const sliceLogo = await slice.build("Icon", {
      name: "sliceJs",
      size: logoSize,
      color: "var(--font-primary-color)",
      iconStyle: "filled",
    });
    sliceLogo.classList.add("sliceLogo");
    this.querySelector(".intro").appendChild(sliceLogo);
  }
}

customElements.define("slice-landing", Landing);
