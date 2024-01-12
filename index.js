const tester2 = await slice.build("Tester", {
    id: "tester2",
    sliceId: "tester2",
    subject: "HOLA profe"
})

const tester3 = await slice.build("Tester2", {
    id: "tester3",
    sliceId: "tester3",
    subject: "HOLA profe",
    children:true
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
document.body.appendChild(tester3);


