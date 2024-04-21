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
      value: "Test Button",
      color: {
        button: "red",
      },
      onClickCallback: async () => {
        console.log("Test");
      },
    },
  ],
});

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
  a.href = `#${name}`;
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

// div.appendChild(navBar);

const button = await slice.build("Button", {
  value: "Slice",
  onClickCallback: () => {
    // layOut.showing(form);
  },
});

button.width = "50px";

const grid = await slice.build("Grid", {
  columns: 3,
  rows: 1,
  items: [button],
});

div.appendChild(grid);

// grid.setItem(button);

const form = document.createElement("div");

const button2 = await slice.build("Button", {
  value: "Another Button",
  customColor: {
    button: "#008080",
  },
  onClickCallback: () => {
    layOut.showing(button);
  },
});

form.appendChild(button2);

//form test

const name1 = await slice.build("Input", {
  id: "nombre",
  placeholder: "Name",
  required: true,
  sliceId: "myInput",
});

const lastname = await slice.build("Input", {
  placeholder: "Last Name",
});

const password = await slice.build("Input", {
  placeholder: "Password",
  type: "password",
  required: true,
  secret: true,
});

const confirmPassword = await slice.build("Input", {
  placeholder: "Confirm Password",
  type: "password",
  required: true,
  secret: false,
  disabled: true,
  conditions: {
    // regex: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[\\W_]).{8,}$",
    minLength: 8,
    maxLength: 10,
    minMinusc: 1,
    maxMinusc: 4,
    minMayusc: 1,
    maxMayusc: 6,
    minNumber: 1,
    maxNumber: 6,
    minSymbol: 1,
    maxSymbol: 10,
  },
});

form.appendChild(name1);
form.appendChild(lastname);
form.appendChild(password);
form.appendChild(confirmPassword);

//form test

const divView = document.createElement("div");
divView.id = "view";

const layOut = await slice.build("Layout", {
  layout: div,
  view: divView,
});

document.body.appendChild(layOut);

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
