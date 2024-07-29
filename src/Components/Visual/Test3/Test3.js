export default class Test3 extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {

    const goTo2Button = await slice.build("Button", {
      value: "Go to Test2",
      // color:
      onClickCallback: async () => {
        await slice.router.navigate("/2");
      },
    });

    const goToHomeButton = await slice.build("Button", {
      value: "Go to Home",
      // color:
      onClickCallback: async () => {
        await slice.router.navigate("/");
      },
    });

    this.appendChild(goTo2Button);
    this.appendChild(goToHomeButton);
  }

  
}

customElements.define("slice-test3", Test3);
