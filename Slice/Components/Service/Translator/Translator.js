export default class Translator {

    constructor() {
            this.messages={
                "en":{
        
                    "myInput":{
                        "placeholder":"Type here"
                    }
        
                },
                "es":{
                   
                    "myInput":{
                        "placeholder":"Escribe aquí"
                    }
                }
            }
        this.currentLanguage = 'en'; 
        }
  
    
    changeLanguage(newLanguage) {
      this.currentLanguage = newLanguage;
      return this.setPropertiesForComponents();
    }
  
  
   
    setPropertiesForComponents() {
        try {
            const currentLanguageMessages = this.messages[this.currentLanguage];
    
        for (const componentName in currentLanguageMessages) {
          const component = slice.controller.activeComponents.get(componentName);
          const translations = currentLanguageMessages[componentName];
          if (component) {
            for (const prop in translations) {
             component[prop] = translations[prop];
            }
          }else {
            console.error(`Component ${componentName} not found`);
          }

        }

            return true
        } catch (error) {
            console.log(error)
        }
        
      }

  }




  