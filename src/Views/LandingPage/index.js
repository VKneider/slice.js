let theme = "Light";

async function hola() {
  if (theme === "Slice") {
    await slice.setTheme("Light");
    theme = "Light";
    changeThemeButton.value = "Cambiar al tema Dark";
  } else if (theme === "Light") {
    await slice.setTheme("Dark");
    theme = "Dark";
    changeThemeButton.value = "Cambiar al tema Slice";
  } else if (theme === "Dark") {
    await slice.setTheme("Slice");
    theme = "Slice";
    changeThemeButton.value = "Cambiar al tema Light";
  }
}

let changeThemeButton = await slice.build("Button", {
  value: "Cambiar Tema",
  onClickCallback: hola,
});

document.body.insertBefore(changeThemeButton, document.body.firstChild);

//append the component to the body first element

// Form
//
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

function testSliceButton() {
  if (slice.translator.currentLanguage === "es") {
    slice.translator.changeLanguage("en");
  } else {
    slice.translator.changeLanguage("es");
  }

  sliceSwitch.label = slice.translator.currentLanguage;
}

const dateInput = await slice.build("Input", {
  placeholder: "Birthday",
  type: "date",
});
const ageInput = await slice.build("Input", {
  placeholder: "Age",
  type: "number",
});

const button = await slice.build("Button", {
  value: "Slice",
  sliceId: "gio",
  onClickCallback: () => {
    password.triggerError();
    password.triggerError();
    select.value = [
      { value: "Hola", id: 0 },
      { value: "Hello", id: 1 },
      { value: "Hi", id: 3 },
    ];
  },
});

const form = document.getElementById("form");

form.appendChild(name1);
form.appendChild(lastname);
form.appendChild(password);
form.appendChild(confirmPassword);
form.appendChild(dateInput);
form.appendChild(ageInput);

const checkbox = await slice.build("Checkbox", {
  label: "Check",
  position: "top",
  customColor: "yellow",
});
const checkbox2 = await slice.build("Checkbox", {
  label: "Check",
  position: "left",
});

const sliceSwitch = await slice.build("Switch", {
  label: slice.translator.currentLanguage,
  customColor: "black",
  toggle: testSliceButton,
});
const sliceSwitch2 = await slice.build("Switch", {
  label: "Switch",
  position: "bottom",
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

const select2 = await slice.build("Select", {
  options: [
    { value: "Hola", id: 0 },
    { value: "Hello", id: 1 },
    { value: "Hallo", id: 2 },
    { value: "Hi", id: 3 },
  ],
  visibleProp: "id",
  label: "Elige una opcion",
  multiple: false,
  onOptionSelect: function xd() {
    select.value = [select2.value];
  },
});

form.appendChild(checkbox);
form.appendChild(checkbox2);
form.appendChild(sliceSwitch);
form.appendChild(sliceSwitch2);
form.appendChild(select);
form.appendChild(select2);

form.appendChild(button);

const button2 = await slice.build("Button", {
  value: "Cambiar Idioma",
  customColor: "red",
  onClickCallback: () => {
    if (slice.translator.currentLanguage === "es") {
      slice.translator.changeLanguage("en");
    } else {
      slice.translator.changeLanguage("es");
    }
  },
  sliceId: "buttonLanguage",
});

button2.classList.add("center-screen");

form.appendChild(button2);

const loading = await slice.build("Loading", {});
/*
const fetchManager = await slice.build("FetchManager", {
  baseUrl: "https://jsonplaceholder.typicode.com",
});

// Definimos una función para manejar el éxito de la solicitud
const handleSuccess = (data, response) => {
  console.log("Solicitud exitosa:", response);
};

// Definimos una función para manejar el error de la solicitud
const handleError = (data, response) => {
  console.error("Error en la solicitud:", response);
  console.error("Datos enviados:", data);
  hola();
};

// Realizamos una solicitud GET
fetchManager
  .request("GET", null, "/posts", handleSuccess, handleError)
  .then((responseData) => {
    console.log("Respuesta recibida:", responseData);
  })
  .catch((error) => {
    console.error("Error:", error);
  });
*/
const navBar = await slice.build("Navbar", {
  // direction: "reverse",
  logo: {
    src: "./Slice.js-logo.png",
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
<<<<<<< HEAD
      value: "Change Theme",
      // color:
      onClickCallback: hola,
=======
      value: "Sing in",
      onClickCallback: () => console.log("Navbar button"),
    },
    {
      value: "Log in",
      onClickCallback: () => console.log("Navbar button"),
>>>>>>> 7396563 (Navbar adds Buttons)
    },
  ],
});

document.body.insertBefore(navBar, document.body.firstChild);

const cardYoutube = await slice.build("Card", {
  title: "Youtube",
  text: "Plataforma para ver videos",
  icon: {
    name: "youtube",
    iconStyle: "filled",
  },
  customColor: {
    card: "red",
    icon: "white",
  },
  sliceId: "cardYoutube",
});

const cardTwitter = await slice.build("Card", {
  title: "Twitter",
  text: "Plataforma donde nada te nutre",
  icon: {
    name: "twitter",
    iconStyle: "filled",
  },
  customColor: {
    card: "#1DA1F2",
    icon: "white",
  },
  sliceId: "cardTwitter",
});

const cardFacebook = await slice.build("Card", {
  title: "Facebook",
  text: "Plataforma para responder en marketplace y vender 1 vez a la cuaresma",
  icon: {
    name: "facebook",
    iconStyle: "filled",
  },
  customColor: {
    card: "#1877F2",
    icon: "white",
  },
  sliceId: "cardFacebook",
});

const cardLinkedin = await slice.build("Card", {
  title: "Linkedin",
  text: "Plataforma para buscar trabajo",
  icon: {
    name: "linkedin",
    iconStyle: "filled",
  },
  customColor: {
    card: "#0A66C2",
    icon: "white",
  },
});

const cardGoogle = await slice.build("Card", {
  title: "Google",
  text: "Plataforma para buscar cosas",
  icon: {
    name: "google",
    iconStyle: "filled",
  },
  customColor: {
    card: "white",
    icon: "black",
  },
  sliceId: "cardGoogle",
});

const cardApple = await slice.build("Card", {
  title: "Apple",
  text: "Plataforma para comprar cosas caras",
  icon: {
    name: "apple",
    iconStyle: "filled",
  },
  customColor: {
    card: "black",
    icon: "white",
  },
});

const cardStackoverflow = await slice.build("Card", {
  title: "Stackoverflow",
  text: "Plataforma para preguntar cosas",
  icon: {
    name: "stackoverflow",
    iconStyle: "filled",
  },
  customColor: {
    card: "#F48024",
    icon: "white",
  },
});

const cardGithub = await slice.build("Card", {
  title: "Github",
  text: "Plataforma para compartir código",
  icon: {
    name: "github",
    iconStyle: "filled",
  },
  customColor: {
    card: "black",
    icon: "white",
  },
});

const cardDiscord = await slice.build("Card", {
  title: "Discord",
  text: "Plataforma para hablar con amigos y fumar porro y la tarea de Eli",
  icon: {
    name: "discord",
    iconStyle: "filled",
  },
  customColor: {
    card: "#5865F2",
    icon: "white",
  },
});

const cardHTML = await slice.build("Card", {
  title: "HTML",
  text: "Lenguaje de marcado",
  icon: {
    name: "html",
    iconStyle: "filled",
  },
  customColor: {
    card: "orange",
    icon: "white",
  },
});

const gridDiv = document.createElement("div");
gridDiv.style.display = "grid";
gridDiv.style.gridTemplateColumns = "repeat(5, 1fr)";
gridDiv.style.gap = "1rem";
gridDiv.style.padding = "1rem";
gridDiv.style.height = "600px";

gridDiv.appendChild(cardYoutube);
gridDiv.appendChild(cardTwitter);
gridDiv.appendChild(cardFacebook);
gridDiv.appendChild(cardLinkedin);
gridDiv.appendChild(cardGithub);
gridDiv.appendChild(cardGoogle);
gridDiv.appendChild(cardApple);
gridDiv.appendChild(cardStackoverflow);
gridDiv.appendChild(cardDiscord);
gridDiv.appendChild(cardHTML);

// document.body.appendChild(gridDiv);
