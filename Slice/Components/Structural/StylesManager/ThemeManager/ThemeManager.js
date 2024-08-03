export default class ThemeManager {
  constructor() {
    this.themeStyles = new Map();
    this.currentTheme = null;
    this.themeStyle = document.createElement('style');
    document.head.appendChild(this.themeStyle);
  }

  async applyTheme(themeName) {
    if (!themeName) {
      slice.logger.logError("ThemeManager", "Invalid theme name");
      return;
    }

    if (!this.themeStyles.has(themeName)) {
      await this.loadThemeCSS(themeName);
    } else {
      this.setThemeStyle(themeName);
      this.saveThemeLocally(themeName, this.themeStyles.get(themeName));
    }
  }

  async loadThemeCSS(themeName) {
    let themeContent = localStorage.getItem(`sliceTheme-${themeName}`) || await slice.controller.fetchText(themeName, "theme");

    if (!themeContent) {
      slice.logger.logError("ThemeManager", `Failed to load theme: ${themeName}`);
      return;
    }

    this.themeStyles.set(themeName, themeContent);
    this.setThemeStyle(themeName);
    this.saveThemeLocally(themeName, themeContent);
  }

  saveThemeLocally(themeName, themeContent) {
    if (slice.themeConfig.saveThemeLocally) {
      localStorage.setItem("sliceTheme", themeName);
      localStorage.setItem(`sliceTheme-${themeName}`, themeContent);
      slice.logger.logInfo("ThemeManager", `Theme ${themeName} saved locally`);
    }
  }

  removeCurrentTheme() {
    if (this.currentTheme) {
      this.themeStyle.textContent = '';
    }
  }

  setThemeStyle(themeName) {
    this.themeStyle.textContent = this.themeStyles.get(themeName);
    this.currentTheme = themeName;
    slice.logger.logInfo("ThemeManager", `Theme ${themeName} applied`);
  }
}
