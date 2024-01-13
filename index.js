const tester = await slice.build("Tester", {
  id: "tester",
  sliceId: "tester",
  subject: "Hola",
  description: "Saludo",
});

const name1 = await slice.build("Input", {
  id: "nombre",
  placeholder: "Name",
  required: true,
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

const form = document.getElementById("form");

form.appendChild(name1);
form.appendChild(lastname);
form.appendChild(password);

const boton = document.getElementById("boton");

boton.innerHTML = "Cambiar al tema Light";

let theme = "Slice";

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

const botonName = document.getElementById("botonName");
const botonClear = document.getElementById("botonClear");

botonName.addEventListener("click", () => {
  console.log(name1.getValue());
  console.log(lastname.getValue());
});
botonClear.addEventListener("click", () => {
  name1.clear();
  lastname.clear();
  password.clear();
});
