export default class LandingMenu extends HTMLElement {
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
    const goToDocs = await slice.build("Button", {
      value: "Go to Documentation",
      onClickCallback: async () => {
        await slice.router.navigate("/Documentation");
      },
    });
    this.querySelector(".goToDocs").appendChild(goToDocs);
  }
}

customElements.define("slice-landing-menu", LandingMenu);
