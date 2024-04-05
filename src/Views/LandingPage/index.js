const loading = await slice.build("Loading", {});
loading.start();
const div = document.createElement("div");

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
      text: "Components",
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
      // onClickCallback: hola,
    },
  ],
});
div.appendChild(navBar);

const menu = await slice.build("Menu", {});
div.appendChild(menu);

document.body.appendChild(div);
loading.stop();
