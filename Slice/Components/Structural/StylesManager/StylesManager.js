import CustomStylesManager from "./CustomStylesManager/CustomStylesManager.js"
import ThemeManager from "./ThemeManager/ThemeManager.js"

export default class StylesManager {
    constructor() {
      this.customStylesManager = new CustomStylesManager();
      this.themeManager = new ThemeManager();
    }  

    handleInstanceStyles(instance, props) {
      if(props.customCSS){
        this.customStylesManager.proccess(instance, props); 
      }
    }

    setTheme(themeName){
      this.themeManager.setTheme(themeName);
    }


  }
  
