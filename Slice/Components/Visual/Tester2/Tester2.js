export default class Tester2 extends HTMLElement {
  
  constructor(props) {
    super(); 
    slice.attachTemplate(this)

    for (const prop in props) {
      this.setAttribute(prop, props[prop])
    }
     
    
  }
  
  static observedAttributes = ['subject', 'description', "children"];

   async attributeChangedCallback(attributeName, oldValue, newValue){
     if(Tester2.observedAttributes.includes(attributeName)){

       switch(attributeName){
         case 'subject':
           this.querySelector(".slice_tester2_subject").textContent=newValue;
           
            break;

          case 'description':
            this.querySelector(".slice_tester2_description").textContent=newValue;
            break;

          case 'children':
            
            let newTester = await slice.build("Tester", {id: "testers", sliceId: "tester3",  subject: "Este es el subject de un componente Tester", description: "Este es el description de un componente Tester"})
            this.appendChild(newTester);
            break;
        }
      }
   }
}

customElements.define("slice-tester2", Tester2);
