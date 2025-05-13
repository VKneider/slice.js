export default class TheBuildMethod extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async init() {
      // Crear ejemplos de código para la documentación
      const basicBuildExample = await slice.build('CodeVisualizer', {
         value: `// Construir un componente básico
const myButton = await slice.build("Button", {
   value: "Click me!"
});

// Añadir el componente al DOM
document.querySelector("#container").appendChild(myButton);`,
         language: 'javascript'
      });

      const advancedBuildExample = await slice.build('CodeVisualizer', {
         value: `// Componente con propiedades más avanzadas
const customCard = await slice.build("Card", {
   title: "Custom Card",
   text: "This is a custom card with specific styling",
   icon: {
      name: "github",
      iconStyle: "filled"
   },
   customColor: {
      card: "#3a0ca3",
      icon: "#f72585"
   },
   sliceId: "my-custom-card" // ID personalizado para referencia futura
});`,
         language: 'javascript'
      });

      const nestedComponentsExample = await slice.build('CodeVisualizer', {
         value: `// Construcción de componentes anidados
const grid = await slice.build("Grid", { 
   columns: 2, 
   rows: 1 
});

// Construir componentes hijos
const card1 = await slice.build("Card", { 
   title: "First Card" 
});
const card2 = await slice.build("Card", { 
   title: "Second Card" 
});

// Añadir componentes hijos al grid
await grid.setItem(card1);
await grid.setItem(card2);

// Añadir el grid al DOM
document.body.appendChild(grid);`,
         language: 'javascript'
      });

      const errorHandlingExample = await slice.build('CodeVisualizer', {
         value: `// Manejo de errores al construir componentes
try {
   const component = await slice.build("NonExistentComponent", {});
   if (!component) {
      console.error("Component could not be built");
   }
} catch (error) {
   console.error("Error building component:", error);
}`,
         language: 'javascript'
      });

      // Añadir los ejemplos al DOM
      this.querySelector('.basic-example-container').appendChild(basicBuildExample);
      this.querySelector('.advanced-example-container').appendChild(advancedBuildExample);
      this.querySelector('.nested-components-container').appendChild(nestedComponentsExample);
      this.querySelector('.error-handling-container').appendChild(errorHandlingExample);
   }
}

customElements.define('slice-the-build-method', TheBuildMethod);