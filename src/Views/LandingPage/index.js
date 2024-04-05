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
      text: "About Us",
      href: "",
    },
    {
      text: "Language",
      href: "",
      type: "dropdown",
      options: [
        {
          text: "Español",
          href: "",
        },
        {
          text: "Ingles",
          href: "",
        },
      ],
    },
    {
      text: "Contact Us",
      href: "",
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

document.body.appendChild(div);
loading.stop();
