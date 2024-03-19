const boton = document.getElementById("boton");

let theme = "Light";

boton.innerHTML = "Cambiar al tema Dark";
boton.addEventListener("click", async () => {
  if (theme === "Slice") {
    await slice.stylesManager.setTheme("Light");
    theme = "Light";
    boton.innerHTML = "Cambiar al tema Dark";
  } else if (theme === "Light") {
    await slice.stylesManager.setTheme("Dark");
    theme = "Dark";
    boton.innerHTML = "Cambiar al tema Slice";
  } else if (theme === "Dark") {
    await slice.stylesManager.setTheme("Slice");
    theme = "Slice";
    boton.innerHTML = "Cambiar al tema Light";
  }
  // console.log(theme);
});

const tester = await slice.build("Tester", {
  id: "tester",
  sliceId: "tester",
  subject: "Hola",
  description: "Saludo",
});
//
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
  secret: true,
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

async function testSliceSwitch() {
  // console.log(sliceSwitch.checked);
  if (theme === "Dark") {
    await slice.stylesManager.setTheme("Light");
    theme = "Light";
    boton.innerHTML = "Cambiar al tema Dark";
  } else if (theme === "Light") {
    await slice.stylesManager.setTheme("Dark");
    theme = "Dark";
    boton.innerHTML = "Cambiar al tema Slice";
  }
}

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
  ],
  visibleProp: "value",
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
  value: "Color",
  customColor: "red",
  onClickCallback: () => {
    if(slice.translator.currentLanguage === "es"){
      slice.translator.changeLanguage("en");
    }else{
      slice.translator.changeLanguage("es");
    }
  },
});

form.appendChild(button2);

const botonName = document.getElementById("botonName");
const botonClear = document.getElementById("botonClear");

botonName.addEventListener("click", () => {
  console.log(confirmPassword.getValue());
});

botonClear.addEventListener("click", () => {
  if (password.value !== confirmPassword.value) {
    password.triggerError();
    confirmPassword.triggerError();
  } else {
    password.triggerSuccess();
    confirmPassword.triggerSuccess();
  }
  // name1.clear();
  // lastname.clear();
  // password.clear();
});

const icon = await slice.build("Icon", {
  name: "twitter",
  size: "200px",
  color: "yellow",
});

const icon2 = await slice.build("Icon", {
  name: "anchor",
  size: "50px",
  color: "blue",
});

const icon3 = await slice.build("Icon", {
  name: "github",
  size: "100px",
  color: "green",
});

document.body.appendChild(icon);
document.body.appendChild(icon2);
document.body.appendChild(icon3);
