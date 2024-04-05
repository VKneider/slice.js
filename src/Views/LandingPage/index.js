import components from "../../../Slice/Components/components.js";

const loading = await slice.build("Loading", {});
loading.start();

const div = document.createElement("div");
let theme = "Light";

const navBar = await slice.build("Navbar", {
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

for (const name in components) {
  //   console.log(`${name}: ${components[name]}`);
}

div.appendChild(navBar);

document.body.appendChild(div);
loading.stop();
