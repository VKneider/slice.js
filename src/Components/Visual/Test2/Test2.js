export default class Test2 extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {

    const theme = slice.theme;

    const sliceButton = await slice.build("Button", {
      value: "Change Theme",
      // color:
      onClickCallback: async () => {
        if (theme === "Slice") {
          await slice.setTheme("Light");
          theme = "Light";
        } else if (theme === "Light") {
          await slice.setTheme("Dark");
          theme = "Dark";
        } else if (theme === "Dark") {
          await slice.setTheme("Slice");
          theme = "Slice";
        }


      },
    });

    const redirectToHomeButton = await slice.build("Button", {
      value: "Go to Home",
      // color:
      onClickCallback: async () => {
        await slice.router.navigate("/");
      },
    });

    const goTo3Button = await slice.build("Button", {
      value: "Go to Test3",
      // color:
      onClickCallback: async () => {
        await slice.router.navigate("/3");
      },
    });


    this.appendChild(sliceButton);
    this.appendChild(redirectToHomeButton);
    this.appendChild(goTo3Button);
  }

  
}

customElements.define("slice-test2", Test2);
