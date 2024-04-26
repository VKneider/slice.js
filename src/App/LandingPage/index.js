import Slice from "../../../Slice/Slice.js";
import components from "../../../Slice/Components/components.js";

const loading = await slice.build("Loading", {});
loading.start();
const div = document.createElement("div");
let theme = slice.stylesManager.themeManager.currentTheme;

const navBar = await slice.build("Navbar", {
  // position: "fixed",
  logo: {
    src: "../../images/Slice.js-logo.png",
    href: "",
  },
  buttons: [
    {
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
    },
  ],
});

div.appendChild(navBar);

const divView = document.createElement("div");
divView.classList.add("landing_page");

const landingPage = await slice.build("Landing", {});
divView.appendChild(landingPage);

const layOut = await slice.build("Layout", {
  layout: div,
  view: divView,
});

document.body.appendChild(layOut);
loading.stop();
