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
      this._syncThemeColor();
      slice.logger.logInfo('ThemeManager', `Theme ${themeName} applied`);
   }

   /**
    * Sync <meta name="theme-color"> to the theme's primary background color.
    * Reads the CSS variable --primary-background-color from computed styles.
    * @returns {void}
    */
   /**
    * Sync <meta name="theme-color"> and <meta name="color-scheme">
    * from --primary-background-color (the active theme's body bg).
    * @returns {void}
    */
   _syncThemeColor() {
      if (typeof document === 'undefined') return;
      const bg = getComputedStyle(document.documentElement)
         .getPropertyValue('--primary-background-color').trim();
      if (!bg) return;

      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
         meta = document.createElement('meta');
         meta.name = 'theme-color';
         document.head.appendChild(meta);
      }
      meta.content = bg;

      const scheme = this._isLightColor(bg) ? 'light' : 'dark';
      let cs = document.querySelector('meta[name="color-scheme"]');
      if (!cs) {
         cs = document.createElement('meta');
         cs.name = 'color-scheme';
         document.head.appendChild(cs);
      }
      cs.content = scheme;
   }

   /**
    * Rough luminance check for a hex color.
    * Returns true when the color is perceived as light.
    * @param {string} color hex (#fff / #282828)
    * @returns {boolean}
    */
   _isLightColor(color) {
      const hex = color.replace('#', '');
      let r, g, b;
      if (hex.length <= 3) {
         r = parseInt(hex[0] + hex[0], 16);
         g = parseInt(hex[1] + hex[1], 16);
         b = parseInt(hex[2] + hex[2], 16);
      } else {
         r = parseInt(hex.slice(0, 2), 16);
         g = parseInt(hex.slice(2, 4), 16);
         b = parseInt(hex.slice(4, 6), 16);
      }
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
   }
}
