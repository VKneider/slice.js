/**
 * Manages theme CSS loading and persistence.
 */
export default class ThemeManager {
   constructor() {
      this.themeStyles = new Map();
      this.currentTheme = null;
      // In-flight loads, keyed by theme name, so concurrent applyTheme() calls for
      // the same theme share one fetch instead of racing and double-fetching.
      this._loadingThemes = new Map();
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

      // Already the active theme — nothing to re-inject.
      if (themeName === this.currentTheme) {
         return;
      }

      if (this.themeStyles.has(themeName)) {
         this.setThemeStyle(themeName);
         this.saveThemeLocally(themeName, this.themeStyles.get(themeName));
         return;
      }

      // Coalesce concurrent loads of the same theme into a single fetch.
      if (!this._loadingThemes.has(themeName)) {
         this._loadingThemes.set(
            themeName,
            this.loadThemeCSS(themeName).finally(() => this._loadingThemes.delete(themeName))
         );
      }
      await this._loadingThemes.get(themeName);
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
      // Expose the active theme on the root element so CSS can react per theme
      // without any JS — e.g. [data-slice-theme="Dark"] .logo { filter: ... }.
      // Non-breaking: apps opt in only if they reference the attribute.
      if (typeof document !== 'undefined' && document.documentElement) {
         document.documentElement.setAttribute('data-slice-theme', themeName);
      }
      slice.logger.logInfo('ThemeManager', `Theme ${themeName} applied`);
   }
}
