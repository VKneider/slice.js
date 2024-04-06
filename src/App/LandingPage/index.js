import Slice from "../../../Slice/Slice.js";
import components from "../../../Slice/Components/components.js";

const loading = await slice.build("Loading", {});
loading.start();

const div = document.createElement("div");
div.style.height = "90vh";
let theme = "Light";

const navBar = await slice.build("Navbar", {
  // position: "fixed",
  logo: {
    src: "../Slice.js-logo.png",
    href: "",
  },
  items: [
    {
      text: "Home",
      href: "",
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
      text: "Contact Us",
      href: "",
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

let comps = [];

const compVisual = await slice.build("Details", {
  title: "Visual",
});
const compStruc = await slice.build("Details", {
  title: "Structural",
});
const compServe = await slice.build("Details", {
  title: "Service",
});

for (const name in components) {
  // console.log(`${name}: ${components[name]}`);
  const comp = document.createElement("div");
  const a = document.createElement("a");
  a.textContent = name;
  a.href = "";
  comp.appendChild(a);
  if (components[name] === "Visual") {
    compVisual.addDetail(comp);
  }
  if (components[name] === "Structural") {
    compStruc.addDetail(comp);
  }
  if (components[name] === "Service") {
    compServe.addDetail(comp);
  }
}

const menu = await slice.build("Menu", {});

menu.add(compVisual);
menu.add(compStruc);
menu.add(compServe);

div.appendChild(navBar);
div.appendChild(menu);

const button = await slice.build("Button", {
  value: "Slice",
});

// div.appendChild(button);

document.body.appendChild(div);
loading.stop();

