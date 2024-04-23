import Slice from "../../../Slice/Slice.js";
import components from "../../../Slice/Components/components.js";

const loading = await slice.build("Loading", {});
loading.start();
const div = document.createElement("div");
// div.style.height = "90vh";
let theme = "Light";

const navBar = await slice.build("Navbar", {
  // position: "fixed",
  logo: {
    src: "../../images/Slice.js-logo.png",
    href: "",
  },
  items: [
    {
      text: "Home",
      href: "/src/App/LandingPage/",
    },
    {
      text: "About Us",
      href: "",
      type: "dropdown",
      options: [
        {
          text: "Julio",
          href: "https://www.instagram.com/juliograterolb/?hl=es",
        },
        {
          text: "Victor",
          href: "https://www.instagram.com/victorkneider/?hl=es",
        },
      ],
    },
    {
      text: "Documentation",
      href: "/src/App/Documentation/",
    },
    {
      text: "Drop",
      href: "",
      type: "dropdown",
      options: [
        {
          text: "drop 1",
          href: "",
        },
      ],
    },
  ],
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
divView.id = "view";

const layOut = await slice.build("Layout", {
  layout: div,
  view: divView,
});

grid.setItem(layOut);
loading.stop();

if (window.location.hash !== "") {
  await loadComponentFromHash();
}

//create an event that every time the hash changes, the component changes
window.addEventListener("hashchange", async () => {
  await loadComponentFromHash();
});

async function loadComponentFromHash() {
  let hash = window.location.hash;
  hash = hash.substring(1);
  let myComponent = await slice.build(hash, {});
  layOut.showing(myComponent);
}
