import messages from "./messages.json" with { type: "json" };

export default class Translator {

  constructor() {
    this.messages = messages;
    this.currentLanguage = 'en';

    if (slice.translator) {
      throw new Error("Translator already initialized")
    } else {
      slice.translator = this;
    }
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
        } else {
          console.error(`Component ${componentName} not found`);
        }

      }

      return true
    } catch (error) {
      console.log(error)
    }

  }

  setMessages(messagesObject) {
    this.messages = messagesObject;
  }



}




