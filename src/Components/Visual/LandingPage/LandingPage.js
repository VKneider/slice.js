export default class LandingPage extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {
    const loading = await slice.build("Loading", {});
    loading.start();
    const div = document.createElement("div");
    let theme = slice.stylesManager.themeManager.currentTheme;

    const navBar = await slice.build("Navbar", {
      logo: {
        src: "../../images/Slice.js-logo.png",
        href: "",
      },
      buttons: [
        {
          value: "Change Theme",
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
        },
      ],
    });

    div.appendChild(navBar);
    const divView = document.createElement("div");
    divView.classList.add("landing_page");

    const landingMenu = await slice.build("LandingMenu", {});
    divView.appendChild(landingMenu);
    const layOut = await slice.build("Layout", {
      layout: div,
      view: divView,
    });

    this.appendChild(layOut);



    loading.stop();
  }


}

customElements.define("slice-landingpage", LandingPage);
