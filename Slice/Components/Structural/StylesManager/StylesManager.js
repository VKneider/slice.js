import ThemeManager from "./ThemeManager/ThemeManager.js";

export default class StylesManager {
  constructor() {
    this.componentStyles = document.createElement("style");
    this.componentStyles.id = "slice-component-styles";
    document.head.appendChild(this.componentStyles);

    this.themeManager = new ThemeManager();
  }

  async init() {
    const sliceStyles = await slice.controller.fetchText(
      "sliceStyles",
      "styles"
    );
    this.componentStyles.innerText += sliceStyles;
    slice.logger.logInfo("StylesManager", "sliceStyles loaded");

    let theme = slice.themeConfig.defaultTheme;

    if(slice.themeConfig.saveThemeLocally){
      theme = localStorage.getItem("sliceTheme");
      if(!theme){
        theme = slice.themeConfig.defaultTheme;
      }
    }

    if(slice.themeConfig.useBrowserTheme){
      const browserTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? "Dark" : "Light";
      theme = browserTheme;
    }

    await slice.setTheme(theme);

  }

  //add a method that will add css as text to the componentStyles element
  appendComponentStyles(cssText) {
    this.componentStyles.appendChild(document.createTextNode(cssText));
  }

  registerComponentStyles(componentName, cssText) {
    slice.controller.requestedStyles.add(componentName);
    this.appendComponentStyles(cssText);
  }
}
