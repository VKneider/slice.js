
export default class StylesManager {
   constructor() {
      this.componentStyles = document.createElement('style');
      this.componentStyles.id = 'slice-component-styles';
      document.head.appendChild(this.componentStyles);

   }

   /**
    * Load global styles and initialize ThemeManager if enabled.
    * @returns {Promise<void>}
   */
   async init() {
      const requestedStyles = Array.isArray(slice.stylesConfig.requestedStyles)
         ? slice.stylesConfig.requestedStyles
         : [];

      const styleResults = await Promise.all(
         requestedStyles.map(async (styleName) => {
            const styles = await slice.controller.fetchText(styleName, 'styles');
            return { styleName, styles };
         })
      );

      for (const { styleName, styles } of styleResults) {
         this.appendComponentStyles(styles);
         slice.logger.logInfo('StylesManager', `${styleName} styles loaded`);
      }

       if (slice.themeConfig.enabled) {
          const ThemeManagerClass = slice.frameworkClasses?.ThemeManager
             || await slice.getClass(`${slice.paths.structuralComponentFolderPath}/StylesManager/ThemeManager/ThemeManager.js`);
          if (!ThemeManagerClass) {
             throw new Error('ThemeManager not available');
          }

          this.themeManager = new ThemeManagerClass();
         let theme;

         if (slice.themeConfig.saveThemeLocally) {
            theme = localStorage.getItem('sliceTheme');
         }

         if (!theme) {
            theme = slice.themeConfig.defaultTheme;
         }

         if (slice.themeConfig.useBrowserTheme) {
            const browserTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light';
            theme = browserTheme;
         }

         await this.themeManager.applyTheme(theme);
      }
   }

   //add a method that will add css as text to the componentStyles element
   /**
    * Append raw CSS to the global component style tag.
    * @param {string} cssText
    * @returns {void}
    */
   appendComponentStyles(cssText) {
      this.componentStyles.appendChild(document.createTextNode(cssText));
   }

   /**
    * Register CSS for a component.
    * @param {string} componentName
    * @param {string} cssText
    * @returns {void}
    */
   registerComponentStyles(componentName, cssText) {
      slice.controller.requestedStyles.add(componentName);
      this.appendComponentStyles(cssText);
   }
}
