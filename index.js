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
  value: "Graterol",
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
    // minLength: 8,
    // maxLength: 10,
    // minMinusc: 1,
    // maxMinusc: 4,
    // minMayusc: 1,
    // maxMayusc: 6,
    // minNumber: 1,
    // maxNumber: 6,
    // minSymbol: 1,
    // maxSymbol: 10,
  },
});

const translator = await slice.build("Translator", {});
console.log(translator);

function testSliceButton() {
  if (translator.currentLanguage === "es") {
    translator.changeLanguage("en");
  } else {
    translator.changeLanguage("es");
  }
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
  onClickCallback: testSliceButton, // Just the function name without calling it
});

const form = document.getElementById("form");

form.appendChild(name1);
form.appendChild(lastname);
form.appendChild(password);
form.appendChild(confirmPassword);
form.appendChild(dateInput);
form.appendChild(ageInput);
form.appendChild(button);

const botonName = document.getElementById("botonName");
const botonClear = document.getElementById("botonClear");

botonName.addEventListener("click", () => {
  console.log(confirmPassword.getValue());
});
botonClear.addEventListener("click", () => {
  if (password.getValue() !== confirmPassword.getValue()) {
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
