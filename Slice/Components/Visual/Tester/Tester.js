export default class Tester extends HTMLElement {
  
  constructor(props) {
    super(); 
    slice.attachTemplate(this)
  
    for (const prop in props) {
      this.setAttribute(prop, props[prop])
    }
    
  }


  static observedAttributes = ['subject', 'description'];

   attributeChangedCallback(attributeName, oldValue, newValue){
     if(Tester.observedAttributes.includes(attributeName)){

       switch(attributeName){
         case 'subject':
           this.querySelector(".slice_tester_subject").textContent=newValue;
           
            break;

          case 'description':
            this.querySelector(".slice_tester_description").textContent=newValue;
            break;
        }
      }
   }
}

customElements.define("slice-tester", Tester);
