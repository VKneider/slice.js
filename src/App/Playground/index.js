const loading = await slice.build("Loading", {});
loading.start();

let theme = slice.stylesManager.themeManager.currentTheme;

const navBar = await slice.build("Navbar", {
  // position: "fixed",
  logo: {
    src: "../../images/Slice.js-logo.png",
    href: "/src/App/LandingPage/",
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
          href: "https://github.com/juliograterol",
        },
        {
          text: "Victor",
          href: "https://github.com/VKneider",
        },
      ],
    },
    {
      text: "Documentation",
      href: "/src/App/Documentation/",
    },
    {
      text: "Playground",
      href: "/src/App/Playground/",
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

document.body.appendChild(navBar);

const sliceButton = await slice.build("Button", {
  value: "Slice",
  onClickCallback:()=>{
    if(slice.translator.currentLanguage=="es"){
      slice.translator.changeLanguage('en')
    }else{
      slice.translator.changeLanguage('es')

    }
  }
});
const sliceInput = await slice.build("Input", {
  placeholder: "Enter text here...",
});
const checkbox = await slice.build("Checkbox", {
  label: "Check",
  position: "top",
});

const sliceSwitch = await slice.build("Switch", {
  label: "Switch",
  labelPlacement: "left",
});
const select = await slice.build("Select", {
  options: [
    { value: "Hola", id: 0 },
    { value: "Hello", id: 1 },
    { value: "Hallo", id: 2 },
    { value: "Hi", id: 3 },
    { value: "Hola", id: 4 },
    { value: "Hello", id: 5 },
    { value: "Hallo", id: 6 },
    { value: "Hi", id: 7 },
  ],
  visibleProp: "id",
  label: "Elige una opcion",
  multiple: true,
});
const sliceCard = await slice.build("Card", {
  sliceId:"prueba"
});
const details = await slice.build("Details", {
  title: "Slice",
  text: "Slice details text",
});

const grid = document.createElement("div");
grid.classList.add("indexGrid");

sliceButton.classList.add("indexGridItem");
sliceInput.classList.add("indexGridItem");
sliceSwitch.classList.add("indexGridItem");
select.classList.add("indexGridItem");
checkbox.classList.add("indexGridItem");
details.classList.add("indexGridItem");

grid.appendChild(sliceButton);
grid.appendChild(sliceInput);
grid.appendChild(sliceSwitch);
grid.appendChild(select);
grid.appendChild(checkbox);
grid.appendChild(sliceCard);
grid.appendChild(details);

document.body.appendChild(grid);

loading.stop();
