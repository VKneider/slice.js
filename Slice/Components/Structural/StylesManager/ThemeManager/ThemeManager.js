export default class ThemeManager {
  constructor() {
    this.themeStyles = new Map();
    this.currentThemeStyle = null;
  }

  async applyTheme(themeName) {
      if (!this.themeStyles.has(themeName)) {
          this.removeCurrentTheme();
          await this.loadThemeCSS(themeName);        
      } else {
          this.setThemeStyle(themeName);
      }
  }
  
  removeCurrentTheme() {
    if (this.currentThemeStyle) {
      this.currentThemeStyle.parentNode.removeChild(this.currentThemeStyle);
    }
  }

  async loadThemeCSS( themeName) {

    const themeCss = await slice.controller.fetchText(themeName, "theme");
    this.themeStyles.set(themeName, themeCss);
    this.setThemeStyle(themeName);
    
  }

  setThemeStyle(themeName) {
      const themeStyle = document.createElement('style');
      themeStyle.textContent = this.themeStyles.get(themeName);
      document.head.appendChild(themeStyle);
      this.currentThemeStyle = themeStyle;
  }

  
}

