export default class ThemeManager {
  constructor() {
    this.themeStyles = new Map();
    this.currentTheme = null;
    this.themeStyle = document.createElement('style');
    document.head.appendChild(this.themeStyle);
  }

  async applyTheme(themeName) {
    if (!this.themeStyles.has(themeName)) {
      await this.loadThemeCSS(themeName);
    } else {
      this.setThemeStyle(themeName);
    }
  }

  async loadThemeCSS(themeName) {
    const themeCss = await slice.controller.fetchText(themeName, "theme");
    this.themeStyles.set(themeName, themeCss);
    this.removeCurrentTheme(); // Elimina el estilo del tema anterior si existe
    this.setThemeStyle(themeName);
  }

  removeCurrentTheme() {
    if (this.currentTheme) {
      this.themeStyle.textContent = '';
    }
  }

  setThemeStyle(themeName) {
    this.themeStyle.textContent = this.themeStyles.get(themeName);
    this.currentTheme = themeName;
  }
}
