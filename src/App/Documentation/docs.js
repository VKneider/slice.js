import Slice from "../../../Slice/Slice.js";
import components from "../../../Slice/Components/components.js";

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

let compVisual = {
  value: "Visual",
  items: [],
};
let compStruc = {
  value: "Structural",
  items: [],
};
let compServe = {
  value: "Service",
  items: [],
};

for (const name in components) {
  // console.log(`${name}: ${components[name]}`);
  const component = {
    value: name,
    href: `#${name}`,
  };
  if (components[name] === "Visual") {
    compVisual.items.push(component);
  }
  if (components[name] === "Structural") {
    compStruc.items.push(component);
  }
  if (components[name] === "Service") {
    compServe.items.push(component);
  }
}

const grid = await slice.build("Grid", {
  columns: 3,
  rows: 1,
});

div.appendChild(navBar);
div.appendChild(grid);

const treeview = await slice.build("TreeView", {
  items: [
    {
      value: "Components",
      items: [compVisual, compStruc, compServe],
    },
  ],
});

grid.setItem(treeview);

const divView = document.createElement("div");
divView.id = "view";

const layOut = await slice.build("Layout", {
  layout: div,
  view: divView,
});

grid.setItem(layOut);

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
