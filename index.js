const tester = await slice.build("Tester", {
    id: "tester",
    sliceId: "tester",
    subject: "Este es el subject de un componente Tester",
    description: "Este es el description de un componente Tester"
})

const tester2 = await slice.build("Tester", {
    id: "tester2",
    sliceId: "tester2",
    subject: "HOLA profe"
})


let theme = "Slice";


const boton = document.getElementById("boton");
boton.innerHTML = "Cambiar al tema Dark";
boton.addEventListener("click", async () => {
    
    if(theme==="Slice"){
        await slice.stylesManager.setTheme("Dark");
        theme = "Dark";
        boton.innerHTML = "Cambiar al tema Slice";
    }else {

        await slice.stylesManager.setTheme("Slice");
        theme = "Slice";
        boton.innerHTML = "Cambiar al tema Dark";
    }
})
document.body.appendChild(tester);
document.body.appendChild(tester2);

