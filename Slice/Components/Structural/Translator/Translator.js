export default class Translator {

    constructor() {
            this.messages={
                "en":{
                    "Testerm":{
                        "subject":"Democracy",
                        "description":"Democracy is a form of government in which the people have the authority to choose their governing legislation. Who people are and how authority is shared among them are core issues for democratic theory, development and constitution. Some cornerstones of these issues are freedom of assembly and speech, inclusiveness and equality, membership, consent, voting, right to life and minority rights."
                    }
        
                },
                "es":{
                    "Testerm":{
                        "subject":"Democracia",
                        "description":"La democracia es una forma de gobierno en la que el pueblo tiene la autoridad para elegir su legislación gubernamental. Quiénes son las personas y cómo se comparte la autoridad entre ellas son cuestiones fundamentales para la teoría, el desarrollo y la constitución democráticos. Algunos pilares de estos problemas son la libertad de reunión y expresión, la inclusión y la igualdad, la membresía, el consentimiento, el voto, el derecho a la vida y los derechos de las minorías."
                    }
                }
            }
        this.currentLanguage = 'en'; // Idioma predeterminado
        }
  
    
    changeLanguage(newLanguage) {
      this.currentLanguage = newLanguage;
      return this.setPropertiesForComponents();
    }
  
  
   
    setPropertiesForComponents() {
        try {
            const currentLanguageMessages = this.messages[this.currentLanguage];
    
        for (const componentName in currentLanguageMessages) {
          const component = slice.controller.components.get(componentName);
          const translations = currentLanguageMessages[componentName];
    
          if (component) {
            // Establecer propiedades en el componente
            for (const prop in translations) {
              component.setAttribute(prop, translations[prop])
            }
          }

        }

            return true
        } catch (error) {
            console.log(error)
        }
        
      }

  }




  