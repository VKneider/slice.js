/**
 * Manages theme CSS loading and persistence.
 */
export default class ThemeManager {
   constructor() {
      this.themeStyles = new Map();
      this.currentTheme = null;
      this.themeStyle = document.createElement('style');
      document.head.appendChild(this.themeStyle);
   }

   /**
    * Apply a theme by name.
    * @param {string} themeName
    * @returns {Promise<void>}
    */
   async applyTheme(themeName) {
      if (!themeName) {
         slice.logger.logError('ThemeManager', 'Invalid theme name');
         return;
      }

      if (!this.themeStyles.has(themeName)) {
         await this.loadThemeCSS(themeName);
      } else {
         this.setThemeStyle(themeName);
         this.saveThemeLocally(themeName, this.themeStyles.get(themeName));
      }
   }

   /**
    * Load theme CSS and cache it.
    * @param {string} themeName
    * @returns {Promise<void>}
    */
   async loadThemeCSS(themeName) {
      let themeContent =
         localStorage.getItem(`sliceTheme-${themeName}`) || (await slice.controller.fetchText(themeName, 'theme'));

      if (!themeContent) {
         slice.logger.logError('ThemeManager', `Failed to load theme: ${themeName}`);
         return;
      }

      this.themeStyles.set(themeName, themeContent);
      this.setThemeStyle(themeName);
      this.saveThemeLocally(themeName, themeContent);
   }

   /**
    * Persist a theme in localStorage when enabled.
    * @param {string} themeName
    * @param {string} themeContent
    * @returns {void}
    */
   saveThemeLocally(themeName, themeContent) {
      if (slice.themeConfig.saveThemeLocally) {
         localStorage.setItem('sliceTheme', themeName);
         localStorage.setItem(`sliceTheme-${themeName}`, themeContent);
         slice.logger.logInfo('ThemeManager', `Theme ${themeName} saved locally`);
      }
   }

   /**
    * Clear currently applied theme styles.
    * @returns {void}
    */
   removeCurrentTheme() {
      if (this.currentTheme) {
         this.themeStyle.textContent = '';
      }
   }

   /**
    * Set theme style text and mark current theme.
    * @param {string} themeName
    * @returns {void}
    */
   setThemeStyle(themeName) {
      this.themeStyle.textContent = this.themeStyles.get(themeName);
      this.currentTheme = themeName;
      slice.logger.logInfo('ThemeManager', `Theme ${themeName} applied`);
   }
}
