const tester = await slice.build("Tester", { id: "tester", sliceId: "tester", subject: "Este es el subject de un componente Tester", description: "Este es el description de un componente Tester" })

const tester2 = await slice.build("Tester", { id: "tester2", sliceId: "tester2", subject: "HOLA profe" })


document.body.appendChild(tester);
document.body.appendChild(tester2);

document.body.appendChild(slice.debugger) 